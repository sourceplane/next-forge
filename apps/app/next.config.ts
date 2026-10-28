import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { config, withAnalyzer } from "@repo/next-config";
import { workspacePackages } from "@repo/next-config/transpile";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { env } from "@/env";

// Upstream wraps the config in the Vercel Toolbar, BetterStack and (on
// Vercel) Sentry; none of the three runs on Workers (@repo/observability).
let nextConfig: NextConfig = {
  ...config,
  // Required by @opennextjs/cloudflare, which bundles `.next/standalone/**`
  // into the Worker. Traced from the monorepo root so the workspace packages
  // resolve from the root node_modules.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: workspacePackages(__dirname),
};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

// `next dev` reaches the Worker's bindings (HYPERDRIVE, STORAGE, AI) through
// wrangler's platform proxy, from apps/app/wrangler.jsonc.
// Only under `next dev`: the proxy would open its session at `next build`
// too (Workers AI has no local mode, so a remote one, which needs a
// Cloudflare login), and the build reads no binding.
export default (phase: string): NextConfig => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    initOpenNextCloudflareForDev();
  }
  return nextConfig;
};
