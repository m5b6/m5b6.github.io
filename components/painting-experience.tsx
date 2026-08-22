"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  MAX_AGENT_PIXELS,
  parsePixelKey,
  participantColor,
  pixelKey,
  type CanvasSnapshot,
  type CanvasColor,
  type ParticipantIdentity,
  type ParticipantKind,
  type PixelChange,
  type PixelTuple,
  type Point,
  type StoredParticipant,
  type VisibleParticipant,
} from "@/lib/canvas";
import { PaintingSurface } from "@/components/painting-surface";

export type PaintSession = {
  identity: ParticipantIdentity;
  pixels: Readonly<Record<string, string>>;
  participants: VisibleParticipant[];
  onlineCount: number;
  status: string;
  setupNotice?: string;
  /** Bumped whenever the shared canvas is emptied or refilled, so the Trash can reload. */
  trashToken: number;
  onCursorChange: (cursor: Point | null) => void;
  onStrokeStart: () => void;
  onPaintPixel: (change: PixelChange) => void;
  onStrokeEnd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRefresh: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export type PaintSurfaceProps = { session: PaintSession };
export type PaintSurfaceComponent = ComponentType<PaintSurfaceProps>;

const NOOP = () => {};

const LOCAL_IDENTITY: ParticipantIdentity = {
  id: "local-preview",
  name: "Guest",
  color: "#000000",
  kind: "human",
};

function LegacyPaintSurface({ session }: PaintSurfaceProps) {
  return (
    <PaintingSurface
      pixels={session.pixels}
      participants={session.participants}
      onlineCount={session.onlineCount}
      status={session.status}
      setupNotice={session.setupNotice}
      onCursorChange={session.onCursorChange}
      onStrokeStart={session.onStrokeStart}
      onPaintPixel={session.onPaintPixel}
      onStrokeEnd={session.onStrokeEnd}
      onUndo={session.onUndo}
      onRedo={session.onRedo}
      onClear={session.onClear}
      canUndo={session.canUndo}
      canRedo={session.canRedo}
    />
  );
}

type PaintingExperienceProps = {
  initialKind: ParticipantKind;
  multiplayerEnabled: boolean;
  /** The shell passes its own surface; the default is the pre-desktop layout. */
  surface?: PaintSurfaceComponent;
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
      type: "pixels";
      revision: number;
      participant: StoredParticipant;
      pixels: PixelTuple[];
    }
  | { type: "clear"; revision: number }
  | {
      type: "presence";
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

function mutatePixelChanges(
  current: Record<string, string>,
  changes: readonly PixelChange[],
) {
  for (const change of changes) {
    const key = pixelKey(change.x, change.y);
    if (change.color === "transparent") delete current[key];
    else current[key] = change.color;
  }
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
  surface: Surface = LegacyPaintSurface,
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
    return <LocalPaintingRoom surface={Surface} />;
  }

  return <SharedPaintingRoom identity={identity} surface={Surface} />;
}

function SharedPaintingRoom({
  identity,
  surface: Surface,
}: {
  identity: ParticipantIdentity;
  surface: PaintSurfaceComponent;
}) {
  const [pixels, setPixels] = useState<Readonly<Record<string, string>>>({});
  const [participants, setParticipants] = useState<StoredParticipant[]>([]);
  const [status, setStatus] = useState("Connecting…");
  const [undoStack, setUndoStack] = useState<StrokeChange[][]>([]);
  const [redoStack, setRedoStack] = useState<StrokeChange[][]>([]);
  const [trashToken, setTrashToken] = useState(0);
  const pixelsRef = useRef<Record<string, string>>({});
  const revision = useRef(0);
  const activeStroke = useRef<Map<string, StrokeChange> | null>(null);
  const pendingPixels = useRef<Map<string, PixelChange>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushInFlight = useRef(false);
  const clearQueued = useRef(false);
  const flushPixelsRef = useRef<() => void>(() => {});
  const renderFrame = useRef<number | null>(null);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceInFlight = useRef(false);
  const presenceDirty = useRef(false);
  const presenceFlush = useRef<() => void>(() => {});
  const cursor = useRef<Point | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const snapshotRequest = useRef<Promise<void> | null>(null);
  const snapshotRefresh = useRef<() => void>(() => {});
  const snapshotReady = useRef(false);
  const eventsReady = useRef(false);

  const enqueueWrite = useCallback((operation: () => Promise<void>) => {
    const queued = writeQueue.current.catch(() => {}).then(operation);
    writeQueue.current = queued.catch(() => {});
    return queued;
  }, []);

  const publishPixels = useCallback((immediately = false) => {
    const publish = () => {
      renderFrame.current = null;
      setPixels({ ...pixelsRef.current });
    };

    if (immediately) {
      if (renderFrame.current !== null) cancelAnimationFrame(renderFrame.current);
      publish();
    } else if (renderFrame.current === null) {
      renderFrame.current = requestAnimationFrame(publish);
    }
  }, []);

  const markLive = useCallback(() => {
    if (snapshotReady.current && eventsReady.current) setStatus("Live");
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (snapshotRequest.current) return snapshotRequest.current;
    let stale = false;

    const request = (async () => {
      const response = await fetch("/api/canvas", { cache: "no-store" });
      if (!response.ok) throw new Error("Canvas read failed");
      const snapshot = (await response.json()) as CanvasSnapshot;
      if (snapshot.revision < revision.current) {
        stale = true;
        return;
      }

      revision.current = snapshot.revision;
      pixelsRef.current = { ...snapshot.pixels };
      mutatePixelChanges(
        pixelsRef.current,
        [...pendingPixels.current.values()],
      );
      publishPixels(true);
      setParticipants(snapshot.participants);
      snapshotReady.current = true;
      markLive();
    })();

    snapshotRequest.current = request;
    try {
      await request;
    } finally {
      if (snapshotRequest.current === request) snapshotRequest.current = null;
    }
    if (stale) queueMicrotask(snapshotRefresh.current);
  }, [markLive, publishPixels]);

  useEffect(() => {
    snapshotRefresh.current = () => {
      void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
    };
  }, [fetchSnapshot]);

  const flushPixels = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    if (
      flushInFlight.current ||
      clearQueued.current ||
      pendingPixels.current.size === 0
    ) {
      return;
    }

    flushInFlight.current = true;
    void enqueueWrite(async () => {
      while (pendingPixels.current.size > 0 && !clearQueued.current) {
        const changes = [...pendingPixels.current.values()].slice(
          0,
          MAX_AGENT_PIXELS,
        );
        await postCanvas({
          action: "paint",
          participant: identity,
          cursor: cursor.current,
          status: null,
          pixels: changes,
        });

        for (const change of changes) {
          const key = pixelKey(change.x, change.y);
          if (pendingPixels.current.get(key)?.color === change.color) {
            pendingPixels.current.delete(key);
          }
        }
      }
    })
      .then(markLive)
      .catch(() => {
        setStatus("Reconnecting…");
      })
      .finally(() => {
        flushInFlight.current = false;
        if (
          pendingPixels.current.size > 0 &&
          !clearQueued.current &&
          !flushTimer.current
        ) {
          flushTimer.current = setTimeout(() => {
            flushTimer.current = null;
            flushPixelsRef.current();
          }, 250);
        }
      });
  }, [enqueueWrite, identity, markLive]);

  useEffect(() => {
    flushPixelsRef.current = flushPixels;
  }, [flushPixels]);

  const queuePixels = useCallback(
    (changes: PixelChange[], immediately = false) => {
      mutatePixelChanges(pixelsRef.current, changes);
      publishPixels(immediately);
      for (const change of changes) {
        pendingPixels.current.set(pixelKey(change.x, change.y), change);
      }

      if (immediately) {
        flushPixels();
      } else if (!flushTimer.current) {
        flushTimer.current = setTimeout(flushPixels, 32);
      }
    },
    [flushPixels, publishPixels],
  );

  const schedulePresence = useCallback((delay = 0) => {
    if (presenceTimer.current) return;
    presenceTimer.current = setTimeout(() => {
      presenceTimer.current = null;
      presenceFlush.current();
    }, delay);
  }, []);

  const sendPresence = useCallback(async () => {
    if (presenceInFlight.current) {
      presenceDirty.current = true;
      return;
    }

    presenceInFlight.current = true;
    presenceDirty.current = false;
    try {
      await postCanvas({
        action: "presence",
        participant: identity,
        cursor: cursor.current,
        status: null,
      });
      markLive();
    } catch {
      setStatus("Reconnecting…");
      presenceDirty.current = true;
    } finally {
      presenceInFlight.current = false;
      if (presenceDirty.current) schedulePresence(32);
    }
  }, [identity, markLive, schedulePresence]);

  useEffect(() => {
    presenceFlush.current = () => void sendPresence();
  }, [sendPresence]);

  const updateCursor = useCallback(
    (nextCursor: Point | null) => {
      cursor.current = nextCursor;
      presenceDirty.current = true;
      if (!presenceInFlight.current) schedulePresence();
    },
    [schedulePresence],
  );

  const updateParticipant = useCallback((participant: StoredParticipant) => {
    setParticipants((current) => [
      ...current.filter(({ id }) => id !== participant.id),
      participant,
    ]);
  }, []);

  const applyRealtimePixels = useCallback(
    (event: Extract<CanvasEvent, { type: "pixels" }>) => {
      if (event.revision <= revision.current) return;
      const missedRevision = event.revision > revision.current + 1;
      revision.current = event.revision;
      const changes = event.pixels.map(
        ([x, y, color]): PixelChange => ({ x, y, color }),
      );
      mutatePixelChanges(pixelsRef.current, changes);
      mutatePixelChanges(
        pixelsRef.current,
        [...pendingPixels.current.values()],
      );
      publishPixels();
      updateParticipant(event.participant);
      markLive();
      if (missedRevision) {
        void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
      }
    },
    [fetchSnapshot, markLive, publishPixels, updateParticipant],
  );

  useEffect(() => {
    let active = true;
    void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
    const initialPresence = setTimeout(() => {
      presenceDirty.current = true;
      schedulePresence();
    }, 0);

    const events = new EventSource("/api/canvas/events");
    events.onmessage = (message) => {
      if (!active) return;
      let event: CanvasEvent;
      try {
        event = JSON.parse(message.data) as CanvasEvent;
      } catch {
        return;
      }

      if (event.type === "refresh") {
        setTrashToken((current) => current + 1);
        void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
      } else if (event.type === "ready") {
        void (async () => {
          await snapshotRequest.current?.catch(() => {});
          await fetchSnapshot();
          if (!active) return;
          eventsReady.current = true;
          markLive();
        })().catch(() => setStatus("Reconnecting…"));
      } else if (event.type === "pixels") {
        applyRealtimePixels(event);
      } else if (event.type === "clear") {
        setTrashToken((current) => current + 1);
        if (event.revision <= revision.current) return;
        const missedRevision = event.revision > revision.current + 1;
        revision.current = event.revision;
        pixelsRef.current = {};
        mutatePixelChanges(
          pixelsRef.current,
          [...pendingPixels.current.values()],
        );
        publishPixels(true);
        markLive();
        if (missedRevision) {
          void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
        }
      } else if (event.type === "presence") {
        updateParticipant(event.participant);
        markLive();
      }
    };
    events.onerror = () => {
      eventsReady.current = false;
      setStatus("Reconnecting…");
    };

    const heartbeat = setInterval(() => {
      presenceDirty.current = true;
      schedulePresence();
      if (pendingPixels.current.size > 0) flushPixels();
    }, 5_000);
    const fallbackRefresh = setInterval(
      () => void fetchSnapshot().catch(() => setStatus("Reconnecting…")),
      30_000,
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
      if (renderFrame.current !== null) cancelAnimationFrame(renderFrame.current);
    };
  }, [
    applyRealtimePixels,
    fetchSnapshot,
    flushPixels,
    markLive,
    publishPixels,
    schedulePresence,
    updateParticipant,
  ]);

  const beginStroke = useCallback(() => {
    activeStroke.current = new Map();
  }, []);

  const paintPixel = useCallback(
    (change: PixelChange) => {
      const key = pixelKey(change.x, change.y);
      const before = pixelsRef.current[key] ?? null;
      const after = change.color === "transparent" ? null : change.color;
      if (before === after) return;

      const stroke = activeStroke.current;
      if (stroke) {
        const existing = stroke.get(key);
        stroke.set(key, { key, before: existing?.before ?? before, after });
      }

      mutatePixelChanges(pixelsRef.current, [change]);
      publishPixels();
      pendingPixels.current.set(key, change);
      if (!flushTimer.current) {
        flushTimer.current = setTimeout(flushPixels, 32);
      }
    },
    [flushPixels, publishPixels],
  );

  const endStroke = useCallback(() => {
    const changes = [...(activeStroke.current?.values() ?? [])];
    activeStroke.current = null;
    if (changes.length > 0) {
      setUndoStack((current) => [...current, changes]);
      setRedoStack([]);
    }
    flushPixels();
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
    const changes = Object.entries(pixelsRef.current).map(([key, color]) => ({
      key,
      before: color,
      after: null,
    }));
    if (changes.length === 0) return;

    clearQueued.current = true;
    pendingPixels.current.clear();
    pixelsRef.current = {};
    publishPixels(true);
    setUndoStack((current) => [...current, changes]);
    setRedoStack([]);
    setStatus("Saving…");
    void enqueueWrite(() => postCanvas({ action: "clear", participant: identity }))
      .then(() => {
        clearQueued.current = false;
        setTrashToken((current) => current + 1);
        markLive();
        if (pendingPixels.current.size > 0) flushPixelsRef.current();
      })
      .catch(() => {
        clearQueued.current = false;
        setStatus("Reconnecting…");
        void fetchSnapshot();
        if (pendingPixels.current.size > 0) flushPixelsRef.current();
      });
  }, [enqueueWrite, fetchSnapshot, identity, markLive, publishPixels]);

  const activeParticipants = participants;
  const refresh = useCallback(() => {
    setTrashToken((current) => current + 1);
    void fetchSnapshot().catch(() => setStatus("Reconnecting…"));
  }, [fetchSnapshot]);

  return (
    <Surface
      session={{
        identity,
        pixels,
        participants: activeParticipants.filter(({ id }) => id !== identity.id),
        onlineCount: Math.max(1, activeParticipants.length),
        status,
        trashToken,
        onCursorChange: updateCursor,
        onStrokeStart: beginStroke,
        onPaintPixel: paintPixel,
        onStrokeEnd: endStroke,
        onUndo: undo,
        onRedo: redo,
        onClear: clear,
        onRefresh: refresh,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      }}
    />
  );
}

function LocalPaintingRoom({ surface: Surface }: { surface: PaintSurfaceComponent }) {
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
    <Surface
      session={{
        identity: LOCAL_IDENTITY,
        pixels,
        participants: [],
        onlineCount: 1,
        status: "Local preview",
        setupNotice: "Add DATABASE_URL to turn on multiplayer.",
        trashToken: 0,
        onCursorChange: NOOP,
        onStrokeStart: beginStroke,
        onPaintPixel: paintPixel,
        onStrokeEnd: endStroke,
        onUndo: undo,
        onRedo: redo,
        onClear: clear,
        onRefresh: NOOP,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      }}
    />
  );
}
