"use client";

import { useId, useState, type ComponentPropsWithoutRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./password-input.module.css";

type Props = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  label: string;
};

export default function PasswordInput({ label, id, className, disabled, ...props }: Props) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      <div className={styles.control}>
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={`${styles.input}${className ? ` ${className}` : ""}`}
        />
        <button
          type="button"
          className={styles.toggle}
          disabled={disabled}
          aria-label={`${label} ${visible ? "숨기기" : "표시"}`}
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
