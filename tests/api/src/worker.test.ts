import { beforeEach, describe, expect, it } from "vitest";
import worker from "@/worker";
import { requests, state } from "./stubs/open-next-worker";

// worker.ts adds the Cron Trigger's `scheduled` handler beside OpenNext's
// `fetch`; it runs the same route Vercel's cron requested, through that fetch.
const ctx = { waitUntil() {}, passThroughOnException() {} };
const controller = { cron: "0 0 * * *", scheduledTime: 0, noRetry() {} };

describe("apps/api worker.ts", () => {
  beforeEach(() => {
    requests.length = 0;
    state.status = 200;
  });

  it("keeps OpenNext's fetch handler", () => {
    expect(typeof worker.fetch).toBe("function");
  });

  it("runs GET /cron/keep-alive when the trigger fires", async () => {
    await worker.scheduled(controller, {} as CloudflareEnv, ctx);
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      "GET /cron/keep-alive",
    ]);
  });

  it("fails the invocation when the route does", async () => {
    state.status = 500;
    await expect(worker.scheduled(controller, {} as CloudflareEnv, ctx)).rejects.toThrow(
      "/cron/keep-alive answered 500"
    );
  });
});
