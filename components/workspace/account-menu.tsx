import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ChevronDown, KeyRound, Settings, UserRound, X } from "lucide-react";
import type { Employee, RemoteSettings } from "@/lib/types";
import { MIN_IDLE_MINUTES, MAX_IDLE_MINUTES } from "@/lib/remote-settings";
import PasswordChange from "@/app/password-change";
import Avatar from "./avatar";
import styles from "./account-menu.module.css";

type Props = {
  user: Employee;
  remoteSettings: RemoteSettings;
  disabled: boolean;
  onUpdated: (message: string) => Promise<void>;
};

export default function AccountMenu({ user, remoteSettings, disabled, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"profile" | "password" | "remote-settings" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const menuId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (!modal) return;
    const button = trigger.current;
    return () => button?.focus();
  }, [modal]);

  function show(next: "profile" | "password" | "remote-settings") {
    setOpen(false);
    setError("");
    setModal(next);
  }

  function containFocus(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) setModal(null);
    }
    if (event.key !== "Tab") return;
    const fields = dialog.current?.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)");
    if (!fields?.length) return;
    const first = fields[0], last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modal === "remote-settings"
          ? { action: "remote-settings-save", idleMinutes: Number(values.get("idleMinutes")) }
          : { action: "profile-save", ...Object.fromEntries(values) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "변경 내용을 저장하지 못했습니다.");
      await onUpdated(modal === "remote-settings" ? "원격지원설정을 저장했습니다." : "회원정보를 변경했습니다.");
      setModal(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div ref={root} className={styles.root} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}>
        <button ref={trigger} type="button" className={styles.trigger}
          disabled={disabled} aria-expanded={open} aria-controls={menuId}
          onClick={() => setOpen(!open)}>
          <Avatar person={user} small />
          <span className={styles.name}>{user.name}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && (
          <div id={menuId} className={styles.menu}>
            <button type="button" onClick={() => show("profile")}>
              <UserRound size={16} />회원정보변경
            </button>
            <button type="button" onClick={() => show("password")}>
              <KeyRound size={16} />비밀번호변경
            </button>
            {user.role === "admin" && (
              <button type="button" onClick={() => show("remote-settings")}>
                <Settings size={16} />원격지원설정
              </button>
            )}
          </div>
        )}
      </div>
      {(modal === "profile" || (modal === "remote-settings" && user.role === "admin")) && (
        <div className="modal-backdrop" onKeyDown={containFocus} onClick={(event) => {
          if (event.target === event.currentTarget && !busy) setModal(null);
        }}>
          <section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="modal-heading">
              <h2 id={titleId}>{modal === "remote-settings" ? "원격지원설정" : "회원정보변경"}</h2>
              <button type="button" className="icon-button" aria-label="닫기" disabled={busy} onClick={() => setModal(null)}>
                <X size={21} />
              </button>
            </div>
            <form onSubmit={saveAccount}>
              {modal === "remote-settings" ? (
                <>
                  <p>전 구성원의 원격 공유에 적용됩니다. 공유 중인 브라우저는 다음 자동 갱신 시 반영합니다.</p>
                  <label>
                    자리비움 시간 (분)
                    <input autoFocus type="number" name="idleMinutes" min={MIN_IDLE_MINUTES} max={MAX_IDLE_MINUTES}
                      step={1} required defaultValue={remoteSettings.idleMinutes} disabled={busy} aria-describedby={`${titleId}-help`} />
                  </label>
                  <p id={`${titleId}-help`}>1~120분으로 설정하세요. 설정한 시간 동안 기기 입력이 없으면 자리비움으로 표시합니다. 화면 잠금은 시간 설정과 관계없이 자리비움으로 표시합니다.</p>
                </>
              ) : ([
                ["name", "이름"],
                ["department", "소속"],
                ["position", "직무"],
              ] as const).map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input autoFocus={field === "name"} name={field} defaultValue={user[field]} required maxLength={50} disabled={busy} />
                </label>
              ))}
              {error && <p className="modal-error" role="alert">{error}</p>}
              <button className="primary form-submit" disabled={busy}>
                {busy ? "저장 중…" : "정보 저장"}<Check size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
      {modal === "password" && (
        <PasswordChange onClose={() => setModal(null)} onComplete={async () => {
          await onUpdated("비밀번호를 변경했습니다.");
          setModal(null);
        }} />
      )}
    </>
  );
}
