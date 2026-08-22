import type { ButtonHTMLAttributes, ReactNode } from "react";

export type MacButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: "standard" | "default";
  children: ReactNode;
};

export function MacButton({
  variant = "standard",
  className,
  type = "button",
  children,
  ...rest
}: MacButtonProps) {
  const base = variant === "default" ? "btn btn-default" : "btn";
  const classes = className ? `${base} mac-button ${className}` : `${base} mac-button`;

  return (
    <button {...rest} type={type} className={classes}>
      {children}
    </button>
  );
}
