# next-forge

Vercel's [next-forge](https://github.com/vercel/next-forge) — a
production-grade SaaS Turborepo: the app (a dashboard behind Clerk, with
search, a webhooks portal, live cursors and notifications), the marketing
site (home, pricing, a blog, legal pages and a contact form, in six
languages) and the API (Stripe and Clerk webhooks, health, a daily
keep-alive) over twenty shared packages — running on **Cloudflare Workers +
Static Assets**, one Worker per app through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), with its
database a **Supabase** project's Postgres reached through **Cloudflare
Hyperdrive**, files in **R2**, the contact form's rate limit in **Workers KV**
and the keep-alive as a **Cron Trigger**, all four provisioned by Terraform
through [Orun](https://github.com/sourceplane/orun) and the schema applied by
Orun's `db-migrate` — and packaged as an **Orun baseline**: one command takes
a new product from nothing to live on stage and prod, in its own repository,
under its own name, in ONE landing.

The template's code is the code. What the port changes is what the Workers
runtime, Workers Free's 3 MiB per Worker and a fresh, unattended deployment
force: Prisma's client becomes the same `database.page` calls over postgres.js
through Hyperdrive, Vercel Blob becomes R2, Upstash becomes KV, Vercel Cron a
Cron Trigger, the Sentry and BetterStack SDKs Workers Logs, and every SaaS —
Clerk included, which upstream requires — becomes optional, so the three
Workers deploy and serve before their owner has signed up for any of them.
Vercel's next-forge is MIT-licensed ([LICENSE](LICENSE)). See
[`specs/epics/next-forge`](specs/epics/next-forge/README.md) for the design,
the milestones and the as-built status, including every departure.

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/next-forge
cd next-forge
orun new --blueprint repo-blueprint.yaml --out ~/products/acme-forge --run-hooks --resume \
  --set reponame=acme-forge --set productname="Acme Forge" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`next-forge` → Build). Two phases: **`01-product`** creates the repository,
mints the six brokered credentials (Cloudflare and Supabase) and lands the
whole product as one pull request, whose convergence on `main` provisions and
deploys it per environment in a fixed order —

```
supabase ──▶ cloudflare-hyperdrive ──▶ db-migrate ──▶ app, api
cloudflare-r2 ──▶ app            cloudflare-kv ──▶ web
```

— each edge `mode: enforced` on a push to main and advisory on a pull
request; then **`02-docs`** records the live deployment from probed facts.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **product only** — the three apps, the
packages, the Terraform roots, the migrations, the tests, its CI, its
tooling, a README of its own and its operating contract — renamed throughout
to the product's name, repository, Workers, Supabase project, Hyperdrive
config, bucket and namespace. None of this repository's machinery ships.
**The SaaS keys are the owner's to store afterwards** (the product's README,
"Connecting a service"): no platform brokers them, so the card asks for none.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, the product's README and the bootstrap's task contracts | `.baseline/` |
| The rename engine (product-name seam: `packages/seo/site.ts`) | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The component docs generator | `tooling/catalog/gen-component-docs.py` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The product's context pack | `ai/context/` |
| The baseline's tests: contract, wiring, leak, offline bootstrap and plans, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The product's name | `packages/seo/site.ts` (`SITE_NAME`) |
| The app: dashboard, search, webhooks portal, collaboration, notifications, sign-in and sign-up | `apps/app` → Worker `next-forge-app-<env>` |
| The marketing site: home, pricing, blog, legal pages, contact form, six locales | `apps/web` → Worker `next-forge-web-<env>` |
| The API: health, the keep-alive and its Cron Trigger (`worker.ts`), the Stripe and Clerk webhooks | `apps/api` → Worker `next-forge-api-<env>` |
| The shared packages (auth, database, design system, CMS, email, payments, …) | `packages/*` (`@repo/*`) |
| The database client (Prisma's `database.page` calls over postgres.js through Hyperdrive) | `packages/database` |
| The schema as migrations, and their runner | `packages/db` (`@saas/db`), run by `infra/db-migrate` |
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

Running it locally, deploying, connecting each service and the custom-domain
step are the product's README, [`.baseline/product/README.md`](.baseline/product/README.md).

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

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the three Workers built and dry-deployed per environment, the four Terraform roots planned, the migrations planned, the test suites), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone runs — the landing was checked in the build box; a merge applies, migrates and deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests and the component docs; the blueprint read by the pinned orun, the leak gate, the offline bootstrap and the product's own plans; the product installed, checked and built, migrated into a local Postgres, its three Workers dry-deployed and served | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |
