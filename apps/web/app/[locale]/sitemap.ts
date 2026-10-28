import fs from "node:fs";
import { blog, legal } from "@repo/cms";
import type { MetadataRoute } from "next";
import { env } from "@/env";

const appFolders = fs.readdirSync("app", { withFileTypes: true });
const pages = appFolders
  .filter((file) => file.isDirectory())
  .filter((folder) => !folder.name.startsWith("_"))
  .filter((folder) => !folder.name.startsWith("("))
  .map((folder) => folder.name);
const blogs = (await blog.getPosts()).map((post) => post._slug);
const legals = (await legal.getPosts()).map((post) => post._slug);
// The site's own origin, set per environment by the build (upstream read
// Vercel's VERCEL_PROJECT_PRODUCTION_URL).
const url = new URL(env.NEXT_PUBLIC_WEB_URL);

const sitemap = async (): Promise<MetadataRoute.Sitemap> => [
  {
    url: new URL("/", url).href,
    lastModified: new Date(),
  },
  ...pages.map((page) => ({
    url: new URL(page, url).href,
    lastModified: new Date(),
  })),
  ...blogs.map((blog) => ({
    url: new URL(`blog/${blog}`, url).href,
    lastModified: new Date(),
  })),
  ...legals.map((legal) => ({
    url: new URL(`legal/${legal}`, url).href,
    lastModified: new Date(),
  })),
];

export default sitemap;
