"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Monitor,
  Plus,
  Radio,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { Employee, Payroll, Snapshot } from "@/lib/types";
import Link from "next/link";
import PasswordChange from "./password-change";
import authStyles from "./auth.module.css";

import Avatar from "@/components/workspace/avatar";
import AccountMenu from "@/components/workspace/account-menu";
import DashboardModule from "@/components/workspace/dashboard-module";
import PeopleModule from "@/components/workspace/people-module";
import AttendanceModule from "@/components/workspace/attendance-module";
import RemoteModule from "@/components/workspace/remote-module";
import PayrollModule from "@/components/workspace/payroll-module";
import { day, remoteState, won } from "@/utils";
import { useRemotePresence } from "@/lib/use-remote-presence";
import { DEFAULT_IDLE_MINUTES } from "@/lib/remote-settings";

const navigation = [
  { title: "대시보드", icon: LayoutDashboard, en: "OVERVIEW" },
  { title: "구성원 관리", icon: Users, en: "PEOPLE" },
  { title: "출퇴근 관리", icon: Clock3, en: "ATTENDANCE" },
  { title: "원격근무", icon: Monitor, en: "REMOTE WORK" },
  { title: "급여·정산", icon: CreditCard, en: "PAYROLL" },
];
async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/erp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
}
export default function Workspace() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(() => new Date(0));
  const [email, setEmail] = useState("admin@hams.demo");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("사무실");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("전체");
  const [month, setMonth] = useState("");
  const [employeeModal, setEmployeeModal] = useState<Partial<Employee> | null>(
    null,
  );
  const [payrollModal, setPayrollModal] = useState<Payroll | null>(null);
  const [remoteModal, setRemoteModal] = useState(false);
  const [help, setHelp] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/erp", { cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) {
      setData(null);
      return;
    }
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }, []);
  useEffect(() => {
    setClock(new Date());
    setMonth(day().slice(0, 7));
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(tick);
  }, [refresh]);
  const signedIn = !!data;
  useEffect(() => {
    if (!signedIn) return;
    const timer = setInterval(() => {
      refresh().catch((e) => setError(e.message));
    }, 15000);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);
  const sharing =
    !data?.user.must_change_password &&
    !!data?.remote.some((r) => r.employee_id === data.user.id && !r.ended_at);
  const idleMinutes = data?.remoteSettings.idleMinutes ?? DEFAULT_IDLE_MINUTES;
  const presence = useRemotePresence(sharing, data?.user.id, idleMinutes, setError);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setEmployeeModal(null);
        setPayrollModal(null);
        setRemoteModal(false);
        setHelp(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [busy]);
  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await request(body);
      await refresh();
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent) {
    e.preventDefault();
    await act({ action: "login", email, password }, "로그인했습니다.");
  }
  const alerts = (
    <>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="오류 닫기">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </>
  );
  if (loading)
    return (
      <div className="loading">
        <span className="brand-mark">h.</span>
        <p>워크스페이스를 불러오는 중입니다.</p>
      </div>
    );
  if (!data)
    return (
      <div className="login-page">
        {alerts}
        <div className="login-story">
          <div className="brand">
            <span className="brand-mark">h.</span> HAMS <b>WORKS</b>
          </div>
          <span className="eyebrow">YOUR PEOPLE. YOUR WORKSPACE.</span>
          <h1>
            함께 일하는 방식,
            <br />더 가볍고 명확하게.
          </h1>
          <p>
            사람과 프로젝트, 매일의 업무를 연결하는
            <br />
            우리 팀을 위한 하나의 워크스페이스.
          </p>
          <div className="login-visual">
            <div className="visual-line" />
            <div className="visual-card">
              <span className="live-dot" /> PEOPLE & WORK{" "}
              <strong>
                좋은 팀의 시작은
                <br />
                연결에서부터.
              </strong>
              <div className="avatar-stack">
                <span>서준</span>
                <span>지우</span>
                <span>유진</span>
                <span>+3</span>
              </div>
            </div>
            <div className="float-card">
              <Check size={20} /> 오늘도, 함께 성장 중
            </div>
          </div>
          <small>© {clock.getFullYear()} HAMS. All rights reserved.</small>
        </div>
        <main className="login-main">
          <form className="login-form" onSubmit={login}>
            <span className="pill">HAMS WORKSPACE</span>
            <h2>반가워요! 👋</h2>
            <p>오늘의 업무를 시작해 볼까요?</p>
            <div className="account-options">
              {[
                ["관리자", "admin@hams.demo"],
                ["직원", "member@hams.demo"],
                ["프리랜서", "partner@hams.demo"],
              ].map(([name, value]) => (
                <button
                  type="button"
                  className={email === value ? "selected" : ""}
                  key={value}
                  onClick={() => setEmail(value)}
                >
                  {name}
                </button>
              ))}
            </div>
            <label>
              이메일
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary login-button" disabled={busy}>
              {busy ? "로그인 중…" : "워크스페이스 입장"}
              <ArrowRight size={18} />
            </button>
            <div className="demo-note">
              <ShieldCheck size={18} />
              <span>
                초기 비밀번호 <b>hams1234!</b>
                <br />첫 로그인 후 비밀번호를 변경해 주세요.
              </span>
            </div>
            <Link href="/register" className={authStyles.signupButton}>
              회원가입
              <ArrowRight size={16} />
            </Link>
          </form>
        </main>
      </div>
    );

  const { user, employees, remote } = data;
  if (user.must_change_password)
    return (
      <main className={authStyles.firstLogin}>
        {alerts}
        <div className="brand">
          <span className="brand-mark">h.</span>HAMS WORKS
        </div>
        <h1>{user.name}님, 환영합니다.</h1>
        <p>비밀번호 변경을 완료하면 워크스페이스가 열립니다.</p>
        <PasswordChange
          onComplete={async () => {
            await refresh();
            setPassword("");
            setNotice("비밀번호를 변경했습니다. 업무를 시작해 보세요.");
          }}
          onLogout={() => {
            void act({ action: "logout" }, "로그아웃했습니다.");
          }}
        />
      </main>
    );
  const isAdmin = user.role === "admin";
  const today = day(clock);
  const activeRemote = remote.filter((r) => remoteState(r, +clock) === "활동 중");
  const findEmployee = (id: string) => employees.find((p) => p.id === id);
  const changeTab = (n: number) => {
    setTab(n);
    setQuery("");
    setKind("전체");
  };

  return (
    <div className="app-shell">
      {alerts}
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="HAMS WORKS 홈">
          <span className="brand-mark">h.</span>
          <span>
            HAMS <b>WORKS</b>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Building2 size={17} />
          </span>
          <div>
            HAMS 컴퍼니<small>Internal workspace</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {navigation.map((item, n) => (
            <button
              key={item.title}
              className={tab === n ? "nav-item active" : "nav-item"}
              onClick={() => changeTab(n)}
            >
              <item.icon size={19} />
              <span>{item.title}</span>
              {n === 3 && (
                <span className="nav-count">{activeRemote.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Coffee size={21} />
            </span>
            <strong>좋은 하루의 시작</strong>
            <p>
              오늘의 출근 체크,
              <br />
              잊지 않으셨나요?
            </p>
            <button onClick={() => changeTab(2)}>
              근무 현황 확인 <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            이용 가이드
            <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-user">
            <Avatar person={user} small />
            <div>
              <b>{user.name}</b>
              <small>{isAdmin ? "워크스페이스 관리자" : user.position}</small>
            </div>
            <button
              className="icon-button"
              disabled={busy}
              aria-label="로그아웃"
              onClick={() => act({ action: "logout" }, "로그아웃했습니다.")}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div>
            워크스페이스 <ChevronRight size={14} />
            <strong>{navigation[tab].title}</strong>
          </div>
          <div className="topbar-right">
            <span className="sample-label">DEMO WORKSPACE</span>
            <span className="topbar-date">
              <CalendarDays size={15} />
              {today.replaceAll("-", ".")}
            </span>
            <AccountMenu user={user} remoteSettings={data.remoteSettings} disabled={busy} onUpdated={async (message) => {
              await refresh();
              setPassword("");
              setNotice(message);
            }} />
            <button
              className="icon-button"
              disabled={busy}
              aria-label="로그아웃"
              onClick={() => act({ action: "logout" }, "로그아웃했습니다.")}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{navigation[tab].en}</div>
              <h1>
                {tab === 0
                  ? `좋은 하루예요, ${user.name}님`
                  : navigation[tab].title}
                {tab === 0 && <span className="greeting-dot">✳</span>}
              </h1>
              <p>
                {
                  [
                    "우리 팀의 오늘을 한눈에 확인하고, 더 나은 업무를 시작하세요.",
                    "함께 성장하는 직원과 프리랜서의 정보를 관리하세요.",
                    "매일의 시작과 끝, 정확하고 간편하게 기록하세요.",
                    "어디서 일하든 연결되는 우리 팀의 업무 현황입니다.",
                    "구성원의 급여와 프리랜서 정산을 체계적으로 관리하세요.",
                  ][tab]
                }
              </p>
            </div>
            {tab === 1 && isAdmin ? (
              <button
                className="primary"
                onClick={() =>
                  setEmployeeModal({ kind: "직원", joined: today })
                }
              >
                <Plus size={17} />
                구성원 등록
              </button>
            ) : (
              <span className="date-chip">
                <CalendarDays size={16} />
                {clock.toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </span>
            )}
          </div>
          {tab === 0 && (
            <DashboardModule
              data={data}
              clock={clock}
              mode={mode}
              setMode={setMode}
              busy={busy}
              act={act}
              changeTab={changeTab}
              onEditEmployee={setEmployeeModal}
            />
          )}
          {tab === 1 && (
            <PeopleModule
              data={data}
              clock={clock}
              query={query}
              setQuery={setQuery}
              kind={kind}
              setKind={setKind}
              onEditEmployee={setEmployeeModal}
            />
          )}
          {tab === 2 && (
            <AttendanceModule
              data={data}
              clock={clock}
              mode={mode}
              setMode={setMode}
              month={month}
              setMonth={setMonth}
              busy={busy}
              act={act}
            />
          )}
          {tab === 3 && (
            <RemoteModule
              data={data}
              clock={clock}
              sharing={sharing}
              detectionMessage={presence.message}
              onEnableDetection={presence.requestPermission}
              busy={busy}
              act={act}
              onStartSharing={() => setRemoteModal(true)}
            />
          )}
          {tab === 4 && (
            <PayrollModule
              data={data}
              month={month}
              setMonth={setMonth}
              busy={busy}
              act={act}
              onEditPayroll={setPayrollModal}
            />
          )}
          <footer className="main-footer">
            <span>
              HAMS WORKS <span>·</span> A better way to work together.
            </span>
            <span>
              <span className="live-dot" />
              {isAdmin ? "관리자 워크스페이스" : "개인 워크스페이스"}
            </span>
          </footer>
        </main>
      </div>
      {(employeeModal || payrollModal || remoteModal || help) && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setEmployeeModal(null);
              setPayrollModal(null);
              setRemoteModal(false);
              setHelp(false);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <h2 id="modal-title">
                {employeeModal
                  ? employeeModal.id
                    ? "구성원 정보 수정"
                    : "새 구성원 등록"
                  : payrollModal
                    ? "정산 내역 수정"
                    : remoteModal
                      ? "원격근무 상태 공유"
                      : "워크스페이스 이용 가이드"}
              </h2>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="닫기"
                onClick={() => {
                  setEmployeeModal(null);
                  setPayrollModal(null);
                  setRemoteModal(false);
                  setHelp(false);
                }}
              >
                <X size={21} />
              </button>
            </div>
            {employeeModal && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  if (
                    await act(
                      {
                        ...f,
                        action: "employee-save",
                        id: employeeModal.id,
                        salary: Number(f.salary),
                      },
                      "구성원 정보를 저장했습니다.",
                    )
                  )
                    setEmployeeModal(null);
                }}
              >
                <div className="form-grid">
                  {[
                    ["name", "이름", "text"],
                    ["email", "이메일", "email"],
                    ["department", "소속", "text"],
                    ["position", "직무", "text"],
                    ["project", "참여 프로젝트", "text"],
                    ["joined", "입사 / 계약일", "date"],
                  ].map(([key, label, type]) => (
                    <label key={key}>
                      {label}
                      <input
                        autoFocus={key === "name"}
                        name={key}
                        type={type}
                        required
                        maxLength={100}
                        defaultValue={String(
                          employeeModal[key as keyof Employee] || "",
                        )}
                      />
                    </label>
                  ))}
                  <label>
                    계약 유형
                    <select name="kind" defaultValue={employeeModal.kind}>
                      <option>직원</option>
                      <option>프리랜서</option>
                    </select>
                  </label>
                  <label>
                    월 기본급 / 계약금 (원)
                    <input
                      type="number"
                      name="salary"
                      min="0"
                      max="1000000000"
                      step="1"
                      required
                      defaultValue={employeeModal.salary || 0}
                    />
                  </label>
                </div>
                <p className="caption">
                  초기 비밀번호 hams1234!로 계정이 생성됩니다. 첫 로그인 시
                  변경해야 합니다.
                </p>
                <button className="primary form-submit" disabled={busy}>
                  정보 저장 <Check size={16} />
                </button>
              </form>
            )}
            {payrollModal && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  if (
                    await act(
                      {
                        action: "payroll-save",
                        id: payrollModal.id,
                        adjustment: Number(f.adjustment),
                        deduction: Number(f.deduction),
                        status: f.status,
                      },
                      "정산 내역을 저장했습니다.",
                    )
                  )
                    setPayrollModal(null);
                }}
              >
                <p>
                  {findEmployee(payrollModal.employee_id)?.name} ·{" "}
                  {payrollModal.month} · 기본 ₩ {won(payrollModal.base)}
                </p>
                <label>
                  수당 (원)
                  <input
                    autoFocus
                    type="number"
                    name="adjustment"
                    min="0"
                    max="1000000000"
                    required
                    defaultValue={payrollModal.adjustment}
                  />
                </label>
                <label>
                  공제 (원)
                  <input
                    type="number"
                    name="deduction"
                    min="0"
                    max="1000000000"
                    required
                    defaultValue={payrollModal.deduction}
                  />
                </label>
                <label>
                  검토 상태
                  <select name="status" defaultValue={payrollModal.status}>
                    <option>검토 대기</option>
                    <option>검토 완료</option>
                  </select>
                </label>
                <button className="primary form-submit" disabled={busy}>
                  저장하기
                </button>
              </form>
            )}
            {remoteModal && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await presence.requestPermission();
                  if (
                    await act(
                      {
                        action: "remote-start",
                        task: f.get("task"),
                        consent: f.get("consent") === "on",
                      },
                      "업무 상태 공유를 시작했습니다.",
                    )
                  )
                    setRemoteModal(false);
                }}
              >
                <p>먼저 출퇴근 관리에서 원격 근무로 출근해 주세요.</p>
                <label>
                  지금 진행하는 업무
                  <input
                    autoFocus
                    name="task"
                    required
                    maxLength={200}
                    placeholder="예: 커머스 플랫폼 주문 화면 개발"
                  />
                </label>
                <div className="info-box">
                  <p>
                    업무 내용, 연결 시각, 기기 활동·유휴 및 화면 잠금 상태를 관리자에게 공유합니다.
                    공유 시작 시 브라우저의 활동 감지 권한을 요청합니다. 최소화 자체는 자리 비움으로 판정하지 않습니다.
                    {idleMinutes}분간 기기 입력이 없거나 화면을 잠그면 자리 비움, 3분 넘게 통신이 없으면 연결 확인 필요로 표시합니다.
                    미지원·권한 거절 시 자동 판정 불가로 공유하며, 공유 종료·퇴근·로그아웃 시 종료합니다.
                    입력 내용·좌표·사용 프로그램·화면·카메라는 수집하지 않습니다.
                  </p>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" name="consent" required />위 내용을
                  확인했으며 상태 공유에 동의합니다.
                </label>
                <button className="primary form-submit" disabled={busy}>
                  공유 시작 <Radio size={16} />
                </button>
              </form>
            )}
            {help && (
              <div className="guide">
                <p>
                  <b>1. 구성원 관리</b>
                  <br />
                  관리자는 직원·프리랜서 정보를 등록하고 수정합니다. 직원은
                  자신의 정보만 볼 수 있습니다.
                </p>
                <p>
                  <b>2. 출퇴근 관리</b>
                  <br />
                  근무 장소를 선택하고 출근·퇴근 버튼으로 기록합니다. 한국
                  시간으로 하루 한 번 출근할 수 있습니다.
                </p>
                <p>
                  <b>3. 원격근무</b>
                  <br />
                  원격 출근 후 업무를 입력하고 공유에 동의하세요. 상태 공유는 이
                  기기 활동 감지 권한이 있어야 자동 판정할 수 있습니다.
                </p>
                <p>
                  <b>4. 급여·정산</b>
                  <br />
                  관리자가 월 초안을 생성하고 수당·공제를 입력합니다. 구성원은
                  본인 내역만 조회합니다.
                </p>
                <div className="info-box">
                  계정의 초기 비밀번호는 hams1234! 입니다. 첫 로그인 후에는 직접
                  변경한 비밀번호로 로그인하세요.
                </div>
              </div>
            )}
            {error && (
              <p className="modal-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
