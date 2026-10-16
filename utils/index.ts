import type { Remote } from "@/lib/types";

export const won = (v: number) => new Intl.NumberFormat("ko-KR").format(v);
export const day = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export const time = (s?: string | null) =>
  s
    ? new Date(s).toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    : "—";
export const duration = (start: string, end: string) => {
  const m = Math.max(
    0,
    Math.floor((+new Date(end) - +new Date(start)) / 60000),
  );
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
};
export function remoteState(r: Remote | undefined, now: number) {
  if (!r || r.ended_at) return "공유 안 함";
  if (now - +new Date(r.heartbeat) > 180000) return "연결 확인 필요";
  if (r.screen_state === "locked" || r.user_state === "idle") return "자리 비움";
  if (r.user_state !== "active" || r.screen_state !== "unlocked") return "자동 판정 불가";
  return "활동 중";
}
