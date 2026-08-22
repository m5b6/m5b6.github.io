type Run = { x: number; width: number; ink: boolean };

export type MacPixelRows = readonly string[];

export type MacPixelArtProps = {
  rows: MacPixelRows;
  size?: number;
  scale?: number;
  title?: string;
  className?: string;
};

export function pixelRuns(rows: MacPixelRows): readonly (readonly Run[])[] {
  return rows.map((row) => {
    const runs: Run[] = [];
    let start = 0;

    while (start < row.length) {
      const char = row[start];
      let end = start;
      while (end < row.length && row[end] === char) end += 1;
      if (char === "#" || char === "o") {
        runs.push({ x: start, width: end - start, ink: char === "#" });
      }
      start = end;
    }

    return runs;
  });
}

export function MacPixelArt({
  rows,
  size,
  scale,
  title,
  className,
}: MacPixelArtProps) {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const runs = pixelRuns(rows);
  const classes = className ? `mac-pixel-art ${className}` : "mac-pixel-art";

  return (
    <svg
      className={classes}
      viewBox={`0 0 ${width} ${height}`}
      width={scale ? width * scale : size ?? width}
      height={scale ? height * scale : size ?? height}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {runs.map((rowRuns, y) =>
        rowRuns.map((run) => (
          <rect
            key={`${y}-${run.x}`}
            x={run.x}
            y={y}
            width={run.width}
            height={1}
            fill={run.ink ? "var(--mac-art-ink)" : "var(--mac-art-paper)"}
          />
        )),
      )}
    </svg>
  );
}
