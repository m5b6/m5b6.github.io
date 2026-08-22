# DESIGN.md — the Macintosh law

This site is a Macintosh. Not a site with a retro theme: a Macintosh. Every pixel of chrome
belongs to System 6/7 and behaves the way System 6/7 behaved. This file is the law, and the
lint config plus `components/mac/design-law.test.ts` are the police. If you find yourself
arguing with a rule here, you are drifting.

Read this before you write UI. Look at the whole library at `/design`.

---

## 1. The law

1. **One bit, black and white.** The chrome has two colours: ink and paper. There is no grey
   except the two System 7 disabled/inactive greys, and there is no third colour. Where you
   need a mid tone, use the 50% dither (`--mac-dither-50`), which is how the Mac did it.
   *The only colour on the site is inside an app's own data* — the paint canvas' palette is
   the painting, not the interface.
2. **Chicago for the interface, Geneva for labels.** `--mac-font-chicago` on every control,
   menu, title and button. `--mac-font-geneva` for icon names, status text and fine print.
   Never a system UI stack, never a webfont from a CDN.
3. **Borders are one hard pixel.** `--mac-border`. Alerts get `--mac-border-heavy` (2px) and
   nothing else is ever thicker.
4. **Nothing is rounded.** `border-radius` may only ever be `var(--mac-radius)`, which is `0`.
   The push button *looks* rounded because system.css draws its real 1984 border art with
   `border-image` — that is a picture, not a radius.
5. **No soft anything.** No gradients used as decoration, no blur, no opacity fades, no
   transitions on colour. Hard-stop gradients are allowed for exactly one purpose: drawing a
   1-bit pattern (the title-bar stripes, the desktop dither, the progress barber pole). If your
   gradient has a soft stop, delete it.
6. **One shadow.** `--mac-shadow` — `2px 2px 0 0` of solid ink, no blur. It belongs on windows,
   menus and dialogs. Nothing else casts a shadow, ever.
7. **The pixel grid is real.** Sizes are whole pixels. Type is 16px or 24px, never 15 or 17.
   Spacing comes from the `--mac-space-*` scale. `rem`, `em` and fractional pixels round badly
   against bitmap type and are banned in the authored layer.
8. **Colours live in exactly one file.** `styles/tokens.css`. A hex, `rgb()`, `hsl()` or
   `color-mix()` anywhere else fails the tests.

---

## 2. The tokens

`styles/tokens.css` is the only file allowed to name a colour. `styles/mac.css` imports it,
`components/mac/index.ts` imports `styles/mac.css`, so importing the library always brings the
palette with it. Nothing else needs wiring.

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--mac-ink` | black | every border, every glyph |
| `--mac-paper` | white | every surface |
| `--mac-ink-inverted` / `--mac-paper-inverted` | white / black | selection and highlight, which on a Mac is an inversion |
| `--mac-gray-inactive` | `#a5a5a5` | the title of an unfocused window |
| `--mac-gray-disabled` | `#b6b7b8` | disabled button and menu-item text |
| `--mac-dither-50` + `--mac-dither-cell` | 2px checkerboard | the desktop, scrollbar tracks, the resize grip |
| `--mac-stripe` | 45° 2px barber pole | progress fill |

### Type

| Token | Stack | Use |
| --- | --- | --- |
| `--mac-font-chicago` | Chicago_12 (ChiKareGo2) | all interface chrome |
| `--mac-font-display` | Chicago (ChicagoFLF) | headings only |
| `--mac-font-geneva` | Geneva_9 (FindersKeepers) | labels, status bars, fine print |
| `--mac-font-monaco` | Monaco (vendored pixel face) | technical text that wants the period look |
| `--mac-font-mono` | Menlo → monospace | **only** when characters must line up in columns |

Sizes: `--mac-text-base` / `--mac-text-small` / `--mac-text-title` are all `16px`, which is the
size ChiKareGo2 and FindersKeepers were drawn for; `--mac-text-display` is `24px`. There is no
other size. Line height is `--mac-leading-base` (1.15).

> **Trap.** The vendored `Monaco` face from @sakun/system.css is *not* monospaced — `i` and `M`
> have different advances. Use `--mac-font-monaco` for flavour and `--mac-font-mono` when
> alignment actually matters. `.mac-text-technical` and `.mac-text-mono` are the two classes.

### Space, frame, metric

Spacing tokens are named after their value so you cannot pick the wrong one:
`--mac-space-2 … --mac-space-32` (2, 4, 6, 8, 10, 12, 16, 20, 24, 32).

| Token | Value | Why |
| --- | --- | --- |
| `--mac-hairline` / `--mac-border` | 1px solid ink | the only border |
| `--mac-border-heavy` | 2px solid ink | the alert frame |
| `--mac-radius` | `0` | the only legal radius |
| `--mac-shadow` | `2px 2px 0 0` ink | the only legal shadow |
| `--mac-menu-bar-height` | 20px | real System 6/7 menu bar |
| `--mac-title-bar-height` | 20px | real System 7 title bar |
| `--mac-title-button` | 11px | real close / collapse / zoom box |
| `--mac-scrollbar` | 15px | real scroll bar |
| `--mac-icon-size` / `--mac-icon-cell` | 32px / 64px | real icon and its label cell |
| `--mac-desktop-gutter` | 30px | top of the desktop icon well |

Every token defined here is used, and every token used is defined — both directions are tested.

---

## 3. The component contract

Import from the barrel. Always.

```tsx
import { MacButton, MacWindow, MacWindowPane } from "@/components/mac";
```

```tsx
// NEVER. Deep imports skip styles/mac.css and lint rejects them.
import { MacButton } from "@/components/mac/mac-button";
```

Every component in `components/mac` is **presentational and dumb**: no data fetching, no
`lib/wm` import, no `useState` beyond `useId`. State belongs to the window manager and to the
apps. If a component needs to know something, it takes a prop.

### Usage and anti-usage

```tsx
// NEVER
<button onClick={save}>Save</button>
// ALWAYS
<MacButton onClick={save}>Save</MacButton>
<MacButton variant="default" onClick={save}>Save</MacButton>   // the default (thick-ringed) button
```

```tsx
// NEVER
if (confirm("Clear the canvas?")) clear();
// ALWAYS — a Mac alert is a component with an icon well, and it blocks
<MacAlert open={asking} kind="caution" label="Clear the canvas"
  actions={<><MacButton onClick={cancel}>Cancel</MacButton>
            <MacButton variant="default" onClick={clear}>Clear</MacButton></>}>
  Clearing throws away 19,842 painted pixels.
</MacAlert>
```

```tsx
// NEVER
<input value={name} onChange={rename} />
// ALWAYS — the label and the input are one unit, wired by id
<MacField label="Painter" value={name} onChange={rename} hint="Letters only." />
```

```tsx
// NEVER — the window manager owns position, size and z-order
<MacWindow style={{ position: "fixed", zIndex: 9999 }} />
// ALWAYS — the reducer computes the rect, the component only wears it
<MacWindow
  title={win.title}
  active={win.focused}
  collapsed={win.collapsed}
  style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
  dragHandleProps={{ onPointerDown: startDrag }}
  resizeHandleProps={{ onPointerDown: startResize }}
  onClose={close} onCollapse={collapse} onZoom={zoom}
>
  <MacWindowPane>…</MacWindowPane>
</MacWindow>
```

```tsx
// NEVER
<div style={{ background: "#000", borderRadius: 4 }} />
// ALWAYS — a class in styles/mac.css that references tokens
<div className="mac-scroll-area" />
```

### The decision table

| I want to show… | Use | Never |
| --- | --- | --- |
| an application window | `MacWindow` + `MacWindowPane` | a styled `<div>` |
| the screen menu bar | `MacMenuBar` + `MacMenu` + `MacMenuItem` + `MacMenuSeparator` | a `<nav>`, a dropdown library |
| an app on the desktop | `MacDesktopIcons` + `MacDesktopIcon` | absolutely positioned `<img>` |
| the desktop layer itself | `MacDesktop` (+ `MacDesktopSurface`) | `body { background }` |
| an action | `MacButton` | `<button>`, `<a role="button">` |
| a yes/no setting | `MacCheckbox` | `<input type="checkbox">` |
| one of several settings | `MacRadio` | `<input type="radio">`, a `<select>` |
| typed text | `MacField` / `MacFieldRow` | `<input>`, `<textarea>` |
| a destructive confirmation | `MacAlert kind="caution"` | `confirm()` |
| a hard stop | `MacAlert kind="stop"` | `alert()` |
| something informational | `MacAlert kind="note"` | a toast, a snackbar |
| a form in a modal | `MacDialog` | `<dialog>` |
| work in progress | `MacProgressBar` (`indeterminate` when unknown) | a spinner, a skeleton |
| scrolling content | `MacScrollArea` | `overflow: auto` on a bare div |
| counts and coordinates | `MacStatusBar` (or `MacWindow status={…}`) | a footer |
| a rule between things | `MacSeparator` | `<hr>`, a bordered div |
| an icon | `MacIcon` / `MacPixelArt` | an emoji, an SVG icon set, a font icon |

There is **no** `MacToast`, `MacTooltip`, `MacTabs`, `MacCard` or `MacSpinner`, because System 6
had none of those. If you want one, you want a different operating system.

---

## 4. The System 6/7 behaviours that are not optional

- **The menu bar is at the top of the screen, not the top of the window.** One bar, 20px,
  always visible, and its contents change with the front application. It is never inside a
  window and it never scrolls away.
- **There is no dock and no taskbar.** A collapsed window stays where it is on the desktop as a
  bare title bar. That is what the collapse box does: it rolls the window up like a blind.
- **Single click selects, double click opens.** `MacDesktopIcon` takes `onSelect` and `onOpen`
  and they are different things. A single click never opens anything.
- **Selection is inversion.** A selected icon swaps ink and paper. There is no highlight colour,
  no outline, no glow.
- **An inactive window loses its stripes and its boxes.** No title-bar stripes, grey title, and
  the close/collapse/zoom boxes are not drawn at all. `MacWindow` does this from `active`.
- **The close box shows nothing until you press it.** Empty square at rest. system.css draws the
  X on `:active`; do not add a hover state, because the Mac had no hover.
- **Modal dialogs block.** `MacDialog` and `MacAlert` render a full-screen layer that eats
  pointer events. They do not dim the desktop — the Mac never dimmed anything — they simply
  stop you.
- **The default button wears the thick ring.** Exactly one per dialog, and it is the safe
  choice, not the destructive one, unless the destructive one is what you came for.
- **Menus open on click and stay open.** They do not open on hover. system.css opens them on
  hover by CSS alone; `styles/mac.css` overrides that, and `MacMenu` takes `open` as a prop.
- **Shortcuts read the Mac way.** `⌘N`, `⇧⌘Z`, right-aligned in the menu. Never `Ctrl+N`.

---

## 5. Adding a component without drifting

1. **Check system.css first.** `styles/system.css` is @sakun/system.css v0.1.11, vendored, with
   fonts and button art self-hosted. It already ships `.window`, `.title-bar`, `.window-pane`,
   `.standard-dialog`, `.alert-box`, `.btn` / `.btn-default`, `.field-row`, `.separator`,
   `.details-bar`, `.apple`, the checkbox/radio art, and the `menu-bar` / `menu` roles. If the
   look exists there, **wrap it** — put the system.css class first, your `mac-*` class second.
   Only author CSS for what genuinely is not there.
   *Never edit `styles/system.css`.* It is generated by `scripts/vendor-system-css.ts`.
2. **Never add a network request.** No CDN link, no Google Font, no remote image. The site makes
   zero external requests and `lib/vendored-assets.test.ts` keeps it that way.
3. Put new CSS in `styles/mac.css`, referencing tokens only. Add a token to `styles/tokens.css`
   if and only if it is a real System 6/7 value, and use it — unused tokens fail the tests.
4. Keep the component dumb, export it from `components/mac/index.ts`, and add it to the
   decision table above.
5. Add it to `components/mac/gallery.tsx` in **every** state (active, inactive, disabled,
   selected, empty). `/design` is how a human reviews this library; a component that is not on
   that page does not exist.
6. Add a test to `components/mac/mac-components.test.tsx` asserting the exact system.css class
   names it renders. That test is what stops a future refactor from quietly dropping `.btn`.

### Known limits, honestly

- **Scroll bars depend on the viewer's OS.** `styles/mac.css` draws the full System 7 scroll bar
  — dithered track, white thumb with a black border, arrow boxes — via `::-webkit-scrollbar`.
  macOS *overlay* scrollbars (and headless Chrome) give it no layout space, so it is invisible
  there. It renders correctly in headful Chrome and on Windows/Linux.
- **system.css's title-bar buttons are a 40px box at `scale(.5)`,** and it has no collapse box.
  `styles/mac.css` overrides them to the real 11px metric and adds the collapse box.
- **system.css styles the *document* scroll bar only,** not arbitrary scroll containers. That is
  why `.mac-scroll-area` and `.mac-window-pane` carry their own part set.

---

## 6. How the law is enforced

`npm run lint` fails the build on:

- a raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`, `<progress>`, `<menu>` or
  `<hr>` inside `app/**` or `components/apps/**`;
- `alert()`, `confirm()`, `prompt()` (bare or on `window`) anywhere in `app/**`,
  `components/apps/**` or `components/mac/**`;
- an inline `style` that sets colour, background, border colour, shadow or radius;
- a deep import of `components/mac/*` instead of the barrel;
- a hex colour literal inside `components/mac/**`.

`npm run test` fails on:

- a hex, `rgb()`, `hsl()`, `oklch()` or `color-mix()` in any authored file outside
  `styles/tokens.css`;
- a `border-radius` that is not `var(--mac-radius)` or a `box-shadow` that is not
  `var(--mac-shadow)` in the authored stylesheets;
- a `var(--mac-…)` reference to a token that does not exist, or a token that nothing uses;
- a component that stops rendering the system.css class names it promises;
- a pixel-art icon that is not a 32×32 grid of ink / paper / transparent cells.

Do not weaken a rule to land a change. Change the design instead.
