"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWard, type WardState } from "@/lib/asylum/world";
import {
  RECALLED_ROWS_KEPT,
  keepTail,
  recalledRow,
  wallRow,
  wallRows,
  type WallRow,
} from "./wall-model";
import {
  wardDeltaSchema,
  wardPresenceSchema,
  wardSnapshotSchema,
  wardStreamSchema,
} from "./ward-schema";

export const WARD_HEARTBEAT_MS = 6_000;
export const WARD_BACKFILL_REVISIONS = 16;

const STATE_URL = "/api/asylum/state";
const PRESENCE_URL = "/api/asylum/presence";
const EVENTS_URL = "/api/asylum/events";

export type SpectatorKind = "human" | "agent";

/**
 * Nothing here has a text field, and nothing here sends one. The only thing this
 * window ever posts is an opaque spectator id and whether it is a person (D1).
 */
export type WardConnection = "starting" | "watching" | "away" | "unsaved" | "quiet";

export type WardView = {
  state: WardState;
  rows: readonly WallRow[];
  spectators: number;
  persisted: boolean;
  connection: WardConnection;
};

function spectatorId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.trunc(Math.random() * 1_000_000)}`;

  return `ward:${random}`.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 80);
}

export function useWard(kind: SpectatorKind = "human"): WardView {
  const [state, setState] = useState<WardState>(() => createWard(1));
  const [rows, setRows] = useState<readonly WallRow[]>([]);
  const [spectators, setSpectators] = useState(0);
  const [persisted, setPersisted] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [started, setStarted] = useState(false);
  const [watching, setWatching] = useState(true);

  const cursor = useRef(0);
  const identity = useRef<string | null>(null);
  const recalled = useRef(false);

  if (identity.current === null) identity.current = spectatorId();

  const append = useCallback((incoming: readonly WallRow[]) => {
    if (incoming.length === 0) return;

    setRows((current) => {
      const seen = new Set(current.map((row) => row.id));
      const merged = [...current];

      for (const row of incoming) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }

      return keepTail(merged);
    });
  }, []);

  const pull = useCallback(async () => {
    const response = await fetch(`${STATE_URL}?since=${cursor.current}`, {
      cache: "no-store",
    });
    if (!response.ok) return;

    const delta = wardDeltaSchema.safeParse(await response.json());
    if (!delta.success) return;

    append(wallRows(delta.data.events));
    cursor.current = Math.max(cursor.current, delta.data.next);
  }, [append]);

  const adopt = useCallback(
    (next: { state: WardState; spectators: number; persisted: boolean }) => {
      setState(next.state);
      setSpectators(next.spectators);
      setPersisted(next.persisted);
      setQuiet(false);

      if (!recalled.current && next.state.wall.length > 0) {
        recalled.current = true;
        setRows((current) =>
          current.length > 0
            ? current
            : keepTail(next.state.wall.map(recalledRow), RECALLED_ROWS_KEPT),
        );
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const open = async () => {
      try {
        const response = await fetch(STATE_URL, { cache: "no-store" });
        const snapshot = wardSnapshotSchema.safeParse(await response.json());
        if (cancelled || !snapshot.success) {
          if (!cancelled) setQuiet(true);
          setStarted(true);
          return;
        }

        adopt(snapshot.data);
        cursor.current = Math.max(0, snapshot.data.revision - WARD_BACKFILL_REVISIONS);
        if (snapshot.data.persisted) await pull();
      } catch {
        if (!cancelled) setQuiet(true);
      } finally {
        if (!cancelled) setStarted(true);
      }
    };

    void open();
    return () => {
      cancelled = true;
    };
  }, [adopt, pull]);

  useEffect(() => {
    const sync = () => setWatching(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (!started || !watching) return;
    let cancelled = false;

    const beat = async () => {
      try {
        const response = await fetch(PRESENCE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            spectator: { id: identity.current, kind },
          }),
        });
        if (cancelled || !response.ok) return;

        const outcome = wardPresenceSchema.safeParse(await response.json());
        if (cancelled || !outcome.success) return;

        adopt(outcome.data);
        if (outcome.data.persisted && outcome.data.revision > cursor.current) {
          await pull();
        }
      } catch {
        if (!cancelled) setQuiet(true);
      }
    };

    void beat();
    const timer = setInterval(() => void beat(), WARD_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adopt, kind, pull, started, watching]);

  useEffect(() => {
    if (!started || !watching || !persisted) return;

    const source = new EventSource(EVENTS_URL);

    source.addEventListener("message", (message) => {
      let payload: unknown;
      try {
        payload = JSON.parse(message.data);
      } catch {
        return;
      }

      const parsed = wardStreamSchema.safeParse(payload);
      if (!parsed.success || parsed.data.type !== "ward") return;

      const beat = parsed.data;
      append(
        (beat.events ?? []).flatMap((event, seq) => {
          const row = wallRow(event);
          return row ? [{ ...row, id: `${beat.revision}:${seq}` }] : [];
        }),
      );
      cursor.current = Math.max(cursor.current, beat.revision);
    });

    source.addEventListener("error", () => source.close());

    return () => source.close();
  }, [append, persisted, started, watching]);

  const connection: WardConnection = !started
    ? "starting"
    : quiet
      ? "quiet"
      : !persisted
        ? "unsaved"
        : watching
          ? "watching"
          : "away";

  return { state, rows, spectators, persisted, connection };
}
