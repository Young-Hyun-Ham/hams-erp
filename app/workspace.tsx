"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Coffee, CreditCard, LayoutDashboard, LogOut, Monitor, MoreHorizontal, Plus, Radio, Search, ShieldCheck, Users, X } from "lucide-react";
import type { Employee, Payroll, Remote, Snapshot } from "@/lib/types";

const navigation = [
  { title: "대시보드", icon: LayoutDashboard, en: "OVERVIEW" },
  { title: "구성원 관리", icon: Users, en: "PEOPLE" },
  { title: "출퇴근 관리", icon: Clock3, en: "ATTENDANCE" },
  { title: "원격근무", icon: Monitor, en: "REMOTE WORK" },
  { title: "급여·정산", icon: CreditCard, en: "PAYROLL" },
];
const won = (v: number) => new Intl.NumberFormat("ko-KR").format(v);
const day = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const time = (s?: string | null) => s ? new Date(s).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
const duration = (start: string, end: string) => { const m = Math.max(0, Math.floor((+new Date(end) - +new Date(start)) / 60000)); return `${Math.floor(m / 60)}시간 ${m % 60}분`; };
function remoteState(r: Remote | undefined, now: number) {
  if (!r || r.ended_at) return "공유 안 함";
  if (now - +new Date(r.heartbeat) > 90000) return "연결 끊김";
  if (!r.visible || now - +new Date(r.last_active) > 300000) return "자리 비움";
  return "활동 중";
}
async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/erp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
}
function Avatar({ person, small = false }: { person: Employee; small?: boolean }) {
  const colors = ["peach", "lavender", "mint", "blue"];
  return <span className={`avatar ${colors[person.name.charCodeAt(0) % 4]} ${small ? "small" : ""}`}>{person.name.slice(1)}</span>;
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
  const [password, setPassword] = useState("hams1234!");
  const [mode, setMode] = useState("사무실");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("전체");
  const [month, setMonth] = useState("");
  const [employeeModal, setEmployeeModal] = useState<Partial<Employee> | null>(null);
  const [payrollModal, setPayrollModal] = useState<Payroll | null>(null);
  const [remoteModal, setRemoteModal] = useState(false);
  const [help, setHelp] = useState(false);
  const lastActivity = useRef(0);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/erp", { cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) { setData(null); return; }
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }, []);
  useEffect(() => {
    setClock(new Date());
    setMonth(day().slice(0, 7));
    refresh().catch(e => setError(e.message)).finally(() => setLoading(false));
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(tick);
  }, [refresh]);
  const signedIn = !!data;
  useEffect(() => {
    if (!signedIn) return;
    const timer = setInterval(() => { refresh().catch(e => setError(e.message)); }, 15000);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);
  const sharing = !!data?.remote.some(r => r.employee_id === data.user.id && !r.ended_at);
  useEffect(() => {
    if (!sharing) return;
    lastActivity.current = Date.now();
    const active = () => { lastActivity.current = Date.now(); };
    const beat = () => request({ action: "heartbeat", visible: document.visibilityState === "visible", active: document.visibilityState === "visible" && Date.now() - lastActivity.current < 30000 }).catch(e => setError(e.message));
    document.addEventListener("pointerdown", active);
    document.addEventListener("keydown", active);
    document.addEventListener("visibilitychange", beat);
    const timer = setInterval(beat, 20000);
    beat();
    return () => { clearInterval(timer); document.removeEventListener("pointerdown", active); document.removeEventListener("keydown", active); document.removeEventListener("visibilitychange", beat); };
  }, [sharing]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(t); }, [notice]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) { setEmployeeModal(null); setPayrollModal(null); setRemoteModal(false); setHelp(false); } };
    document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close);
  }, [busy]);
  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true); setError("");
    try { await request(body); await refresh(); setNotice(message); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "오류가 발생했습니다."); return false; }
    finally { setBusy(false); }
  }
  async function login(e: FormEvent) { e.preventDefault(); await act({ action: "login", email, password }, "로그인했습니다."); }
  const alerts = <>{error && <div className="error" role="alert">{error}<button onClick={() => setError("")} aria-label="오류 닫기"><X size={16} /></button></div>}{notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}</>;
  if (loading) return <div className="loading"><span className="brand-mark">h.</span><p>워크스페이스를 불러오는 중입니다.</p></div>;
  if (!data) return <div className="login-page">{alerts}<div className="login-story"><div className="brand"><span className="brand-mark">h.</span> HAMS <b>WORKS</b></div><span className="eyebrow">YOUR PEOPLE. YOUR WORKSPACE.</span><h1>함께 일하는 방식,<br />더 가볍고 명확하게.</h1><p>사람과 프로젝트, 매일의 업무를 연결하는<br />우리 팀을 위한 하나의 워크스페이스.</p><div className="login-visual"><div className="visual-line" /><div className="visual-card"><span className="live-dot" /> PEOPLE & WORK <strong>좋은 팀의 시작은<br />연결에서부터.</strong><div className="avatar-stack"><span>서준</span><span>지우</span><span>유진</span><span>+3</span></div></div><div className="float-card"><Check size={20} /> 오늘도, 함께 성장 중</div></div><small>© {clock.getFullYear()} HAMS. All rights reserved.</small></div><main className="login-main"><form className="login-form" onSubmit={login}><span className="pill">샘플 워크스페이스</span><h2>반가워요! 👋</h2><p>오늘의 업무를 시작해 볼까요?</p><div className="account-options">{[["관리자", "admin@hams.demo"], ["직원", "member@hams.demo"], ["프리랜서", "partner@hams.demo"]].map(([name, value]) => <button type="button" className={email === value ? "selected" : ""} key={value} onClick={() => setEmail(value)}>{name}</button>)}</div><label>이메일<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>비밀번호<input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button className="primary login-button" disabled={busy}>{busy ? "로그인 중…" : "워크스페이스 입장"}<ArrowRight size={18} /></button><div className="demo-note"><ShieldCheck size={18} /><span>샘플 비밀번호 <b>hams1234!</b><br />데모 데이터로 기능을 체험할 수 있습니다.</span></div></form></main></div>;

  const { user, employees, attendance, remote, payroll } = data;
  const isAdmin = user.role === "admin";
  const today = day(clock);
  const todayRecords = attendance.filter(a => a.day === today);
  const myToday = todayRecords.find(a => a.employee_id === user.id);
  const myOpen = attendance.find(a => a.employee_id === user.id && !a.check_out);
  const working = todayRecords.filter(a => !a.check_out);
  const remoteWorking = working.filter(a => a.mode === "원격");
  const activeRemote = remote.filter(r => remoteState(r, +clock) === "활동 중");
  const monthPayroll = payroll.filter(p => p.month === month);
  const filteredEmployees = employees.filter(p => (kind === "전체" || p.kind === kind) && `${p.name} ${p.department} ${p.project} ${p.email}`.toLowerCase().includes(query.toLowerCase()));
  const findEmployee = (id: string) => employees.find(p => p.id === id);
  const changeTab = (n: number) => { setTab(n); setQuery(""); setKind("전체"); };
  const exportCSV = () => {
    const rows = [["이름", "날짜", "근무 장소", "출근", "퇴근"], ...attendance.filter(a => a.day.startsWith(month)).map(a => [findEmployee(a.employee_id)?.name || "", a.day, a.mode, time(a.check_in), time(a.check_out)])];
    const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v).replace(/^[=+@-]/, "'").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `HAMS-근태-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const attendanceControl = <section className="panel attendance-card"><div className="panel-heading"><h3>나의 근무 현황</h3><span className={`badge ${myOpen ? "green" : "gray"}`}>{myOpen ? "근무 중" : myToday?.check_out ? "퇴근 완료" : "출근 전"}</span></div><div className="clock">{clock.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })}<span>SEOUL, KST</span></div><div className="attendance-times"><span>출근 <b>{time((myOpen || myToday)?.check_in)}</b></span><span>퇴근 <b>{time(myToday?.check_out)}</b></span></div><div className="mode-switch">{["사무실", "원격"].map(m => <button key={m} className={(myOpen?.mode || mode) === m ? "selected" : ""} disabled={!!myOpen || !!myToday} onClick={() => setMode(m)}>{m === "사무실" ? <Building2 size={15} /> : <Monitor size={15} />}{m} 근무</button>)}</div><div className="attendance-actions"><button className="primary" disabled={busy || !!myToday || !!myOpen} onClick={() => act({ action: "checkin", mode }, "출근이 기록되었습니다.")}><ArrowRight size={17} />출근하기</button><button className="secondary" disabled={busy || !myOpen} onClick={() => act({ action: "checkout" }, "퇴근이 기록되었습니다. 수고하셨습니다!")}>퇴근하기</button></div><p className="caption">출퇴근 시각은 서버 시간으로 저장됩니다.</p></section>;
  const remoteCards = (compact = false) => {
    const list = compact ? remote.filter(r => !r.ended_at).slice(0, 3) : remote.filter(r => !r.ended_at);
    if (!list.length) return <div className="empty"><Monitor size={29} /><b>아직 공유 중인 원격근무가 없어요</b><span>원격 출근 후 업무 상태 공유를 시작해 보세요.</span></div>;
    return <div className={compact ? "remote-list" : "remote-grid"}>{list.map(r => {
      const person = findEmployee(r.employee_id); if (!person) return null;
      const status = remoteState(r, +clock);
      return <div className="remote-person" key={r.employee_id}><div className="remote-person-top"><Avatar person={person} /><div><strong>{person.name}</strong><span>{person.position}</span></div><span className={`badge ${status === "활동 중" ? "green" : "gray"}`}><i />{status}</span></div><p>{r.task}</p><div className="remote-meta"><span><Clock3 size={13} />시작 {time(r.started_at)}</span><span>연결 {time(r.heartbeat)}</span></div></div>;
    })}</div>;
  };
  const peopleTable = (compact = false) => <div className="table-scroll"><table><thead><tr><th>구성원</th><th>소속 / 직무</th><th>계약 유형</th><th>참여 프로젝트</th><th>{compact ? "오늘의 근무" : "입사 / 계약일"}</th>{!compact && isAdmin && <th><span className="sr-only">관리</span></th>}</tr></thead><tbody>{(compact ? employees.slice(0, 5) : filteredEmployees).map(p => { const a = todayRecords.find(a => a.employee_id === p.id); return <tr key={p.id}><td><div className="person-cell"><Avatar person={p} small /><div><strong>{p.name}</strong><small>{p.email}</small></div></div></td><td><b>{p.department}</b><small>{p.position}</small></td><td><span className={`badge ${p.kind === "직원" ? "blue" : "purple"}`}>{p.kind}</span></td><td>{p.project}</td><td>{compact ? <span className={`status-text ${a && !a.check_out ? "online" : ""}`}><i />{a ? a.check_out ? "퇴근" : `${a.mode} 근무` : "출근 전"}</span> : p.joined}</td>{!compact && isAdmin && <td><button className="icon-button" aria-label={`${p.name} 정보 수정`} onClick={() => setEmployeeModal(p)}><MoreHorizontal size={20} /></button></td>}</tr>; })}</tbody></table>{!compact && !filteredEmployees.length && <div className="empty">검색 결과가 없습니다.</div>}</div>;

  return <div className="app-shell">{alerts}<aside className="sidebar"><a className="brand" href="/" aria-label="HAMS WORKS 홈"><span className="brand-mark">h.</span><span>HAMS <b>WORKS</b></span></a><div className="workspace-label"><span className="workspace-icon"><Building2 size={17} /></span><div>HAMS 컴퍼니<small>Internal workspace</small></div><ShieldCheck size={15} /></div><span className="nav-label">WORKSPACE</span><nav>{navigation.map((item, n) => <button key={item.title} className={tab === n ? "nav-item active" : "nav-item"} onClick={() => changeTab(n)}><item.icon size={19} /><span>{item.title}</span>{n === 3 && <span className="nav-count">{activeRemote.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Coffee size={21} /></span><strong>좋은 하루의 시작</strong><p>오늘의 출근 체크,<br />잊지 않으셨나요?</p><button onClick={() => changeTab(2)}>근무 현황 확인 <ArrowUpRight size={15} /></button></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={18} />이용 가이드<ArrowUpRight size={15} /></button><div className="sidebar-user"><Avatar person={user} small /><div><b>{user.name}</b><small>{isAdmin ? "워크스페이스 관리자" : user.position}</small></div><button className="icon-button" disabled={busy} aria-label="로그아웃" onClick={() => act({ action: "logout" }, "로그아웃했습니다.")}><LogOut size={17} /></button></div></div></aside>
    <div className="workspace-main"><header className="topbar"><div>워크스페이스 <ChevronRight size={14} /><strong>{navigation[tab].title}</strong></div><div className="topbar-right"><span className="sample-label">DEMO WORKSPACE</span><span className="topbar-date"><CalendarDays size={15} />{today.replaceAll("-", ".")}</span><Avatar person={user} small /><button className="icon-button" disabled={busy} aria-label="로그아웃" onClick={() => act({ action: "logout" }, "로그아웃했습니다.")}><LogOut size={17} /></button></div></header><main className="main-content"><div className="page-heading"><div><div className="eyebrow">{navigation[tab].en}</div><h1>{tab === 0 ? `좋은 하루예요, ${user.name}님` : navigation[tab].title}{tab === 0 && <span className="greeting-dot">✳</span>}</h1><p>{["우리 팀의 오늘을 한눈에 확인하고, 더 나은 업무를 시작하세요.", "함께 성장하는 직원과 프리랜서의 정보를 관리하세요.", "매일의 시작과 끝, 정확하고 간편하게 기록하세요.", "어디서 일하든 연결되는 우리 팀의 업무 현황입니다.", "구성원의 급여와 프리랜서 정산을 체계적으로 관리하세요."][tab]}</p></div>{tab === 1 && isAdmin ? <button className="primary" onClick={() => setEmployeeModal({ kind: "직원", joined: today })}><Plus size={17} />구성원 등록</button> : <span className="date-chip"><CalendarDays size={16} />{clock.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" })}</span>}</div>
      {tab === 0 && <><div className="overview-stats">{[
        { label: isAdmin ? "전체 구성원" : "나의 프로필", value: employees.length, suffix: "명", icon: Users, color: "blue", detail: `직원 ${employees.filter(e => e.kind === "직원").length} · 프리랜서 ${employees.filter(e => e.kind === "프리랜서").length}`, target: 1 },
        { label: "오늘 근무 중", value: working.length, suffix: "명", icon: Clock3, color: "mint", detail: `사무실 ${working.filter(a => a.mode === "사무실").length} · 원격 ${remoteWorking.length}`, target: 2 },
        { label: "원격 활동 중", value: activeRemote.length, suffix: "명", icon: Monitor, color: "lavender", detail: "앱 연결 및 최근 활동 기준", target: 3 },
        { label: "이번 달 정산 예정", value: won(payroll.filter(p => p.month === today.slice(0, 7)).reduce((s, p) => s + p.base + p.adjustment - p.deduction, 0)), suffix: "원", icon: CreditCard, color: "peach", detail: "수당·공제를 반영한 정산 초안", target: 4 },
      ].map(s => <button key={s.label} className="stat-card" onClick={() => changeTab(s.target)}><div className="stat-title">{s.label}<span className={`stat-icon ${s.color}`}><s.icon size={18} /></span></div><div className={`stat-number ${s.suffix === "원" ? "money-number" : ""}`}>{s.value}<span>{s.suffix}</span></div><div className="stat-detail">{s.detail}<ArrowUpRight size={15} /></div></button>)}</div><div className="dashboard-grid"><div className="dashboard-left"><section className="welcome-banner"><div><span className="eyebrow">BETTER TOGETHER</span><h2>사람과 일을 연결하는<br />우리 팀의 워크스페이스</h2><p>서로의 현황을 알고, 함께 일하는 흐름을 만들어가요.</p><button onClick={() => changeTab(1)}>우리 팀 살펴보기 <ArrowRight size={16} /></button></div><div className="banner-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-tile tile-one"><Users size={38} /></div><div className="art-tile tile-two"><BriefcaseBusiness size={32} /></div><span className="art-star">✳</span><span className="art-dot" /></div></section><section className="panel"><div className="panel-heading"><div><h3>우리 팀 구성원 <span className="count">{employees.length}</span></h3><p>다양한 전문성이 모여 더 큰 가치를 만듭니다.</p></div><button className="text-button" onClick={() => changeTab(1)}>전체 보기 <ChevronRight size={16} /></button></div>{peopleTable(true)}</section></div><div className="dashboard-right">{attendanceControl}<section className="panel"><div className="panel-heading"><h3><span className="live-dot" />원격근무 라이브</h3><button className="icon-button" aria-label="원격근무 전체 보기" onClick={() => changeTab(3)}><ArrowUpRight size={18} /></button></div>{remoteCards(true)}<div className="panel-footnote"><Radio size={13} />15초마다 최신 현황을 확인합니다.</div></section></div></div></>}
      {tab === 1 && <section className="panel"><div className="table-toolbar"><div className="tabs">{["전체", "직원", "프리랜서"].map(k => <button key={k} className={kind === k ? "selected" : ""} onClick={() => setKind(k)}>{k}<span>{employees.filter(p => k === "전체" || p.kind === k).length}</span></button>)}</div><label className="search"><Search size={17} /><input aria-label="구성원 검색" placeholder="이름, 소속, 프로젝트 검색" value={query} onChange={e => setQuery(e.target.value)} /></label></div>{peopleTable()}</section>}
      {tab === 2 && <><div className="attendance-layout">{attendanceControl}<section className="panel attendance-summary"><span className="eyebrow">TODAY AT A GLANCE</span><h2>오늘, 우리 팀은</h2><div className="summary-numbers"><div><strong>{todayRecords.length}</strong><span>출근 완료</span></div><div><strong>{working.length}</strong><span>근무 중</span></div><div><strong>{todayRecords.filter(a => a.check_out).length}</strong><span>퇴근 완료</span></div></div><p><ShieldCheck size={16} />출퇴근 기록은 로그인한 본인의 계정으로 저장됩니다.</p></section></div><section className="panel"><div className="panel-heading"><h3>{isAdmin ? "구성원" : "나의"} 출퇴근 기록</h3><div className="inline-controls"><input aria-label="근태 조회 월" type="month" value={month} onChange={e => setMonth(e.target.value)} /><button className="secondary" onClick={exportCSV}><ArrowDownToLine size={16} />CSV 다운로드</button></div></div><div className="table-scroll"><table><thead><tr><th>구성원</th><th>근무일</th><th>근무 장소</th><th>출근</th><th>퇴근</th><th>기록 시간</th><th>상태</th></tr></thead><tbody>{attendance.filter(a => a.day.startsWith(month)).map(a => <tr key={a.id}><td><strong>{findEmployee(a.employee_id)?.name}</strong></td><td>{a.day}</td><td>{a.mode}</td><td>{time(a.check_in)}</td><td>{time(a.check_out)}</td><td>{duration(a.check_in, a.check_out || data.serverTime)}</td><td><span className={`badge ${a.check_out ? "gray" : "green"}`}>{a.check_out ? "퇴근 완료" : "근무 중"}</span></td></tr>)}</tbody></table>{!attendance.some(a => a.day.startsWith(month)) && <div className="empty"><CalendarDays size={28} /><b>이번 달의 첫 기록을 기다리고 있어요</b><span>출근하기 버튼으로 오늘의 근무를 시작하세요.</span></div>}</div><div className="panel-footnote">기록 시간은 휴게시간 차감 전 출퇴근 시각의 차이입니다. 최근 500건까지 표시됩니다.</div></section></>}
      {tab === 3 && <><section className="remote-banner"><span className="remote-symbol"><Monitor size={30} /></span><div><h2>어디서든, 함께 일하는 중</h2><p>현재 업무와 앱 활동 상태를 팀에 공유하세요.</p></div><button className={sharing ? "secondary" : "primary"} disabled={busy} onClick={() => sharing ? act({ action: "remote-stop" }, "상태 공유를 종료했습니다.") : setRemoteModal(true)}>{sharing ? <><X size={16} />공유 종료</> : <><Radio size={16} />내 업무 상태 공유</>}</button></section><div className="remote-stats"><span><i className="live-dot" />활동 중 <b>{activeRemote.length}</b></span><span>자리 비움 <b>{remote.filter(r => remoteState(r, +clock) === "자리 비움").length}</b></span><span>연결 끊김 <b>{remote.filter(r => remoteState(r, +clock) === "연결 끊김").length}</b></span><span className="refresh-label"><Activity size={15} />15초 자동 갱신</span></div>{remoteCards()}<div className="info-box"><ShieldCheck size={22} /><div><b>투명한 상태 공유로 연결되는 팀</b><p>동의 후 공유한 업무, 앱 연결 시각, 앱 내 클릭·키 입력의 발생 시각만 기록합니다. 입력 내용, 화면, 카메라는 수집하지 않습니다. 5분간 앱 활동이 없거나 탭을 숨기면 자리 비움, 90초 이상 연결되지 않으면 연결 끊김으로 표시됩니다. 실제 업무 수행 여부를 보장하는 지표는 아닙니다. 원격 현황은 최신 공유 상태를 보관합니다.</p></div></div></>}
      {tab === 4 && <><div className="payroll-toolbar"><input aria-label="정산 월" type="month" value={month} onChange={e => setMonth(e.target.value)} />{isAdmin && <button className="primary" disabled={busy || !month} onClick={() => act({ action: "payroll-generate", month }, "정산 초안을 생성했습니다. 기존 기록은 유지됩니다.")}><Plus size={16} />월 정산 초안 생성</button>}</div><div className="payroll-summary"><div><span>정산 대상</span><strong>{monthPayroll.length}<small>명</small></strong></div><div><span>지급 예정 합계</span><strong>₩ {won(monthPayroll.reduce((s, p) => s + p.base + p.adjustment - p.deduction, 0))}</strong></div><div><span>검토 완료</span><strong>{monthPayroll.filter(p => p.status === "검토 완료").length}<small>건</small></strong></div></div><section className="panel"><div className="panel-heading"><h3>{month} 급여·정산 내역</h3><span className="badge gray">정산 초안</span></div><div className="table-scroll"><table><thead><tr><th>구성원</th><th>유형</th><th>기본급 / 계약금</th><th>수당</th><th>공제</th><th>지급 예정액</th><th>검토 상태</th>{isAdmin && <th>관리</th>}</tr></thead><tbody>{monthPayroll.map(p => <tr key={p.id}><td><strong>{findEmployee(p.employee_id)?.name}</strong></td><td>{findEmployee(p.employee_id)?.kind}</td><td>{won(p.base)}</td><td>{won(p.adjustment)}</td><td>{won(p.deduction)}</td><td><b>₩ {won(p.base + p.adjustment - p.deduction)}</b></td><td><span className={`badge ${p.status === "검토 완료" ? "green" : "orange"}`}>{p.status}</span></td>{isAdmin && <td><button className="text-button" onClick={() => setPayrollModal(p)}>수정</button></td>}</tr>)}</tbody></table>{!monthPayroll.length && <div className="empty"><CreditCard size={28} /><b>생성된 정산 내역이 없습니다</b><span>{isAdmin ? "월 정산 초안을 생성한 후 수당과 공제를 입력하세요." : "관리자가 정산 내역을 생성하면 확인할 수 있습니다."}</span></div>}</div></section><div className="info-box"><CircleHelp size={21} /><p>등록된 월 기본급·계약금을 기준으로 생성하는 정산 초안입니다. 세금·보험·근무일수는 자동 계산하지 않으며, 수당과 공제는 담당자가 직접 확인해 입력합니다. 검토 완료는 실제 송금 상태와 별개입니다.</p></div></>}
      <footer className="main-footer"><span>HAMS WORKS <span>·</span> A better way to work together.</span><span><span className="live-dot" />{isAdmin ? "관리자 워크스페이스" : "개인 워크스페이스"}</span></footer></main></div>
    {(employeeModal || payrollModal || remoteModal || help) && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) { setEmployeeModal(null); setPayrollModal(null); setRemoteModal(false); setHelp(false); } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{employeeModal ? employeeModal.id ? "구성원 정보 수정" : "새 구성원 등록" : payrollModal ? "정산 내역 수정" : remoteModal ? "원격근무 상태 공유" : "워크스페이스 이용 가이드"}</h2><button className="icon-button" disabled={busy} aria-label="닫기" onClick={() => { setEmployeeModal(null); setPayrollModal(null); setRemoteModal(false); setHelp(false); }}><X size={21} /></button></div>
      {employeeModal && <form onSubmit={async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); if (await act({ ...f, action: "employee-save", id: employeeModal.id, salary: Number(f.salary) }, "구성원 정보를 저장했습니다.")) setEmployeeModal(null); }}><div className="form-grid">{[["name", "이름", "text"], ["email", "이메일", "email"], ["department", "소속", "text"], ["position", "직무", "text"], ["project", "참여 프로젝트", "text"], ["joined", "입사 / 계약일", "date"]].map(([key, label, type]) => <label key={key}>{label}<input autoFocus={key === "name"} name={key} type={type} required maxLength={100} defaultValue={String(employeeModal[key as keyof Employee] || "")} /></label>)}<label>계약 유형<select name="kind" defaultValue={employeeModal.kind}><option>직원</option><option>프리랜서</option></select></label><label>월 기본급 / 계약금 (원)<input type="number" name="salary" min="0" max="1000000000" step="1" required defaultValue={employeeModal.salary || 0} /></label></div><p className="caption">구성원 등록은 로그인 계정을 생성하지 않습니다.</p><button className="primary form-submit" disabled={busy}>정보 저장 <Check size={16} /></button></form>}
      {payrollModal && <form onSubmit={async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); if (await act({ action: "payroll-save", id: payrollModal.id, adjustment: Number(f.adjustment), deduction: Number(f.deduction), status: f.status }, "정산 내역을 저장했습니다.")) setPayrollModal(null); }}><p>{findEmployee(payrollModal.employee_id)?.name} · {payrollModal.month} · 기본 ₩ {won(payrollModal.base)}</p><label>수당 (원)<input autoFocus type="number" name="adjustment" min="0" max="1000000000" required defaultValue={payrollModal.adjustment} /></label><label>공제 (원)<input type="number" name="deduction" min="0" max="1000000000" required defaultValue={payrollModal.deduction} /></label><label>검토 상태<select name="status" defaultValue={payrollModal.status}><option>검토 대기</option><option>검토 완료</option></select></label><button className="primary form-submit" disabled={busy}>저장하기</button></form>}
      {remoteModal && <form onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await act({ action: "remote-start", task: f.get("task"), consent: f.get("consent") === "on" }, "업무 상태 공유를 시작했습니다.")) setRemoteModal(false); }}><p>먼저 출퇴근 관리에서 원격 근무로 출근해 주세요.</p><label>지금 진행하는 업무<input autoFocus name="task" required maxLength={200} placeholder="예: 커머스 플랫폼 주문 화면 개발" /></label><div className="info-box"><p>업무 내용, 연결 시각, 앱 내 최근 활동 시각과 탭 표시 상태가 관리자에게 공유됩니다. 공유 종료·퇴근·로그아웃 시 종료되며, 앱을 닫으면 90초 후 연결 끊김으로 표시됩니다.</p></div><label className="checkbox-label"><input type="checkbox" name="consent" required />위 내용을 확인했으며 상태 공유에 동의합니다.</label><button className="primary form-submit" disabled={busy}>공유 시작 <Radio size={16} /></button></form>}
      {help && <div className="guide"><p><b>1. 구성원 관리</b><br />관리자는 직원·프리랜서 정보를 등록하고 수정합니다. 직원은 자신의 정보만 볼 수 있습니다.</p><p><b>2. 출퇴근 관리</b><br />근무 장소를 선택하고 출근·퇴근 버튼으로 기록합니다. 한국 시간으로 하루 한 번 출근할 수 있습니다.</p><p><b>3. 원격근무</b><br />원격 출근 후 업무를 입력하고 공유에 동의하세요. 상태 공유는 이 앱에서 발생한 활동을 기준으로 합니다.</p><p><b>4. 급여·정산</b><br />관리자가 월 초안을 생성하고 수당·공제를 입력합니다. 구성원은 본인 내역만 조회합니다.</p><div className="info-box">샘플 계정의 기본 비밀번호는 hams1234! 입니다. 운영 환경에서는 샘플 로그인이 기본적으로 차단됩니다.</div></div>}
      {error && <p className="modal-error" role="alert">{error}</p>}
    </section></div>}
  </div>;
}
