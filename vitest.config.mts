import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "server-only": "next/dist/compiled/server-only/empty.js",
  "@": fileURLToPath(new URL(".", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "lib",
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "mac",
          environment: "jsdom",
          include: ["components/**/*.test.{ts,tsx}"],
          setupFiles: ["./components/mac/test-setup.ts"],
        },
      },
    ],
  },
});
