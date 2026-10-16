import { MoreHorizontal } from "lucide-react";
import type { Attendance, Employee } from "@/lib/types";
import Avatar from "./avatar";

type Props = {
  employees: Employee[];
  todayRecords: Attendance[];
  isAdmin: boolean;
  onEdit: (employee: Employee) => void;
  compact?: boolean;
};

export default function PeopleTable({ employees, todayRecords, isAdmin, onEdit, compact = false }: Props) {

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>구성원</th>
            <th>소속 / 직무</th>
            <th>계약 유형</th>
            <th>참여 프로젝트</th>
            <th>{compact ? "오늘의 근무" : "입사 / 계약일"}</th>
            {!compact && isAdmin && (
              <th>
                <span className="sr-only">관리</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {(compact ? employees.slice(0, 5) : employees).map((p) => {
            const a = todayRecords.find((a) => a.employee_id === p.id);
            return (
              <tr key={p.id}>
                <td>
                  <div className="person-cell">
                    <Avatar person={p} small />
                    <div>
                      <strong>{p.name}</strong>
                      <small>{p.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <b>{p.department}</b>
                  <small>{p.position}</small>
                </td>
                <td>
                  <span
                    className={`badge ${p.kind === "직원" ? "blue" : "purple"}`}
                  >
                    {p.kind}
                  </span>
                </td>
                <td>{p.project}</td>
                <td>
                  {compact ? (
                    <span
                      className={`status-text ${a && !a.check_out ? "online" : ""}`}
                    >
                      <i />
                      {a
                        ? a.check_out
                          ? "퇴근"
                          : `${a.mode} 근무`
                        : "출근 전"}
                    </span>
                  ) : (
                    p.joined
                  )}
                </td>
                {!compact && isAdmin && (
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`${p.name} 정보 수정`}
                      onClick={() => onEdit(p)}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!compact && !employees.length && (
        <div className="empty">검색 결과가 없습니다.</div>
      )}
    </div>
  );
}
