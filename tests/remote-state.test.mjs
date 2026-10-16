import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../utils/index.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { remoteState } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const now = Date.parse("2026-10-17T12:00:00Z");
const remote = { ended_at: null, heartbeat: new Date(now).toISOString(), last_active: "2000-01-01T00:00:00Z", visible: 0, user_state: "active", screen_state: "unlocked" };

test("a minimized tab and old page activity do not imply device inactivity", () => {
  assert.equal(remoteState(remote, now), "활동 중");
});
test("device idle or screen lock implies away", () => {
  assert.equal(remoteState({ ...remote, user_state: "idle" }, now), "자리 비움");
  assert.equal(remoteState({ ...remote, screen_state: "locked" }, now), "자리 비움");
});
test("unsupported, denied and legacy reports never imply activity or absence", () => {
  assert.equal(remoteState({ ...remote, user_state: "unknown" }, now), "자동 판정 불가");
  assert.equal(remoteState({ ...remote, screen_state: "unknown" }, now), "자동 판정 불가");
  assert.equal(remoteState({ ...remote, user_state: undefined, screen_state: undefined }, now), "자동 판정 불가");
});
test("connection grace is three minutes and takes precedence over absence", () => {
  assert.equal(remoteState(remote, now + 180000), "활동 중");
  assert.equal(remoteState(remote, now + 180001), "연결 확인 필요");
  assert.equal(remoteState({ ...remote, user_state: "idle" }, now + 180001), "연결 확인 필요");
});
test("ended or missing sharing always takes precedence", () => {
  assert.equal(remoteState(undefined, now), "공유 안 함");
  assert.equal(remoteState({ ...remote, ended_at: "2026-10-17T11:00:00Z" }, now + 180001), "공유 안 함");
});
