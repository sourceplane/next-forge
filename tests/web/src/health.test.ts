import { beforeEach, describe, expect, it, vi } from "vitest";

// /api/health — the deploy's smoke: answered only by the Worker, once its
// RATE_LIMIT namespace (the contact form's limit) is bound.

let env: Record<string, unknown> = {};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env }),
}));

describe("apps/web /api/health", () => {
  beforeEach(() => vi.resetModules());

  it("answers ok once the namespace answers", async () => {
    const reads: string[] = [];
    env = { RATE_LIMIT: { get: async (key: string) => { reads.push(key); return null; } } };
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(reads).toEqual(["health"]);
  });

  it("answers 503 with no namespace bound", async () => {
    env = {};
    const { GET } = await import("@/app/api/health/route");
    expect((await GET()).status).toBe(503);
  });
});
