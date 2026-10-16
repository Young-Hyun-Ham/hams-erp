import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { hashPassword, INITIAL_PASSWORD } from "./password";
import { DEFAULT_IDLE_MINUTES } from "./remote-settings";
const url = process.env.ERP_DATABASE_URL;
if (!url) mkdirSync("data", { recursive: true });
export const db = createClient({
  url: url || "file:data/erp.db",
  authToken: process.env.ERP_DATABASE_AUTH_TOKEN,
});
let ready: Promise<void> | undefined;
export function initialize() {
  ready ??= setup().catch((e) => {
    ready = undefined;
    throw e;
  });
  return ready;
}
async function setup() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, department TEXT NOT NULL, position TEXT NOT NULL, kind TEXT NOT NULL, project TEXT NOT NULL, joined TEXT NOT NULL, role TEXT NOT NULL, salary INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, employee_id TEXT NOT NULL, expires INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, day TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT, mode TEXT NOT NULL, UNIQUE(employee_id, day))`,
      `CREATE TABLE IF NOT EXISTS remote (employee_id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT, heartbeat TEXT NOT NULL, last_active TEXT NOT NULL, visible INTEGER NOT NULL, task TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS payroll (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, month TEXT NOT NULL, base INTEGER NOT NULL, adjustment INTEGER NOT NULL, deduction INTEGER NOT NULL, status TEXT NOT NULL, UNIQUE(employee_id, month))`,
      `CREATE TABLE IF NOT EXISTS login_attempts (identity TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS remote_settings (id INTEGER PRIMARY KEY CHECK(id=1), idle_minutes INTEGER NOT NULL CHECK(idle_minutes BETWEEN 1 AND 120))`,
      { sql: "INSERT OR IGNORE INTO remote_settings (id,idle_minutes) VALUES (1,?)", args: [DEFAULT_IDLE_MINUTES] },
    ],
    "write",
  );
  for (const name of ["user_state", "screen_state"]) {
    const columns = await db.execute("PRAGMA table_info(remote)");
    if (!columns.rows.some((row) => row.name === name)) {
      try {
        await db.execute(`ALTER TABLE remote ADD COLUMN ${name} TEXT NOT NULL DEFAULT 'unknown'`);
      } catch (error) {
        const current = await db.execute("PRAGMA table_info(remote)");
        if (!current.rows.some((row) => row.name === name)) throw error;
      }
    }
  }
  const people = [
    [
      "admin",
      "김하늘",
      "admin@hams.demo",
      "경영지원",
      "인사 매니저",
      "직원",
      "HAMS 운영",
      "2023-03-02",
      "admin",
      4200000,
    ],
    [
      "member",
      "이서준",
      "member@hams.demo",
      "개발팀",
      "프론트엔드 개발자",
      "직원",
      "커머스 플랫폼 구축",
      "2024-01-15",
      "member",
      4800000,
    ],
    [
      "freelancer",
      "박지우",
      "partner@hams.demo",
      "디자인팀",
      "UI/UX 디자이너",
      "프리랜서",
      "금융 서비스 리뉴얼",
      "2025-06-01",
      "member",
      5500000,
    ],
    [
      "dev2",
      "최유진",
      "yujin@hams.demo",
      "개발팀",
      "백엔드 개발자",
      "직원",
      "커머스 플랫폼 구축",
      "2024-05-20",
      "member",
      5100000,
    ],
    [
      "pm",
      "정도윤",
      "doyun@hams.demo",
      "사업팀",
      "프로젝트 매니저",
      "직원",
      "금융 서비스 리뉴얼",
      "2023-09-04",
      "member",
      5300000,
    ],
    [
      "partner2",
      "한소율",
      "soyul@hams.demo",
      "개발팀",
      "풀스택 개발자",
      "프리랜서",
      "클라우드 운영 고도화",
      "2025-11-10",
      "member",
      6200000,
    ],
  ];
  // Explicit columns preserve compatibility as authentication columns are added.
  await db.batch(
    people.map((args) => ({
      sql: "INSERT OR IGNORE INTO employees (id,name,email,department,position,kind,project,joined,role,salary) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args,
    })),
    "write",
  );
  await ensureColumn("password_hash", "TEXT");
  await ensureColumn("must_change_password", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn("password_changed_at", "TEXT");
  const uninitialized = await db.execute(
    "SELECT id FROM employees WHERE password_hash IS NULL",
  );
  // Backfill each existing account once, with an independent random salt.
  for (const person of uninitialized.rows) {
    const passwordHash = await hashPassword(INITIAL_PASSWORD);
    await db.batch(
      [
        {
          sql: "DELETE FROM sessions WHERE employee_id=? AND EXISTS (SELECT 1 FROM employees WHERE id=? AND password_hash IS NULL)",
          args: [person.id, person.id],
        },
        {
          sql: "UPDATE employees SET password_hash=?,must_change_password=1 WHERE id=? AND password_hash IS NULL",
          args: [passwordHash, person.id],
        },
      ],
      "write",
    );
  }
}
async function ensureColumn(name: string, definition: string) {
  const columns = await db.execute("PRAGMA table_info(employees)");
  if (columns.rows.some((row) => row.name === name)) return;
  try {
    await db.execute(`ALTER TABLE employees ADD COLUMN ${name} ${definition}`);
  } catch (error) {
    // Another serverless instance may have completed the same migration.
    const current = await db.execute("PRAGMA table_info(employees)");
    if (!current.rows.some((row) => row.name === name)) throw error;
  }
}
export function koreaDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
