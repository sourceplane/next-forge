import { captureException } from "./sentry";

// The browser's uncaught errors and rejections, to Sentry when a DSN is set
// (./sentry.ts). Upstream's Session Replay and console-log capture are part of
// `@sentry/browser`, which is not carried.
export const initializeSentry = () => {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }
  window.addEventListener("error", (event) => captureException(event.error));
  window.addEventListener("unhandledrejection", (event) =>
    captureException(event.reason)
  );
};

export const onRouterTransitionStart = () => undefined;
