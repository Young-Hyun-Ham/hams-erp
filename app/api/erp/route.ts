import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db, initialize, koreaDay } from "@/lib/db";
import type { Employee } from "@/lib/types";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
async function user() {
  const token = (await cookies()).get("hams_session")?.value;
  if (!token) throw new ApiError("로그인이 필요합니다.", 401);
  const r = await db.execute({ sql: "SELECT e.* FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token=? AND s.expires>?", args: [hash(token), Date.now()] });
  if (!r.rows[0]) throw new ApiError("세션이 만료되었습니다.", 401);
  return r.rows[0] as unknown as Employee;
}
function text(v: unknown, max = 100) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max) throw new ApiError("입력 내용을 확인해 주세요.");
  return v.trim();
}
function money(v: unknown) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > 1000000000) throw new ApiError("금액은 0~10억 원의 정수로 입력해 주세요.");
  return v;
}
function failure(e: unknown) {
  if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
  console.error("ERP request failed", e);
  return Response.json({ error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
}
export async function GET() {
  try {
    await initialize(); const current = await user();
    const admin = current.role === "admin", filter = admin ? "" : " WHERE employee_id=?", args = admin ? [] : [current.id];
    const [employees, attendance, remote, payroll] = await Promise.all([
      db.execute(admin ? "SELECT * FROM employees ORDER BY joined" : { sql: "SELECT * FROM employees WHERE id=?", args: [current.id] }),
      db.execute({ sql: `SELECT * FROM attendance${filter} ORDER BY check_in DESC LIMIT 500`, args }),
      db.execute({ sql: `SELECT * FROM remote${filter}`, args }),
      db.execute({ sql: `SELECT * FROM payroll${filter} ORDER BY month DESC`, args }),
    ]);
    return Response.json({ user: current, employees: employees.rows, attendance: attendance.rows, remote: remote.rows, payroll: payroll.rows, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    // Next.js may normalize request.url to localhost; compare the browser's
    // origin with the original Host header instead of that internal URL.
    if (origin) {
      let originHost;
      try { originHost = new URL(origin).host; } catch { throw new ApiError("허용되지 않은 요청입니다.", 403); }
      if (originHost !== request.headers.get("host")) throw new ApiError("허용되지 않은 요청입니다.", 403);
    }
    await initialize();
    let b;
    try { b = await request.json(); } catch { throw new ApiError("잘못된 요청입니다."); }
    if (!b || typeof b !== "object") throw new ApiError("잘못된 요청입니다.");
    const now = new Date().toISOString();
    if (b.action === "login") {
      if (process.env.NODE_ENV === "production" && process.env.ERP_ENABLE_DEMO_LOGIN !== "true") throw new ApiError("운영 환경에서는 샘플 로그인이 비활성화됩니다.", 403);
      const email = text(b.email);
      const attempt = await db.execute({ sql: "SELECT * FROM login_attempts WHERE identity=?", args: [email] });
      if (attempt.rows[0] && Number(attempt.rows[0].reset_at) > Date.now() && Number(attempt.rows[0].attempts) >= 10) throw new ApiError("15분 후 다시 로그인해 주세요.", 429);
      if (typeof b.password !== "string" || !timingSafeEqual(Buffer.from(hash(b.password)), Buffer.from(hash(process.env.ERP_DEMO_PASSWORD || "hams1234!"))) || !["admin@hams.demo", "member@hams.demo", "partner@hams.demo"].includes(email)) {
        await db.execute({ sql: "INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(identity) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END", args: [email, Date.now() + 900000, Date.now(), Date.now()] });
        throw new ApiError("샘플 계정 또는 비밀번호를 확인해 주세요.", 401);
      }
      const employee = await db.execute({ sql: "SELECT id FROM employees WHERE email=?", args: [email] });
      if (!employee.rows.length) throw new ApiError("샘플 계정을 찾을 수 없습니다.", 401);
      const token = randomBytes(32).toString("hex");
      await db.execute({ sql: "INSERT INTO sessions VALUES (?,?,?)", args: [hash(token), employee.rows[0].id, Date.now() + 28800000] });
      (await cookies()).set("hams_session", token, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 28800 });
      return Response.json({ ok: true });
    }
    const current = await user();
    const admin = () => { if (current.role !== "admin") throw new ApiError("관리자만 사용할 수 있습니다.", 403); };
    switch (b.action) {
      case "logout": {
        const token = (await cookies()).get("hams_session")?.value || "";
        await db.batch([
          { sql: "DELETE FROM sessions WHERE token=?", args: [hash(token)] },
          { sql: "UPDATE remote SET ended_at=? WHERE employee_id=? AND ended_at IS NULL", args: [now, current.id] },
        ], "write");
        (await cookies()).delete("hams_session"); break;
      }
      case "checkin": {
        if (!["사무실", "원격"].includes(b.mode)) throw new ApiError("근무 장소를 선택해 주세요.");
        const open = await db.execute({ sql: "SELECT id FROM attendance WHERE employee_id=? AND check_out IS NULL", args: [current.id] });
        if (open.rows.length) throw new ApiError("진행 중인 근무를 먼저 퇴근 처리해 주세요.", 409);
        const r = await db.execute({ sql: "INSERT OR IGNORE INTO attendance VALUES (?,?,?,?,NULL,?)", args: [randomUUID(), current.id, koreaDay(), now, b.mode] });
        if (!r.rowsAffected) throw new ApiError("오늘은 이미 출근 기록이 있습니다.", 409);
        break;
      }
      case "checkout": {
        const r = await db.batch([
          { sql: "UPDATE attendance SET check_out=? WHERE employee_id=? AND check_out IS NULL", args: [now, current.id] },
          { sql: "UPDATE remote SET ended_at=? WHERE employee_id=? AND ended_at IS NULL", args: [now, current.id] },
        ], "write");
        if (!r[0].rowsAffected) throw new ApiError("진행 중인 출근 기록이 없습니다.", 409);
        break;
      }
      case "remote-start": {
        if (b.consent !== true) throw new ApiError("상태 공유에 동의해 주세요.");
        const task = text(b.task, 200);
        const r = await db.execute({ sql: "SELECT id FROM attendance WHERE employee_id=? AND day=? AND check_out IS NULL AND mode='원격'", args: [current.id, koreaDay()] });
        if (!r.rows.length) throw new ApiError("원격 출근 후 상태 공유를 시작해 주세요.");
        await db.execute({ sql: "INSERT INTO remote VALUES (?,?,NULL,?,?,1,?) ON CONFLICT(employee_id) DO UPDATE SET started_at=excluded.started_at, ended_at=NULL, heartbeat=excluded.heartbeat, last_active=excluded.last_active, visible=1, task=excluded.task", args: [current.id, now, now, now, task] }); break;
      }
      case "heartbeat":
        await db.execute({ sql: "UPDATE remote SET heartbeat=?,visible=?,last_active=CASE WHEN ?=1 THEN ? ELSE last_active END WHERE employee_id=? AND ended_at IS NULL", args: [now, b.visible === true ? 1 : 0, b.active === true ? 1 : 0, now, current.id] }); break;
      case "remote-stop": await db.execute({ sql: "UPDATE remote SET ended_at=? WHERE employee_id=? AND ended_at IS NULL", args: [now, current.id] }); break;
      case "employee-save": {
        admin(); const name = text(b.name, 50), email = text(b.email, 100);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["직원", "프리랜서"].includes(b.kind) || typeof b.joined !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.joined) || Number.isNaN(Date.parse(b.joined)) || new Date(b.joined).toISOString().slice(0, 10) !== b.joined) throw new ApiError("이메일, 계약 유형, 입사일을 확인해 주세요.");
        const id = b.id ? text(b.id) : randomUUID();
        const duplicate = await db.execute({ sql: "SELECT id FROM employees WHERE email=? AND id!=?", args: [email, id] });
        if (duplicate.rows.length) throw new ApiError("이미 등록된 이메일입니다.", 409);
        const fields = [name, email, text(b.department, 50), text(b.position, 50), b.kind, text(b.project), b.joined, money(b.salary)];
        if (b.id) {
          if (["admin", "member", "freelancer"].includes(id)) {
            const original = await db.execute({ sql: "SELECT email FROM employees WHERE id=?", args: [id] });
            if (original.rows[0]?.email !== email) throw new ApiError("샘플 로그인 계정의 이메일은 변경할 수 없습니다.");
          }
          await db.execute({ sql: "UPDATE employees SET name=?,email=?,department=?,position=?,kind=?,project=?,joined=?,salary=? WHERE id=?", args: [...fields, id] });
        } else await db.execute({ sql: "INSERT INTO employees (name,email,department,position,kind,project,joined,salary,id,role) VALUES (?,?,?,?,?,?,?,?,?,'member')", args: [...fields, id] });
        break;
      }
      case "payroll-generate": {
        admin(); const month = text(b.month);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError("정산 월을 확인해 주세요.");
        await db.execute({ sql: "INSERT OR IGNORE INTO payroll SELECT lower(hex(randomblob(16))),id,?,salary,0,0,'검토 대기' FROM employees WHERE substr(joined,1,7)<=?", args: [month, month] }); break;
      }
      case "payroll-save": {
        admin(); const status = text(b.status);
        if (!["검토 대기", "검토 완료"].includes(status)) throw new ApiError("정산 상태를 확인해 주세요.");
        const adjustment = money(b.adjustment), deduction = money(b.deduction), id = text(b.id);
        const row = await db.execute({ sql: "SELECT base FROM payroll WHERE id=?", args: [id] });
        if (!row.rows.length || deduction > Number(row.rows[0].base) + adjustment) throw new ApiError("공제액을 확인해 주세요.");
        await db.execute({ sql: "UPDATE payroll SET adjustment=?,deduction=?,status=? WHERE id=?", args: [adjustment, deduction, status, id] }); break;
      }
      default: throw new ApiError("지원하지 않는 요청입니다.");
    }
    return Response.json({ ok: true });
  } catch (e) { return failure(e); }
}
