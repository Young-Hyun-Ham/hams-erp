import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  CreditCard,
  Monitor,
  Radio,
  Users,
} from "lucide-react";
import type { Employee, Snapshot } from "@/lib/types";
import type { WorkspaceAction } from "@/types";
import AttendanceControl from "./attendance-control";
import PeopleTable from "./people-table";
import RemoteCards from "./remote-cards";
import { day, remoteState, won } from "@/utils";

type Props = {
  data: Snapshot;
  clock: Date;
  mode: string;
  setMode: (mode: string) => void;
  busy: boolean;
  act: WorkspaceAction;
  changeTab: (tab: number) => void;
  onEditEmployee: (employee: Employee) => void;
};

export default function DashboardModule({ data, clock, mode, setMode, busy, act, changeTab, onEditEmployee }: Props) {
  const { user, employees, attendance, remote, payroll } = data;
  const isAdmin = user.role === "admin";
  const today = day(clock);
  const todayRecords = attendance.filter((a) => a.day === today);
  const working = todayRecords.filter((a) => !a.check_out);
  const remoteWorking = working.filter((a) => a.mode === "원격");
  const activeRemote = remote.filter((r) => remoteState(r, +clock) === "활동 중");
  return (
    <>
      <div className="overview-stats">
        {[
          {
            label: isAdmin ? "전체 구성원" : "나의 프로필",
            value: employees.length,
            suffix: "명",
            icon: Users,
            color: "blue",
            detail: `직원 ${employees.filter((e) => e.kind === "직원").length} · 프리랜서 ${employees.filter((e) => e.kind === "프리랜서").length}`,
            target: 1,
          },
          {
            label: "오늘 근무 중",
            value: working.length,
            suffix: "명",
            icon: Clock3,
            color: "mint",
            detail: `사무실 ${working.filter((a) => a.mode === "사무실").length} · 원격 ${remoteWorking.length}`,
            target: 2,
          },
          {
            label: "원격 활동 중",
            value: activeRemote.length,
            suffix: "명",
            icon: Monitor,
            color: "lavender",
            detail: "기기 활동 및 화면 잠금 기준",
            target: 3,
          },
          {
            label: "이번 달 정산 예정",
            value: won(
              payroll
                .filter((p) => p.month === today.slice(0, 7))
                .reduce(
                  (s, p) => s + p.base + p.adjustment - p.deduction,
                  0,
                ),
            ),
            suffix: "원",
            icon: CreditCard,
            color: "peach",
            detail: "수당·공제를 반영한 정산 초안",
            target: 4,
          },
        ].map((s) => (
          <button
            key={s.label}
            className="stat-card"
            onClick={() => changeTab(s.target)}
          >
            <div className="stat-title">
              {s.label}
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={18} />
              </span>
            </div>
            <div
              className={`stat-number ${s.suffix === "원" ? "money-number" : ""}`}
            >
              {s.value}
              <span>{s.suffix}</span>
            </div>
            <div className="stat-detail">
              {s.detail}
              <ArrowUpRight size={15} />
            </div>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-left">
          <section className="welcome-banner">
            <div>
              <span className="eyebrow">BETTER TOGETHER</span>
              <h2>
                사람과 일을 연결하는
                <br />
                우리 팀의 워크스페이스
              </h2>
              <p>서로의 현황을 알고, 함께 일하는 흐름을 만들어가요.</p>
              <button onClick={() => changeTab(1)}>
                우리 팀 살펴보기 <ArrowRight size={16} />
              </button>
            </div>
            <div className="banner-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="art-tile tile-one">
                <Users size={38} />
              </div>
              <div className="art-tile tile-two">
                <BriefcaseBusiness size={32} />
              </div>
              <span className="art-star">✳</span>
              <span className="art-dot" />
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>
                  우리 팀 구성원{" "}
                  <span className="count">{employees.length}</span>
                </h3>
                <p>다양한 전문성이 모여 더 큰 가치를 만듭니다.</p>
              </div>
              <button
                className="text-button"
                onClick={() => changeTab(1)}
              >
                전체 보기 <ChevronRight size={16} />
              </button>
            </div>
            <PeopleTable employees={employees} todayRecords={todayRecords} isAdmin={isAdmin} onEdit={onEditEmployee} compact />
          </section>
        </div>
        <div className="dashboard-right">
          <AttendanceControl
            attendance={attendance}
            user={user}
            clock={clock}
            mode={mode}
            setMode={setMode}
            busy={busy}
            act={act}
          />
          <section className="panel">
            <div className="panel-heading">
              <h3>
                <span className="live-dot" />
                원격근무 라이브
              </h3>
              <button
                className="icon-button"
                aria-label="원격근무 전체 보기"
                onClick={() => changeTab(3)}
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
            <RemoteCards employees={employees} remote={remote} clock={clock} compact />
            <div className="panel-footnote">
              <Radio size={13} />
              15초마다 최신 현황을 확인합니다.
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
