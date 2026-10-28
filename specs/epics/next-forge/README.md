# Epic: next-forge (NF)

**next-forge is Vercel's production-grade SaaS monorepo: three Next.js apps over twenty shared packages, each package a thin wrapper around one SaaS. On Cloudflare the apps become three Workers — one `@opennextjs/cloudflare` build each — and the Vercel- and Neon-shaped pieces move to what Cloudflare and Supabase provide: Postgres in a Supabase project behind Hyperdrive, Vercel Blob → R2, Upstash → Workers KV, Vercel Cron → a Cron Trigger. Every other SaaS stays what it is upstream, an optional key: the product deploys and serves before its owner has signed up for any of them.**

The port keeps the apps, their pages, their routes and the package boundaries. It adds the Workers builds, the per-call database client, the unconnected sample modes, the Terraform roots, the migrations and the deploy contract.

## Status

| Field | Value |
|-------|-------|
| Status | In progress |
| Cluster | **NF** (NF0–NF4) |
| Owner(s) | `apps/app` · `apps/web` · `apps/api` · `packages/*` · `tests/*` · `infra/terraform/{supabase,cloudflare-hyperdrive,cloudflare-r2,cloudflare-kv}` · `packages/db` + `infra/db-migrate` |
| Builds on | `saas-starter` (Supabase + Hyperdrive roots, db-migrate through the Management API), `blob-starter` (the R2 root), `kv-redis-starter` (the KV root), `cron-starter` (a Cron Trigger on an OpenNext Worker), `cms-sanity` (an unconnected CMS sample mode) |
| Upstream | [vercel/next-forge](https://github.com/vercel/next-forge) (MIT) |
| Changes | The Workers builds, the database client, sample modes for Clerk and BaseHub, the storage, rate-limit and observability packages, the Terraform roots, the migrations, the deploy contract |
| Gate | NF1 is the first user-visible rung. NF2 applies only with a linked workspace; verified by `terraform validate` and a real Postgres in the e2e |

## Read order

1. `design.md` — what maps to what, the three Workers, the data flow, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| NF0 — the spec | intent, CI, tooling, the spec index, this doc set and the task contracts | merged on `main` |
| NF1 — the apps on Workers | `apps/{app,web,api}`, `packages/*`, the rendered wrangler configs, `tests/{app,web,api}` | each Worker builds under 3 MiB compressed and serves its pages with no key set |
| NF2 — the data plane | `infra/terraform/{supabase,cloudflare-hyperdrive,cloudflare-r2,cloudflare-kv}`, `packages/db`, `infra/db-migrate`, `tests/db` | the roots validate; the migrations apply to a real Postgres |
| NF3 — ready to instantiate | README, as-built status | a reader can run, test, preview and deploy it |
| NF4 — a baseline | card, build document (one landing), rename, bootstrap tooling, tests | a new product goes from nothing to live; Baseline CI green |
