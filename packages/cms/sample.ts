// What the blog and the legal pages show before a BaseHub repository is
// connected (BASEHUB_TOKEN unset): two posts and two legal pages, shaped
// exactly like the fragments index.ts queries for, so every page renders as
// it will with real content. Upstream rendered an empty blog and an empty
// footer instead; a product built from this baseline goes live first and
// connects its CMS later (`cms-sanity` does the same with Sanity).
//
// The images are inline SVG gradients: nothing to host, nothing to fetch.

const gradient = (from: string, to: string) =>
  `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`
  )}`;

const image = (from: string, to: string, alt: string) => ({
  url: gradient(from, to),
  width: 1200,
  height: 630,
  alt,
  blurDataURL: "",
});

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string) => ({
  type: "paragraph",
  content: [text(value)],
});
const heading = (value: string, id: string) => ({
  type: "heading",
  attrs: { level: 2, id },
  content: [text(value)],
});
const tocOf = (headings: { id: string; title: string }[]) => [
  {
    type: "orderedList",
    attrs: { start: 1 },
    content: headings.map(({ id, title }) => ({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: title,
              marks: [{ type: "link", attrs: { href: `#${id}`, target: "_self" } }],
            },
          ],
        },
      ],
    })),
  },
];

interface Section {
  id: string;
  title: string;
  paragraphs: string[];
}

const bodyOf = (sections: Section[]) => {
  const content = sections.flatMap(({ id, title, paragraphs }) => [
    heading(title, id),
    ...paragraphs.map(paragraph),
  ]);
  const plainText = sections
    .flatMap(({ title, paragraphs }) => [title, ...paragraphs])
    .join("\n");
  return {
    plainText,
    json: { content, toc: tocOf(sections) },
    readingTime: Math.max(1, Math.round(plainText.split(/\s+/).length / 200)),
  };
};

const author = {
  _title: "The team",
  avatar: image("#0f172a", "#334155", "The team"),
  xUrl: null,
};

export const samplePosts = [
  {
    _slug: "welcome",
    _title: "Welcome to your blog",
    authors: [author],
    categories: [{ _title: "Product" }],
    date: "2026-10-28",
    description:
      "A sample post: the blog shows these until a BaseHub repository is connected.",
    image: image("#6366f1", "#ec4899", "An indigo-to-pink gradient"),
    body: bodyOf([
      {
        id: "sample-content",
        title: "Sample content",
        paragraphs: [
          "This post is a placeholder. The blog, its posts and the legal pages are read from BaseHub, and until this product has a BaseHub repository they render this sample instead, so every page works from the first deploy.",
        ],
      },
      {
        id: "connect-basehub",
        title: "Connecting BaseHub",
        paragraphs: [
          "Create a repository from the BaseHub template of Vercel's next-forge, make a read token, and store it as this product's BASEHUB_TOKEN secret. The next deploy reads your posts and pages instead of these.",
        ],
      },
    ]),
  },
  {
    _slug: "on-cloudflare",
    _title: "Three Workers, one product",
    authors: [author],
    categories: [{ _title: "Engineering" }],
    date: "2026-10-21",
    description:
      "A sample post: how the app, the marketing site and the API are deployed.",
    image: image("#0ea5e9", "#22c55e", "A sky-to-green gradient"),
    body: bodyOf([
      {
        id: "the-workers",
        title: "The Workers",
        paragraphs: [
          "The marketing site, the app and the API are each a Cloudflare Worker built by OpenNext, with their static files served beside them.",
        ],
      },
      {
        id: "the-data",
        title: "The data",
        paragraphs: [
          "The app and the API reach a Supabase Postgres database through Hyperdrive; files go to an R2 bucket, and the contact form's rate limit is kept in Workers KV.",
        ],
      },
    ]),
  },
];

export const sampleLegalPages = [
  {
    _slug: "privacy",
    _title: "Privacy Policy",
    description: "A sample privacy policy — replace it before you launch.",
    body: bodyOf([
      {
        id: "sample",
        title: "This is a sample",
        paragraphs: [
          "This page is placeholder text, not a privacy policy. Write your own in BaseHub (or wherever your legal pages live) before you collect anyone's data.",
        ],
      },
    ]),
  },
  {
    _slug: "terms",
    _title: "Terms of Service",
    description: "Sample terms of service — replace them before you launch.",
    body: bodyOf([
      {
        id: "sample",
        title: "This is a sample",
        paragraphs: [
          "These are placeholder terms, not an agreement. Replace them with your own before you take on users.",
        ],
      },
    ]),
  },
];

type Query = Record<string, unknown>;

interface ListQuery {
  items?: unknown;
  item?: unknown;
  __args?: { filter?: { _sys_slug?: { eq?: string } } };
}

const pick = <T extends { _slug: string }>(list: T[], query: ListQuery) => {
  const slug = query.__args?.filter?._sys_slug?.eq;
  return slug
    ? (list.find((entry) => entry._slug === slug) ?? null)
    : (list[0] ?? null);
};

// The result BaseHub would return for one of index.ts's queries, from the
// sample: a list query gets every entry, an item query the one its slug
// filter names (or the newest). Entries carry every field the widest
// fragment asks for; a narrower one ignores the rest.
export const sampleResult = (query: Query): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const blog = query.blog as { posts?: ListQuery } | undefined;
  if (blog?.posts) {
    result.blog = {
      posts:
        "items" in blog.posts
          ? { items: samplePosts }
          : { item: pick(samplePosts, blog.posts) },
    };
  }
  const legalPages = query.legalPages as ListQuery | undefined;
  if (legalPages) {
    result.legalPages =
      "items" in legalPages
        ? { items: sampleLegalPages }
        : { item: pick(sampleLegalPages, legalPages) };
  }
  return result;
};
