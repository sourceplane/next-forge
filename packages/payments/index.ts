import "server-only";
import Stripe from "stripe";
import { keys } from "./keys";

const { STRIPE_SECRET_KEY } = keys();

// Workers have `fetch` and SubtleCrypto, not Node's `http` and `crypto`: the
// client talks to Stripe over fetch, and webhooks are verified with
// `stripe.webhooks.constructEventAsync(…, cryptoProvider)`.
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
      httpClient: Stripe.createFetchHttpClient(),
    })
  : undefined;

export type { Stripe } from "stripe";
