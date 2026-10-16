export type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  kind: "직원" | "프리랜서";
  project: string;
  joined: string;
  role: "admin" | "member";
  salary: number;
  must_change_password: number;
};
export type Attendance = {
  id: string;
  employee_id: string;
  day: string;
  check_in: string;
  check_out: string | null;
  mode: string;
};
export type Remote = {
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  heartbeat: string;
  last_active: string;
  visible: number;
  task: string;
  user_state: "active" | "idle" | "unknown";
  screen_state: "locked" | "unlocked" | "unknown";
};
export type Payroll = {
  id: string;
  employee_id: string;
  month: string;
  base: number;
  adjustment: number;
  deduction: number;
  status: string;
};
export type RemoteSettings = { idleMinutes: number };
export type Snapshot = {
  remoteSettings: RemoteSettings;
  user: Employee;
  employees: Employee[];
  attendance: Attendance[];
  remote: Remote[];
  payroll: Payroll[];
  serverTime: string;
};
