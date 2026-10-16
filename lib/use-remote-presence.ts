"use client";

import { useCallback, useEffect, useState } from "react";
import type { Remote } from "./types";

interface DeviceIdleDetector extends EventTarget {
  userState: "active" | "idle" | null;
  screenState: "locked" | "unlocked" | null;
  start(options: { threshold: number; signal: AbortSignal }): Promise<void>;
}
type IdleConstructor = {
  new(): DeviceIdleDetector;
  requestPermission(): Promise<PermissionState>;
};
function idleAPI(): IdleConstructor | undefined {
  if (!window.isSecureContext) return;
  return (window as Window & { IdleDetector?: IdleConstructor }).IdleDetector;
}

export function useRemotePresence(sharing: boolean, employeeId: string | undefined, idleMinutes: number, onError: (message: string) => void) {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");

  const requestPermission = useCallback(async () => {
    const API = idleAPI();
    if (!API) {
      setMessage("이 브라우저 또는 접속 환경에서는 자동 판정을 지원하지 않습니다. 공유는 계속할 수 있습니다.");
      return;
    }
    try {
      const permission = await API.requestPermission();
      setMessage(permission === "granted" ? "기기 활동 감지를 허용했습니다." : "활동 감지 권한이 없어 자동 판정 불가로 표시합니다. 브라우저 사이트 설정에서 허용할 수 있습니다.");
    } catch {
      setMessage("활동 감지를 시작할 수 없습니다. 자동 판정 불가로 표시합니다.");
    }
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!sharing || !employeeId) return;
    const controller = new AbortController();
    let detector: DeviceIdleDetector | undefined;
    let permission: PermissionStatus | undefined;
    let userState: Remote["user_state"] = "unknown";
    let screenState: Remote["screen_state"] = "unknown";
    let queue = Promise.resolve();

    // Serialize sends so a delayed response cannot overwrite a newer state.
    const beat = () => {
      queue = queue.then(async () => {
        if (controller.signal.aborted) return;
        try {
          const response = await fetch("/api/erp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "heartbeat", userState, screenState, visible: document.visibilityState === "visible" }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || "연결 상태를 전송하지 못했습니다.");
          }
        } catch (error) {
          if (!controller.signal.aborted) onError(error instanceof Error ? error.message : "연결 상태를 전송하지 못했습니다.");
        }
      });
    };
    const changed = () => {
      userState = detector?.userState ?? "unknown";
      screenState = detector?.screenState ?? "unknown";
      beat();
    };
    const permissionChanged = () => {
      // Recreate the detector for both permission grants and revocations.
      setRevision((value) => value + 1);
    };
    async function start() {
      const API = idleAPI();
      if (!API) {
        setMessage("자동 판정 미지원 환경입니다. 연결과 업무 공유는 유지합니다.");
        return;
      }
      try {
        const current = await navigator.permissions.query({ name: "idle-detection" as PermissionName });
        if (controller.signal.aborted) return;
        permission = current;
        permission.addEventListener("change", permissionChanged);
        if (permission.state !== "granted") {
          setMessage("자동 판정을 사용하려면 기기 활동 감지를 허용해 주세요.");
          return;
        }
        detector = new API();
        detector.addEventListener("change", changed);
        await detector.start({ threshold: idleMinutes * 60000, signal: controller.signal });
        if (controller.signal.aborted) return;
        changed();
        setMessage(`기기 활동 감지 중 · 입력 없음 ${idleMinutes}분 또는 화면 잠금 시 자리 비움`);
      } catch {
        if (controller.signal.aborted) return;
        userState = "unknown";
        screenState = "unknown";
        beat();
        setMessage("활동 감지를 사용할 수 없어 자동 판정 불가로 표시합니다.");
      }
    }
    beat();
    void start();
    const timer = setInterval(beat, 20000);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("online", beat);
    return () => {
      controller.abort();
      clearInterval(timer);
      detector?.removeEventListener("change", changed);
      permission?.removeEventListener("change", permissionChanged);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("online", beat);
    };
  }, [sharing, employeeId, idleMinutes, revision, onError]);

  return { requestPermission, message };
}
