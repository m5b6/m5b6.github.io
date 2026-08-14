import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  pointFromViewport,
} from "../lib/canvas";

const desktopViewport = { width: 1280, height: 720 };
const multiplayerTarget = pointFromViewport(
  1180,
  650,
  desktopViewport.width,
  desktopViewport.height,
);

const testParticipant = {
  id: "playwright-cleanup",
  name: "Playwright",
  color: "#000000",
  kind: "agent",
};

async function clearSharedCanvas(request: APIRequestContext) {
  const response = await request.post("/api/canvas", {
    data: { action: "clear", participant: testParticipant },
  });
  expect(response.ok()).toBeTruthy();
}

async function paintedPixelCount(page: Page) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) painted += 1;
    }
    return painted;
  });
}

test("paints, undoes, redoes, and clears a shared stroke", async ({
  page,
  request,
}) => {
  await clearSharedCanvas(request);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Matias Berrios" })).toBeVisible();
  await expect(page.locator(".sync-status")).toHaveText("Live");

  await page.getByRole("button", { name: "Red", exact: true }).click();
  await page.mouse.move(980, 180);
  await page.mouse.down();
  await page.mouse.move(1120, 300, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => paintedPixelCount(page)).toBeGreaterThan(5);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => paintedPixelCount(page)).toBe(0);

  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => paintedPixelCount(page)).toBeGreaterThan(5);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear" }).click();
  await expect.poll(() => paintedPixelCount(page)).toBe(0);
  await expect
    .poll(async () => {
      const snapshot = await request.get("/api/canvas");
      return Object.keys(
        ((await snapshot.json()) as { pixels: Record<string, string> }).pixels,
      ).length;
    })
    .toBe(0);
});

test("renders a stroke before its network save completes", async ({
  page,
  request,
}) => {
  await clearSharedCanvas(request);
  await page.goto("/");
  await expect(page.locator(".sync-status")).toHaveText("Live");

  let releasePaint = () => {};
  const paintGate = new Promise<void>((resolve) => {
    releasePaint = resolve;
  });
  await page.route("**/api/canvas", async (route) => {
    const requestBody = route.request();
    if (
      requestBody.method() === "POST" &&
      (requestBody.postDataJSON() as { action?: string } | null)?.action === "paint"
    ) {
      await paintGate;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Red", exact: true }).click();
  const startedAt = Date.now();
  await page.mouse.click(1180, 650);
  await expect
    .poll(() => paintedPixelCount(page), {
      intervals: [10, 20, 40],
      timeout: 300,
    })
    .toBeGreaterThan(0);
  expect(Date.now() - startedAt).toBeLessThan(300);

  releasePaint();
  await expect
    .poll(async () => {
      const snapshot = await request.get("/api/canvas");
      return Object.keys(
        ((await snapshot.json()) as { pixels: Record<string, string> }).pixels,
      ).length;
    })
    .toBeGreaterThan(0);
  await clearSharedCanvas(request);
});

test("fills a continuous stroke between sparse held-pointer samples", async ({
  page,
  request,
}) => {
  await clearSharedCanvas(request);
  await page.goto("/");
  await expect(page.locator(".sync-status")).toHaveText("Live");

  await page.getByRole("button", { name: "Gold", exact: true }).click();
  await page.mouse.move(980, 180);
  await page.mouse.down();
  await page.mouse.move(1120, 300);
  await page.mouse.up();

  await expect.poll(() => paintedPixelCount(page)).toBeGreaterThan(8);
  await clearSharedCanvas(request);
});

test("synchronizes another visitor's pixels and cursor", async ({
  browser,
  request,
}) => {
  await clearSharedCanvas(request);
  const firstContext = await browser.newContext({ viewport: desktopViewport });
  const secondContext = await browser.newContext({ viewport: desktopViewport });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  let secondSnapshotReads = 0;
  await second.route("**/api/canvas", async (route) => {
    if (route.request().method() === "GET") secondSnapshotReads += 1;
    await route.continue();
  });

  await Promise.all([first.goto("/"), second.goto("/")]);
  await Promise.all([
    expect(first.locator(".sync-status")).toHaveText("Live"),
    expect(second.locator(".sync-status")).toHaveText("Live"),
  ]);
  const readsBeforePaint = secondSnapshotReads;

  await first.getByRole("button", { name: "Blue", exact: true }).click();
  const startedAt = Date.now();
  await first.mouse.click(1180, 650);

  await expect
    .poll(() =>
      second.locator("canvas").evaluate(
        (canvas: HTMLCanvasElement, target: { x: number; y: number }) => {
          const context = canvas.getContext("2d")!;
          return Array.from(context.getImageData(target.x, target.y, 1, 1).data);
        },
        multiplayerTarget,
      ),
      { intervals: [25, 50, 100], timeout: 1_500 },
    )
    .toEqual([0, 0, 255, 255]);
  expect(Date.now() - startedAt).toBeLessThan(1_500);
  expect(secondSnapshotReads).toBe(readsBeforePaint);

  await first.mouse.move(1050, 610);
  await expect(second.locator(".remote-cursor").first()).toBeVisible();
  await second.screenshot({
    path: "test-results/canvas-multiplayer.png",
    fullPage: true,
  });

  await Promise.all([firstContext.close(), secondContext.close()]);
  await clearSharedCanvas(request);
});

test("offers a huge canvas, brushes, colors, and playful paint modes", async ({
  page,
  request,
}) => {
  await clearSharedCanvas(request);
  await page.goto("/");
  await expect(page.locator(".sync-status")).toHaveText("Live");
  await expect(page.locator("canvas")).toHaveJSProperty("width", CANVAS_WIDTH);
  await expect(page.locator("canvas")).toHaveJSProperty("height", CANVAS_HEIGHT);

  await page.getByRole("button", { name: "Big marker" }).click();
  await page.getByRole("button", { name: "Hot pink" }).click();
  await page.mouse.click(1180, 650);
  await expect.poll(() => paintedPixelCount(page)).toBeGreaterThan(15);

  await page.getByRole("button", { name: "Pixel brush" }).click();
  await page.getByRole("button", { name: "Purple" }).click();
  await page.getByRole("button", { name: /mirror/i }).click();
  await page.mouse.click(1050, 610);
  const mirroredTarget = pointFromViewport(
    1050,
    610,
    desktopViewport.width,
    desktopViewport.height,
  );
  await expect
    .poll(() =>
      page.locator("canvas").evaluate(
        (
          canvas: HTMLCanvasElement,
          {
            target,
            canvasWidth,
          }: { target: { x: number; y: number }; canvasWidth: number },
        ) => {
          const context = canvas.getContext("2d")!;
          return [target.x, canvasWidth - 1 - target.x].map((x) =>
            Array.from(context.getImageData(x, target.y, 1, 1).data),
          );
        },
        { target: mirroredTarget, canvasWidth: CANVAS_WIDTH },
      ),
    )
    .toEqual([
      [138, 43, 226, 255],
      [138, 43, 226, 255],
    ]);

  await page.getByRole("button", { name: /rainbow/i }).click();
  await page.mouse.click(1000, 600);
  const rainbowTarget = pointFromViewport(
    1000,
    600,
    desktopViewport.width,
    desktopViewport.height,
  );
  const rainbowPair = await page.locator("canvas").evaluate(
    (
      canvas: HTMLCanvasElement,
      {
        target,
        canvasWidth,
      }: { target: { x: number; y: number }; canvasWidth: number },
    ) => {
      const context = canvas.getContext("2d")!;
      return [target.x, canvasWidth - 1 - target.x].map((x) =>
        Array.from(context.getImageData(x, target.y, 1, 1).data).join(","),
      );
    },
    { target: rainbowTarget, canvasWidth: CANVAS_WIDTH },
  );
  expect(rainbowPair[0]).not.toBe(rainbowPair[1]);

  await clearSharedCanvas(request);
});

test("keeps controls usable on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  const palette = page.locator(".palette-window");
  await expect(palette).toBeVisible();
  await expect(page.getByRole("link", { name: "join via MCP" })).toBeVisible();
  await page.screenshot({ path: "test-results/canvas-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(palette).toBeVisible();
  await expect(page.getByRole("button", { name: "Eraser" })).toBeVisible();
  await page.screenshot({ path: "test-results/canvas-mobile.png", fullPage: true });
});

test("publishes agent discovery files", async ({ request }) => {
  const instructions = await request.get("/llms.txt");
  expect(instructions.ok()).toBeTruthy();
  expect(await instructions.text()).toContain("MCP endpoint");

  const configuration = await request.get("/mcp.json");
  expect(configuration.ok()).toBeTruthy();
  expect(await configuration.json()).toEqual({
    mcpServers: {
      "matiasberrios-canvas": {
        url: "https://matiasberrios.com/api/mcp",
      },
    },
  });
});

test("lets an MCP agent paint the shared canvas", async ({ request }) => {
  await clearSharedCanvas(request);
  const response = await request.post("/api/mcp", {
    headers: { Accept: "application/json, text/event-stream" },
    data: {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "draw_pixels",
        arguments: {
          agentName: "Playwright MCP",
          pixels: [{ x: 7, y: 11, color: "#FFD700" }],
        },
      },
    },
  });

  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toContain("Painted 1 shared pixels");

  await expect
    .poll(async () => {
      const snapshot = await request.get("/api/canvas");
      return ((await snapshot.json()) as { pixels: Record<string, string> }).pixels[
        "7:11"
      ];
    })
    .toBe("#FFD700");

  await clearSharedCanvas(request);
});
