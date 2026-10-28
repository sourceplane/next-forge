// Vercel's next-forge lints with Biome (ultracite); a baseline lints with
// ESLint 9.
// eslint-config-next 16's flat configs, as `create-next-app` generates them.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
  ]),
]);
