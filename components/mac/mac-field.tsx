"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export type MacFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "children"> & {
  label: string;
  hint?: string;
  stacked?: boolean;
  id?: string;
};

export function MacField({
  label,
  hint,
  stacked = false,
  id,
  className,
  type = "text",
  ...rest
}: MacFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const rowClass = stacked ? "field-row mac-field mac-field-stacked" : "field-row mac-field";
  const classes = className ? `${rowClass} ${className}` : rowClass;

  return (
    <div className={classes}>
      <label className="mac-field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        type={type}
        id={inputId}
        className="mac-field-input"
        aria-describedby={hintId}
      />
      {hint ? (
        <span className="mac-field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export type MacFieldRowProps = {
  children: ReactNode;
  stacked?: boolean;
  className?: string;
};

export function MacFieldRow({ children, stacked = false, className }: MacFieldRowProps) {
  const rowClass = stacked ? "field-row mac-field mac-field-stacked" : "field-row mac-field";
  const classes = className ? `${rowClass} ${className}` : rowClass;

  return <div className={classes}>{children}</div>;
}
