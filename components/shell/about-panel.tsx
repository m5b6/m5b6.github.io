"use client";

import { Fragment } from "react";
import { MacIcon, MacProgressBar, MacSeparator } from "@/components/mac";
import { APPS, SITE } from "@/lib/apps/manifest";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/canvas";

const TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT;

export function unusedPixels(paintedCount: number) {
  return Math.max(0, TOTAL_PIXELS - paintedCount);
}

export type AboutPanelProps = {
  paintedCount: number;
  trashedCount: number;
  onlineCount: number;
};

/**
 * About This Macintosh, read literally: the canvas is the machine's memory and the
 * painting is what is loaded into it.
 */
export function AboutPanel({
  paintedCount,
  trashedCount,
  onlineCount,
}: AboutPanelProps) {
  const painted = Math.min(paintedCount, TOTAL_PIXELS);
  const figures: readonly [string, string][] = [
    ["Total Memory:", `${TOTAL_PIXELS.toLocaleString("en-US")} pixels`],
    ["Largest Unused Block:", `${unusedPixels(painted).toLocaleString("en-US")} pixels`],
    ["In the Trash:", `${trashedCount.toLocaleString("en-US")} pixels`],
    ["Painters Present:", `${onlineCount.toLocaleString("en-US")}`],
  ];

  return (
    <div className="shell-about">
      <div className="shell-about-head">
        <MacIcon name="canvas" title="Shared Paint" />
        <div>
          <h2 className="shell-about-title">{SITE.name}</h2>
          <p className="shell-about-line">
            {CANVAS_WIDTH} × {CANVAS_HEIGHT}, one bit of chrome, {SITE.owner}
          </p>
        </div>
      </div>

      <MacSeparator />

      <div className="shell-about-figures">
        {figures.map(([label, value]) => (
          <Fragment key={label}>
            <span>{label}</span>
            <span>{value}</span>
          </Fragment>
        ))}
      </div>

      <MacSeparator />

      {APPS.map((app) => (
        <div key={app.id} className="shell-about-bar">
          <span>{app.title}</span>
          <MacProgressBar
            label={`${app.title} memory`}
            value={app.status === "live" ? painted / TOTAL_PIXELS : 0}
          />
          <span>{app.status === "live" ? "running" : "not open"}</span>
        </div>
      ))}
    </div>
  );
}
