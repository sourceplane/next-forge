// Vercel's next-forge lints with Biome (ultracite); a baseline lints with
// ESLint 9.
// eslint-config-next 16's flat configs, as `create-next-app` generates them.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // worker.ts imports the generated `.open-next/worker.js` the way the
      // OpenNext custom-worker guide does: `@ts-ignore` with a reason,
      // because the file does not exist before the build and an
      // `@ts-expect-error` would be "unused" after it.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
  ]),
]);
