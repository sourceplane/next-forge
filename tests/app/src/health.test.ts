import { beforeEach, describe, expect, it, vi } from "vitest";

// /api/health — the deploy's smoke: the Worker answering, through its
// HYPERDRIVE binding, from the migrated table. Outside the dashboard, so it
// answers whether or not Clerk is connected.

let count: () => Promise<number>;

vi.mock("@repo/database", () => ({
  database: { page: { count: () => count() } },
}));

describe("apps/app /api/health", () => {
  beforeEach(() => vi.resetModules());

  it("answers ok with the page count", async () => {
    count = async () => 2;
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, pages: 2 });
  });

  it("answers 503 when the database cannot be reached", async () => {
    count = async () => {
      throw new Error("connection refused");
    };
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).ok).toBe(false);
  });
});
