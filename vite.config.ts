import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Relative base so the built game works from any folder or a GitHub Pages URL.
// The version shown on the main screen: the package version and the commit it was built from.
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
let commit = "dev";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  // Not a git checkout: the package version alone.
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(`v${pkg.version} (${commit})`) },
  // Whole seasons are simulated in some tests; give them room when the suite runs in parallel.
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
});
