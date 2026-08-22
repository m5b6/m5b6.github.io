import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const RAW_ELEMENTS = [
  ["button", "MacButton"],
  ["input", "MacField, MacCheckbox or MacRadio"],
  ["select", "MacField"],
  ["textarea", "MacField"],
  ["dialog", "MacDialog or MacAlert"],
  ["progress", "MacProgressBar"],
  ["menu", "MacMenuBar"],
  ["hr", "MacSeparator"],
];

const NATIVE_MODALS = ["alert", "confirm", "prompt"];

const rawElementRules = RAW_ELEMENTS.map(([tag, replacement]) => ({
  selector: `JSXOpeningElement[name.name="${tag}"]`,
  message: `DESIGN.md: <${tag}> drifts off the Macintosh. Use <${replacement}> from @/components/mac.`,
}));

const nativeModalRules = NATIVE_MODALS.flatMap((fn) => [
  {
    selector: `CallExpression[callee.name="${fn}"]`,
    message: `DESIGN.md: ${fn}() renders the browser's chrome, not the Macintosh's. Use <MacAlert> or <MacDialog>.`,
  },
  {
    selector: `CallExpression[callee.object.name="window"][callee.property.name="${fn}"]`,
    message: `DESIGN.md: window.${fn}() renders the browser's chrome, not the Macintosh's. Use <MacAlert> or <MacDialog>.`,
  },
]);

const inlineStyleRules = [
  {
    selector: 'JSXAttribute[name.name="style"] Property[key.name=/^(color|background|backgroundColor|borderColor|boxShadow|borderRadius)$/]',
    message: "DESIGN.md: colour, shadow and radius live in styles/tokens.css, never in an inline style.",
  },
];

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "next-env.d.ts"]),
  {
    name: "macintosh/no-drift",
    files: ["app/**/*.{ts,tsx}", "components/apps/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...rawElementRules,
        ...nativeModalRules,
        ...inlineStyleRules,
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/mac/*", "**/components/mac/*"],
              message:
                "DESIGN.md: import from @/components/mac so the Macintosh stylesheet always comes with the component.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "macintosh/library-gallery",
    files: ["app/design/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    name: "macintosh/library-internals",
    files: ["components/mac/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...nativeModalRules,
        ...inlineStyleRules,
        {
          selector: "Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message:
            "DESIGN.md: styles/tokens.css is the only file allowed to name a colour. Reference a --mac-* token.",
        },
        {
          selector: "TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message:
            "DESIGN.md: styles/tokens.css is the only file allowed to name a colour. Reference a --mac-* token.",
        },
      ],
    },
  },
]);
