import { CircleHelp, CreditCard, Plus } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import type { WorkspaceAction } from "@/types";
import type { Payroll } from "@/lib/types";
import { won } from "@/utils";

type Props = {
  data: Snapshot;
  month: string;
  setMonth: (month: string) => void;
  busy: boolean;
  act: WorkspaceAction;
  onEditPayroll: (payroll: Payroll) => void;
};

export default function PayrollModule({ data, month, setMonth, busy, act, onEditPayroll }: Props) {
  const { user, employees, payroll } = data;
  const isAdmin = user.role === "admin";
  const monthPayroll = payroll.filter((p) => p.month === month);
  const findEmployee = (id: string) => employees.find((p) => p.id === id);
  return (
    <>
      <div className="payroll-toolbar">
        <input
          aria-label="정산 월"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        {isAdmin && (
          <button
            className="primary"
            disabled={busy || !month}
            onClick={() =>
              act(
                { action: "payroll-generate", month },
                "정산 초안을 생성했습니다. 기존 기록은 유지됩니다.",
              )
            }
          >
            <Plus size={16} />월 정산 초안 생성
          </button>
        )}
      </div>
      <div className="payroll-summary">
        <div>
          <span>정산 대상</span>
          <strong>
            {monthPayroll.length}
            <small>명</small>
          </strong>
        </div>
        <div>
          <span>지급 예정 합계</span>
          <strong>
            ₩{" "}
            {won(
              monthPayroll.reduce(
                (s, p) => s + p.base + p.adjustment - p.deduction,
                0,
              ),
            )}
          </strong>
        </div>
        <div>
          <span>검토 완료</span>
          <strong>
            {
              monthPayroll.filter((p) => p.status === "검토 완료")
                .length
            }
            <small>건</small>
          </strong>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>{month} 급여·정산 내역</h3>
          <span className="badge gray">정산 초안</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>구성원</th>
                <th>유형</th>
                <th>기본급 / 계약금</th>
                <th>수당</th>
                <th>공제</th>
                <th>지급 예정액</th>
                <th>검토 상태</th>
                {isAdmin && <th>관리</th>}
              </tr>
            </thead>
            <tbody>
              {monthPayroll.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{findEmployee(p.employee_id)?.name}</strong>
                  </td>
                  <td>{findEmployee(p.employee_id)?.kind}</td>
                  <td>{won(p.base)}</td>
                  <td>{won(p.adjustment)}</td>
                  <td>{won(p.deduction)}</td>
                  <td>
                    <b>₩ {won(p.base + p.adjustment - p.deduction)}</b>
                  </td>
                  <td>
                    <span
                      className={`badge ${p.status === "검토 완료" ? "green" : "orange"}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <button
                        className="text-button"
                        onClick={() => onEditPayroll(p)}
                      >
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!monthPayroll.length && (
            <div className="empty">
              <CreditCard size={28} />
              <b>생성된 정산 내역이 없습니다</b>
              <span>
                {isAdmin
                  ? "월 정산 초안을 생성한 후 수당과 공제를 입력하세요."
                  : "관리자가 정산 내역을 생성하면 확인할 수 있습니다."}
              </span>
            </div>
          )}
        </div>
      </section>
      <div className="info-box">
        <CircleHelp size={21} />
        <p>
          등록된 월 기본급·계약금을 기준으로 생성하는 정산 초안입니다.
          세금·보험·근무일수는 자동 계산하지 않으며, 수당과 공제는
          담당자가 직접 확인해 입력합니다. 검토 완료는 실제 송금 상태와
          별개입니다.
        </p>
      </div>
    </>
  );
}
