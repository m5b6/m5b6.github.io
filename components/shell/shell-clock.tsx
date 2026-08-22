"use client";

import { useEffect, useState } from "react";

const FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
};

export function formatClock(date: Date, locale?: string) {
  return new Intl.DateTimeFormat(locale, FORMAT).format(date);
}

/**
 * The menu-bar clock. It renders nothing on the server, because the server's minute is
 * not the reader's minute and a Macintosh does not flicker on arrival.
 */
export function ShellClock() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const tick = () => setLabel(formatClock(new Date()));
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);

  if (!label) return null;

  return (
    <span suppressHydrationWarning aria-label={`Clock, ${label}`}>
      {label}
    </span>
  );
}
