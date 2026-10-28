# next-forge — operating contract (for humans and agents)

This is the standing guide to how this product is deployed and operated.
Instance facts (live URLs, workspace, which services are connected, the
secrets it uses) live in [deployment.md](deployment.md), rendered from
probed reality by the bootstrap's `02-docs` phase; this file is the contract
that stays true between deployments. It is written to give an agent with
repository read access enough context to reason about and operate the product
without any other source.

## What this system is

Vercel's next-forge — a SaaS monorepo of three Next.js apps over twenty
`@repo/*` packages — on Cloudflare Workers, with its Postgres a Supabase
project reached through Cloudflare Hyperdrive, files in R2 and rate limits in
Workers KV, expressed as an Orun component-native desired-state repo.
Thirteen components:

- **`infra/terraform/supabase`** (`supabase`) — one Supabase project per
  environment. Its apply publishes `SUPABASE_PROJECT_REF`,
  `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL` onto the environment's secret
  rung.
- **`infra/terraform/cloudflare-hyperdrive`** (`cloudflare-hyperdrive`) — one
  Hyperdrive config per environment over that database; publishes
  `WIRING_CLOUDFLARE_HYPERDRIVE` (the config's id and name).
- **`infra/terraform/cloudflare-r2`** (`cloudflare-r2`) — the storage bucket
  `@repo/storage` writes; publishes `WIRING_CLOUDFLARE_R2` (its name).
- **`infra/terraform/cloudflare-kv`** (`cloudflare-kv`) — the namespace
  `@repo/rate-limit` counts in; publishes `WIRING_CLOUDFLARE_KV` (its id).
- **`infra/db-migrate`** (`db-migrate`) — applies `packages/db`'s migrations
  to the environment's database through Supabase's Management API. Each
  migration is recorded with its checksum in `_migrations.applied`; only the
  missing ones apply.
- **`packages/db`** (`db`) — the migrations and their runner.
- **`apps/app`** (`app`) — the product: the dashboard (behind Clerk, or a
  sample user before Clerk is connected), search, the webhooks portal,
  collaboration, notifications. One Worker (`@opennextjs/cloudflare`) with
  `HYPERDRIVE`, `STORAGE` (R2) and `AI` (Workers AI).
- **`apps/web`** (`web`) — the marketing site: home, pricing, blog, legal
  pages, contact form, six locales. One Worker with `RATE_LIMIT` (KV).
- **`apps/api`** (`api`) — the API: `/health`, the Stripe and Clerk
  webhooks, and `/cron/keep-alive`, which a Cron Trigger (`0 0 * * *`, in
  `apps/api/worker.ts`) runs daily. One Worker with `HYPERDRIVE`.
- **`tests/app`**, **`tests/web`**, **`tests/api`**, **`tests/db`** — vitest
  suites, verified on the `dev` rung.

The `@repo/*` packages are no component of their own: each app's
`component.yaml` names `packages/**` as a change input, so a change to a
package re-plans the apps.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and test, nothing deploys.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files (or change inputs) changed are planned — then runs
   each planned lane with `orun run --remote-state`, authenticated by GitHub
   OIDC (the exchange resolves this repository's linked workspace
   server-side).
3. Per environment, in this order — each edge `mode: enforced` on a push to
   main, advisory on a pull request (which deploys nothing):
   **`supabase` → `cloudflare-hyperdrive` → `db-migrate` → `app`, `api`**,
   with **`cloudflare-r2` → `app`** and **`cloudflare-kv` → `web`** beside
   them. A job resolves its secrets when it starts, so each one reads what
   the apply before it published. Each Worker's deploy re-renders its
   `wrangler.jsonc` from those wiring documents, builds with the three
   Workers' origins for the environment, hands its server secrets to the
   Worker (`tooling/wire/worker-secrets.mjs`), deploys
   `next-forge-{app,web,api}-<env>` and smoke-tests it: the app's
   `/api/health` (the database, through Hyperdrive, migrated), the site's
   `/api/health` (its KV namespace) and the API's `/cron/keep-alive` (one row
   written and deleted, as the Cron Trigger does).
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "product
  converged"; probe the URLs instead.
- Each `apps/*/wrangler.jsonc` is committed as the render of its
  `wrangler.template.jsonc` from `wiring.fixture.json` (placeholder ids):
  edit the template and run `pnpm run wire:fixture`. The deploy lanes render
  the real one in their own job tree; never commit a real id.
- Workers Free deploys a Worker up to 3 MiB compressed. The app is about 2.8
  MiB; a heavy server-side dependency can push it over — check with
  `pnpm --filter @app/app exec wrangler deploy --dry-run` after `pnpm build`,
  or move the account to Workers Paid (10 MiB).
- Every table in `public` has row-level security and no policy. Supabase's
  Data API serves `public` to the anon key, so this is what keeps the tables
  out of it; the apps are unaffected because they connect as `postgres`, the
  tables' owner. Enable RLS on every new table; never `FORCE` it, and never
  add a policy for `anon` without meaning to publish that table.
- A migration is immutable once applied: its checksum is in
  `packages/db/src/manifest.ts` and in the database's ledger. Change the
  schema with a NEW migration in `packages/db/src/migrations`.

## Secrets model

- **Brokered provider secrets**, minted per run from the workspace's
  connections — no long-lived values at rest, nothing to rotate by hand:
  `CLOUDFLARE_API_TOKEN` (the Workers' deploys, the KV namespace),
  `CLOUDFLARE_HYPERDRIVE_TOKEN` and `CLOUDFLARE_R2_TOKEN` (the deploy token
  deliberately cannot touch either), `CLOUDFLARE_ACCOUNT_ID`,
  `SUPABASE_ACCESS_TOKEN` (project create and migrations) and
  `SUPABASE_ORG_ID`.
- **Published by the applies** onto the stage and prod rungs:
  `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`,
  `WIRING_CLOUDFLARE_HYPERDRIVE`, `WIRING_CLOUDFLARE_R2`,
  `WIRING_CLOUDFLARE_KV`.
- **The SaaS keys, the owner's own**, because no platform brokers Clerk,
  Stripe, BaseHub or the rest: this repository's Orun secrets, per
  environment, under the names the template reads (each component's
  `optionalSecretEnv`; the README's "Connecting a service" table). Missing
  ones are skipped, and every page still serves. Public keys
  (`NEXT_PUBLIC_*`) are inlined into the build; server keys are kept out of
  it and set on the Worker as Worker secrets at deploy.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.

## Connecting a service

```bash
orun secrets set CLERK_SECRET_KEY --env stage   # prompts for the value
```

Then redeploy the Worker that reads it (below): a secret reaches a Worker
when it deploys, and setting one deploys nothing. Re-running the bootstrap's
`02-docs` phase records which services are connected in
[deployment.md](deployment.md).

## Verifying the system

```bash
# each Worker on each environment (also recorded, probed, in deployment.md)
curl -s https://next-forge-app-stage.your-workers-subdomain.workers.dev/api/health
curl -s https://next-forge-web-stage.your-workers-subdomain.workers.dev/api/health
curl -s https://next-forge-api-prod.your-workers-subdomain.workers.dev/health

# workspace readiness (integrations + repository link)
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| change the schema | a new `packages/db/src/migrations/<nnn>_<name>/up.sql` with RLS enabled on any new table, listed in `src/manifest.ts` (`pnpm --filter @saas/db run manifest:fix` for its checksum), and the queries in `packages/database`; merge — db-migrate applies it before the app and the API deploy |
| connect a service | above; the README's table says which Worker reads which key |
| redeploy without a change | edit the last line of the component's `component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| serve a custom domain | attach it to each Worker in Cloudflare (README, "Custom domain"), set `APP_URL`, `WEB_URL` and `API_URL` under each environment's `env:` in `intent.yaml`, replace the placeholder `next-forge.example.com` in `BASE_DOMAIN`, and merge |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes (a fourth Worker, a queue, another data store) follow the
same contract that deployed the product: add a component under `apps/`,
`infra/` or `packages/` with a `component.yaml` — declaring `dependsOn` on
any infrastructure whose published secrets it reads, enforced on main — land
it as a pull request, and the convergence run applies it.
