import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

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

test("synchronizes another visitor's pixels and cursor", async ({
  browser,
  request,
}) => {
  await clearSharedCanvas(request);
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();

  await Promise.all([first.goto("/"), second.goto("/")]);
  await Promise.all([
    expect(first.locator(".sync-status")).toHaveText("Live"),
    expect(second.locator(".sync-status")).toHaveText("Live"),
  ]);

  await first.getByRole("button", { name: "Blue", exact: true }).click();
  await first.mouse.click(1180, 650);

  await expect
    .poll(() =>
      second.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext("2d")!;
        return Array.from(context.getImageData(92, 57, 1, 1).data);
      }),
    )
    .toEqual([0, 0, 255, 255]);

  await first.mouse.move(1050, 610);
  await expect(second.locator(".remote-cursor").first()).toBeVisible();
  await second.screenshot({
    path: "test-results/canvas-multiplayer.png",
    fullPage: true,
  });

  await Promise.all([firstContext.close(), secondContext.close()]);
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
