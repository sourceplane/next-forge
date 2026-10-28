# next-forge

Vercel's [next-forge](https://github.com/vercel/next-forge) — a
production-grade Turborepo for SaaS: the **app** (a dashboard behind
Clerk, with search, a webhooks portal, live cursors and notifications), the
**marketing site** (home, pricing, a blog, legal pages and a contact form, in
six languages) and the **API** (Stripe and Clerk webhooks, health, a daily
keep-alive), over twenty shared `@repo/*` packages — running on **Cloudflare
Workers + Static Assets**, one Worker per app through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), with the
database in a **Supabase** project's Postgres reached through **Cloudflare
Hyperdrive**, files in **R2**, the contact form's rate limit in **Workers KV**
and the keep-alive as a **Cron Trigger**. Terraform provisions all four per
environment and Orun's `db-migrate` applies the schema, on every merge to
`main`.

Every SaaS the template wires — Clerk, Stripe, BaseHub, Resend, PostHog,
Google Analytics, Sentry, BetterStack, Liveblocks, Knock, Svix, OpenAI — is
optional. With none of them the three Workers deploy and serve: the app runs
as a sample user under a "connect Clerk" notice, the blog and the legal pages
show sample entries, and each page that needs a service says which one.

next-forge is MIT-licensed by Vercel ([LICENSE](LICENSE)); this port keeps
its apps, pages, routes and package boundaries.

## What is here

| Surface | Where |
|---|---|
| The product's name | `packages/seo/site.ts` (`SITE_NAME`) |
| The app: dashboard, search, webhooks portal, collaboration, notifications, sign-in and sign-up | `apps/app` → Worker `next-forge-app-<env>` |
| The marketing site: home, pricing, blog, legal pages, contact form, six locales | `apps/web` → Worker `next-forge-web-<env>` |
| The API: health, the keep-alive and its Cron Trigger (`worker.ts`), the Stripe and Clerk webhooks | `apps/api` → Worker `next-forge-api-<env>` |
| The shared packages (auth, database, design system, CMS, email, payments, …) | `packages/*` (`@repo/*`) |
| The database client (Prisma's `database.page` calls over postgres.js through Hyperdrive) | `packages/database` |
| The schema as migrations, and their runner | `packages/db` (`@app/db`), run by `infra/db-migrate` |
| The Supabase project, the Hyperdrive config, the R2 bucket, the KV namespace | `infra/terraform/{supabase,cloudflare-hyperdrive,cloudflare-r2,cloudflare-kv}` |
| Each Worker's build and deploy contract | `apps/*/next.config.ts`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` → `wrangler.jsonc`, `component.yaml` |
| Tests | `tests/app`, `tests/web`, `tests/api`, `tests/db` (vitest) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # re-render each apps/*/wrangler.jsonc from its template (they are committed)
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build --webpack + opennextjs-cloudflare build → apps/*/.open-next
```

The build needs no database and no SaaS account. Each app's
`.env.production` gives a local build stage's workers.dev origins to link
the three apps by; a deployed build sets its own environment's.

## Running it locally

You need a Postgres on `localhost:54322` — the Supabase CLI's default
(`supabase start`) — or any Postgres whose URL you put in `DATABASE_URL`.

1. **Schema.** Apply the migrations once (CI applies the same files to the
   real databases):

   ```bash
   for f in packages/db/src/migrations/*/up.sql; do psql "postgres://postgres:postgres@localhost:54322/postgres" -f "$f"; done
   ```

2. **Environment.** Every key in `apps/*/.env.example` is optional. For
   `next dev`, copy the app's `.env.example` to `.env.local` and fill in what
   you have; under `wrangler dev` the server-only keys go in `.dev.vars`.

3. **Run.** Next's dev servers, which reach the Workers' bindings through
   wrangler's platform proxy (`HYPERDRIVE` points at `localhost:54322`):

   ```bash
   pnpm --filter @app/app dev   # http://localhost:3000
   pnpm --filter @app/web dev   # http://localhost:3001
   pnpm --filter @app/api dev   # http://localhost:3002
   ```

   or a built Worker under `wrangler dev`:

   ```bash
   pnpm build
   pnpm --filter @app/web preview
   ```

   Workers AI has no local mode, so the app's `AI` binding asks for
   `wrangler login` the first time something calls a model; nothing in the
   template does until you do.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. Per environment the order is
enforced — **the Supabase project, then the Hyperdrive config over its
database, then the migrations, then the app and the API**, with the R2
bucket before the app and the KV namespace before the marketing site —
because each reads what the one before it published. `stage` deploys first
and `prod` once stage has converged on the same commit; `dev` only verifies.
Every deploy is smoke-tested over HTTP: the app's `/api/health` (its
database), the site's `/api/health` (its KV namespace) and the API's
`/cron/keep-alive` (its database, as the Cron Trigger runs it).

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare tokens and account id and the Supabase access token and org id
are brokered per run from the workspace's connections; the Supabase
project's credentials and the Hyperdrive id, bucket name and namespace id
are published by the Terraform applies as Orun secrets. Every SaaS key is an
Orun secret you store when you have one.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after storing a
secret, say. A component with nothing to run in that environment (a test
suite in `prod`) is left out with a notice.

## Connecting a service

Each key is this repository's Orun secret, per deployed environment, under
the name the template already reads:

```bash
orun secrets set CLERK_SECRET_KEY --env prod                    # prompts for the value
orun secrets set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --env prod
```

Then redeploy the Worker that reads it (**Deploy by hand**, above): a secret
reaches a Worker when it deploys. Public keys (`NEXT_PUBLIC_*`) are inlined
into that Worker's build; server keys are kept out of the build and handed
to the Worker as Worker secrets (`wrangler secret bulk`, values over stdin),
so they are in no bundle and no log.

| Service | Keys | Worker(s) | Without it |
|---|---|---|---|
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`; `CLERK_WEBHOOK_SECRET` for `/webhooks/auth` | app, web, api | the app runs as a sample user; sign-in says what to set |
| BaseHub | `BASEHUB_TOKEN` | web | sample blog posts and legal pages under a notice |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (endpoint `https://next-forge-api-<env>.<subdomain>.workers.dev/webhooks/payments`) | api | the webhook answers "Not configured" |
| Resend | `RESEND_TOKEN`, `RESEND_FROM` | web, app | the contact form says email is not configured |
| Svix | `SVIX_TOKEN` | app | the webhooks page says what to connect |
| Liveblocks | `LIVEBLOCKS_SECRET` | app | no live cursors or avatar stack |
| Knock | `NEXT_PUBLIC_KNOCK_API_KEY`, `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`, `KNOCK_SECRET_API_KEY` | app | no notifications bell |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | all | no product analytics; the beta flag stays off |
| Google Analytics | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | app, web | no GA tag |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN` | all | errors are in Workers Logs only |
| BetterStack | `BETTERSTACK_API_KEY`, `BETTERSTACK_URL` | all | no status badge in the footer |
| OpenAI | `OPENAI_API_KEY` | app | `@repo/ai`'s models are Workers AI's |

## How it maps to Vercel

| Vercel / upstream | Here |
|---|---|
| Three Vercel projects | Three Workers + Static Assets, `next-forge-{app,web,api}-<env>`, each `@opennextjs/cloudflare`'s output (`next build --webpack`) |
| `proxy.ts` (Next 16 middleware) | Unchanged, run in each Worker by OpenNext |
| Neon Postgres through Prisma 7 | A Supabase project's Postgres through Hyperdrive; `@repo/database` keeps `database.page.findMany/create/delete`, over postgres.js, one client per call |
| `prisma migrate` | `infra/db-migrate` applies `packages/db/src/migrations` through Supabase's Management API, per environment, before the Workers deploy; RLS closes the tables to Supabase's Data API |
| Prisma Studio (`apps/studio`) | Supabase's Table Editor |
| Vercel Cron → `/cron/keep-alive` | A Cron Trigger (`0 0 * * *`) on the API Worker, whose `worker.ts` runs the same route; it also keeps a free Supabase project from pausing |
| Vercel Blob (`@repo/storage`) | The `STORAGE` R2 bucket on the app Worker: `put`, `get`, `head`, `list`, `del` |
| Upstash rate limit (`@repo/rate-limit`) | The same `slidingWindow` API over the `RATE_LIMIT` KV namespace on the marketing site |
| OpenAI (`@repo/ai`) | Workers AI through the app Worker's `AI` binding, no key; OpenAI when `OPENAI_API_KEY` is set |
| Sentry, BetterStack logging | Workers Logs; errors posted to Sentry over `fetch` when a DSN is set |
| Arcjet (bot detection, shield) | Not carried: its WebAssembly analyzer alone is over Workers Free's 3 MiB per Worker. On a custom domain, Cloudflare's WAF managed rules, Bot Fight Mode and rate-limiting rules do the same job at the edge |
| Vercel Analytics, the Vercel Toolbar | Not carried (Vercel's own); Web Analytics is a Cloudflare dashboard switch on a custom domain |
| BaseHub's code block (every Shiki language) | Shiki with a blog's usual languages on its JavaScript engine |
| Clerk required | Optional (above) |
| `VERCEL_PROJECT_PRODUCTION_URL` | Each app's own origin, set per environment by its build |
| `apps/docs` (Mintlify) | Not carried: Mintlify hosts docs from its own GitHub integration |
| `apps/email` (react-email preview), `apps/storybook` | Not carried: dev tools; the email templates are in `packages/email` |
| bun, Biome | pnpm 10, Node 22, ESLint 9 |
| "Deploy with Vercel" | `orun new --blueprint repo-blueprint.yaml` — a new repository, branded, provisioned, deployed |

## Worker size

Workers Free deploys a Worker up to 3 MiB compressed, Workers Paid up to 10
MiB. Measured with `wrangler deploy --dry-run`: the app 2,869 KiB, the
marketing site 2,602 KiB, the API 1,315 KiB. Adding heavy server-side
dependencies to the app can push it past the free limit; Workers Paid lifts
it.

## Custom domain

The Workers answer on workers.dev from their first deploy. To serve them on
your domain, attach it to each Worker in Cloudflare (Workers & Pages →
the Worker → Settings → Domains & Routes), then set `APP_URL`, `WEB_URL` and
`API_URL` under each environment's `env:` in `intent.yaml` to the origins
the apps link each other by — they override the workers.dev defaults in each
`component.yaml`'s build — and merge. `BASE_DOMAIN` beside them records the
domain; the repository was born with the placeholder
`next-forge.example.com`.
