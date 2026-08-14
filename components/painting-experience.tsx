"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parsePixelKey,
  participantColor,
  pixelKey,
  type CanvasSnapshot,
  type CanvasColor,
  type ParticipantIdentity,
  type ParticipantKind,
  type PixelChange,
  type Point,
  type StoredParticipant,
} from "@/lib/canvas";
import { PaintingSurface } from "@/components/painting-surface";

type PaintingExperienceProps = {
  initialKind: ParticipantKind;
  multiplayerEnabled: boolean;
};

type StrokeChange = {
  key: string;
  before: string | null;
  after: string | null;
};

type CanvasEvent =
  | { type: "ready" }
  | { type: "refresh"; revision: number }
  | {
      type: "presence";
      revision: number;
      participant: StoredParticipant;
    };

function createIdentity(kind: ParticipantKind): ParticipantIdentity {
  const storageKey = "matiasberrios-canvas-participant";

  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      const identity = JSON.parse(stored) as ParticipantIdentity;
      if (
        typeof identity.id === "string" &&
        typeof identity.name === "string" &&
        typeof identity.color === "string"
      ) {
        return { ...identity, kind };
      }
    }
  } catch {}

  const id = crypto.randomUUID();
  const number = Number.parseInt(id.slice(-4), 16) % 1000;
  const identity = {
    id,
    name: `${kind === "agent" ? "Browser agent" : "Guest"} ${number
      .toString()
      .padStart(3, "0")}`,
    color: participantColor(id),
    kind,
  } satisfies ParticipantIdentity;

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(identity));
  } catch {}

  return identity;
}

async function postCanvas(body: unknown) {
  const response = await fetch("/api/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });

  if (!response.ok) throw new Error("Canvas write failed");
}

function applyPixelChanges(
  current: Readonly<Record<string, string>>,
  changes: PixelChange[],
) {
  const next = { ...current };
  for (const change of changes) {
    const key = pixelKey(change.x, change.y);
    if (change.color === "transparent") delete next[key];
    else next[key] = change.color;
  }
  return next;
}

function historyPixels(changes: StrokeChange[], direction: "before" | "after") {
  return changes.flatMap((change): PixelChange[] => {
    const point = parsePixelKey(change.key);
    if (!point) return [];
    return [
      {
        ...point,
        color: (change[direction] ?? "transparent") as CanvasColor,
      },
    ];
  });
}

export function PaintingExperience({
  initialKind,
  multiplayerEnabled,
}: PaintingExperienceProps) {
  const [identity, setIdentity] = useState<ParticipantIdentity | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIdentity(createIdentity(initialKind)), 0);
    return () => window.clearTimeout(timer);
  }, [initialKind]);

  if (!identity) {
    return <div className="loading-screen">Opening the shared canvas…</div>;
  }

  if (!multiplayerEnabled) {
    return <LocalPaintingRoom />;
  }

  return <SharedPaintingRoom identity={identity} />;
}

function SharedPaintingRoom({ identity }: { identity: ParticipantIdentity }) {
  const [pixels, setPixels] = useState<Readonly<Record<string, string>>>({});
  const [participants, setParticipants] = useState<StoredParticipant[]>([]);
  const [status, setStatus] = useState("Connecting…");
  const [undoStack, setUndoStack] = useState<StrokeChange[][]>([]);
  const [redoStack, setRedoStack] = useState<StrokeChange[][]>([]);
  const activeStroke = useRef<Map<string, StrokeChange> | null>(null);
  const pendingPixels = useRef<Map<string, PixelChange>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursor = useRef<Point | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const enqueueWrite = useCallback((operation: () => Promise<void>) => {
    const queued = writeQueue.current.catch(() => {}).then(operation);
    writeQueue.current = queued.catch(() => {});
    return queued;
  }, []);

  const fetchSnapshot = useCallback(async () => {
    const response = await fetch("/api/canvas", { cache: "no-store" });
    if (!response.ok) throw new Error("Canvas read failed");
    const snapshot = (await response.json()) as CanvasSnapshot;
    const optimistic = applyPixelChanges(
      snapshot.pixels,
      [...pendingPixels.current.values()],
    );
    setPixels(optimistic);
    setParticipants(snapshot.participants);
    setStatus("Live");
  }, []);

  const flushPixels = useCallback(async () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    const changes = [...pendingPixels.current.values()];
    pendingPixels.current.clear();
    if (changes.length === 0) return;

    setStatus("Saving…");
    try {
      await enqueueWrite(() =>
        postCanvas({
          action: "paint",
          participant: identity,
          cursor: cursor.current,
          status: null,
          pixels: changes,
        }),
      );
      setStatus("Live");
    } catch {
      for (const change of changes) {
        pendingPixels.current.set(pixelKey(change.x, change.y), change);
      }
      setStatus("Reconnecting…");
    }
  }, [enqueueWrite, identity]);

  const queuePixels = useCallback(
    (changes: PixelChange[], immediately = false) => {
      setPixels((current) => applyPixelChanges(current, changes));
      for (const change of changes) {
        pendingPixels.current.set(pixelKey(change.x, change.y), change);
      }

      if (immediately) {
        void flushPixels();
      } else if (!flushTimer.current) {
        flushTimer.current = setTimeout(() => void flushPixels(), 45);
      }
    },
    [flushPixels],
  );

  const sendPresence = useCallback(
    async (nextCursor: Point | null) => {
      try {
        await postCanvas({
          action: "presence",
          participant: identity,
          cursor: nextCursor,
          status: null,
        });
      } catch {
        setStatus("Reconnecting…");
      }
    },
    [identity],
  );

  const updateCursor = useCallback(
    (nextCursor: Point | null) => {
      cursor.current = nextCursor;
      if (presenceTimer.current) clearTimeout(presenceTimer.current);
      presenceTimer.current = setTimeout(() => {
        presenceTimer.current = null;
        void sendPresence(cursor.current);
      }, 80);
    },
    [sendPresence],
  );

  useEffect(() => {
    let active = true;
    void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
    const initialPresence = setTimeout(() => void sendPresence(null), 0);

    const events = new EventSource("/api/canvas/events");
    events.onmessage = (message) => {
      if (!active) return;
      const event = JSON.parse(message.data) as CanvasEvent;

      if (event.type === "refresh") {
        void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
      } else if (event.type === "presence") {
        setParticipants((current) => [
          ...current.filter(({ id }) => id !== event.participant.id),
          event.participant,
        ]);
        setStatus("Live");
      }
    };
    events.onerror = () => setStatus("Reconnecting…");

    const heartbeat = setInterval(() => {
      void sendPresence(cursor.current);
      if (pendingPixels.current.size > 0) void flushPixels();
    }, 5_000);
    const fallbackRefresh = setInterval(
      () => void fetchSnapshot().catch(() => setStatus("Reconnecting…")),
      5_000,
    );
    const removeExpired = setInterval(() => {
      const now = Date.now();
      setParticipants((current) =>
        current.filter(({ expiresAt }) => Date.parse(expiresAt) > now),
      );
    }, 1_000);

    return () => {
      active = false;
      events.close();
      clearTimeout(initialPresence);
      clearInterval(heartbeat);
      clearInterval(fallbackRefresh);
      clearInterval(removeExpired);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (presenceTimer.current) clearTimeout(presenceTimer.current);
    };
  }, [fetchSnapshot, flushPixels, sendPresence]);

  const beginStroke = useCallback(() => {
    activeStroke.current = new Map();
  }, []);

  const paintPixel = useCallback(
    (change: PixelChange) => {
      setPixels((current) => {
        const key = pixelKey(change.x, change.y);
        const before = current[key] ?? null;
        const after = change.color === "transparent" ? null : change.color;
        if (before === after) return current;

        const stroke = activeStroke.current;
        if (stroke) {
          const existing = stroke.get(key);
          stroke.set(key, { key, before: existing?.before ?? before, after });
        }

        return applyPixelChanges(current, [change]);
      });
      pendingPixels.current.set(pixelKey(change.x, change.y), change);
      if (!flushTimer.current) {
        flushTimer.current = setTimeout(() => void flushPixels(), 45);
      }
    },
    [flushPixels],
  );

  const endStroke = useCallback(() => {
    const changes = [...(activeStroke.current?.values() ?? [])];
    activeStroke.current = null;
    if (changes.length > 0) {
      setUndoStack((current) => [...current, changes]);
      setRedoStack([]);
    }
    void flushPixels();
  }, [flushPixels]);

  const undo = useCallback(() => {
    const changes = undoStack.at(-1);
    if (!changes) return;
    queuePixels(historyPixels(changes, "before"), true);
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, changes]);
  }, [queuePixels, undoStack]);

  const redo = useCallback(() => {
    const changes = redoStack.at(-1);
    if (!changes) return;
    queuePixels(historyPixels(changes, "after"), true);
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, changes]);
  }, [queuePixels, redoStack]);

  const clear = useCallback(() => {
    const changes = Object.entries(pixels).map(([key, color]) => ({
      key,
      before: color,
      after: null,
    }));
    if (changes.length === 0) return;

    pendingPixels.current.clear();
    setPixels({});
    setUndoStack((current) => [...current, changes]);
    setRedoStack([]);
    setStatus("Saving…");
    void enqueueWrite(() => postCanvas({ action: "clear", participant: identity }))
      .then(() => setStatus("Live"))
      .catch(() => {
        setStatus("Reconnecting…");
        void fetchSnapshot();
      });
  }, [enqueueWrite, fetchSnapshot, identity, pixels]);

  const activeParticipants = participants;

  return (
    <PaintingSurface
      pixels={pixels}
      participants={activeParticipants.filter(({ id }) => id !== identity.id)}
      onlineCount={Math.max(1, activeParticipants.length)}
      status={status}
      onCursorChange={updateCursor}
      onStrokeStart={beginStroke}
      onPaintPixel={paintPixel}
      onStrokeEnd={endStroke}
      onUndo={undo}
      onRedo={redo}
      onClear={clear}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
    />
  );
}

function LocalPaintingRoom() {
  const [pixels, setPixels] = useState<Readonly<Record<string, string>>>({});
  const [undoStack, setUndoStack] = useState<StrokeChange[][]>([]);
  const [redoStack, setRedoStack] = useState<StrokeChange[][]>([]);
  const activeStroke = useRef<Map<string, StrokeChange> | null>(null);

  const beginStroke = useCallback(() => {
    activeStroke.current = new Map();
  }, []);

  const paintPixel = useCallback((change: PixelChange) => {
    setPixels((current) => {
      const key = pixelKey(change.x, change.y);
      const before = current[key] ?? null;
      const after = change.color === "transparent" ? null : change.color;
      if (before === after) return current;

      const stroke = activeStroke.current;
      if (stroke) {
        const existing = stroke.get(key);
        stroke.set(key, { key, before: existing?.before ?? before, after });
      }

      return applyPixelChanges(current, [change]);
    });
  }, []);

  const endStroke = useCallback(() => {
    const changes = [...(activeStroke.current?.values() ?? [])];
    activeStroke.current = null;
    if (changes.length > 0) {
      setUndoStack((current) => [...current, changes]);
      setRedoStack([]);
    }
  }, []);

  const applyHistory = useCallback(
    (changes: StrokeChange[], direction: "before" | "after") => {
      setPixels((current) =>
        applyPixelChanges(current, historyPixels(changes, direction)),
      );
    },
    [],
  );

  const undo = useCallback(() => {
    const changes = undoStack.at(-1);
    if (!changes) return;
    applyHistory(changes, "before");
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, changes]);
  }, [applyHistory, undoStack]);

  const redo = useCallback(() => {
    const changes = redoStack.at(-1);
    if (!changes) return;
    applyHistory(changes, "after");
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, changes]);
  }, [applyHistory, redoStack]);

  const clear = useCallback(() => {
    const changes = Object.entries(pixels).map(([key, color]) => ({
      key,
      before: color,
      after: null,
    }));
    if (changes.length === 0) return;
    setPixels({});
    setUndoStack((current) => [...current, changes]);
    setRedoStack([]);
  }, [pixels]);

  return (
    <PaintingSurface
      pixels={pixels}
      participants={[]}
      onlineCount={1}
      status="Local preview"
      setupNotice="Add DATABASE_URL to turn on multiplayer."
      onCursorChange={() => {}}
      onStrokeStart={beginStroke}
      onPaintPixel={paintPixel}
      onStrokeEnd={endStroke}
      onUndo={undo}
      onRedo={redo}
      onClear={clear}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
    />
  );
}
