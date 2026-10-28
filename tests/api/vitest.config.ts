import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "../../apps/api/$1") },
      // Next's guard against client imports; a no-op module under test.
      { find: "server-only", replacement: path.resolve(__dirname, "src/stubs/server-only.ts") },
      // The adapter's generated worker exists only after a build; worker.ts's
      // suite gives it a stand-in.
      { find: /^\.\/\.open-next\/worker\.js$/, replacement: path.resolve(__dirname, "src/stubs/open-next-worker.ts") },
    ],
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // What the apps' env.ts requires (the origins the build inlines).
    env: {
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NEXT_PUBLIC_WEB_URL: "https://www.example.com",
      NEXT_PUBLIC_API_URL: "https://api.example.com",
    },
  },
});
