export type MacSeparatorProps = {
  className?: string;
};

export function MacSeparator({ className }: MacSeparatorProps) {
  const classes = className
    ? `separator mac-separator ${className}`
    : "separator mac-separator";

  return <hr className={classes} />;
}
