# next-forge — where this repository stands

This repository is a baseline, not a product: it is what a product is built
FROM. This page says where it stands; the product's own context is
[operations.md](operations.md) and [deployment.md](deployment.md), the two
pages here that ship.

## What it is

Vercel's next-forge — the app, the marketing site and the API over twenty
shared packages — on Cloudflare Workers, one OpenNext Worker per app, with
its database a Supabase project's Postgres reached through Cloudflare
Hyperdrive, files in R2, the contact form's rate limit in Workers KV and the
keep-alive as a Cron Trigger, all from Terraform through Orun, the schema
applied by db-migrate. One bootstrap landing (`01-product`: the Supabase
project, Hyperdrive, R2 and KV, then the migrations, then the three Workers,
per environment, in one convergence) and a deployment record (`02-docs`).
Every SaaS the template wires is optional; with none of them the Workers
deploy and serve.

| Field | Value |
|---|---|
| Latest tag | `baseline-v1` (NF4 — the baseline) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI: the e2e tier migrates a local Postgres with the product's own runner, builds all three Workers in orun's staged job trees, dry-deploys them and serves them with no SaaS key. No bootstrap from a tag has run against a workspace: no Terraform root has been applied, db-migrate has not run against a real project, nothing has deployed, and the card's twenty minutes is unmeasured (risk NF-F) |
| Worker sizes | app 2,873 KiB, web 2,602 KiB, api 1,315 KiB gzip — under Workers Free's 3 MiB |

## Where to look

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/next-forge/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/next-forge/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/next-forge/risks-and-open-questions.md` |
| How a product is built from it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `<component>/docs/` beside each `component.yaml` (generated; `python3 tooling/catalog/gen-component-docs.py`) |
