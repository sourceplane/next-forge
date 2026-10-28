import { expect, test } from "vitest";
import { GET } from "@/app/health/route";

// Upstream's own test (apps/api/__tests__/health.test.ts), as it was.
test("Health Check", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("OK");
});
