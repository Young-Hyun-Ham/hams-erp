import { Search } from "lucide-react";
import type { Employee, Snapshot } from "@/lib/types";
import PeopleTable from "./people-table";
import { day } from "@/utils";

type Props = {
  data: Snapshot;
  clock: Date;
  query: string;
  setQuery: (query: string) => void;
  kind: string;
  setKind: (kind: string) => void;
  onEditEmployee: (employee: Employee) => void;
};

export default function PeopleModule({ data, clock, query, setQuery, kind, setKind, onEditEmployee }: Props) {
  const { user, employees, attendance } = data;
  const isAdmin = user.role === "admin";
  const todayRecords = attendance.filter((a) => a.day === day(clock));
  const filteredEmployees = employees.filter((p) =>
    (kind === "전체" || p.kind === kind) &&
    `${p.name} ${p.department} ${p.project} ${p.email}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <section className="panel">
      <div className="table-toolbar">
        <div className="tabs">
          {["전체", "직원", "프리랜서"].map((k) => (
            <button
              key={k}
              className={kind === k ? "selected" : ""}
              onClick={() => setKind(k)}
            >
              {k}
              <span>
                {
                  employees.filter((p) => k === "전체" || p.kind === k)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="구성원 검색"
            placeholder="이름, 소속, 프로젝트 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <PeopleTable
        employees={filteredEmployees}
        todayRecords={todayRecords}
        isAdmin={isAdmin}
        onEdit={onEditEmployee}
      />
    </section>
  );
}
