import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PaintSession } from "@/components/painting-experience";
import { createDesktopStore, type DesktopStore } from "@/lib/wm/store";

let canvasRenders = 0;
let canvasDraws = 0;

vi.mock("@/components/painting-surface", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/painting-surface")>();

  return {
    ...actual,
    PaintingCanvas: (props: Parameters<typeof actual.PaintingCanvas>[0]) => {
      canvasRenders += 1;
      return createElement(actual.PaintingCanvas, props);
    },
  };
});

const { ShellStoreProvider } = await import("./desktop-store");
const { PaintDesktop } = await import("./paint-desktop");

function recordingContext() {
  return {
    clearRect: () => {
      canvasDraws += 1;
    },
    fillRect: () => {
      canvasDraws += 1;
    },
    fillStyle: "",
    imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D;
}

function session(overrides: Partial<PaintSession> = {}): PaintSession {
  return {
    identity: { id: "tester", name: "Tester", color: "#000000", kind: "human" },
    pixels: { "1:1": "#FF0000", "2:2": "#0000FF" },
    participants: [],
    onlineCount: 1,
    status: "Live",
    trashToken: 0,
    onCursorChange: vi.fn(),
    onStrokeStart: vi.fn(),
    onPaintPixel: vi.fn(),
    onStrokeEnd: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onClear: vi.fn(),
    onRefresh: vi.fn(),
    canUndo: true,
    canRedo: false,
    ...overrides,
  };
}

async function mountDesktop(overrides: Partial<PaintSession> = {}) {
  const store = createDesktopStore({ viewport: { width: 1280, height: 720 } });
  const view = render(
    <ShellStoreProvider store={store}>
      <PaintDesktop session={session(overrides)} />
    </ShellStoreProvider>,
  );

  await waitFor(() => expect(store.getWindow("paint.tools")).not.toBeNull());
  return { store, view };
}

function titleBarOf(store: DesktopStore, id: string) {
  const window = document.querySelector<HTMLElement>(`[aria-label="${store.getWindow(id)?.title}"]`);
  const bar = window?.querySelector<HTMLElement>('[data-draggable="true"]');
  if (!bar) throw new Error(`No drag handle for ${id}`);
  return bar;
}

/** jsdom applies no stylesheet, so a closed menu is still in the tree. Scope by region. */
function iconWell() {
  return within(screen.getByRole("group", { name: "Desktop icons" }));
}

function menuItem(label: string) {
  const match = screen
    .getAllByRole("button", { name: label })
    .find((button) => button.closest('[role="menu"]') !== null);
  if (!match) throw new Error(`No menu item ${label}`);
  return match;
}

function drag(handle: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId: 1,
    clientX: from[0],
    clientY: from[1],
  });
  for (let step = 1; step <= 4; step += 1) {
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: from[0] + ((to[0] - from[0]) * step) / 4,
      clientY: from[1] + ((to[1] - from[1]) * step) / 4,
    });
  }
  fireEvent.pointerUp(handle, { pointerId: 1 });
}

beforeEach(() => {
  canvasRenders = 0;
  canvasDraws = 0;
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ entries: [] }), { status: 200 })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => recordingContext(),
  );
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the desktop shell around the canvas", () => {
  test("opens Paint on load, as the suggested application", async () => {
    const { store } = await mountDesktop();

    expect(store.getWindow("paint.tools")?.focused).toBe(true);
    expect(store.getWindow("paint.profile")).not.toBeNull();
    expect(document.querySelector(".palette-window")).not.toBeNull();
    expect(screen.getByRole("link", { name: "join via MCP" })).toBeInTheDocument();
  });

  test("paints the canvas once from the snapshot it is given", async () => {
    await mountDesktop();
    expect(canvasDraws).toBeGreaterThan(0);
  });

  /**
   * The hard performance requirement: chrome and canvas are siblings, and only the dragged
   * window subscribes to the window manager, so a drag must not reach the canvas at all.
   */
  test("dragging a window neither re-renders nor repaints the canvas", async () => {
    const { store } = await mountDesktop();
    const before = store.getWindow("paint.tools")!;

    const rendersBeforeDrag = canvasRenders;
    const drawsBeforeDrag = canvasDraws;

    drag(titleBarOf(store, "paint.tools"), [before.x + 40, before.y + 8], [
      before.x + 140,
      before.y + 68,
    ]);

    const after = store.getWindow("paint.tools")!;
    expect(after.x).toBe(before.x + 100);
    expect(after.y).toBe(before.y + 60);

    expect(canvasRenders).toBe(rendersBeforeDrag);
    expect(canvasDraws).toBe(drawsBeforeDrag);
  });

  test("resizing a window also leaves the canvas alone", async () => {
    const { store } = await mountDesktop();
    const before = store.getWindow("paint.tools")!;
    const grip = document
      .querySelector(".palette-window")
      ?.querySelector<HTMLElement>(".mac-window-resize");
    expect(grip).not.toBeNull();

    const renders = canvasRenders;
    const draws = canvasDraws;
    drag(grip!, [before.width, before.height], [before.width + 60, before.height + 40]);

    const after = store.getWindow("paint.tools")!;
    expect(after.width).toBe(before.width + 60);
    expect(after.height).toBe(before.height + 40);
    expect(canvasRenders).toBe(renders);
    expect(canvasDraws).toBe(draws);
  });

  test("a window drag moves only the window it grabbed", async () => {
    const { store } = await mountDesktop();
    const profileBefore = store.getWindow("paint.profile")!;
    const tools = store.getWindow("paint.tools")!;

    drag(titleBarOf(store, "paint.tools"), [tools.x + 10, tools.y + 8], [
      tools.x + 60,
      tools.y + 8,
    ]);

    const profileAfter = store.getWindow("paint.profile")!;
    expect(profileAfter.x).toBe(profileBefore.x);
    expect(profileAfter.y).toBe(profileBefore.y);
  });

  test("closing a window removes it and reopening it from the menu brings it back", async () => {
    const { store } = await mountDesktop();

    fireEvent.click(screen.getByRole("button", { name: "Close Shared Paint" }));
    await waitFor(() => expect(store.getWindow("paint.tools")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Apple" }));
    fireEvent.click(menuItem("Shared Paint"));
    await waitFor(() => expect(store.getWindow("paint.tools")).not.toBeNull());
  });

  test("collapsing rolls the window up and leaves it on the desktop", async () => {
    const { store } = await mountDesktop();

    fireEvent.click(screen.getByRole("button", { name: "Collapse Shared Paint" }));
    await waitFor(() => expect(store.getWindow("paint.tools")?.collapsed).toBe(true));
    expect(document.querySelector(".palette-window")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
  });

  test("Clear asks with a Macintosh alert instead of a browser dialog", async () => {
    const onClear = vi.fn();
    await mountDesktop({ onClear });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    const alert = await screen.findByRole("alertdialog", { name: "Clear the canvas" });
    expect(alert).toHaveTextContent(/Trash/);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    const reopened = await screen.findByRole("alertdialog", {
      name: "Clear the canvas",
    });
    fireEvent.click(
      [...reopened.querySelectorAll("button")].find(
        (button) => button.textContent === "Clear",
      )!,
    );
    expect(onClear).toHaveBeenCalledOnce();
  });

  test("an alert takes focus, traps Tab and answers Escape", async () => {
    const onClear = vi.fn();
    await mountDesktop({ onClear });

    const opener = screen.getByRole("button", { name: "Clear" });
    opener.focus();
    fireEvent.click(opener);

    const alert = await screen.findByRole("alertdialog", { name: "Clear the canvas" });
    const buttons = [...alert.querySelectorAll("button")];
    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(onClear).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  test("puts a desktop icon on the screen for every application in the registry", async () => {
    await mountDesktop();

    const icons = iconWell();
    expect(icons.getByRole("button", { name: "Shared Paint" })).toBeInTheDocument();
    expect(icons.getByRole("button", { name: "The Asylum" })).toBeInTheDocument();
    expect(icons.getByRole("button", { name: "Trash" })).toBeInTheDocument();
  });

  test("opens each live application's own window from its icon", async () => {
    const { store } = await mountDesktop();

    expect(store.getWindow("asylum.ward")).toBeNull();

    fireEvent.dblClick(iconWell().getByRole("button", { name: "The Asylum" }));
    await waitFor(() => expect(store.getWindow("asylum.ward")).not.toBeNull());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.dblClick(iconWell().getByRole("button", { name: "Shared Paint" }));
    await waitFor(() =>
      expect(store.getWindow("paint.tools")?.focused).toBe(true),
    );
  });

  test("stops watching the ward from the Ward menu", async () => {
    const { store } = await mountDesktop();

    fireEvent.click(menuItem("Watch the Ward"));
    await waitFor(() => expect(store.getWindow("asylum.ward")).not.toBeNull());

    fireEvent.click(menuItem("Stop Watching"));
    await waitFor(() => expect(store.getWindow("asylum.ward")).toBeNull());
  });
});
