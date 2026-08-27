import {
  FACE_VIEWBOX,
  faceNodes,
  faceTilt,
  parseFace,
  PAINTS,
  type FaceNode,
  type Paint,
  type PathToken,
  type StrokeWidth,
} from "@/lib/asylum/face";

const [TRANSPARENT, INK, PAPER] = PAINTS;

/** Ink and paper come from the tokens, so an inverted panel inverts the face with it. */
function fillOf(value: Paint | undefined, fallback: Paint = TRANSPARENT) {
  const paint = value !== undefined && PAINTS.includes(value) ? value : fallback;
  if (paint === INK) return "var(--mac-art-ink)";
  if (paint === PAPER) return "var(--mac-art-paper)";
  return "none";
}

function widthOf(value: StrokeWidth | undefined) {
  return value === 1 ? 1 : 2;
}

function pathData(tokens: readonly PathToken[]) {
  return tokens
    .map((token, index) => {
      if (index === 0) return `M ${token.x} ${token.y}`;
      if (token.c === "Q") return `Q ${token.cx} ${token.cy} ${token.x} ${token.y}`;
      return `${token.c} ${token.x} ${token.y}`;
    })
    .join(" ");
}

function FaceShape({ node }: { node: FaceNode }) {
  switch (node.el) {
    case "line":
      return (
        <line
          x1={node.x1}
          y1={node.y1}
          x2={node.x2}
          y2={node.y2}
          strokeWidth={widthOf(node.sw)}
        />
      );
    case "circle":
      return (
        <circle
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          fill={fillOf(node.fill)}
          strokeWidth={widthOf(node.sw)}
        />
      );
    case "rect":
      return (
        <rect
          x={node.x}
          y={node.y}
          width={node.rw}
          height={node.rh}
          fill={fillOf(node.fill)}
          strokeWidth={widthOf(node.sw)}
        />
      );
    case "polyline":
      return (
        <polyline
          points={node.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={fillOf(node.fill)}
          strokeWidth={widthOf(node.sw)}
        />
      );
    case "path":
      return (
        <path
          d={pathData(node.d)}
          fill={fillOf(node.fill)}
          strokeWidth={widthOf(node.sw)}
        />
      );
  }
}

export type InmateFaceProps = {
  spec: unknown;
  size?: number;
  title?: string;
  className?: string;
};

/**
 * The face an inmate drew, rendered as React elements from the same clamped node
 * list the serialiser uses. Hostile input cannot reach the DOM as markup, because
 * markup is never what it becomes.
 */
export function InmateFace({ spec, size = 40, title, className }: InmateFaceProps) {
  const parsed = parseFace(spec);
  const nodes = faceNodes(parsed);
  const tilt = faceTilt(parsed);
  const shapes = nodes.map((node, index) => (
    <FaceShape key={`${node.el}-${index}`} node={node} />
  ));
  const classes = className ? `ward-face ${className}` : "ward-face";

  return (
    <svg
      className={classes}
      viewBox={`0 0 ${FACE_VIEWBOX} ${FACE_VIEWBOX}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      stroke="var(--mac-art-ink)"
      strokeLinecap="square"
      strokeLinejoin="miter"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {tilt === 0 ? shapes : <g transform={`rotate(${tilt} 32 32)`}>{shapes}</g>}
    </svg>
  );
}
