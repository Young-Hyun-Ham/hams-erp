import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, initialize, koreaDay } from "@/lib/db";
import {
  hashPassword,
  INITIAL_PASSWORD,
  validNewPassword,
  verifyPassword,
} from "@/lib/password";
import type { Employee } from "@/lib/types";
import { validIdleMinutes } from "@/lib/remote-settings";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const publicColumns =
  "id,name,email,department,position,kind,project,joined,role,salary,must_change_password";
function publicEmployee(row: Record<string, unknown>) {
  return Object.fromEntries(
    publicColumns.split(",").map((key) => [key, row[key]]),
  ) as unknown as Employee;
}
async function sessionCookie(token: string, request: Request) {
  (await cookies()).set("hams_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.VERCEL === "1" || new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 28800,
  });
}
class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function user() {
  const token = (await cookies()).get("hams_session")?.value;
  if (!token) throw new ApiError("로그인이 필요합니다.", 401);
  const r = await db.execute({
    sql: "SELECT e.* FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token=? AND s.expires>?",
    args: [hash(token), Date.now()],
  });
  if (!r.rows[0]) throw new ApiError("세션이 만료되었습니다.", 401);
  return r.rows[0] as unknown as Employee & { password_hash: string };
}
function text(v: unknown, max = 100) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new ApiError("입력 내용을 확인해 주세요.");
  return v.trim();
}
function money(v: unknown) {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v < 0 ||
    v > 1000000000
  )
    throw new ApiError("금액은 0~10억 원의 정수로 입력해 주세요.");
  return v;
}
function emailAddress(value: unknown) {
  const email = text(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError("이메일 주소를 확인해 주세요.");
  return email;
}
function failure(e: unknown) {
  if (e instanceof ApiError)
    return Response.json({ error: e.message }, { status: e.status });
  console.error("ERP request failed", e);
  return Response.json(
    { error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}
export async function GET() {
  try {
    // Establish a request boundary before any database initialization so that
    // Next.js prerendering never runs migrations against the configured DB.
    await cookies();
    await initialize();
    const current = await user();
    const settings = await db.execute("SELECT idle_minutes FROM remote_settings WHERE id=1");
    const remoteSettings = { idleMinutes: Number(settings.rows[0].idle_minutes) };
    if (current.must_change_password)
      return Response.json(
        {
          user: publicEmployee(current),
          remoteSettings,
          employees: [],
          attendance: [],
          remote: [],
          payroll: [],
          serverTime: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const admin = current.role === "admin",
      filter = admin ? "" : " WHERE employee_id=?",
      args = admin ? [] : [current.id];
    const [employees, attendance, remote, payroll] = await Promise.all([
      db.execute(
        admin
          ? `SELECT ${publicColumns} FROM employees ORDER BY joined`
          : {
              sql: `SELECT ${publicColumns} FROM employees WHERE id=?`,
              args: [current.id],
            },
      ),
      db.execute({
        sql: `SELECT * FROM attendance${filter} ORDER BY check_in DESC LIMIT 500`,
        args,
      }),
      db.execute({ sql: `SELECT * FROM remote${filter}`, args }),
      db.execute({
        sql: `SELECT * FROM payroll${filter} ORDER BY month DESC`,
        args,
      }),
    ]);
    return Response.json(
      {
        user: publicEmployee(current),
        remoteSettings,
        employees: employees.rows,
        attendance: attendance.rows,
        remote: remote.rows,
        payroll: payroll.rows,
        serverTime: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    // Next.js may normalize request.url to localhost; compare the browser's
    // origin with the original Host header instead of that internal URL.
    if (origin) {
      let originHost;
      try {
        originHost = new URL(origin).host;
      } catch {
        throw new ApiError("허용되지 않은 요청입니다.", 403);
      }
      if (originHost !== request.headers.get("host"))
        throw new ApiError("허용되지 않은 요청입니다.", 403);
    }
    await initialize();
    let b;
    try {
      b = await request.json();
    } catch {
      throw new ApiError("잘못된 요청입니다.");
    }
    if (!b || typeof b !== "object") throw new ApiError("잘못된 요청입니다.");
    const now = new Date().toISOString();
    if (b.action === "register") {
      const email = emailAddress(b.email),
        name = text(b.name, 50);
      const department = text(b.department, 50),
        position = text(b.position, 50);
      if (!["직원", "프리랜서"].includes(b.kind))
        throw new ApiError("계약 유형을 선택해 주세요.");
      const duplicate = await db.execute({
        sql: "SELECT id FROM employees WHERE lower(email)=?",
        args: [email],
      });
      if (duplicate.rows.length)
        throw new ApiError("이미 등록된 이메일입니다.", 409);
      const passwordHash = await hashPassword(INITIAL_PASSWORD);
      try {
        await db.execute({
          sql: "INSERT INTO employees (id,name,email,department,position,kind,project,joined,role,salary,password_hash,must_change_password) VALUES (?,?,?,?,?,?,'미배정',?,'member',0,?,1)",
          args: [
            randomUUID(),
            name,
            email,
            department,
            position,
            b.kind,
            koreaDay(),
            passwordHash,
          ],
        });
      } catch (error) {
        if (String(error).includes("UNIQUE"))
          throw new ApiError("이미 등록된 이메일입니다.", 409);
        throw error;
      }
      return Response.json({ ok: true });
    }
    if (b.action === "login") {
      const email = emailAddress(b.email);
      const attempt = await db.execute({
        sql: "SELECT * FROM login_attempts WHERE identity=?",
        args: [email],
      });
      if (
        attempt.rows[0] &&
        Number(attempt.rows[0].reset_at) > Date.now() &&
        Number(attempt.rows[0].attempts) >= 10
      )
        throw new ApiError("15분 후 다시 로그인해 주세요.", 429);
      const employee = await db.execute({
        sql: "SELECT id,password_hash FROM employees WHERE lower(email)=?",
        args: [email],
      });
      const stored = employee.rows[0]?.password_hash;
      // Unknown accounts still perform the same expensive password derivation.
      const dummy = `scrypt$32768$8$3$${"0".repeat(32)}$${"0".repeat(128)}`;
      const valid =
        typeof b.password === "string" &&
        b.password.length <= 128 &&
        (await verifyPassword(
          b.password,
          typeof stored === "string" ? stored : dummy,
        ));
      if (!valid || !employee.rows.length) {
        await db.execute({
          sql: "INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(identity) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END",
          args: [email, Date.now() + 900000, Date.now(), Date.now()],
        });
        throw new ApiError("이메일 또는 비밀번호를 확인해 주세요.", 401);
      }
      const token = randomBytes(32).toString("hex");
      const inserted = await db.execute({
        sql: "INSERT INTO sessions (token,employee_id,expires) SELECT ?,id,? FROM employees WHERE id=? AND password_hash=?",
        args: [hash(token), Date.now() + 28800000, employee.rows[0].id, stored],
      });
      if (!inserted.rowsAffected)
        throw new ApiError(
          "비밀번호가 변경되었습니다. 다시 로그인해 주세요.",
          401,
        );
      await db.execute({
        sql: "DELETE FROM login_attempts WHERE identity=?",
        args: [email],
      });
      await sessionCookie(token, request);
      return Response.json({ ok: true });
    }
    const current = await user();
    if (b.action === "password-change") {
      if (!validNewPassword(b.newPassword))
        throw new ApiError(
          "새 비밀번호는 초기 비밀번호와 다른 10~128자로 입력해 주세요.",
        );
      if (b.newPassword !== b.confirmPassword)
        throw new ApiError("새 비밀번호 확인이 일치하지 않습니다.");
      if (
        typeof b.currentPassword !== "string" ||
        b.currentPassword.length > 128 ||
        !(await verifyPassword(b.currentPassword, current.password_hash))
      )
        throw new ApiError("현재 비밀번호를 확인해 주세요.", 401);
      if (await verifyPassword(b.newPassword, current.password_hash))
        throw new ApiError("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
      const passwordHash = await hashPassword(b.newPassword),
        token = randomBytes(32).toString("hex");
      const transaction = await db.transaction("write");
      try {
        const updated = await transaction.execute({
          sql: "UPDATE employees SET password_hash=?,must_change_password=0,password_changed_at=? WHERE id=? AND password_hash=?",
          args: [passwordHash, now, current.id, current.password_hash],
        });
        if (!updated.rowsAffected)
          throw new ApiError(
            "비밀번호가 이미 변경되었습니다. 다시 로그인해 주세요.",
            409,
          );
        await transaction.execute({
          sql: "DELETE FROM sessions WHERE employee_id=?",
          args: [current.id],
        });
        await transaction.execute({
          sql: "INSERT INTO sessions VALUES (?,?,?)",
          args: [hash(token), current.id, Date.now() + 28800000],
        });
        await transaction.commit();
      } finally {
        transaction.close();
      }
      await sessionCookie(token, request);
      return Response.json({ ok: true });
    }
    if (current.must_change_password && b.action !== "logout")
      throw new ApiError("먼저 초기 비밀번호를 변경해 주세요.", 403);
    const admin = () => {
      if (current.role !== "admin")
        throw new ApiError("관리자만 사용할 수 있습니다.", 403);
    };
    switch (b.action) {
      case "remote-settings-save": {
        admin();
        if (!validIdleMinutes(b.idleMinutes))
          throw new ApiError("자리비움 시간은 1~120분의 정수로 입력해 주세요.");
        await db.execute({
          sql: "UPDATE remote_settings SET idle_minutes=? WHERE id=1",
          args: [b.idleMinutes],
        });
        break;
      }
      case "profile-save": {
        const name = text(b.name, 50);
        const department = text(b.department, 50);
        const position = text(b.position, 50);
        await db.execute({
          sql: "UPDATE employees SET name=?,department=?,position=? WHERE id=?",
          args: [name, department, position, current.id],
        });
        break;
      }
      case "logout": {
        const token = (await cookies()).get("hams_session")?.value || "";
        await db.batch(
          [
            { sql: "DELETE FROM sessions WHERE token=?", args: [hash(token)] },
            {
              sql: "UPDATE remote SET ended_at=? WHERE employee_id=? AND ended_at IS NULL",
              args: [now, current.id],
            },
          ],
          "write",
        );
        (await cookies()).delete("hams_session");
        break;
      }
      case "checkin": {
        if (!["사무실", "원격"].includes(b.mode))
          throw new ApiError("근무 장소를 선택해 주세요.");
        const open = await db.execute({
          sql: "SELECT id FROM attendance WHERE employee_id=? AND check_out IS NULL",
          args: [current.id],
        });
        if (open.rows.length)
          throw new ApiError("진행 중인 근무를 먼저 퇴근 처리해 주세요.", 409);
        const r = await db.execute({
          sql: "INSERT OR IGNORE INTO attendance VALUES (?,?,?,?,NULL,?)",
          args: [randomUUID(), current.id, koreaDay(), now, b.mode],
        });
        if (!r.rowsAffected)
          throw new ApiError("오늘은 이미 출근 기록이 있습니다.", 409);
        break;
      }
      case "checkout": {
        const r = await db.batch(
          [
            {
              sql: "UPDATE attendance SET check_out=? WHERE employee_id=? AND check_out IS NULL",
              args: [now, current.id],
            },
            {
              sql: "UPDATE remote SET ended_at=? WHERE employee_id=? AND ended_at IS NULL",
              args: [now, current.id],
            },
          ],
          "write",
        );
        if (!r[0].rowsAffected)
          throw new ApiError("진행 중인 출근 기록이 없습니다.", 409);
        break;
      }
      case "remote-start": {
        if (b.consent !== true)
          throw new ApiError("상태 공유에 동의해 주세요.");
        const task = text(b.task, 200);
        const r = await db.execute({
          sql: "SELECT id FROM attendance WHERE employee_id=? AND day=? AND check_out IS NULL AND mode='원격'",
          args: [current.id, koreaDay()],
        });
        if (!r.rows.length)
          throw new ApiError("원격 출근 후 상태 공유를 시작해 주세요.");
        await db.execute({
          sql: "INSERT INTO remote (employee_id,started_at,ended_at,heartbeat,last_active,visible,task,user_state,screen_state) VALUES (?,?,NULL,?,?,1,?,'unknown','unknown') ON CONFLICT(employee_id) DO UPDATE SET started_at=excluded.started_at, ended_at=NULL, heartbeat=excluded.heartbeat, last_active=excluded.last_active, visible=1, task=excluded.task, user_state='unknown', screen_state='unknown'",
          args: [current.id, now, now, now, task],
        });
        break;
      }
      case "heartbeat": {
        const userState = b.userState ?? "unknown";
        const screenState = b.screenState ?? "unknown";
        if (!["active", "idle", "unknown"].includes(userState) ||
            !["locked", "unlocked", "unknown"].includes(screenState))
          throw new ApiError("기기 활동 상태를 확인해 주세요.");
        await db.execute({
          sql: "UPDATE remote SET heartbeat=?,visible=?,last_active=CASE WHEN ?=1 THEN ? ELSE last_active END,user_state=?,screen_state=? WHERE employee_id=? AND ended_at IS NULL",
          args: [
            now,
            b.visible === true ? 1 : 0,
            userState === "active" && screenState === "unlocked" ? 1 : 0,
            now,
            userState,
            screenState,
            current.id,
          ],
        });
        break;
      }
      case "remote-stop":
        await db.execute({
          sql: "UPDATE remote SET ended_at=? WHERE employee_id=? AND ended_at IS NULL",
          args: [now, current.id],
        });
        break;
      case "employee-save": {
        admin();
        const name = text(b.name, 50),
          email = emailAddress(b.email);
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          !["직원", "프리랜서"].includes(b.kind) ||
          typeof b.joined !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(b.joined) ||
          Number.isNaN(Date.parse(b.joined)) ||
          new Date(b.joined).toISOString().slice(0, 10) !== b.joined
        )
          throw new ApiError("이메일, 계약 유형, 입사일을 확인해 주세요.");
        const id = b.id ? text(b.id) : randomUUID();
        const duplicate = await db.execute({
          sql: "SELECT id FROM employees WHERE lower(email)=? AND id!=?",
          args: [email, id],
        });
        if (duplicate.rows.length)
          throw new ApiError("이미 등록된 이메일입니다.", 409);
        const fields = [
          name,
          email,
          text(b.department, 50),
          text(b.position, 50),
          b.kind,
          text(b.project),
          b.joined,
          money(b.salary),
        ];
        if (b.id) {
          if (["admin", "member", "freelancer"].includes(id)) {
            const original = await db.execute({
              sql: "SELECT email FROM employees WHERE id=?",
              args: [id],
            });
            if (original.rows[0]?.email !== email)
              throw new ApiError(
                "샘플 로그인 계정의 이메일은 변경할 수 없습니다.",
              );
          }
          await db.execute({
            sql: "UPDATE employees SET name=?,email=?,department=?,position=?,kind=?,project=?,joined=?,salary=? WHERE id=?",
            args: [...fields, id],
          });
        } else
          await db.execute({
            sql: "INSERT INTO employees (name,email,department,position,kind,project,joined,salary,id,role,password_hash,must_change_password) VALUES (?,?,?,?,?,?,?,?,?,'member',?,1)",
            args: [...fields, id, await hashPassword(INITIAL_PASSWORD)],
          });
        break;
      }
      case "payroll-generate": {
        admin();
        const month = text(b.month);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
          throw new ApiError("정산 월을 확인해 주세요.");
        await db.execute({
          sql: "INSERT OR IGNORE INTO payroll SELECT lower(hex(randomblob(16))),id,?,salary,0,0,'검토 대기' FROM employees WHERE substr(joined,1,7)<=?",
          args: [month, month],
        });
        break;
      }
      case "payroll-save": {
        admin();
        const status = text(b.status);
        if (!["검토 대기", "검토 완료"].includes(status))
          throw new ApiError("정산 상태를 확인해 주세요.");
        const adjustment = money(b.adjustment),
          deduction = money(b.deduction),
          id = text(b.id);
        const row = await db.execute({
          sql: "SELECT base FROM payroll WHERE id=?",
          args: [id],
        });
        if (
          !row.rows.length ||
          deduction > Number(row.rows[0].base) + adjustment
        )
          throw new ApiError("공제액을 확인해 주세요.");
        await db.execute({
          sql: "UPDATE payroll SET adjustment=?,deduction=?,status=? WHERE id=?",
          args: [adjustment, deduction, status, id],
        });
        break;
      }
      default:
        throw new ApiError("지원하지 않는 요청입니다.");
    }
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
