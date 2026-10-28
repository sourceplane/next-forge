import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The two webhook routes. With no keys they answer "Not configured", as
// upstream does. With Stripe's keys set, a payload signed with the webhook
// secret is verified with constructEventAsync over SubtleCrypto (Workers have
// no Node crypto) and a forged one is refused. No network: an event type the
// route does not handle reaches neither Clerk nor PostHog.

let incoming = new Headers();

vi.mock("next/headers", () => ({
  headers: async () => incoming,
}));

const STRIPE_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CLERK_WEBHOOK_SECRET"];

describe("apps/api webhooks", () => {
  beforeEach(() => {
    vi.resetModules();
    incoming = new Headers();
    for (const key of STRIPE_KEYS) {
      delete process.env[key];
    }
  });

  it("answers Not configured with no keys", async () => {
    const payments = await import("@/app/webhooks/payments/route");
    const auth = await import("@/app/webhooks/auth/route");
    for (const route of [payments, auth]) {
      const response = await route.POST(new Request("https://api.example.com", { method: "POST", body: "{}" }));
      expect(await response.json()).toEqual({ message: "Not configured", ok: false });
    }
  });

  it("verifies a signed Stripe event with SubtleCrypto, and refuses a forged one", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_baseline";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_baseline";
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_1", object: "customer" } },
    });
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: "whsec_baseline",
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    });
    const { POST } = await import("@/app/webhooks/payments/route");

    incoming = new Headers({ "stripe-signature": signature });
    const ok = await POST(new Request("https://api.example.com", { method: "POST", body: payload }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).ok).toBe(true);

    incoming = new Headers({ "stripe-signature": signature.replace(/v1=[0-9a-f]+/, `v1=${"0".repeat(64)}`) });
    const forged = await POST(new Request("https://api.example.com", { method: "POST", body: payload }));
    expect(forged.status).toBe(500);
    expect((await forged.json()).ok).toBe(false);
  });
});
