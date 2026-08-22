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
  webServer: hostedBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000/api/canvas",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
