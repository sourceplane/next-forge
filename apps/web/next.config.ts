import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { withCMS } from "@repo/cms/next-config";
import { config, withAnalyzer } from "@repo/next-config";
import { workspacePackages } from "@repo/next-config/transpile";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { env } from "@/env";

// Upstream wraps the config in the Vercel Toolbar, BetterStack and (on
// Vercel) Sentry; none of the three runs on Workers (@repo/observability).
let nextConfig: NextConfig = {
  ...config,
  // Dev server only (`next build` ignores it): orun.work's live Preview tab
  // loads `next dev` from the preview's own host, and Next.js refuses the
  // hot reload and other /_next/* dev requests from an origin it is not told
  // about. These are the preview's hosts, prod's and stage's.
  allowedDevOrigins: ["*.orun-preview.app", "preview-gateway-stage.oruncloud.workers.dev"],
  experimental: {
    // Dev server only: behind orun.work's live Preview the browser's Origin
    // is the preview's host while `next dev` sees a local Host, and Next.js
    // refuses a Server Action from an origin it is not told about. `next
    // build` runs with NODE_ENV=production, so production keeps its
    // same-origin check.
    ...(process.env.NODE_ENV === "development"
      ? { serverActions: { allowedOrigins: ["*.orun-preview.app", "preview-gateway-stage.oruncloud.workers.dev"] } }
      : {}),
  },
  images: {
    ...config.images,
    remotePatterns: [...(config.images?.remotePatterns ?? [])],
  },
  // Required by @opennextjs/cloudflare, which bundles `.next/standalone/**`
  // into the Worker. Traced from the monorepo root so the workspace packages
  // resolve from the root node_modules.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: workspacePackages(__dirname),
};

nextConfig.images?.remotePatterns?.push({
  protocol: "https",
  hostname: "assets.basehub.com",
});

if (process.env.NODE_ENV === "production") {
  const redirects: NextConfig["redirects"] = async () => [
    {
      source: "/legal",
      destination: "/legal/privacy",
      statusCode: 301,
    },
  ];

  nextConfig.redirects = redirects;
}

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

// `next dev` reaches the Worker's bindings (RATE_LIMIT) through wrangler's
// platform proxy, from apps/web/wrangler.jsonc.
// Only under `next dev`: the proxy would open its session at `next build`
// too (Workers AI has no local mode, so a remote one, which needs a
// Cloudflare login), and the build reads no binding.
export default (phase: string): NextConfig => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    initOpenNextCloudflareForDev();
  }
  return withCMS(nextConfig);
};
