import type { ReactNode } from "react";
import { MacIcon } from "./mac-icon";

export type MacDialogProps = {
  open: boolean;
  label: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function MacDialog({ open, label, actions, children, className }: MacDialogProps) {
  if (!open) return null;

  const classes = className
    ? `standard-dialog mac-dialog ${className}`
    : "standard-dialog mac-dialog";

  return (
    <div className="mac-dialog-layer">
      <div className={classes} role="dialog" aria-modal="true" aria-label={label}>
        <div className="mac-dialog-body">
          <div className="mac-dialog-message">{children}</div>
        </div>
        {actions ? <div className="mac-dialog-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export type MacAlertKind = "stop" | "caution" | "note";

export type MacAlertProps = {
  open: boolean;
  kind?: MacAlertKind;
  label: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function MacAlert({
  open,
  kind = "caution",
  label,
  actions,
  children,
  className,
}: MacAlertProps) {
  if (!open) return null;

  const classes = className
    ? `standard-dialog alert-box mac-dialog ${className}`
    : "standard-dialog alert-box mac-dialog";

  return (
    <div className="mac-dialog-layer">
      <div className={classes} role="alertdialog" aria-modal="true" aria-label={label}>
        <div className="alert-contents mac-dialog-body">
          <MacIcon name={kind} className="mac-dialog-well" title={`${kind} alert`} />
          <div className="mac-dialog-message">{children}</div>
        </div>
        {actions ? <div className="mac-dialog-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
