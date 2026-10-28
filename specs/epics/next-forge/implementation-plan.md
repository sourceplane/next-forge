# next-forge — implementation plan

| Milestone | Task | Lands | Done when |
|---|---|---|---|
| NF0 — the spec | NF-1 | intent.yaml (placeholder workspace), ci.yml (turso-starter's, byte for byte, with the manual-deploy contract), the root workspace, the shared tooling, the spec index, this doc set, the task contracts | merged on `main` |
| NF1 — the apps on Workers | NF-2 | `apps/{app,web,api}` and the `@repo/*` packages under pnpm, each app's `wrangler.template.jsonc` + fixture + committed render, `open-next.config.ts`, `component.yaml`; the sample modes; `tests/{app,web,api}` | every app type-checks, lints, tests and builds; each Worker's dry run is under 3 MiB compressed; `wrangler dev` serves each with no key |
| NF2 — the data plane | NF-3 | `infra/terraform/{supabase,cloudflare-hyperdrive,cloudflare-r2,cloudflare-kv}`, `packages/db` (migrations, the Management-API runner), `infra/db-migrate`, `tests/db`, the Workers' dependsOn and wiring | `terraform validate` passes for every root; the migrations apply to a real Postgres twice, the second applying nothing |
| NF3 — ready to instantiate | NF-4 | README (run, test, preview, deploy, the mapping table, connecting each SaaS), as-built status | a reader can take it from clone to a deploy |
| NF4 — a baseline | NF-5 | blueprint.yaml, repo-blueprint.yaml, `.baseline/`, `tooling/{rebrand,bootstrap,catalog}`, `hooks/`, `docs/phases/`, `ai/context/`, `testing/`, baseline.yml, tag.yml | Baseline CI green: every contract test, the docs check, the leak gate, the placement tier and the e2e |
