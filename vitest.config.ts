import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  // Même runtime JSX que Next.js : les composants serveur testés n'importent
  // pas React explicitement.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
