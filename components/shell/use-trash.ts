"use client";

import { useCallback, useEffect, useState } from "react";
import {
  trashSnapshotSchema,
  type TrashEntry,
  type TrashRequest,
} from "@/lib/trash";

export type TrashReading = {
  entries: readonly TrashEntry[];
  error: string | null;
};

export type TrashState = TrashReading & {
  loaded: boolean;
  busy: boolean;
  refresh: () => void;
  putBack: (revision?: number) => Promise<boolean>;
  empty: () => Promise<boolean>;
};

export async function fetchTrash(): Promise<TrashReading> {
  try {
    const response = await fetch("/api/canvas/trash", { cache: "no-store" });
    if (!response.ok) throw new Error("Trash read failed");
    const snapshot = trashSnapshotSchema.parse(await response.json());
    return { entries: snapshot.entries, error: null };
  } catch {
    return { entries: [], error: "The Trash is not available." };
  }
}

async function postTrash(body: TrashRequest) {
  const response = await fetch("/api/canvas/trash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error("Trash write failed");
}

/**
 * The Trash is server state, so the window reads it rather than guessing. `token` changes
 * whenever the shared canvas is emptied or refilled, by anybody, which is exactly when the
 * Trash has new contents.
 */
export function useTrash(
  actorId: string,
  actorName: string,
  token: number,
): TrashState {
  const [reading, setReading] = useState<TrashReading | null>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    const read = async () => {
      const next = await fetchTrash();
      if (active) setReading(next);
    };

    void read();
    return () => {
      active = false;
    };
  }, [nonce, token]);

  const run = useCallback(async (body: TrashRequest) => {
    setBusy(true);
    try {
      await postTrash(body);
      setReading(await fetchTrash());
      return true;
    } catch {
      setReading((current) => ({
        entries: current?.entries ?? [],
        error: "That could not be done.",
      }));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const putBack = useCallback(
    (revision?: number) =>
      run({
        action: "putBack",
        participant: { id: actorId, name: actorName },
        revision,
      }),
    [actorId, actorName, run],
  );

  const empty = useCallback(
    () => run({ action: "empty", participant: { id: actorId, name: actorName } }),
    [actorId, actorName, run],
  );

  return {
    entries: reading?.entries ?? [],
    error: reading?.error ?? null,
    loaded: reading !== null,
    busy,
    refresh: () => setNonce((current) => current + 1),
    putBack,
    empty,
  };
}
