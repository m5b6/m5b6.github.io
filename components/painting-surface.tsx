"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  parsePixelKey,
  pointFromViewport,
  type CanvasColor,
  type PixelChange,
  type Point,
  type VisibleParticipant,
} from "@/lib/canvas";

type PaintingSurfaceProps = {
  pixels: Readonly<Record<string, string>>;
  participants: VisibleParticipant[];
  onlineCount: number;
  status: string;
  setupNotice?: string;
  onCursorChange: (cursor: Point | null) => void;
  onStrokeStart: () => void;
  onPaintPixel: (change: PixelChange) => void;
  onStrokeEnd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type Position = { left: number; top: number };

function drawPixel(canvas: HTMLCanvasElement | null, change: PixelChange) {
  const context = canvas?.getContext("2d");
  if (!context) return;

  if (change.color === "transparent") {
    context.clearRect(change.x, change.y, 1, 1);
  } else {
    context.fillStyle = change.color;
    context.fillRect(change.x, change.y, 1, 1);
  }
}

function DraggableWindow({
  className,
  title,
  children,
}: {
  className: string;
  title: ReactNode;
  children: ReactNode;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const dragOffset = useRef<Point | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current || !windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    setPosition({
      left: Math.min(
        window.innerWidth - rect.width,
        Math.max(0, event.clientX - dragOffset.current.x),
      ),
      top: Math.min(
        window.innerHeight - rect.height,
        Math.max(0, event.clientY - dragOffset.current.y),
      ),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragOffset.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = position
    ? ({
        left: position.left,
        top: position.top,
        transform: "none",
      } satisfies CSSProperties)
    : undefined;

  return (
    <section ref={windowRef} className={`window ${className}`} style={style}>
      <div
        className="title-bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <h1 className="title">{title}</h1>
      </div>
      <div className="separator" />
      <div className="window-pane">{children}</div>
    </section>
  );
}

function Cursor({ participant }: { participant: VisibleParticipant }) {
  if (!participant.cursor) return null;

  const style = {
    left: `${((participant.cursor.x + 0.5) / CANVAS_WIDTH) * 100}%`,
    top: `${((participant.cursor.y + 0.5) / CANVAS_HEIGHT) * 100}%`,
    "--cursor-color": participant.color,
  } as CSSProperties;

  return (
    <div
      className={`remote-cursor ${participant.kind === "agent" ? "agent-cursor" : ""}`}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 28" role="presentation">
        <path d="M2 1.5v20.8l5.8-5.4 4.4 9.2 4.2-2-4.4-8.9 8-.8L2 1.5Z" />
      </svg>
      <span>
        {participant.kind === "agent" ? "🤖 " : ""}
        {participant.name}
        {participant.status ? ` · ${participant.status}` : ""}
      </span>
    </div>
  );
}

export function PaintingSurface({
  pixels,
  participants,
  onlineCount,
  status,
  setupNotice,
  onCursorChange,
  onStrokeStart,
  onPaintPixel,
  onStrokeEnd,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: PaintingSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const lastPixel = useRef<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<CanvasColor | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.imageSmoothingEnabled = false;

    for (const [key, color] of Object.entries(pixels)) {
      const point = parsePixelKey(key);
      if (!point) continue;
      context.fillStyle = color;
      context.fillRect(point.x, point.y, 1, 1);
    }
  }, [pixels]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        onRedo();
      } else if (event.key === "Escape") {
        setSelectedColor(null);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [onRedo, onUndo]);

  const pointForEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) =>
      pointFromViewport(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
      ),
    [],
  );

  const paintAt = useCallback(
    (point: Point) => {
      if (!selectedColor) return;
      const key = `${point.x}:${point.y}:${selectedColor}`;
      if (lastPixel.current === key) return;
      lastPixel.current = key;
      const change = { ...point, color: selectedColor } satisfies PixelChange;
      drawPixel(canvasRef.current, change);
      onPaintPixel(change);
    },
    [onPaintPixel, selectedColor],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !selectedColor) return;
    activePointer.current = event.pointerId;
    lastPixel.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    onStrokeStart();
    const point = pointForEvent(event);
    onCursorChange(point);
    paintAt(point);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointForEvent(event);
    onCursorChange(point);
    if (activePointer.current === event.pointerId) paintAt(point);
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    lastPixel.current = null;
    onStrokeEnd();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearPainting = () => {
    if (Object.keys(pixels).length === 0) return;
    if (window.confirm("Clear the shared painting for everyone? You can undo it.")) {
      onClear();
    }
  };

  return (
    <main className="painting-stage">
      <canvas
        ref={canvasRef}
        className={`painting-canvas ${selectedColor ? "painting-enabled" : ""}`}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Shared multiplayer pixel canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onPointerLeave={() => onCursorChange(null)}
      />

      <div className="cursor-layer">
        {participants.map((participant) => (
          <Cursor key={participant.id} participant={participant} />
        ))}
      </div>

      <DraggableWindow className="profile-window" title="Matias Berrios">
        <pre className="ascii-mark" aria-label="m5b6">
{String.raw`┌─┐ ┌─┐┌┐ ┌──
│││ └─┐├┴┐├─┐
└ └ └─┘└─┘└─┘`}
        </pre>
        <div className="info-section" aria-label="About Matias Berrios">
          <p>
            Founder of{" "}
            <a href="https://vita.lat" target="_blank" rel="noreferrer">
              Vita
            </a>
          </p>
          <p>Based in Santiago, Chile</p>
        </div>
        <nav aria-label="Links">
          <a
            className="btn icon-button"
            href="https://linkedin.com/in/matiasberrios"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn profile"
          >
            <Image src="/assets/in.png" alt="" width={500} height={500} />
          </a>
          <a
            className="btn icon-button"
            href="https://github.com/m5b6"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
          >
            <Image src="/assets/gh.png" alt="" width={506} height={493} />
          </a>
          <a
            className="btn icon-button"
            href="mailto:mati@vita.lat"
            aria-label="Email Matias"
          >
            <Image src="/assets/mail.png" alt="" width={500} height={500} />
          </a>
        </nav>
      </DraggableWindow>

      <DraggableWindow className="palette-window" title="✏ shared paint">
        <div className="presence-row" aria-live="polite">
          <span className="presence-dot" />
          <span>{onlineCount} online</span>
          <span className="sync-status">{status}</span>
        </div>

        <div className="color-swatches" role="group" aria-label="Paint colors">
          {PALETTE.map(({ color, name }) => (
            <button
              key={color}
              type="button"
              className={`color-swatch ${selectedColor === color ? "selected-swatch" : ""}`}
              style={{ backgroundColor: color }}
              title={name}
              aria-label={name}
              aria-pressed={selectedColor === color}
              onClick={() => setSelectedColor(selectedColor === color ? null : color)}
            />
          ))}
          <button
            type="button"
            className={`color-swatch eraser-swatch ${
              selectedColor === "transparent" ? "selected-swatch" : ""
            }`}
            title="Eraser"
            aria-label="Eraser"
            aria-pressed={selectedColor === "transparent"}
            onClick={() =>
              setSelectedColor(
                selectedColor === "transparent" ? null : "transparent",
              )
            }
          >
            ×
          </button>
        </div>

        <div className="palette-actions">
          <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⇧⌘Z)"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={clearPainting}
            disabled={Object.keys(pixels).length === 0}
          >
            Clear
          </button>
        </div>

        <p className="agent-link">
          AI agents can <a href="/llms.txt">join via MCP</a>.
        </p>
        {setupNotice ? <p className="setup-notice">{setupNotice}</p> : null}
      </DraggableWindow>
    </main>
  );
}
