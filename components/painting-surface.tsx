"use client";

import Image from "next/image";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  M5B6_WORDMARK,
  M5B6_WORDMARK_TEXT,
  MIRROR_ART,
  MacAlert,
  MacButton,
  MacPixelArt,
  RAINBOW_ART,
  SURPRISE_ART,
  brushArt,
} from "@/components/mac";
import { useModalFocus } from "@/components/use-modal-focus";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  parsePixelKey,
  pointFromRect,
  pointsOnLine,
  type CanvasColor,
  type PixelChange,
  type Point,
  type VisibleParticipant,
} from "@/lib/canvas";

type Position = { left: number; top: number };
type BrushId = "pixel" | "round" | "marker" | "scatter" | "heart";

type BrushDefinition = {
  id: BrushId;
  name: string;
  previewSize: number;
  offsets: readonly Point[];
};

const BRUSHES: readonly BrushDefinition[] = [
  {
    id: "pixel",
    name: "Pixel brush",
    previewSize: 1,
    offsets: [{ x: 0, y: 0 }],
  },
  {
    id: "round",
    name: "Round brush",
    previewSize: 3,
    offsets: [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: "marker",
    name: "Big marker",
    previewSize: 5,
    offsets: [
      { x: -1, y: -2 },
      { x: 0, y: -2 },
      { x: 1, y: -2 },
      { x: -2, y: -1 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 2, y: -1 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: -2, y: 1 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: -1, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  },
  {
    id: "scatter",
    name: "Scatter brush",
    previewSize: 9,
    offsets: [
      { x: -4, y: -1 },
      { x: -3, y: 3 },
      { x: -2, y: -3 },
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: -2 },
      { x: 2, y: 3 },
      { x: 3, y: 1 },
      { x: 4, y: -3 },
    ],
  },
  {
    id: "heart",
    name: "Heart stamp",
    previewSize: 5,
    offsets: [
      { x: -2, y: -2 },
      { x: -1, y: -2 },
      { x: 1, y: -2 },
      { x: 2, y: -2 },
      { x: -2, y: -1 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 2, y: -1 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ],
  },
] as const;

const RAINBOW_COLORS = [
  "#FF0000",
  "#FF8C00",
  "#FFFF00",
  "#00A36C",
  "#00CED1",
  "#0000FF",
  "#8A2BE2",
  "#FF1493",
] as const satisfies readonly CanvasColor[];

function brushById(id: BrushId) {
  return BRUSHES.find((brush) => brush.id === id) ?? BRUSHES[0];
}

function pointInCanvas(point: Point) {
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < CANVAS_WIDTH &&
    point.y < CANVAS_HEIGHT
  );
}

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

export type PaintTools = {
  selectedColor: CanvasColor | null;
  selectedBrush: BrushId;
  activeBrush: BrushDefinition;
  rainbow: boolean;
  mirror: boolean;
  chooseColor: (color: CanvasColor | null) => void;
  chooseBrush: (id: BrushId) => void;
  cycleBrush: () => void;
  chooseEraser: () => void;
  toggleRainbow: () => void;
  toggleMirror: () => void;
  surprise: () => void;
};

export function usePaintTools(): PaintTools {
  const [selectedColor, setSelectedColor] = useState<CanvasColor | null>("#000000");
  const [selectedBrush, setSelectedBrush] = useState<BrushId>("pixel");
  const [rainbow, setRainbow] = useState(false);
  const [mirror, setMirror] = useState(false);

  const chooseColor = useCallback((color: CanvasColor | null) => {
    setSelectedColor(color);
    setRainbow(false);
  }, []);

  const cycleBrush = useCallback(() => {
    setSelectedBrush((current) => {
      const index = BRUSHES.findIndex(({ id }) => id === current);
      return BRUSHES[(index + 1) % BRUSHES.length].id;
    });
  }, []);

  const chooseEraser = useCallback(() => chooseColor("transparent"), [chooseColor]);

  const toggleRainbow = useCallback(() => {
    setSelectedColor((current) =>
      current === "transparent" || current === null ? "#FF0000" : current,
    );
    setRainbow((current) => !current);
  }, []);

  const toggleMirror = useCallback(() => setMirror((current) => !current), []);

  const surprise = useCallback(() => {
    chooseColor(PALETTE[Math.floor(Math.random() * PALETTE.length)].color);
  }, [chooseColor]);

  return useMemo(
    () => ({
      selectedColor,
      selectedBrush,
      activeBrush: brushById(selectedBrush),
      rainbow,
      mirror,
      chooseColor,
      chooseBrush: setSelectedBrush,
      cycleBrush,
      chooseEraser,
      toggleRainbow,
      toggleMirror,
      surprise,
    }),
    [
      chooseColor,
      chooseEraser,
      cycleBrush,
      mirror,
      rainbow,
      selectedBrush,
      selectedColor,
      surprise,
      toggleMirror,
      toggleRainbow,
    ],
  );
}

export type PaintShortcutHandlers = {
  tools: PaintTools;
  onUndo: () => void;
  onRedo: () => void;
  enabled?: boolean;
};

export function usePaintShortcuts({
  tools,
  onUndo,
  onRedo,
  enabled = true,
}: PaintShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

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
        tools.chooseColor(null);
      } else if (!modifier && event.key.toLowerCase() === "b") {
        tools.cycleBrush();
      } else if (!modifier && event.key.toLowerCase() === "e") {
        tools.chooseEraser();
      } else if (!modifier && event.key.toLowerCase() === "m") {
        tools.toggleMirror();
      } else if (!modifier && event.key.toLowerCase() === "r") {
        tools.toggleRainbow();
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [enabled, onRedo, onUndo, tools]);
}

export type PaintingCanvasProps = {
  pixels: Readonly<Record<string, string>>;
  participants: VisibleParticipant[];
  tools: PaintTools;
  onCursorChange: (cursor: Point | null) => void;
  onStrokeStart: () => void;
  onPaintPixel: (change: PixelChange) => void;
  onStrokeEnd: () => void;
};

/**
 * D2: the canvas keeps its 320:180 aspect and centres inside the viewport, so the
 * painting is the same image on every screen. At a 16:9 viewport the frame fills the
 * screen and the mapping is identical to the full-bleed one it replaced.
 * Every piece of Macintosh chrome floats above it; none of it may move or resize it.
 */
export const PaintingCanvas = memo(function PaintingCanvas({
  pixels,
  participants,
  tools,
  onCursorChange,
  onStrokeStart,
  onPaintPixel,
  onStrokeEnd,
}: PaintingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushPreviewRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const lastPaintedPoint = useRef<Point | null>(null);
  const stampIndex = useRef(0);
  const rawPointerSupported = useRef(false);
  const { selectedColor, activeBrush, rainbow, mirror } = tools;

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

  const pointForCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const rect = canvas
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    return pointFromRect(clientX, clientY, rect);
  }, []);

  const pointForEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) =>
      pointForCoordinates(event.clientX, event.clientY),
    [pointForCoordinates],
  );

  const updateBrushPreview = useCallback(
    (clientX: number, clientY: number, visible = true) => {
      const preview = brushPreviewRef.current;
      if (!preview) return;
      preview.hidden = !visible || !selectedColor;
      if (!preview.hidden) {
        preview.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
      }
    },
    [selectedColor],
  );

  const paintThrough = useCallback(
    (point: Point) => {
      if (!selectedColor) return;
      const previous = lastPaintedPoint.current;
      if (previous?.x === point.x && previous.y === point.y) return;

      const centers = previous ? pointsOnLine(previous, point).slice(1) : [point];
      for (const center of centers) {
        const targets = new Map<string, Point>();
        for (const offset of activeBrush.offsets) {
          const target = { x: center.x + offset.x, y: center.y + offset.y };
          if (pointInCanvas(target)) targets.set(`${target.x}:${target.y}`, target);

          if (mirror) {
            const reflected = {
              x: CANVAS_WIDTH - 1 - target.x,
              y: target.y,
            };
            if (pointInCanvas(reflected)) {
              targets.set(`${reflected.x}:${reflected.y}`, reflected);
            }
          }
        }

        let targetIndex = 0;
        for (const target of targets.values()) {
          const color =
            selectedColor === "transparent"
              ? "transparent"
              : rainbow
                ? RAINBOW_COLORS[
                    (stampIndex.current + targetIndex) % RAINBOW_COLORS.length
                  ]
                : selectedColor;
          const change = { ...target, color } satisfies PixelChange;
          drawPixel(canvasRef.current, change);
          onPaintPixel(change);
          targetIndex += 1;
        }
        stampIndex.current += 1;
      }
      lastPaintedPoint.current = point;
    },
    [activeBrush.offsets, mirror, onPaintPixel, rainbow, selectedColor],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    rawPointerSupported.current = "onpointerrawupdate" in window;
    if (!canvas || !rawPointerSupported.current) return;

    const handleRawPointer = (rawEvent: Event) => {
      const event = rawEvent as PointerEvent;
      if (activePointer.current !== event.pointerId) return;
      const samples = event.getCoalescedEvents?.() ?? [event];
      for (const sample of samples) {
        paintThrough(pointForCoordinates(sample.clientX, sample.clientY));
      }
      const latest = samples.at(-1) ?? event;
      updateBrushPreview(latest.clientX, latest.clientY);
      onCursorChange(pointForCoordinates(latest.clientX, latest.clientY));
    };

    canvas.addEventListener("pointerrawupdate", handleRawPointer);
    return () => canvas.removeEventListener("pointerrawupdate", handleRawPointer);
  }, [onCursorChange, paintThrough, pointForCoordinates, updateBrushPreview]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !selectedColor) return;
    activePointer.current = event.pointerId;
    lastPaintedPoint.current = null;
    stampIndex.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    onStrokeStart();
    const point = pointForEvent(event);
    onCursorChange(point);
    updateBrushPreview(event.clientX, event.clientY);
    paintThrough(point);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointForEvent(event);
    onCursorChange(point);
    updateBrushPreview(event.clientX, event.clientY);
    if (activePointer.current !== event.pointerId) return;
    if (rawPointerSupported.current) return;

    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples) {
      paintThrough(pointForCoordinates(sample.clientX, sample.clientY));
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    paintThrough(pointForEvent(event));
    activePointer.current = null;
    lastPaintedPoint.current = null;
    onStrokeEnd();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = () => {
    if (activePointer.current === null) updateBrushPreview(0, 0, false);
    onCursorChange(null);
  };

  return (
    <div className="painting-stage">
      <div className="painting-frame">
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
          onPointerLeave={handlePointerLeave}
        />

        <div className="cursor-layer">
          {participants.map((participant) => (
            <Cursor key={participant.id} participant={participant} />
          ))}
        </div>
      </div>

      <div
        ref={brushPreviewRef}
        className={`brush-preview ${rainbow ? "rainbow-preview" : ""}`}
        style={
          {
            "--brush-size": activeBrush.previewSize,
            "--brush-color":
              selectedColor === "transparent" ? "#ffffff" : selectedColor,
          } as CSSProperties
        }
        hidden
        aria-hidden="true"
      />

    </div>
  );
});

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

export type PaintingToolsPanelProps = {
  tools: PaintTools;
  onlineCount: number;
  status: string;
  pixelCount: number;
  setupNotice?: string;
  onUndo: () => void;
  onRedo: () => void;
  onRequestClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function PaintingToolsPanel({
  tools,
  onlineCount,
  status,
  pixelCount,
  setupNotice,
  onUndo,
  onRedo,
  onRequestClear,
  canUndo,
  canRedo,
}: PaintingToolsPanelProps) {
  const { selectedColor, selectedBrush, rainbow, mirror } = tools;

  return (
    <>
      <div className="presence-row" aria-live="polite">
        <span className="presence-dot" />
        <span>{onlineCount} online</span>
        <span className="sync-status">{status}</span>
      </div>

      <div className="canvas-stats">
        <span>
          {CANVAS_WIDTH}×{CANVAS_HEIGHT}
        </span>
        <span>{pixelCount.toLocaleString()} pixels</span>
      </div>

      <div className="tool-row">
        <span className="tool-label">brush</span>
        <div className="brush-options" role="group" aria-label="Brushes">
          {BRUSHES.map((brush) => (
            <button
              key={brush.id}
              type="button"
              className={selectedBrush === brush.id ? "selected-tool" : ""}
              aria-label={brush.name}
              aria-pressed={selectedBrush === brush.id}
              title={`${brush.name} (B to cycle)`}
              onClick={() => tools.chooseBrush(brush.id)}
            >
              <MacPixelArt
                rows={brushArt(brush.offsets)}
                scale={2}
                title={brush.name}
              />
            </button>
          ))}
        </div>
      </div>

      <span className="tool-label">color</span>
      <div className="color-swatches" role="group" aria-label="Paint colors">
        {PALETTE.map(({ color, name }) => (
          <button
            key={color}
            type="button"
            className={`color-swatch ${
              selectedColor === color && !rainbow ? "selected-swatch" : ""
            }`}
            style={{ backgroundColor: color }}
            title={name}
            aria-label={name}
            aria-pressed={selectedColor === color && !rainbow}
            onClick={() => tools.chooseColor(color)}
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
          onClick={tools.chooseEraser}
        >
          <span className="eraser-chip">erase</span>
        </button>
      </div>

      <div className="fun-options" role="group" aria-label="Paint effects">
        <button
          type="button"
          className={rainbow ? "selected-tool rainbow-tool" : "rainbow-tool"}
          aria-pressed={rainbow}
          title="Rainbow mode (R)"
          onClick={tools.toggleRainbow}
        >
          <MacPixelArt rows={RAINBOW_ART} scale={2} /> rainbow
        </button>
        <button
          type="button"
          className={mirror ? "selected-tool" : ""}
          aria-pressed={mirror}
          title="Horizontal mirror (M)"
          onClick={tools.toggleMirror}
        >
          <MacPixelArt rows={MIRROR_ART} scale={2} /> mirror
        </button>
        <button type="button" title="Pick a surprise color" onClick={tools.surprise}>
          <MacPixelArt rows={SURPRISE_ART} scale={2} /> surprise
        </button>
      </div>

      <div className="palette-actions">
        <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo (⇧⌘Z)">
          Redo
        </button>
        <button type="button" onClick={onRequestClear} disabled={pixelCount === 0}>
          Clear
        </button>
      </div>

      <p className="agent-link">
        AI agents can <a href="/llms.txt">join via MCP</a>.
      </p>
      {setupNotice ? <p className="setup-notice">{setupNotice}</p> : null}
    </>
  );
}

export function PaintingProfile() {
  return (
    <>
      <MacPixelArt
        className="ascii-mark"
        rows={M5B6_WORDMARK}
        scale={4}
        title={M5B6_WORDMARK_TEXT}
      />
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
        <a className="btn icon-button" href="mailto:mati@vita.lat" aria-label="Email Matias">
          <Image src="/assets/mail.png" alt="" width={500} height={500} />
        </a>
      </nav>
    </>
  );
}

export type ClearCanvasAlertProps = {
  open: boolean;
  pixelCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * DESIGN.md: a destructive confirmation is a Macintosh caution alert, never confirm().
 * Clearing is reversible now — the painting is filed in the Trash — and the alert says so.
 */
export function ClearCanvasAlert({
  open,
  pixelCount,
  onCancel,
  onConfirm,
}: ClearCanvasAlertProps) {
  useModalFocus(open, onCancel);

  return (
    <MacAlert
      open={open}
      kind="caution"
      label="Clear the canvas"
      actions={
        <>
          <MacButton variant="default" onClick={onCancel}>
            Cancel
          </MacButton>
          <MacButton onClick={onConfirm}>Clear</MacButton>
        </>
      }
    >
      Clearing puts {pixelCount.toLocaleString()} painted pixels in the Trash for
      everyone. You can Put Back the painting until the Trash is emptied.
    </MacAlert>
  );
}

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

/**
 * The pre-desktop composition, kept whole behind SHELL_ENABLED=0 so production can be
 * rolled back to it without a deploy of new code.
 */
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
  const tools = usePaintTools();
  const [askingToClear, setAskingToClear] = useState(false);
  const pixelCount = Object.keys(pixels).length;
  const cancelClear = useCallback(() => setAskingToClear(false), []);

  usePaintShortcuts({ tools, onUndo, onRedo });

  return (
    <main className="painting-room">
      <PaintingCanvas
        pixels={pixels}
        participants={participants}
        tools={tools}
        onCursorChange={onCursorChange}
        onStrokeStart={onStrokeStart}
        onPaintPixel={onPaintPixel}
        onStrokeEnd={onStrokeEnd}
      />

      <DraggableWindow className="profile-window" title="Matias Berrios">
        <PaintingProfile />
      </DraggableWindow>

      <DraggableWindow className="palette-window" title="✏ shared paint">
        <PaintingToolsPanel
          tools={tools}
          onlineCount={onlineCount}
          status={status}
          pixelCount={pixelCount}
          setupNotice={setupNotice}
          onUndo={onUndo}
          onRedo={onRedo}
          onRequestClear={() => setAskingToClear(true)}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </DraggableWindow>

      <ClearCanvasAlert
        open={askingToClear}
        pixelCount={pixelCount}
        onCancel={cancelClear}
        onConfirm={() => {
          setAskingToClear(false);
          onClear();
        }}
      />
    </main>
  );
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
  const [collapsed, setCollapsed] = useState(false);

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
    <section
      ref={windowRef}
      className={`window ${className} ${collapsed ? "collapsed-window" : ""}`}
      style={style}
    >
      <div
        className="title-bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setCollapsed((current) => !current)}
      >
        <h1 className="title">{title}</h1>
        <button
          type="button"
          className="window-collapse"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${String(title)}`}
          title={collapsed ? "Expand" : "Collapse"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? "+" : "−"}
        </button>
      </div>
      {collapsed ? null : (
        <>
          <div className="separator" />
          <div className="window-pane">{children}</div>
        </>
      )}
    </section>
  );
}
