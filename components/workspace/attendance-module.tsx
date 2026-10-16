import { ArrowDownToLine, CalendarDays, ShieldCheck } from "lucide-react";
import AttendanceControl from "./attendance-control";
import type { Snapshot } from "@/lib/types";
import type { WorkspaceAction } from "@/types";
import { day, duration, time } from "@/utils";

type Props = {
  data: Snapshot;
  clock: Date;
  mode: string;
  setMode: (mode: string) => void;
  month: string;
  setMonth: (month: string) => void;
  busy: boolean;
  act: WorkspaceAction;
};

export default function AttendanceModule({ data, clock, mode, setMode, month, setMonth, busy, act }: Props) {
  const { user, attendance, employees } = data;
  const isAdmin = user.role === "admin";
  const todayRecords = attendance.filter((a) => a.day === day(clock));
  const working = todayRecords.filter((a) => !a.check_out);
  const findEmployee = (id: string) => employees.find((p) => p.id === id);
  const exportCSV = () => {
    const rows = [
      ["이름", "날짜", "근무 장소", "출근", "퇴근"],
      ...attendance
        .filter((a) => a.day.startsWith(month))
        .map((a) => [
          findEmployee(a.employee_id)?.name || "",
          a.day,
          a.mode,
          time(a.check_in),
          time(a.check_out),
        ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                `"${String(v)
                  .replace(/^[=+@-]/, "'")
                  .replaceAll('"', '""')}"`,
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `HAMS-근태-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="attendance-layout">
        <AttendanceControl
          attendance={attendance}
          user={user}
          clock={clock}
          mode={mode}
          setMode={setMode}
          busy={busy}
          act={act}
        />
        <section className="panel attendance-summary">
          <span className="eyebrow">TODAY AT A GLANCE</span>
          <h2>오늘, 우리 팀은</h2>
          <div className="summary-numbers">
            <div>
              <strong>{todayRecords.length}</strong>
              <span>출근 완료</span>
            </div>
            <div>
              <strong>{working.length}</strong>
              <span>근무 중</span>
            </div>
            <div>
              <strong>
                {todayRecords.filter((a) => a.check_out).length}
              </strong>
              <span>퇴근 완료</span>
            </div>
          </div>
          <p>
            <ShieldCheck size={16} />
            출퇴근 기록은 로그인한 본인의 계정으로 저장됩니다.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>{isAdmin ? "구성원" : "나의"} 출퇴근 기록</h3>
          <div className="inline-controls">
            <input
              aria-label="근태 조회 월"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button className="secondary" onClick={exportCSV}>
              <ArrowDownToLine size={16} />
              CSV 다운로드
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>구성원</th>
                <th>근무일</th>
                <th>근무 장소</th>
                <th>출근</th>
                <th>퇴근</th>
                <th>기록 시간</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {attendance
                .filter((a) => a.day.startsWith(month))
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>
                        {findEmployee(a.employee_id)?.name}
                      </strong>
                    </td>
                    <td>{a.day}</td>
                    <td>{a.mode}</td>
                    <td>{time(a.check_in)}</td>
                    <td>{time(a.check_out)}</td>
                    <td>
                      {duration(
                        a.check_in,
                        a.check_out || data.serverTime,
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${a.check_out ? "gray" : "green"}`}
                      >
                        {a.check_out ? "퇴근 완료" : "근무 중"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!attendance.some((a) => a.day.startsWith(month)) && (
            <div className="empty">
              <CalendarDays size={28} />
              <b>이번 달의 첫 기록을 기다리고 있어요</b>
              <span>출근하기 버튼으로 오늘의 근무를 시작하세요.</span>
            </div>
          )}
        </div>
        <div className="panel-footnote">
          기록 시간은 휴게시간 차감 전 출퇴근 시각의 차이입니다. 최근
          500건까지 표시됩니다.
        </div>
      </section>
    </>
  );
}
