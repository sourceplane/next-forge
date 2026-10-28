import { describe, expect, it } from "vitest";

// The sitemap lists the site's pages and every blog post and legal page on
// the site's own origin (NEXT_PUBLIC_WEB_URL, set per environment by the
// build), with no filesystem read: a Worker has no `app` folder to list.
delete process.env.BASEHUB_TOKEN;

describe("the sitemap", () => {
  it("lists the pages, the posts and the legal pages on the site's origin", async () => {
    const { default: sitemap } = await import("@/app/[locale]/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual([
      "https://www.example.com/",
      "https://www.example.com/blog",
      "https://www.example.com/contact",
      "https://www.example.com/pricing",
      "https://www.example.com/blog/welcome",
      "https://www.example.com/blog/on-cloudflare",
      "https://www.example.com/legal/privacy",
      "https://www.example.com/legal/terms",
    ]);
  });
});
