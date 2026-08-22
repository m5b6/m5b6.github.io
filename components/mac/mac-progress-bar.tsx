export type MacProgressBarProps = {
  value?: number;
  indeterminate?: boolean;
  label: string;
  className?: string;
};

function clampFraction(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function MacProgressBar({
  value = 0,
  indeterminate = false,
  label,
  className,
}: MacProgressBarProps) {
  const fraction = clampFraction(value);
  const classes = className ? `mac-progress ${className}` : "mac-progress";

  return (
    <div
      className={classes}
      data-indeterminate={indeterminate ? "true" : "false"}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(fraction * 100)}
    >
      <div
        className="mac-progress-fill"
        style={{ width: indeterminate ? "100%" : `${fraction * 100}%` }}
      />
    </div>
  );
}
