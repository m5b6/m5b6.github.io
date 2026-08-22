import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type MacWindowProps = {
  title: string;
  active?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
  onZoom?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  resizeHandleProps?: HTMLAttributes<HTMLDivElement>;
  status?: ReactNode;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
} & Pick<HTMLAttributes<HTMLElement>, "onPointerDownCapture" | "id" | "role">;

function TitleButtonSlot() {
  return <span className="mac-title-button-slot" aria-hidden="true" />;
}

export function MacWindow({
  title,
  active = true,
  collapsed = false,
  onClose,
  onCollapse,
  onZoom,
  dragHandleProps,
  resizeHandleProps,
  status,
  style,
  className,
  children,
  ...rest
}: MacWindowProps) {
  const classes = className ? `window mac-window ${className}` : "window mac-window";
  const barClass = active ? "title-bar" : "inactive-title-bar";
  const rightButtons = [
    onCollapse
      ? { key: "collapse", className: "mac-collapse", label: collapsed ? "Expand" : "Collapse", onClick: onCollapse }
      : null,
    onZoom ? { key: "zoom", className: "mac-zoom", label: "Zoom", onClick: onZoom } : null,
  ].filter((entry) => entry !== null);

  return (
    <section
      {...rest}
      className={classes}
      style={style}
      data-collapsed={collapsed ? "true" : "false"}
      data-active={active ? "true" : "false"}
      aria-label={title}
    >
      <div
        {...dragHandleProps}
        className={barClass}
        data-draggable={dragHandleProps ? "true" : "false"}
      >
        {active && onClose ? (
          <button type="button" className="close" onClick={onClose}>
            <span className="mac-visually-hidden">{`Close ${title}`}</span>
          </button>
        ) : (
          <TitleButtonSlot />
        )}
        <h2 className="title">{title}</h2>
        <span className="mac-title-buttons-right">
          {active
            ? rightButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  className={button.className}
                  onClick={button.onClick}
                >
                  <span className="mac-visually-hidden">{`${button.label} ${title}`}</span>
                </button>
              ))
            : rightButtons.map((button) => <TitleButtonSlot key={button.key} />)}
        </span>
      </div>
      <div className="mac-window-body">
        {children}
        {status ? <MacWindowStatus>{status}</MacWindowStatus> : null}
      </div>
      {resizeHandleProps && !collapsed ? (
        <div {...resizeHandleProps} className="mac-window-resize" aria-hidden="true" />
      ) : null}
    </section>
  );
}

function MacWindowStatus({ children }: { children: ReactNode }) {
  return <div className="details-bar mac-status-bar">{children}</div>;
}

export type MacWindowPaneProps = {
  children: ReactNode;
  className?: string;
};

export function MacWindowPane({ children, className }: MacWindowPaneProps) {
  const classes = className ? `mac-window-pane ${className}` : "mac-window-pane";
  return <div className={classes}>{children}</div>;
}
