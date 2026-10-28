import type { MetadataRoute } from "next";
import { env } from "@/env";

// The site's own origin, set per environment by the build (upstream read
// Vercel's VERCEL_PROJECT_PRODUCTION_URL).
const url = new URL(env.NEXT_PUBLIC_WEB_URL);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", url.href).href,
  };
}
