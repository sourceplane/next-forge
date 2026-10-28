import { describe, expect, it } from "vitest";

// Upstream's webhooks page threw a 500 without Svix; the page now says what
// to connect, so it asks @repo/webhooks whether a key is set.
describe("@repo/webhooks", () => {
  it("reports itself unconfigured without SVIX_TOKEN", async () => {
    delete process.env.SVIX_TOKEN;
    const { isWebhooksConfigured } = await import("@repo/webhooks");
    expect(isWebhooksConfigured()).toBe(false);
  });
});
