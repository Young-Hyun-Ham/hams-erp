import { ArrowRight, Building2, Monitor } from "lucide-react";
import type { Attendance, Employee } from "@/lib/types";
import type { WorkspaceAction } from "@/types";
import { day, time } from "@/utils";

type Props = {
  attendance: Attendance[];
  user: Employee;
  clock: Date;
  mode: string;
  setMode: (mode: string) => void;
  busy: boolean;
  act: WorkspaceAction;
};

export default function AttendanceControl({ attendance, user, clock, mode, setMode, busy, act }: Props) {
  const today = day(clock);
  const myToday = attendance.find((a) => a.day === today && a.employee_id === user.id);
  const myOpen = attendance.find((a) => a.employee_id === user.id && !a.check_out);
  return (
    <section className="panel attendance-card">
      <div className="panel-heading">
        <h3>나의 근무 현황</h3>
        <span className={`badge ${myOpen ? "green" : "gray"}`}>
          {myOpen ? "근무 중" : myToday?.check_out ? "퇴근 완료" : "출근 전"}
        </span>
      </div>
      <div className="clock">
        {clock.toLocaleTimeString("ko-KR", {
          timeZone: "Asia/Seoul",
          hour12: false,
        })}
        <span>SEOUL, KST</span>
      </div>
      <div className="attendance-times">
        <span>
          출근 <b>{time((myOpen || myToday)?.check_in)}</b>
        </span>
        <span>
          퇴근 <b>{time(myToday?.check_out)}</b>
        </span>
      </div>
      <div className="mode-switch">
        {["사무실", "원격"].map((m) => (
          <button
            key={m}
            className={(myOpen?.mode || mode) === m ? "selected" : ""}
            disabled={!!myOpen || !!myToday}
            onClick={() => setMode(m)}
          >
            {m === "사무실" ? <Building2 size={15} /> : <Monitor size={15} />}
            {m} 근무
          </button>
        ))}
      </div>
      <div className="attendance-actions">
        <button
          className="primary"
          disabled={busy || !!myToday || !!myOpen}
          onClick={() =>
            act({ action: "checkin", mode }, "출근이 기록되었습니다.")
          }
        >
          <ArrowRight size={17} />
          출근하기
        </button>
        <button
          className="secondary"
          disabled={busy || !myOpen}
          onClick={() =>
            act(
              { action: "checkout" },
              "퇴근이 기록되었습니다. 수고하셨습니다!",
            )
          }
        >
          퇴근하기
        </button>
      </div>
      <p className="caption">출퇴근 시각은 서버 시간으로 저장됩니다.</p>
    </section>
  );
}
