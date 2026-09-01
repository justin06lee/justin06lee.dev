import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // react() lets component tests (jsdom, via a per-file @vitest-environment
  // docblock) import and render TSX. Plain node tests are unaffected.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws unless it's resolved under React's react-server
      // condition, which vitest doesn't set. Stubbing it lets server modules
      // (e.g. lib/project-images) be unit tested; the guard still does its job
      // in the real build, where this alias doesn't apply.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  // Don't run the app's PostCSS (Tailwind v4) on CSS that component tests pull in
  // transitively (e.g. katex.min.css via the markdown renderer); we don't assert
  // on styles, only on the DOM.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    css: false,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
