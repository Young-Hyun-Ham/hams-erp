import { Activity, Monitor, Radio, ShieldCheck, X } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import type { WorkspaceAction } from "@/types";
import RemoteCards from "./remote-cards";
import { remoteState } from "@/utils";

type Props = {
  data: Snapshot;
  clock: Date;
  sharing: boolean;
  busy: boolean;
  act: WorkspaceAction;
  onStartSharing: () => void;
  detectionMessage: string;
  onEnableDetection: () => Promise<void>;
};

export default function RemoteModule({ data, clock, sharing, busy, act, onStartSharing, detectionMessage, onEnableDetection }: Props) {
  const { employees, remote } = data;
  const activeRemote = remote.filter((r) => remoteState(r, +clock) === "활동 중");
  return (
    <>
      <section className="remote-banner">
        <span className="remote-symbol">
          <Monitor size={30} />
        </span>
        <div>
          <h2>어디서든, 함께 일하는 중</h2>
          <p>현재 업무와 기기 활동 상태를 팀에 공유하세요.</p>
        </div>
        <button
          className={sharing ? "secondary" : "primary"}
          disabled={busy}
          onClick={() =>
            sharing
              ? act(
                { action: "remote-stop" },
                "상태 공유를 종료했습니다.",
              )
              : onStartSharing()
          }
        >
          {sharing ? (
            <>
              <X size={16} />
              공유 종료
            </>
          ) : (
            <>
              <Radio size={16} />내 업무 상태 공유
            </>
          )}
        </button>
      </section>
      {sharing && (
        <div className="info-box">
          <p role="status">{detectionMessage || "기기 활동 감지 상태 확인 중…"}</p>
          <button className="secondary" disabled={busy} onClick={() => void onEnableDetection()}>기기 활동 감지 허용</button>
        </div>
      )}
      <div className="remote-stats">
        <span>
          <i className="live-dot" />
          활동 중 <b>{activeRemote.length}</b>
        </span>
        <span>
          자리 비움{" "}
          <b>
            {
              remote.filter(
                (r) => remoteState(r, +clock) === "자리 비움",
              ).length
            }
          </b>
        </span>
        <span>
          연결 확인 필요{" "}
          <b>
            {
              remote.filter(
                (r) => remoteState(r, +clock) === "연결 확인 필요",
              ).length
            }
          </b>
        </span>
        <span>자동 판정 불가 <b>{remote.filter((r) => remoteState(r, +clock) === "자동 판정 불가").length}</b></span>
        <span className="refresh-label">
          <Activity size={15} />
          15초 자동 갱신
        </span>
      </div>
      <RemoteCards employees={employees} remote={remote} clock={clock} />
      <div className="info-box">
        <ShieldCheck size={22} />
        <div>
          <b>투명한 상태 공유로 연결되는 팀</b>
          <p>
            동의 후 업무와 연결 시각, 기기 활동·유휴 및 화면 잠금 상태를 공유합니다.
            지원 브라우저와 활동 감지 권한이 필요합니다. 브라우저를 최소화해도 기기를 사용 중이면 활동 중으로 표시하며,
            {data.remoteSettings.idleMinutes}분간 기기 입력이 없거나 화면을 잠그면 자리 비움으로 표시합니다.
            권한 거절·미지원 시 자동 판정 불가, 3분 넘게 통신이 없으면 연결 확인 필요로 표시합니다.
            입력 내용·좌표·사용 프로그램·화면·카메라는 수집하지 않습니다.
            브라우저 종료·절전·탭 중단 시 상태 전달이 지연될 수 있으며, 실제 업무 수행 여부를 보장하지 않습니다.
          </p>
        </div>
      </div>
    </>
  );
}
