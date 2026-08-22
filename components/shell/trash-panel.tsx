"use client";

import { useState } from "react";
import { MacButton, MacScrollArea } from "@/components/mac";
import type { TrashEntry } from "@/lib/trash";
import type { TrashState } from "./use-trash";

export function formatDiscarded(iso: string, now = Date.now()) {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "just now";

  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function trashItemName(entry: TrashEntry) {
  return `Painting at revision ${entry.revision}`;
}

export type TrashPanelProps = {
  trash: TrashState;
  onRequestEmpty: () => void;
};

/**
 * The Finder's Trash. Clearing the canvas files the painting here instead of destroying
 * it; Put Back returns the newest one; only Empty Trash is irreversible.
 */
export function TrashPanel({ trash, onRequestEmpty }: TrashPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const empty = trash.entries.length === 0;
  const target = selected ?? trash.entries[0]?.revision ?? null;

  return (
    <div className="shell-window-pane">
      {trash.error ? <p className="shell-note">{trash.error}</p> : null}

      <MacScrollArea className="shell-list" framed>
        {empty ? (
          <p className="shell-list-empty">
            {trash.loaded ? "Nothing has been thrown away." : "Looking…"}
          </p>
        ) : (
          trash.entries.map((entry) => (
            <div
              key={entry.revision}
              className="shell-list-row"
              data-selected={target === entry.revision ? "true" : "false"}
              role="button"
              tabIndex={0}
              aria-pressed={target === entry.revision}
              onClick={() => setSelected(entry.revision)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setSelected(entry.revision);
              }}
            >
              <span className="shell-list-name">{trashItemName(entry)}</span>
              <span>
                {entry.pixelCount.toLocaleString("en-US")} px ·{" "}
                {formatDiscarded(entry.discardedAt)}
              </span>
            </div>
          ))
        )}
      </MacScrollArea>

      <div className="shell-actions">
        <MacButton onClick={onRequestEmpty} disabled={empty || trash.busy}>
          Empty Trash…
        </MacButton>
        <MacButton
          variant="default"
          disabled={empty || trash.busy}
          onClick={() => {
            if (target !== null) void trash.putBack(target);
          }}
        >
          Put Back
        </MacButton>
      </div>
    </div>
  );
}
