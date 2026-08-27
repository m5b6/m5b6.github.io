"use client";

import { useEffect, useRef } from "react";
import { MacPixelArt, MacScrollArea } from "@/components/mac";
import { WALL_MARKS } from "./marks";
import type { WallRow } from "./wall-model";
import type { WardVoice } from "./ward-boot";

export type WardWallProps = {
  rows: readonly WallRow[];
  voice: WardVoice;
};

/**
 * Requirement two. Speech is Chicago and out loud; a thought is Geneva, set aside,
 * and tagged PRIVATE, because the inmates are told think() is private and it is
 * projected here anyway. The tag is left standing. Nobody corrects it.
 */
export function WardWall({ rows, voice }: WardWallProps) {
  const list = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);

  /** The wall stays at the newest beat unless the reader has gone looking backwards. */
  useEffect(() => {
    const lines = list.current;
    const box = lines?.parentElement;
    if (!lines || !box) return;

    const gap = () => box.scrollHeight - box.scrollTop - box.clientHeight;
    const pin = () => {
      if (pinned.current) box.scrollTop = box.scrollHeight;
    };
    const track = () => {
      pinned.current = gap() < 24;
    };

    pin();
    box.addEventListener("scroll", track, { passive: true });
    const resize = new ResizeObserver(pin);
    resize.observe(lines);

    return () => {
      box.removeEventListener("scroll", track);
      resize.disconnect();
    };
  }, []);

  return (
    <MacScrollArea className="ward-wall" framed>
      <ol className="ward-wall-lines" ref={list}>
        {rows.length === 0 ? (
          <li className="ward-wall-empty">
            THE WALL IS BLANK. NOTHING HAS BEEN SAID IN HERE YET.
          </li>
        ) : null}
        {rows.map((row) => (
          <li
            key={row.id}
            className="ward-line"
            data-kind={row.kind}
            data-weight={row.weight}
            data-aside={row.aside ? "true" : "false"}
          >
            <span className="ward-line-rail" data-voice={voice} aria-hidden="true" />
            <span className="ward-line-mark">
              {row.mark ? (
                <MacPixelArt rows={WALL_MARKS[row.mark]} size={14} />
              ) : null}
            </span>
            <span className="ward-line-text">
              {row.speaker ? (
                <span className="ward-line-speaker">{row.speaker}</span>
              ) : null}
              {row.tag ? <span className="ward-line-tag">{row.tag}</span> : null}
              <span className="ward-line-body">{row.body}</span>
            </span>
            {row.amount ? (
              <span className="ward-line-amount">{row.amount}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </MacScrollArea>
  );
}
