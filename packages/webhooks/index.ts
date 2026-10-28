import { keys } from "./keys";
import { getAppPortal, send } from "./lib/svix";

// Whether a Svix account is connected (SVIX_TOKEN). Upstream threw from
// every call without it, so the app's webhooks page failed with a 500.
export const isWebhooksConfigured = (): boolean => Boolean(keys().SVIX_TOKEN);

export const webhooks = {
  send,
  getAppPortal,
};
