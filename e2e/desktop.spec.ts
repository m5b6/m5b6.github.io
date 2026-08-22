import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { assertDisposableRoom } from "../lib/canvas-room";

/** These specs clear the canvas and empty the Trash. Never let them reach production art. */
assertDisposableRoom();

const desktopViewport = { width: 1280, height: 720 };

/** D2: nothing the desktop draws may sit on top of the points the canvas suite paints. */
const PAINT_POINTS = [
  [980, 180],
  [1120, 300],
  [1050, 610],
  [1180, 650],
  [1000, 600],
] as const;

/** The rollback path renders no desktop at all, so its tests do not apply there. */
const SHELL_OFF = process.env.SHELL_ENABLED === "0";

const actor = { id: "playwright-desktop", name: "Playwright" };
const participant = { ...actor, color: "#000000", kind: "agent" };

async function resetCanvas(request: APIRequestContext) {
  const cleared = await request.post("/api/canvas", {
    data: { action: "clear", participant },
  });
  expect(cleared.ok()).toBeTruthy();
  const emptied = await request.post("/api/canvas/trash", {
    data: { action: "empty", participant: actor },
  });
  expect(emptied.ok()).toBeTruthy();
}

async function paintedPixels(request: APIRequestContext) {
  const snapshot = await request.get("/api/canvas");
  return Object.keys(
    ((await snapshot.json()) as { pixels: Record<string, string> }).pixels,
  ).length;
}

/** A drag posts in batches, so a count that merely passed a threshold may still be climbing. */
async function settledPixels(request: APIRequestContext) {
  let previous = -1;
  let current = await paintedPixels(request);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (current > 0 && current === previous) return current;
    await new Promise((resolve) => setTimeout(resolve, 150));
    previous = current;
    current = await paintedPixels(request);
  }

  return current;
}

async function trashEntries(request: APIRequestContext) {
  const snapshot = await request.get("/api/canvas/trash");
  expect(snapshot.ok()).toBeTruthy();
  return (
    (await snapshot.json()) as {
      entries: { revision: number; pixelCount: number; discardedAt: string }[];
    }
  ).entries;
}

function readDraws(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __canvasDraws: { draws: number } }).__canvasDraws.draws,
  );
}

/** Wait until the first snapshot has finished painting, so the drag is measured alone. */
async function settledDraws(page: Page) {
  let last = -1;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const draws = await readDraws(page);
    if (draws === last) return draws;
    last = draws;
    await page.waitForTimeout(150);
  }
  return last;
}

async function openDesktop(page: Page) {
  await page.goto("/");
  await expect(page.locator(".sync-status")).toHaveText("Live");
  await expect(page.locator(".palette-window")).toBeVisible();
}

test.describe("the desktop shell", () => {
  test.skip(SHELL_OFF, "SHELL_ENABLED=0 renders the pre-desktop page instead");

  test("keeps every canvas point paintable under the desktop chrome", async ({
    page,
  }) => {
    await openDesktop(page);

    await expect(page.locator(".mac-menu-bar")).toBeVisible();
    const well = await page.locator(".mac-desktop-icons").boundingBox();
    expect(well).not.toBeNull();
    expect(well!.y).toBeGreaterThanOrEqual(30);
    expect(well!.y + well!.height).toBeLessThanOrEqual(290);
    expect(well!.x + well!.width).toBeLessThanOrEqual(desktopViewport.width);

    for (const [x, y] of PAINT_POINTS) {
      const tag = await page.evaluate(
        ([pointX, pointY]) => document.elementFromPoint(pointX, pointY)?.tagName ?? "",
        [x, y],
      );
      expect(tag, `element at (${x}, ${y})`).toBe("CANVAS");
    }
  });

  test("renders the menu bar and desktop icons from the application registry", async ({
    page,
  }) => {
    await openDesktop(page);

    const icons = page.getByRole("group", { name: "Desktop icons" });
    await expect(icons.getByRole("button", { name: "Shared Paint" })).toBeVisible();
    await expect(icons.getByRole("button", { name: "The Asylum" })).toBeVisible();
    await expect(icons.getByRole("button", { name: "Trash" })).toBeVisible();

    const paintMenu = page.locator(".mac-menu-title", { hasText: "Paint" });
    await paintMenu.click();
    await expect(page.getByRole("button", { name: "Clear Canvas…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rainbow Mode" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Clear Canvas…" })).toBeHidden();
  });

  test("walks the menu bar with the keyboard", async ({ page }) => {
    await openDesktop(page);

    const file = page.locator(".mac-menu-title", { hasText: "File" });
    await file.focus();
    await page.keyboard.press("ArrowDown");
    await expect(file).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("ArrowRight");
    await expect(file).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".mac-menu-title", { hasText: "Paint" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await page.keyboard.press("Escape");
    await expect(page.locator('[aria-expanded="true"]')).toHaveCount(0);
  });

  /**
   * The performance requirement, measured in the browser: a window drag must not put a
   * single mark on the canvas.
   */
  test("dragging a window never repaints the canvas", async ({ page }) => {
    await page.addInitScript(() => {
      const counters = { draws: 0 };
      (window as unknown as { __canvasDraws: typeof counters }).__canvasDraws = counters;

      for (const method of ["fillRect", "clearRect", "drawImage", "putImageData"] as const) {
        const original = CanvasRenderingContext2D.prototype[method];
        Object.defineProperty(CanvasRenderingContext2D.prototype, method, {
          configurable: true,
          writable: true,
          value: function patched(this: CanvasRenderingContext2D, ...args: unknown[]) {
            counters.draws += 1;
            return (original as (...rest: unknown[]) => unknown).apply(this, args);
          },
        });
      }
    });

    await openDesktop(page);

    const titleBar = page.locator('.palette-window [data-draggable="true"]');
    const before = await page.locator(".palette-window").boundingBox();
    expect(before).not.toBeNull();

    const drawsBefore = await settledDraws(page);

    const grip = await titleBar.boundingBox();
    await page.mouse.move(grip!.x + 120, grip!.y + 10);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(grip!.x + 120 + step * 12, grip!.y + 10 + step * 8);
    }
    await page.mouse.up();

    const after = await page.locator(".palette-window").boundingBox();
    expect(Math.round(after!.x - before!.x)).toBe(120);
    expect(Math.round(after!.y - before!.y)).toBe(80);

    expect(await readDraws(page)).toBe(drawsBefore);
  });

  test("clears into the Trash, puts the painting back, and only then destroys it", async ({
    page,
    request,
  }) => {
    await resetCanvas(request);
    await openDesktop(page);
    expect(await trashEntries(request)).toEqual([]);

    await page.getByRole("button", { name: "Red", exact: true }).click();
    await page.mouse.move(980, 180);
    await page.mouse.down();
    await page.mouse.move(1120, 300, { steps: 12 });
    await page.mouse.up();
    const painted = await settledPixels(request);
    expect(painted).toBeGreaterThan(5);

    await page.getByRole("button", { name: "Clear" }).click();
    const alert = page.getByRole("alertdialog", { name: "Clear the canvas" });
    await expect(alert).toContainText("Trash");
    await alert.getByRole("button", { name: "Clear", exact: true }).click();

    await expect.poll(() => paintedPixels(request)).toBe(0);
    await expect.poll(async () => (await trashEntries(request)).length).toBe(1);
    expect((await trashEntries(request))[0].pixelCount).toBe(painted);

    await page
      .getByRole("group", { name: "Desktop icons" })
      .getByRole("button", { name: "Trash" })
      .dblclick();
    const trashWindow = page.locator('[aria-label="Trash"]');
    await expect(trashWindow).toBeVisible();
    await expect(trashWindow).toContainText(`${painted.toLocaleString("en-US")} px`);

    await trashWindow.getByRole("button", { name: "Put Back" }).click();
    await expect.poll(() => paintedPixels(request)).toBe(painted);
    await expect.poll(async () => (await trashEntries(request)).length).toBe(0);

    await page.getByRole("button", { name: "Clear" }).click();
    await page
      .getByRole("alertdialog", { name: "Clear the canvas" })
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect.poll(async () => (await trashEntries(request)).length).toBe(1);

    await page.locator(".mac-menu-title", { hasText: "Special" }).click();
    await page.getByRole("menu").getByRole("button", { name: "Empty Trash…" }).click();
    const stop = page.getByRole("alertdialog", { name: "Empty the Trash" });
    await expect(stop).toContainText("cannot be undone");
    await stop.getByRole("button", { name: "Empty Trash", exact: true }).click();

    await expect.poll(async () => (await trashEntries(request)).length).toBe(0);
    expect(await paintedPixels(request)).toBe(0);
  });
});

test("renders no desktop at all when the shell is switched off", async ({ page }) => {
  test.skip(!SHELL_OFF, "This asserts the rollback path, which only exists at SHELL_ENABLED=0");

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize(desktopViewport);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  for (const selector of [
    ".mac-menu-bar",
    ".mac-desktop",
    "[data-shell-clock]",
    "[data-managed-window]",
  ]) {
    await expect(page.locator(selector), selector).toHaveCount(0);
  }

  await expect(page.locator("canvas.painting-canvas")).toHaveCount(1);
  expect(errors).toEqual([]);

  for (const [x, y] of PAINT_POINTS) {
    const tag = await page.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.tagName ?? "NONE",
      [x, y],
    );

    expect(tag, `${x},${y} must reach the canvas in rollback mode`).toBe("CANVAS");
  }
});

test("keeps the pre-desktop clear contract working for agents", async ({ request }) => {
  await resetCanvas(request);

  const painted = await request.post("/api/canvas", {
    data: {
      action: "paint",
      participant,
      cursor: null,
      status: null,
      pixels: [{ x: 5, y: 5, color: "#FF0000" }],
    },
  });
  expect(painted.ok()).toBeTruthy();

  const cleared = await request.post("/api/canvas", {
    data: { action: "clear", participant },
  });
  expect(cleared.ok()).toBeTruthy();
  const body = (await cleared.json()) as { ok: boolean; revision: number };
  expect(body.ok).toBe(true);
  expect(typeof body.revision).toBe("number");

  expect(await paintedPixels(request)).toBe(0);
  const entries = await trashEntries(request);
  expect(entries).toHaveLength(1);
  expect(entries[0].pixelCount).toBe(1);
  expect(entries[0].revision).toBe(body.revision);

  await resetCanvas(request);
});

test("rejects a malformed trash operation", async ({ request }) => {
  const response = await request.post("/api/canvas/trash", {
    data: { action: "incinerate", participant: actor },
  });
  expect(response.status()).toBe(400);
});
