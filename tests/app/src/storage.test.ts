import { beforeEach, describe, expect, it, vi } from "vitest";

// @repo/storage is Vercel Blob's put/head/list/del (and get) over the app
// Worker's STORAGE R2 binding. An in-memory bucket stands in for R2.

const objects = new Map<string, { body: string; contentType?: string }>();

const bucket = {
  async put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }) {
    objects.set(key, { body: value, contentType: options?.httpMetadata?.contentType });
    return {
      key,
      size: value.length,
      httpEtag: `"${key}"`,
      uploaded: new Date(0),
      httpMetadata: options?.httpMetadata,
    };
  },
  async get(key: string) {
    const object = objects.get(key);
    return object ? { key, body: object.body, text: async () => object.body } : null;
  },
  async head(key: string) {
    return objects.has(key) ? { key } : null;
  },
  async list({ prefix = "" }: { prefix?: string } = {}) {
    return {
      objects: [...objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key, size: objects.get(key)?.body.length ?? 0, uploaded: new Date(0) })),
      truncated: false,
    };
  },
  async delete(keys: string | string[]) {
    for (const key of [keys].flat()) {
      objects.delete(key);
    }
  },
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { STORAGE: bucket } }),
}));

describe("@repo/storage over R2", () => {
  beforeEach(() => objects.clear());

  it("puts a file under a random suffix, as Vercel Blob does, or under its own name when asked", async () => {
    const { put } = await import("@repo/storage");
    const suffixed = await put("avatars/me.png", "png-bytes", { contentType: "image/png" });
    expect(suffixed.pathname).toMatch(/^avatars\/me-[0-9a-f]{8}\.png$/);
    expect(suffixed.contentType).toBe("image/png");
    const exact = await put("notes.txt", "hello", { addRandomSuffix: false });
    expect(exact.pathname).toBe("notes.txt");
    expect(exact.size).toBe(5);
  });

  it("lists, reads and deletes what it stored", async () => {
    const { del, get, head, list, put } = await import("@repo/storage");
    await put("a/1.txt", "one", { addRandomSuffix: false });
    await put("a/2.txt", "two", { addRandomSuffix: false });
    await put("b/3.txt", "three", { addRandomSuffix: false });
    const listed = await list({ prefix: "a/" });
    expect(listed.blobs.map((blob) => blob.pathname)).toEqual(["a/1.txt", "a/2.txt"]);
    expect(listed.hasMore).toBe(false);
    expect(await (await get("a/2.txt"))?.text()).toBe("two");
    await del(["a/1.txt", "a/2.txt"]);
    expect(await head("a/1.txt")).toBeNull();
    expect((await list()).blobs.map((blob) => blob.pathname)).toEqual(["b/3.txt"]);
  });
});
