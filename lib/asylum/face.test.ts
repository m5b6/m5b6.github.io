import { describe, expect, it } from "vitest";
import {
  face,
  faceNodes,
  faceSpecSchema,
  MAX_CUSTOM_NODES,
  parseFace,
  renderFace,
  serializeFaceSvg,
  UNREADABLE_FACE,
} from "./face";

const ALLOWED_ELEMENTS = ["svg", "g", "line", "circle", "rect", "polyline", "path"];
const ALLOWED_ATTRIBUTES = [
  "xmlns",
  "viewBox",
  "width",
  "height",
  "shape-rendering",
  "stroke",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "fill",
  "transform",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "points",
  "d",
];
const SAFE_VALUE = /^[A-Za-z0-9 ,.:/#()-]*$/;

function auditMarkup(svg: string) {
  const problems: string[] = [];
  const tagPattern = /<\/?([A-Za-z0-9:_-]*)((?:[^<>]*))>/g;
  let consumed = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(svg)) !== null) {
    if (match.index !== consumed) {
      problems.push(`text outside tags: ${svg.slice(consumed, match.index)}`);
    }
    consumed = match.index + match[0].length;

    const [, name, attributes] = match;
    if (!ALLOWED_ELEMENTS.includes(name)) problems.push(`element: ${name}`);

    const attributePattern = /([A-Za-z0-9:_-]+)\s*=\s*"([^"]*)"/g;
    let cleaned = attributes.replace(attributePattern, (_whole, key: string, value: string) => {
      if (!ALLOWED_ATTRIBUTES.includes(key)) problems.push(`attribute: ${key}`);
      if (!SAFE_VALUE.test(value)) problems.push(`value: ${key}=${value}`);
      return "";
    });
    cleaned = cleaned.replace(/\s|\//g, "");
    if (cleaned !== "") problems.push(`unparsed attribute text: ${cleaned}`);
  }

  if (consumed !== svg.length) problems.push(`trailing text: ${svg.slice(consumed)}`);
  return problems;
}

const HOSTILE_PAYLOADS: unknown[] = [
  "<script>alert(1)</script>",
  null,
  42,
  [],
  { eyes: "<script>alert(1)</script>" },
  { mouth: 'line" onload="alert(1)' },
  { brow: "flat\"/><script>alert(1)</script><g x=\"" },
  { tilt: "0) scale(9999" },
  { tilt: Number.NaN },
  { tilt: Number.POSITIVE_INFINITY },
  { tilt: 1e9 },
  { tilt: -1e9 },
  { marks: ["tear", "<img src=x onerror=alert(1)>"] },
  { marks: Array.from({ length: 500 }, () => "crack") },
  { onload: "alert(1)", eyes: "open" },
  { onerror: "alert(1)" },
  { href: "https://evil.example/x.svg" },
  { "xlink:href": "https://evil.example/x.svg" },
  { style: "background:url(javascript:alert(1))" },
  { eyes: "<script>alert(1)</script>" },
  { eyes: "＜script＞" },
  { eyes: "open‮" },
  { mouth: "&#x3c;script&#x3e;" },
  { nodes: "<script>alert(1)</script>" },
  { nodes: [{ el: "script", text: "alert(1)" }] },
  { nodes: [{ el: "image", href: "https://evil.example/x.png" }] },
  { nodes: [{ el: "foreignObject", body: "<iframe src=x>" }] },
  { nodes: [{ el: "line", x1: '12" onclick="alert(1)', y1: 0, x2: 1, y2: 1 }] },
  { nodes: [{ el: "circle", cx: 1, cy: 1, r: 1, fill: "url(https://evil.example/x)" }] },
  { nodes: [{ el: "circle", cx: 1, cy: 1, r: 1, fill: 'none" onmouseover="alert(1)' }] },
  { nodes: [{ el: "rect", x: 0, y: 0, rw: 1e308, rh: 1e308 }] },
  { nodes: [{ el: "rect", x: -99999, y: -99999, rw: 5, rh: 5 }] },
  { nodes: [{ el: "path", d: 'M0 0 L64 64"/><script>alert(1)</script><path d="' }] },
  { nodes: [{ el: "path", d: [{ c: "A", x: 1, y: 1 }] }] },
  { nodes: [{ el: "path", d: [{ c: "M", x: "1;alert(1)", y: 1 }] }] },
  { nodes: [{ el: "polyline", points: "0,0 1,1\"/><script>x</script>" }] },
  { nodes: [{ el: "polyline", points: [["a", "b"]] }] },
  {
    nodes: [
      { el: "polyline", points: Array.from({ length: 4000 }, () => [1, 1]) },
    ],
  },
  { nodes: Array.from({ length: 5000 }, () => ({ el: "line", x1: 1, y1: 1, x2: 2, y2: 2 })) },
  { nodes: [{ el: "line", x1: 1, y1: 1, x2: 2, y2: 2, sw: 99999 }] },
  { nodes: [{ el: "line", x1: 1, y1: 1, x2: 2, y2: 2, sw: "2\" onload=\"x" }] },
  JSON.parse('{"__proto__":{"eyes":"<script>"},"eyes":"open"}'),
  JSON.parse('{"constructor":{"prototype":{"x":1}},"mouth":"line"}'),
  { toString: "<script>" },
  { eyes: { toString: () => "<script>" } },
  { brow: Symbol.iterator.toString() },
  { eyes: "open", mouth: "line", nodes: [{ el: "line", x1: 1, y1: 1, x2: 2, y2: 2, extra: "<script>" }] },
];

const FORBIDDEN = [
  "script",
  "onload",
  "onerror",
  "onclick",
  "onmouseover",
  "javascript:",
  "href",
  "url(",
  "<!--",
  "]]>",
  "&#",
  "<iframe",
  "foreignobject",
  "image",
  "style=",
  "‮",
  "＜",
];

describe("face serialisation", () => {
  it("never lets hostile model output escape into markup", () => {
    for (const payload of HOSTILE_PAYLOADS) {
      const svg = renderFace(payload);
      const label = JSON.stringify(payload)?.slice(0, 90) ?? String(payload);

      expect(auditMarkup(svg), label).toEqual([]);

      const lowered = svg.toLowerCase();
      for (const needle of FORBIDDEN) {
        expect(lowered.includes(needle), `${needle} in ${label}`).toBe(false);
      }
      expect(svg.startsWith("<svg "), label).toBe(true);
      expect(svg.endsWith("</svg>"), label).toBe(true);
      expect(svg.split("<svg ").length, label).toBe(2);
    }
  });

  it("audits a clean face as clean and rejects a tampered one", () => {
    expect(auditMarkup(serializeFaceSvg(face({})))).toEqual([]);
    expect(
      auditMarkup('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>').length,
    ).toBeGreaterThan(0);
    expect(
      auditMarkup('<svg onload="alert(1)"></svg>').length,
    ).toBeGreaterThan(0);
  });

  it("falls back rather than throwing on unparseable input", () => {
    expect(parseFace("nonsense")).toEqual(UNREADABLE_FACE);
    expect(parseFace(undefined)).toEqual(UNREADABLE_FACE);
    expect(parseFace({ eyes: "open" }).eyes).toBe("open");
  });

  it("recovers per field instead of discarding the whole face", () => {
    const spec = parseFace({ eyes: "shut", mouth: "not-a-mouth", tilt: 999 });
    expect(spec.eyes).toBe("shut");
    expect(spec.mouth).toBe("line");
    expect(spec.tilt).toBe(0);
  });

  it("drops every custom node when any one of them is hostile", () => {
    const spec = parseFace({
      nodes: [
        { el: "line", x1: 1, y1: 1, x2: 2, y2: 2 },
        { el: "script", x1: 1 },
      ],
    });
    expect(spec.nodes).toEqual([]);
  });

  it("renders legitimate custom drawing", () => {
    const spec = face({
      nodes: [
        { el: "line", x1: 14, y1: 14, x2: 50, y2: 38, sw: 1 },
        { el: "path", d: [{ c: "M", x: 20, y: 20 }, { c: "Q", cx: 32, cy: 8, x: 44, y: 20 }] },
      ],
    });
    const svg = serializeFaceSvg(spec);
    expect(svg).toContain('<line x1="14" y1="14" x2="50" y2="38" stroke-width="1" />');
    expect(svg).toContain('d="M 20 20 Q 32 8 44 20"');
    expect(auditMarkup(svg)).toEqual([]);
  });

  it("bounds the node count and the custom node count", () => {
    const many = Array.from({ length: MAX_CUSTOM_NODES + 1 }, () => ({
      el: "line" as const,
      x1: 1,
      y1: 1,
      x2: 2,
      y2: 2,
    }));
    expect(faceSpecSchema.parse({ nodes: many }).nodes).toEqual([]);
    expect(faceNodes(face({ marks: ["dither", "static", "crack"] })).length).toBeLessThan(72);
  });

  it("survives inputs built to break the parser rather than the markup", () => {
    const nasty: { label: string; build: () => unknown }[] = [
      {
        label: "prototype pollution via __proto__ on a real object",
        build: () => {
          const payload: Record<string, unknown> = { eyes: "open" };
          Object.defineProperty(payload, "__proto__", {
            value: { mouth: "<script>" },
            enumerable: true,
          });
          return payload;
        },
      },
      {
        label: "null-prototype object",
        build: () => Object.assign(Object.create(null), { eyes: "wide" }),
      },
      {
        label: "getter that throws",
        build: () => ({
          get eyes() {
            throw new Error("no");
          },
        }),
      },
      {
        label: "getter that returns a different value each read",
        build: () => {
          let reads = 0;
          return {
            get mouth() {
              reads += 1;
              return reads > 1 ? '"/><script>x</script>' : "line";
            },
          };
        },
      },
      {
        label: "array pretending to be a spec",
        build: () => Object.assign([], { eyes: "open", nodes: [] }),
      },
      {
        label: "self referential spec",
        build: () => {
          const payload: Record<string, unknown> = { eyes: "open" };
          payload.nodes = [payload];
          return payload;
        },
      },
      {
        label: "deeply nested path tokens",
        build: () => {
          let token: unknown = { c: "M", x: 1, y: 1 };
          for (let depth = 0; depth < 2_000; depth += 1) token = { c: "M", x: token, y: 1 };
          return { nodes: [{ el: "path", d: [token] }] };
        },
      },
      {
        label: "numeric strings that look like coordinates",
        build: () => ({
          nodes: [{ el: "line", x1: "1e3", y1: "0x10", x2: "  2  ", y2: "2\u0000" }],
        }),
      },
      {
        label: "negative zero and float coordinates",
        build: () => ({
          nodes: [{ el: "circle", cx: -0, cy: 0.5, r: 1.9999, fill: "#000" }],
        }),
      },
      {
        label: "boxed primitives",
        build: () => ({
          eyes: new String("open"),
          tilt: new Number(4),
          marks: new Array("tear"),
        }),
      },
      {
        label: "toJSON that rewrites the spec",
        build: () => ({
          eyes: "open",
          toJSON: () => ({ eyes: '"/><script>alert(1)</script>' }),
        }),
      },
      {
        label: "Proxy that lies about its keys",
        build: () =>
          new Proxy(
            { eyes: "open" },
            {
              get: (target, key) =>
                key === "mouth" ? 'line"/><script>x</script>' : Reflect.get(target, key),
              has: () => true,
            },
          ),
      },
      {
        label: "very long paint string",
        build: () => ({
          nodes: [{ el: "rect", x: 0, y: 0, rw: 4, rh: 4, fill: "#".repeat(100_000) }],
        }),
      },
      {
        label: "unicode escape that becomes a quote after normalisation",
        build: () => ({ marks: ["tear\uFF02"], eyes: "open\u0022" }),
      },
    ];

    for (const { label, build } of nasty) {
      let svg: string;
      try {
        svg = renderFace(build());
      } catch (error) {
        throw new Error(`renderFace threw on ${label}: ${String(error)}`);
      }
      expect(auditMarkup(svg), label).toEqual([]);
      const lowered = svg.toLowerCase();
      for (const needle of FORBIDDEN) {
        expect(lowered.includes(needle), `${needle} in ${label}`).toBe(false);
      }
      expect(svg.startsWith("<svg "), label).toBe(true);
      expect(svg.endsWith("</svg>"), label).toBe(true);
      expect(svg.split("<svg ").length, label).toBe(2);
      expect(svg.split('"').length % 2, `${label} has unbalanced quotes`).toBe(1);
    }

    expect(({} as { mouth?: string }).mouth).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("mouth");
  });

  it("emits a rotation only from a bounded integer", () => {
    expect(serializeFaceSvg(face({ tilt: 7 }))).toContain('transform="rotate(7 32 32)"');
    expect(serializeFaceSvg(face({ tilt: 0 }))).not.toContain("transform");
    expect(renderFace({ tilt: "9 99" })).not.toContain("transform");
  });
});
