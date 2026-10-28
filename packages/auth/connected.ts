// Whether this deployment has a Clerk application to authenticate against.
//
// Vercel's next-forge requires Clerk: its proxies run Clerk's middleware and its
// layouts read the signed-in user on every request. A product built from the
// baseline goes live before its owner has a Clerk application, so @repo/auth
// asks this one question and, with no Clerk, gives the apps a sample user
// (./sample.ts) instead of failing every route.
//
// Both keys must be set. The publishable key is inlined into the client
// bundle at build time (NEXT_PUBLIC_); the secret is read at request time on
// the server — a Worker secret, never in a bundle.
export const isClerkConfigured = (): boolean =>
  Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
  );

// The browser knows only the publishable key, which the build inlined.
export const isClerkConfiguredInBrowser = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
