import { describe, expect, it } from "vitest";
import { createRateLimiter, slidingWindow, toMilliseconds } from "@repo/rate-limit";

// Upstash's sliding window, upstream, over Workers KV here — the same API the
// contact form calls, `createRateLimiter({ limiter: slidingWindow(1, "1d") })`.
// An in-memory namespace stands in for KV, and the clock is the test's.

const memoryKv = () => {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    async get(key: string) {
      return store.get(key)?.value ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      store.set(key, { value, ttl: options?.expirationTtl });
    },
  };
};

const DAY = 86_400_000;

describe("@repo/rate-limit on Workers KV", () => {
  it("parses Upstash's durations", () => {
    expect(toMilliseconds("10 s")).toBe(10_000);
    expect(toMilliseconds("1d")).toBe(DAY);
    expect(toMilliseconds("5 m")).toBe(300_000);
    expect(() => toMilliseconds("soon" as never)).toThrow();
  });

  it("allows the contact form once a day per visitor, then refuses until the window slides", async () => {
    const kv = memoryKv();
    const limiter = createRateLimiter({ limiter: slidingWindow(1, "1d"), kv });
    const start = 10 * DAY + 1000;
    expect((await limiter.limit("contact_form_1.2.3.4", start)).success).toBe(true);
    const refused = await limiter.limit("contact_form_1.2.3.4", start + 1000);
    expect(refused.success).toBe(false);
    expect(refused.remaining).toBe(0);
    // Another visitor is counted apart.
    expect((await limiter.limit("contact_form_5.6.7.8", start + 2000)).success).toBe(true);
    // Most of a day later the previous window still weighs in…
    expect((await limiter.limit("contact_form_1.2.3.4", start + DAY - 5000)).success).toBe(false);
    // …and two days later it does not.
    expect((await limiter.limit("contact_form_1.2.3.4", start + 2 * DAY)).success).toBe(true);
  });

  it("keeps each window's count for two windows, never under KV's 60-second minimum", async () => {
    const kv = memoryKv();
    await createRateLimiter({ limiter: slidingWindow(10, "10 s"), kv, prefix: "p" }).limit("k", 5000);
    expect([...kv.store.entries()]).toEqual([["p:k:0", { value: "1", ttl: 60 }]]);
    const daily = memoryKv();
    await createRateLimiter({ limiter: slidingWindow(1, "1d"), kv: daily }).limit("k", 0);
    expect([...daily.store.values()][0]?.ttl).toBe(2 * 86_400);
  });

  it("counts nothing, and allows, with no namespace bound", async () => {
    const result = await createRateLimiter().limit("anyone");
    expect(result.success).toBe(true);
  });
});
