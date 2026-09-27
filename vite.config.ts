import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Relative base so the built game works from any folder or a GitHub Pages URL.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // Whole seasons are simulated in some tests; give them room when the suite runs in parallel.
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
});
