import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Relative base so the built game works from any folder or a GitHub Pages URL.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"] },
});
