import type { HTMLAttributes, ReactNode } from "react";

export type MacScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  framed?: boolean;
  children: ReactNode;
};

export function MacScrollArea({
  framed = false,
  className,
  children,
  ...rest
}: MacScrollAreaProps) {
  const classes = className ? `mac-scroll-area ${className}` : "mac-scroll-area";

  return (
    <div {...rest} className={classes} data-framed={framed ? "true" : "false"}>
      {children}
    </div>
  );
}
