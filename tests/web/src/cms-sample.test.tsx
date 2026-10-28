import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

// With no BaseHub repository (BASEHUB_TOKEN unset) the blog, the latest-post
// banner, the footer's legal links and the legal pages render sample entries
// shaped like BaseHub's answers, under a notice — upstream rendered an empty
// blog and an empty footer. No network.
delete process.env.BASEHUB_TOKEN;

describe("@repo/cms, unconnected", () => {
  it("lists the sample posts, newest first, and finds one by slug", async () => {
    const { blog, isSampleContent } = await import("@repo/cms");
    expect(isSampleContent).toBe(true);
    const posts = await blog.getPosts();
    expect(posts.map((post) => post._slug)).toEqual(["welcome", "on-cloudflare"]);
    expect((await blog.getLatestPost())?._slug).toBe("welcome");
    const post = await blog.getPost("on-cloudflare");
    expect(post?._title).toBe("Three Workers, one product");
    expect(post?.body.json.content.length).toBeGreaterThan(0);
    expect(post?.body.readingTime).toBeGreaterThanOrEqual(1);
    expect(await blog.getPost("no-such-post")).toBeNull();
  });

  it("answers the legal queries the footer and the legal pages make", async () => {
    const { legal } = await import("@repo/cms");
    expect((await legal.getPostsMeta()).map((page) => page._slug)).toEqual(["privacy", "terms"]);
    expect((await legal.getPost("terms"))?._title).toBe("Terms of Service");
  });

  it("feeds a page's render function the sample, under a notice", async () => {
    const { blog } = await import("@repo/cms");
    const { Feed } = await import("@repo/cms/components/feed");
    const element = await (Feed as unknown as (props: object) => Promise<React.ReactElement>)({
      queries: [blog.postQuery("welcome")],
      children: async ([data]: [{ blog: { posts: { item: { _title: string } } } }]) => (
        <h1>{data.blog.posts.item._title}</h1>
      ),
    });
    const sample = await (element.type as (props: object) => Promise<React.ReactElement>)(
      element.props as object
    );
    const html = renderToString(sample);
    expect(html).toContain('data-cms="sample"');
    expect(html).toContain("BASEHUB_TOKEN");
    expect(html).toContain("<h1>Welcome to your blog</h1>");
  });

  it("renders the sample's images as they are, not through BaseHub's CDN", async () => {
    const { samplePosts } = await import("@repo/cms/sample");
    for (const post of samplePosts) {
      expect(post.image.url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    }
  });
});
