import { defineConfig, devices } from "@playwright/test";

const hostedBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Every spec paints the one shared canvas in the one database. Files running in
  // parallel would clear each other's strokes, so the suite is deliberately serial.
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: hostedBaseUrl ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  /**
   * A production build, not `next dev`. Dev-mode compilation grew with the desktop and the
   * ward, and racing it made timing assertions fail for reasons a visitor never sees.
   * Set PLAYWRIGHT_DEV=1 to drive the dev server while iterating.
   */
  webServer: hostedBaseUrl
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_DEV
          ? "npm run dev -- --hostname 127.0.0.1"
          : "npm run build && npm run start -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000/api/canvas",
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
