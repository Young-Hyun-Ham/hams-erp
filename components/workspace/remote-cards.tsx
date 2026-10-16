import { Clock3, Monitor } from "lucide-react";
import type { Employee, Remote } from "@/lib/types";
import Avatar from "./avatar";
import { remoteState, time } from "@/utils";

type Props = { employees: Employee[]; remote: Remote[]; clock: Date; compact?: boolean };

export default function RemoteCards({ employees, remote, clock, compact = false }: Props) {
  const list = compact
    ? remote.filter((r) => !r.ended_at).slice(0, 3)
    : remote.filter((r) => !r.ended_at);
  if (!list.length)
    return (
      <div className="empty">
        <Monitor size={29} />
        <b>아직 공유 중인 원격근무가 없어요</b>
        <span>원격 출근 후 업무 상태 공유를 시작해 보세요.</span>
      </div>
    );
  return (
    <div className={compact ? "remote-list" : "remote-grid"}>
      {list.map((r) => {
        const person = employees.find((p) => p.id === r.employee_id);
        if (!person) return null;
        const status = remoteState(r, +clock);
        return (
          <div className="remote-person" key={r.employee_id}>
            <div className="remote-person-top">
              <Avatar person={person} />
              <div>
                <strong>{person.name}</strong>
                <span>{person.position}</span>
              </div>
              <span
                className={`badge ${status === "활동 중" ? "green" : "gray"}`}
              >
                <i />
                {status}
              </span>
            </div>
            <p>{r.task}</p>
            <div className="remote-meta">
              <span>
                <Clock3 size={13} />
                시작 {time(r.started_at)}
              </span>
              <span>연결 {time(r.heartbeat)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

}
