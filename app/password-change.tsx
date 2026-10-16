"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ShieldCheck } from "lucide-react";
import PasswordInput from "@/components/password-input";
import styles from "./auth.module.css";

export default function PasswordChange({
  onComplete,
  onLogout,
  onClose,
}: {
  onComplete: () => Promise<void>;
  onLogout?: () => void;
  onClose?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  function containFocus(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose?.();
    }
    if (event.key !== "Tab") return;
    const fields = dialog.current?.querySelectorAll<HTMLElement>(
      "input:not(:disabled), button:not(:disabled)",
    );
    if (!fields?.length) return;
    const first = fields[0],
      last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    if (values.get("newPassword") !== values.get("confirmPassword")) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password-change",
          ...Object.fromEntries(values),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "비밀번호를 변경하지 못했습니다.");
      await onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={styles.backdrop}
      onKeyDown={containFocus}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        ref={dialog}
        className={styles.passwordModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
        aria-describedby="password-description"
      >
        <div className={styles.symbol}>
          <ShieldCheck size={27} />
        </div>
        <h2 id="password-title">
          {onClose ? "비밀번호 변경" : "첫 로그인, 비밀번호를 변경해 주세요"}
        </h2>
        <p id="password-description" className={styles.description}>
          {onClose ? (
            "현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다."
          ) : (
            <>
              계정을 보호하기 위해 초기 비밀번호를 변경한 후 업무를 시작할 수
              있습니다. 초기 비밀번호는 <b>hams1234!</b>입니다.
            </>
          )}
        </p>
        <form onSubmit={submit}>
          <PasswordInput
            label="현재 비밀번호"
            autoFocus
            name="currentPassword"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <PasswordInput
            label="새 비밀번호"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            aria-describedby="new-password-help"
          />
          <p id="new-password-help" className={styles.hint}>
            초기 비밀번호와 다른 10~128자로 입력하세요.
          </p>
          <PasswordInput
            label="새 비밀번호 확인"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
          />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button className={styles.submit} disabled={busy}>
            {busy ? "변경 중…" : onClose ? "비밀번호 변경" : "비밀번호 변경 후 시작"}
            <Check size={17} />
          </button>
          <button
            type="button"
            className={styles.logout}
            disabled={busy}
            onClick={onClose || onLogout}
          >
            {onClose ? "취소" : "로그아웃"}
          </button>
        </form>
      </section>
    </div>
  );
}
