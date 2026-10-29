import { defineConfig } from "vitest/config";

// Unit tests (for now the end-to-end encryption core). Kept apart from
// vite.config.ts so tests don't load the app's plugins (PWA, React).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
