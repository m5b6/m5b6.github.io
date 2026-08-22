import type { ReactNode } from "react";

export type MacStatusBarProps = {
  children: ReactNode;
  className?: string;
};

export function MacStatusBar({ children, className }: MacStatusBarProps) {
  const classes = className
    ? `details-bar mac-status-bar ${className}`
    : "details-bar mac-status-bar";

  return <div className={classes}>{children}</div>;
}
