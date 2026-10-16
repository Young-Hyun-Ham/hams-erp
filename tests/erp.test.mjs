import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";

// Uses a separate disposable database and a production server; run after pnpm build.
test("ERP authentication, persistence, attendance, remote work and payroll", { timeout: 90000 }, async t => {
  const filename = `data/test-${randomUUID()}.db`;
  await mkdir("data", { recursive: true });
  function inspectDatabase(script) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import { createClient } from '@libsql/client'; const db=createClient({url:process.env.TEST_DB_URL}); try { ${script} } finally { db.close(); }`], {
      cwd: process.cwd(), windowsHide: true, encoding: "utf8", env: { ...process.env, TEST_DB_URL: `file:${filename}` },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  // Start with the pre-password schema to exercise the non-destructive upgrade.
  inspectDatabase(`
    await db.execute('CREATE TABLE employees (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,department TEXT NOT NULL,position TEXT NOT NULL,kind TEXT NOT NULL,project TEXT NOT NULL,joined TEXT NOT NULL,role TEXT NOT NULL,salary INTEGER NOT NULL)');
    await db.execute({sql:'INSERT INTO employees VALUES (?,?,?,?,?,?,?,?,?,?)',args:['member','기존 구성원','member@hams.demo','개발팀','개발자','직원','기존 프로젝트','2024-01-15','member',4800000]});
    await db.execute('CREATE TABLE sessions (token TEXT PRIMARY KEY,employee_id TEXT NOT NULL,expires INTEGER NOT NULL)');
    await db.execute('CREATE TABLE remote (employee_id TEXT PRIMARY KEY,started_at TEXT NOT NULL,ended_at TEXT,heartbeat TEXT NOT NULL,last_active TEXT NOT NULL,visible INTEGER NOT NULL,task TEXT NOT NULL)');
    await db.execute({sql:'INSERT INTO remote VALUES (?,?,?,?,?,?,?)',args:['admin','2026-01-01T00:00:00Z','2026-01-01T01:00:00Z','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z',0,'기존 종료된 공유']});
    await db.execute({sql:'INSERT INTO sessions VALUES (?,?,?)',args:['legacy-token-hash','member',Date.now()+100000]});
  `);
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
      assert.equal((await get(admin)).body.user.must_change_password, 1);
      assert.equal((await post({ action: "remote-settings-save", idleMinutes: 7 }, admin)).status, 403);
      assert.deepEqual((await get(admin)).body.employees, []);
      assert.equal((await post({ action: "checkin", mode: "원격" }, member)).status, 403);
      assert.equal((await post({ action: "profile-save", name: "변경", department: "팀", position: "직무" }, member)).status, 403);
      const duplicateSession = await post({ action: "login", email: "admin@hams.demo", password: "hams1234!" });
      for (const [email, cookie] of [["admin@hams.demo", admin], ["member@hams.demo", member], ["partner@hams.demo", partner]]) {
        const change = { action: "password-change", currentPassword: "hams1234!", newPassword: "Changed-password-2026!", confirmPassword: "Changed-password-2026!" };
        assert.equal((await post({ ...change, currentPassword: "wrong" }, cookie)).status, 401);
        assert.equal((await post({ ...change, confirmPassword: "mismatch" }, cookie)).status, 400);
        assert.equal((await post({ ...change, newPassword: "hams1234!", confirmPassword: "hams1234!" }, cookie)).status, 400);
        const changed = await post(change, cookie);
        assert.equal(changed.status, 200, JSON.stringify(changed.body));
        assert.ok(changed.cookie);
        assert.equal((await get(cookie)).status, 401);
        if (email.startsWith("admin")) admin = changed.cookie;
        else if (email.startsWith("member")) member = changed.cookie;
        else partner = changed.cookie;
        assert.equal((await post({ action: "login", email, password: "hams1234!" })).status, 401);
        assert.equal((await post({ action: "login", email, password: "Changed-password-2026!" })).status, 200);
      }
      assert.equal((await get(duplicateSession.cookie)).status, 401);
      const snapshot = (await get(admin)).body;
      assert.equal(snapshot.employees.length, 6);
      assert.equal(snapshot.user.must_change_password, 0);
      assert.equal(snapshot.remote.find(r => r.employee_id === "admin").user_state, "unknown");
      assert.equal(snapshot.remote.find(r => r.employee_id === "admin").task, "기존 종료된 공유");
      assert.ok(!JSON.stringify(snapshot).includes("password_hash"));
      assert.ok(!JSON.stringify(snapshot).includes("scrypt$"));
      assert.deepEqual((await get(member)).body.employees.map(e => e.id), ["member"]);
      assert.equal((await get(partner)).body.user.kind, "프리랜서");
      assert.equal((await get(member)).body.user.name, "기존 구성원");
      assert.equal(inspectDatabase(`
        const people=await db.execute('SELECT password_hash FROM employees');
        const valid=people.rows.every(r=>typeof r.password_hash==='string' && r.password_hash.startsWith('scrypt$32768$8$3$'));
        const unique=new Set(people.rows.map(r=>r.password_hash)).size===people.rows.length;
        const legacy=await db.execute("SELECT token FROM sessions WHERE token='legacy-token-hash'");
        console.log(valid && unique && legacy.rows.length===0);
      `), "true");
    });
    await t.test("registration creates a member with a hashed initial password and forces password change", async () => {
      assert.equal((await fetch(`${base}/register`)).status, 200);
      const fields = { action: "register", name: "신규 회원", email: "NEW.MEMBER@example.test", department: "개발팀", position: "개발자", kind: "직원", role: "admin", salary: 900000000 };
      assert.equal((await post({ ...fields, email: "not-an-email" })).status, 400);
      assert.equal((await post({ ...fields, kind: "unknown" })).status, 400);
      assert.equal((await post(fields)).status, 200);
      assert.equal((await post({ ...fields, email: "new.member@example.test" })).status, 409);
      const login = await post({ action: "login", email: "new.member@example.test", password: "hams1234!" });
      assert.equal(login.status, 200);
      const initial = (await get(login.cookie)).body;
      assert.equal(initial.user.role, "member"); assert.equal(initial.user.salary, 0);
      assert.equal(initial.user.must_change_password, 1);
      assert.deepEqual(initial.payroll, []);
      assert.equal((await post({ action: "employee-save" }, login.cookie)).status, 403);
      const changed = await post({ action: "password-change", currentPassword: "hams1234!", newPassword: "New-member-password!", confirmPassword: "New-member-password!" }, login.cookie);
      assert.equal(changed.status, 200);
      assert.equal((await get(changed.cookie)).body.user.must_change_password, 0);
      assert.equal((await post({ action: "payroll-generate", month: "2026-10" }, changed.cookie)).status, 403);
    });
    await t.test("remote support settings are global, persistent and admin-only", async () => {
      assert.deepEqual((await get(admin)).body.remoteSettings, { idleMinutes: 5 });
      const fields = { action: "remote-settings-save", idleMinutes: 7 };
      assert.equal((await post(fields)).status, 401);
      assert.equal((await post(fields, member)).status, 403);
      assert.equal((await post(fields, partner)).status, 403);
      for (const idleMinutes of [0, -1, 121, 1.5, "7", null]) {
        assert.equal((await post({ ...fields, idleMinutes }, admin)).status, 400);
      }
      assert.equal((await post({ action: "remote-settings-save" }, admin)).status, 400);
      assert.equal((await get(member)).body.remoteSettings.idleMinutes, 5);
      for (const idleMinutes of [1, 120, 7]) {
        assert.equal((await post({ ...fields, idleMinutes }, admin)).status, 200);
        assert.equal((await get(admin)).body.remoteSettings.idleMinutes, idleMinutes);
        assert.equal((await get(member)).body.remoteSettings.idleMinutes, idleMinutes);
      }
    });
    await t.test("profile changes validate fields and only update the signed-in account", async () => {
      const before = (await get(admin)).body;
      const originalMember = before.employees.find(e => e.id === "member");
      const fields = { action: "profile-save", name: "  변경한 이름  ", department: "  플랫폼팀  ", position: "  엔지니어  " };
      assert.equal((await post(fields)).status, 401);
      for (const field of ["name", "department", "position"]) {
        for (const invalid of ["   ", "x".repeat(51), null, 123]) {
          assert.equal((await post({ ...fields, [field]: invalid }, member)).status, 400);
        }
      }
      assert.deepEqual((await get(member)).body.user, originalMember);
      assert.equal((await post({ ...fields, id: "admin", employee_id: "admin", role: "admin", salary: 999999999, email: "other@example.test" }, member)).status, 200);
      const expected = { ...originalMember, name: "변경한 이름", department: "플랫폼팀", position: "엔지니어" };
      assert.deepEqual((await get(member)).body.user, expected);
      const after = (await get(admin)).body;
      assert.deepEqual(after.user, before.user);
      assert.deepEqual(after.employees.find(e => e.id === "member"), expected);
      assert.equal((await post({ action: "profile-save", name: originalMember.name, department: originalMember.department, position: originalMember.position }, member)).status, 200);
      assert.equal((await post({ ...fields, name: before.user.name, department: before.user.department, position: before.user.position }, admin)).status, 200);
    });
    await t.test("members can change their password again and invalidate prior sessions", async () => {
      const duplicate = await post({ action: "login", email: "member@hams.demo", password: "Changed-password-2026!" });
      const fields = { action: "password-change", currentPassword: "Changed-password-2026!", newPassword: "Another-password-2026!", confirmPassword: "Another-password-2026!" };
      assert.equal((await post({ ...fields, currentPassword: "wrong" }, member)).status, 401);
      assert.equal((await post({ ...fields, confirmPassword: "mismatch" }, member)).status, 400);
      const changed = await post(fields, member);
      assert.equal(changed.status, 200);
      assert.ok(changed.cookie);
      assert.equal((await get(member)).status, 401);
      assert.equal((await get(duplicate.cookie)).status, 401);
      member = changed.cookie;
      assert.equal((await get(member)).body.user.must_change_password, 0);
      assert.equal((await post({ action: "login", email: "member@hams.demo", password: "Changed-password-2026!" })).status, 401);
      const restored = await post({ action: "password-change", currentPassword: "Another-password-2026!", newPassword: "Changed-password-2026!", confirmPassword: "Changed-password-2026!" }, member);
      assert.equal(restored.status, 200);
      member = restored.cookie;
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
      assert.equal((await get(member)).body.remote[0].user_state, "unknown");
      assert.equal((await post({ action: "heartbeat", visible: false, active: false }, member)).status, 200);
      const state = (await get(admin)).body;
      assert.equal(state.attendance.filter(a => a.employee_id === "member").length, 1);
      assert.equal(state.remote.find(r => r.employee_id === "member").visible, 0);
      assert.equal(state.remote.find(r => r.employee_id === "member").task, "주문 화면 개발");
      assert.equal((await get(partner)).body.remote.length, 0);
    });
    await t.test("device activity is separate from tab visibility, validated and scoped to the current user", async () => {
      const send = (fields) => post({ action: "heartbeat", visible: false, ...fields }, member);
      for (const [userState, screenState] of [["active", "unlocked"], ["idle", "unlocked"], ["active", "locked"], ["unknown", "unknown"]]) {
        assert.equal((await send({ userState, screenState, employee_id: "admin" })).status, 200);
        const r = (await get(member)).body.remote[0];
        assert.equal(r.user_state, userState);
        assert.equal(r.screen_state, screenState);
        assert.equal(r.visible, 0);
      }
      assert.equal((await send({ userState: "invalid", screenState: "unlocked" })).status, 400);
      assert.equal((await send({ userState: "active", screenState: "invalid" })).status, 400);
      await send({ userState: "active", screenState: "unlocked" });
      await send({ active: true }); // Old clients must not imply device activity.
      assert.equal((await get(member)).body.remote[0].user_state, "unknown");
      assert.equal((await get(admin)).body.remote.find(r => r.employee_id === "admin").user_state, "unknown");
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
      assert.equal(rows.length, 8);
      const target = rows.find(p => p.employee_id === "member");
      const edit = { action: "payroll-save", id: target.id, adjustment: 100000, deduction: 50000, status: "검토 완료" };
      assert.equal((await post(edit, member)).status, 403);
      assert.equal((await post({ ...edit, deduction: 999999999 }, admin)).status, 400);
      assert.equal((await post(edit, admin)).status, 200);
      assert.equal((await post({ action: "payroll-generate", month: "2026-10" }, admin)).status, 200);
      const updated = (await get(member)).body.payroll;
      assert.equal(updated.length, 1); assert.equal(updated[0].adjustment, 100000); assert.equal(updated[0].status, "검토 완료");
      assert.equal((await get(admin)).body.payroll.length, 8);
    });
    await t.test("credentials survive restart and no longer depend on demo login environment variables", async () => {
      await stop(); await start(false);
      assert.equal((await get(admin)).body.remoteSettings.idleMinutes, 7);
      assert.equal((await get(member)).body.remoteSettings.idleMinutes, 7);
      assert.equal((await get(admin)).body.employees.length, 8);
      assert.ok((await get(member)).body.attendance[0].check_out);
      assert.equal((await get(member)).body.payroll[0].adjustment, 100000);
      assert.equal((await post({ action: "login", email: "admin@hams.demo", password: "hams1234!" })).status, 401);
      assert.equal((await post({ action: "login", email: "admin@hams.demo", password: "Changed-password-2026!" })).status, 200);
      const created = await post({ action: "login", email: "new@example.test", password: "hams1234!" });
      assert.equal(created.status, 200);
      assert.equal((await get(created.cookie)).body.user.must_change_password, 1);
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
