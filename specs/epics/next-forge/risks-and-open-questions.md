# next-forge — risks and open questions

## NF-A — Worker size (OPEN until NF1 measures it)

Workers Free takes a Worker up to 3 MiB compressed. next-forge's apps import
Clerk, Liveblocks, Knock, Svix, Stripe, PostHog and the design system; the
app Worker is the one at risk. Mitigations, in order: build with webpack (the
smaller Worker, as ai-emoji-generator measured), keep vendor SDKs that only
run in the browser out of the server bundle, replace `@sentry/nextjs` and
`@logtail/next` (both instrument Node) with `fetch` posts. Every dry run's
size is recorded in IMPLEMENTATION-STATUS.md.

## NF-B — Clerk is not optional upstream (DECIDED: a sample mode)

Upstream's proxies call `clerkMiddleware` and its layouts call
`currentUser()` unconditionally, so the apps cannot render without Clerk's
keys. `@repo/auth` decides once whether Clerk is connected (both keys set)
and, when it is not, gives the apps a sample user and organization, skips the
middleware and renders a notice; the app code is unchanged.

## NF-C — A database client per call (ACCEPTED, by design)

As saas-starter (SA-A): a postgres.js client opened in one request cannot be
reused by another on Workers, so `@repo/database` opens one per call through
Hyperdrive, which is the pool.

## NF-D — BaseHub's client is generated at build (DECIDED: committed types, sample entries)

`basehub` generates its client from the repository's schema with a token.
The committed `basehub-types.d.ts` stays the type source, the build does not
call BaseHub, and with no token the blog and legal pages render sample
entries.

## NF-E — Upstash's sliding window on KV (ACCEPTED)

KV is eventually consistent and allows one write per key per second; a
contact form's per-IP daily window is far inside both. The limiter keeps
upstream's API.

## NF-F — Live deploy unproven offline (OPEN)

The Terraform roots are held to `terraform validate`, the migrations to a real
Postgres, the Workers to `wrangler deploy --dry-run` and `wrangler dev`. The
applies, the deploys and the probes need a linked workspace.
