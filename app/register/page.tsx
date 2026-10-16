"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import PasswordInput from "@/components/password-input";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState("");
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, action: "register" }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "회원등록을 처리하지 못했습니다.");
      setRegistered(String(values.email).trim().toLowerCase());
    } catch (error) {
      setError(error instanceof Error ? error.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.registrationPage}>
      <Link href="/" className="brand">
        <span className="brand-mark">h.</span>HAMS WORKS
      </Link>
      <section className={styles.card}>
        {registered ? (
          <div>
            <span className={styles.symbol}>
              <Check size={30} />
            </span>
            <h1>회원등록이 완료됐어요</h1>
            <p className={styles.successEmail}>
              <b>{registered}</b>로 로그인하세요.
            </p>
            <div className={styles.note}>
              <p>
                초기 비밀번호는 <b>hams1234!</b>입니다.
                <br />첫 로그인 후 비밀번호 변경을 완료해야 업무 기능을 사용할
                수 있습니다.
              </p>
            </div>
            <Link className={styles.submit} href="/">
              로그인으로 이동
              <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <span className="pill">JOIN OUR WORKSPACE</span>
            <h1>회원등록</h1>
            <p className={styles.description}>
              직원 또는 프리랜서 계정을 등록하고 업무를 시작하세요.
            </p>
            <form onSubmit={register}>
              <div className={styles.fields}>
                <label>
                  이름
                  <input
                    autoFocus
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={50}
                    placeholder="이름"
                  />
                </label>
                <label>
                  계약 유형
                  <select name="kind" defaultValue="직원">
                    <option>직원</option>
                    <option>프리랜서</option>
                  </select>
                </label>
                <label className={styles.fullWidth}>
                  이메일
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={100}
                    placeholder="name@company.com"
                  />
                </label>
                <label>
                  소속
                  <input
                    name="department"
                    autoComplete="organization"
                    required
                    maxLength={50}
                    placeholder="개발팀"
                  />
                </label>
                <label>
                  직무
                  <input
                    name="position"
                    autoComplete="organization-title"
                    required
                    maxLength={50}
                    placeholder="프론트엔드 개발자"
                  />
                </label>
              </div>
              <PasswordInput
                label="초기 비밀번호"
                value="hams1234!"
                readOnly
                autoComplete="off"
              />
              <div className={styles.note}>
                <ShieldCheck size={21} />
                <p>
                  위 초기 비밀번호로 계정이 생성되며, 첫 로그인 시
                  비밀번호를 변경합니다. 일반 구성원 권한으로 등록됩니다.
                </p>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button className={styles.submit} disabled={busy}>
                {busy ? "등록 중…" : "회원등록"}
                <ArrowRight size={17} />
              </button>
            </form>
            <Link href="/" className={styles.backLink}>
              <ArrowLeft size={15} />
              로그인으로 돌아가기
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
