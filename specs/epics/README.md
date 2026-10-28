# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`next-forge/`](./next-forge/) | **NF** | In progress | Vercel's next-forge production SaaS monorepo — the app, the marketing site and the API — on Cloudflare Workers, one OpenNext Worker each, with Supabase Postgres through Hyperdrive, files in R2, rate limits in Workers KV and the keep-alive as a Cron Trigger; then an Orun baseline that instantiates it in one landing |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
