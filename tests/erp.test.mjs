import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";

// Uses a separate disposable database and a production server; run after pnpm build.
test("ERP authentication, persistence, attendance, remote work and payroll", { timeout: 90000 }, async t => {
  const filename = `data/test-${randomUUID()}.db`;
  await mkdir("data", { recursive: true });
  const port = 32000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  let server;
  let logs = "";
  async function start(demo) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: process.cwd(), windowsHide: true,
      env: { ...process.env, ERP_DATABASE_URL: `file:${filename}`, ERP_DEMO_PASSWORD: "hams1234!", ERP_ENABLE_DEMO_LOGIN: demo ? "true" : "false" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let spawnError;
    server.on("error", e => { spawnError = e; });
    server.stdout.on("data", d => { logs += d; });
    server.stderr.on("data", d => { logs += d; });
    for (let i = 0; i < 100; i++) {
      if (spawnError) throw spawnError;
      if (server.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(base)).ok) return; } catch { /* waiting for server */ }
      await pause(200);
    }
    throw new Error(`Server did not start: ${logs}`);
  }
  async function stop() {
    if (!server || server.exitCode !== null) return;
    const exited = new Promise(resolve => server.once("exit", resolve));
    server.kill(); await exited;
  }
  async function get(cookie = "") {
    const r = await fetch(`${base}/api/erp`, { headers: { cookie } });
    return { status: r.status, body: await r.json() };
  }
  async function post(body, cookie = "", origin = base) {
    const r = await fetch(`${base}/api/erp`, { method: "POST", headers: { "Content-Type": "application/json", cookie, origin }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  }
  let admin, member, partner;
  try {
    await start(true);
    await t.test("requires login, checks passwords, rejects cross-origin writes", async () => {
      assert.equal((await get()).status, 401);
      const wrong = await post({ action: "login", email: "admin@hams.demo", password: "wrong" });
      assert.equal(wrong.status, 401, JSON.stringify(wrong.body));
      assert.equal((await post({ action: "login", email: "admin@hams.demo", password: "hams1234!" }, "", "https://untrusted.example")).status, 403);
      for (const email of ["admin@hams.demo", "member@hams.demo", "partner@hams.demo"]) {
        const r = await post({ action: "login", email, password: "hams1234!" });
        assert.equal(r.status, 200); assert.ok(r.cookie);
        if (email.startsWith("admin")) admin = r.cookie;
        else if (email.startsWith("member")) member = r.cookie;
        else partner = r.cookie;
      }
      assert.equal((await get(admin)).body.employees.length, 6);
      assert.deepEqual((await get(member)).body.employees.map(e => e.id), ["member"]);
      assert.equal((await get(partner)).body.user.kind, "프리랜서");
    });
    await t.test("employee registration and editing require admin and validate data", async () => {
      const employee = { action: "employee-save", name: "테스트 직원", email: "new@example.test", department: "개발팀", position: "개발자", kind: "직원", project: "ERP 테스트", joined: "2026-01-01", salary: 3000000 };
      assert.equal((await post(employee, member)).status, 403);
      assert.equal((await post({ ...employee, joined: "2026-02-31" }, admin)).status, 400);
      assert.equal((await post(employee, admin)).status, 200);
      assert.equal((await post(employee, admin)).status, 409);
      const person = (await get(admin)).body.employees.find(e => e.email === employee.email);
      assert.ok(person);
      assert.equal((await post({ ...employee, id: person.id, project: "프로젝트 변경" }, admin)).status, 200);
      assert.equal((await get(admin)).body.employees.find(e => e.id === person.id).project, "프로젝트 변경");
    });
    await t.test("remote work requires remote check-in and explicit consent", async () => {
      assert.equal((await post({ action: "remote-start", task: "개발", consent: true }, member)).status, 400);
      const attempts = await Promise.all([post({ action: "checkin", mode: "원격" }, member), post({ action: "checkin", mode: "원격" }, member)]);
      assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
      assert.equal((await post({ action: "remote-start", task: "개발", consent: false }, member)).status, 400);
      assert.equal((await post({ action: "remote-start", task: "주문 화면 개발", consent: true }, member)).status, 200);
      assert.equal((await post({ action: "heartbeat", visible: false, active: false }, member)).status, 200);
      const state = (await get(admin)).body;
      assert.equal(state.attendance.filter(a => a.employee_id === "member").length, 1);
      assert.equal(state.remote.find(r => r.employee_id === "member").visible, 0);
      assert.equal(state.remote.find(r => r.employee_id === "member").task, "주문 화면 개발");
      assert.equal((await get(partner)).body.remote.length, 0);
    });
    await t.test("checkout persists and stops remote sharing", async () => {
      assert.equal((await post({ action: "checkout" }, member)).status, 200);
      const state = (await get(member)).body;
      assert.ok(state.attendance[0].check_out);
      assert.ok(state.remote[0].ended_at);
      assert.equal((await post({ action: "checkout" }, member)).status, 409);
      assert.equal((await post({ action: "checkin", mode: "사무실" }, member)).status, 409);
      assert.equal((await post({ action: "heartbeat", visible: true, active: true }, member)).status, 200);
      assert.ok((await get(member)).body.remote[0].ended_at);
    });
    await t.test("payroll is idempotent, admin-only, editable and scoped to each member", async () => {
      assert.equal((await post({ action: "payroll-generate", month: "2026-10" }, member)).status, 403);
      assert.equal((await post({ action: "payroll-generate", month: "2026-13" }, admin)).status, 400);
      assert.equal((await post({ action: "payroll-generate", month: "2026-10" }, admin)).status, 200);
      const rows = (await get(admin)).body.payroll;
      assert.equal(rows.length, 7);
      const target = rows.find(p => p.employee_id === "member");
      const edit = { action: "payroll-save", id: target.id, adjustment: 100000, deduction: 50000, status: "검토 완료" };
      assert.equal((await post(edit, member)).status, 403);
      assert.equal((await post({ ...edit, deduction: 999999999 }, admin)).status, 400);
      assert.equal((await post(edit, admin)).status, 200);
      assert.equal((await post({ action: "payroll-generate", month: "2026-10" }, admin)).status, 200);
      const updated = (await get(member)).body.payroll;
      assert.equal(updated.length, 1); assert.equal(updated[0].adjustment, 100000); assert.equal(updated[0].status, "검토 완료");
      assert.equal((await get(admin)).body.payroll.length, 7);
    });
    await t.test("database survives restart and production demo login defaults to disabled", async () => {
      await stop(); await start(false);
      assert.equal((await get(admin)).body.employees.length, 7);
      assert.ok((await get(member)).body.attendance[0].check_out);
      assert.equal((await get(member)).body.payroll[0].adjustment, 100000);
      assert.equal((await post({ action: "login", email: "admin@hams.demo", password: "hams1234!" })).status, 403);
    });
    await t.test("logout invalidates the server-side session", async () => {
      assert.equal((await post({ action: "logout" }, member)).status, 200);
      assert.equal((await get(member)).status, 401);
      assert.equal((await get(admin)).status, 200);
    });
  } finally {
    await stop();
    for (const suffix of ["", "-wal", "-shm"]) await rm(filename + suffix, { force: true });
  }
});
