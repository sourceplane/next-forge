import { beforeEach, describe, expect, it, vi } from "vitest";

// /cron/keep-alive, upstream's daily Vercel Cron, now the API Worker's Cron
// Trigger: one row written and deleted, so a free database does not pause.

const calls: string[] = [];

vi.mock("@repo/database", () => ({
  database: {
    page: {
      create: async ({ data }: { data: { name: string } }) => {
        calls.push(`create ${data.name}`);
        return { id: 41, name: data.name };
      },
      delete: async ({ where }: { where: { id: number } }) => {
        calls.push(`delete ${where.id}`);
        return { id: where.id, name: "cron-temp" };
      },
    },
  },
}));

describe("apps/api /cron/keep-alive", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("writes a row and deletes the same row, and answers OK", async () => {
    const { GET } = await import("@/app/cron/keep-alive/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(calls).toEqual(["create cron-temp", "delete 41"]);
  });
});
