# 01-product — the product, in one landing

The whole product lands as ONE pull request, and ONE convergence on main
provisions and deploys it on stage and prod: the Supabase project, the
Hyperdrive config over its database, the migrations, then the app and the
API — in that order, per environment — with the R2 bucket before the app and
the KV namespace before the marketing site.

**Places** every module `repo-blueprint.yaml` declares: the root manifests,
CI, tooling and identity; `infra/terraform/supabase`,
`infra/terraform/cloudflare-hyperdrive`, `infra/terraform/cloudflare-r2`,
`infra/terraform/cloudflare-kv` and `infra/db-migrate`; `packages/db` (the
migrations and their runner) and next-forge's twenty `packages/*`;
`apps/app`, `apps/web` and `apps/api`; and `tests/app`, `tests/web`,
`tests/api`, `tests/db`. `testing/phases.test.sh` holds the set.

**Requires** three live connections, probed and waited for (up to ten
minutes, so a consent can be clicked while it waits): the GitHub App on the
account that OWNS the repository — the platform sees a PR only through that
installation — and Cloudflare and Supabase, which every credential below is
minted from.

## How one convergence keeps the order

| what has to come first | how the plan holds it |
|---|---|
| the Supabase project before Hyperdrive | `cloudflare-hyperdrive` reads `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`, which the `supabase` apply lease-publishes, and declares `dependsOn: supabase`, `mode: enforced` on main. A job resolves its secrets when it STARTS, so the values are there |
| the migrations after the project — and after Hyperdrive | `db-migrate` reads the project's three credentials and declares `dependsOn` on `supabase` and `cloudflare-hyperdrive`, enforced on main. Nothing in it needs Hyperdrive: a migration is the one step a re-run cannot take back, so it runs only once everything else the app needs exists, right before the app |
| the apps last | `app` binds the Hyperdrive id and the R2 bucket (`WIRING_CLOUDFLARE_HYPERDRIVE_<ENV>`, `WIRING_CLOUDFLARE_R2_<ENV>`, rendered into `wrangler.jsonc` before the build) and queries the migrated schema, so it declares `dependsOn` on `cloudflare-hyperdrive`, `cloudflare-r2` and `db-migrate`; `api` binds Hyperdrive and declares `dependsOn` on `cloudflare-hyperdrive` and `db-migrate`; `web` binds the KV namespace (`WIRING_CLOUDFLARE_KV_<ENV>`) its rate limiter keeps its windows in, and declares `dependsOn: cloudflare-kv` — every edge enforced on main |
| stage before prod | deferred during the bootstrap (below), so both environments run their chains side by side |

Every one of these edges is **advisory on a pull request**, which applies and
deploys nothing. `testing/placement.test.sh` plans the placed product's own
push to main and reads the order off it:
`supabase → cloudflare-hyperdrive → db-migrate → app` and `→ api`,
`cloudflare-r2 → app`, `cloudflare-kv → web`.

## What runs

The run's task set-up — the epic, both milestones, both tasks — runs in the
background from the start (`background: true`), so every hook up to `task`
runs beside it; `task` is the first that waits for it.

| hook | what it does |
|---|---|
| `retouch` | one trailing `# orun: redeploy 01-product <stamp>` line in each component `.baseline/tasks/01-product.TaskContract.yaml` names (supabase, cloudflare-hyperdrive, cloudflare-r2, cloudflare-kv, db, db-migrate, app, web, api), so a RE-RUN has a diff to land |
| `git-init`, `stage` | the tree becomes a git repository with a populated index (the rebrand enumerates `git ls-files`) |
| `rebrand` | renames the baseline's identity to the product's: the slug (intent, worker, secret project, the `repo` the Supabase project and Hyperdrive config are named after), the name seam, the domain, the workers.dev subdomain. The upstream template's own links and every migration are left alone |
| `orun-workspace` | writes the product's workspace into `intent.yaml` |
| `work-tree` | strips this repository's `work:` block from the product's intent |
| `promotion`, `dev-lanes` | defer prod's wait on stage and dev's push lanes until `02-docs` |
| `restage`, `rebrand-verify` | the sweep: no baseline identity left |
| `repo` | `orun.repo/ensure@v1`: creates (or finds) `<githuborg>/<reponame>` |
| `link` | the repository becomes the workspace's (`orun cloud link`, best effort; `orun cloud check` is the gate). Every convergence lane authenticates over GitHub OIDC through that link |
| `secrets-cloudflare` | `orun.integrations/reconcile@v1`, Cloudflare's four keys in one hook, each under its own scope, created side by side: `CLOUDFLARE_API_TOKEN` (workers-deploy, the three Workers' deploys and the KV namespace), `CLOUDFLARE_HYPERDRIVE_TOKEN` (hyperdrive-edit — the deploy token cannot touch Hyperdrive), `CLOUDFLARE_R2_TOKEN` (r2-data, the bucket), `CLOUDFLARE_ACCOUNT_ID` (account-id). Keys that exist are kept |
| `secrets-supabase` | the same for Supabase's two: `SUPABASE_ACCESS_TOKEN` (management-access, the project and the migrations), `SUPABASE_ORG_ID` (org-id) |
| `task` | finds the phase's task and yields its key — waiting, if it must, for the background set-up |
| `land` | one PR bound to the task, its commit checked in the box first (`checks: local`: `orun validate`, then `orun plan` as the PR and as the merge would plan it, under a second); merged without waiting for the PR's CI (`plan` alone on a bootstrap branch) |
| `converge` (await) | `orun.run/watch@v1` on the merge commit's run, read every 5 s; resumes it up to three times |
| `verify` (await) | `orun.http/probe@v1`: the site's `/` and `/api/health`, the app's `/api/health` and the API's `/health`, on both environments' workers.dev URLs |

## What the convergence does, per environment

1. **supabase** — `terraform apply`: one project, `<reponame>-<env>`, in the
   org `SUPABASE_ORG_ID` names, with a generated database password. Its
   outputs are lease-published as `SUPABASE_PROJECT_REF`,
   `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL`. A new project takes five to
   seven minutes to come up.
2. **cloudflare-hyperdrive** — `terraform apply` with the Hyperdrive token: a
   config over the project's Postgres, published as
   `WIRING_CLOUDFLARE_HYPERDRIVE` (its id and name).
   **cloudflare-r2** and **cloudflare-kv**, beside it from the start — the
   app's bucket `<reponame>-<env>` and the site's namespace
   `<reponame>-app-kv-<env>`, published as `WIRING_CLOUDFLARE_R2` and
   `WIRING_CLOUDFLARE_KV`.
3. **db-migrate** — builds `@saas/db` and applies every migration the
   database's `_migrations.applied` ledger does not have, through Supabase's
   Management API: the template's `Page` table, then row-level security on
   every table in `public` — closed to Supabase's Data API, open to the
   apps, which own them.
4. **app**, **api** and **web** — each installs, re-renders its
   `wrangler.jsonc` from this environment's wiring documents, builds with
   OpenNext, deploys `<reponame>-<app>-<env>` and pushes whichever SaaS keys
   the environment holds as Worker secrets, then smoke-tests it: the app's
   `/api/health` (answers only when the database behind the binding is
   reachable and migrated) and `/sign-in`; the API's `/health` and
   `/cron/keep-alive` (a query through Hyperdrive); the site's `/` and
   `/api/health` (a read of its KV namespace).

No SaaS is in it: no connection brokers Clerk, Stripe, BaseHub, Resend or
the rest. The Workers deploy without their keys — the app signs in as a
sample user, the blog shows sample posts — until the owner stores one (the
product's README, "Connecting a service").

## Verify / done means

- The convergence for the merge commit is green on stage and prod — in it,
  Hyperdrive and db-migrate resolved the Supabase project's
  `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL`, and
  the Workers' deploys `WIRING_CLOUDFLARE_{HYPERDRIVE,R2,KV}`, from stage and prod, where
  every later run reads them. A missing one fails its lane, so there is no
  separate check that they exist.
- The four probed URLs answer on both environments.

## Failure modes

| symptom | meaning → fix |
|---|---|
| parks on the `providers` probe | a connection is missing — GitHub on the repository's owner, Cloudflare, or Supabase. Connect it (console → Integrations); the probe is a wait, not a failure |
| supabase apply: `does not support oauth access` | the provider is above 1.5.x, which reads billing endpoints an OAuth token cannot — `~> 1.5.1` is pinned for this reason |
| supabase apply: project name already exists | `adopt.tf` looks the project up by name and imports it — if you removed that file, restore it |
| hyperdrive or db-migrate lane: secret resolution failed (`SUPABASE_*`) | the supabase apply for that environment did not publish — read its log; both wait on it, so they show as not run |
| app, api or web lane: secret resolution failed (`WIRING_CLOUDFLARE_{HYPERDRIVE,R2,KV}_*`) | that root's apply did not publish its wiring (the root lost its `secretOutputs`, or its lane was not in the plan) — read its lane; re-run the phase and its retouch marker re-plans it |
| r2 apply: `Please enable R2 through the Cloudflare Dashboard` (10042) | R2 is not enabled on the account. Enable it (free tier; Cloudflare asks for a payment method) and re-run the phase |
| `land`: `the landing's own check failed — orun plan for …` | the placed tree does not plan; the next line is orun's own error. Nothing was pushed. Fix it (or the baseline) and re-run the phase |
| `land` waits on CI after all | the product's repository requires a status check on `main` (branch protection or a ruleset), so GitHub refused the early merge; the landing waits for the check as a `checks: ci` landing would, then merges |
| hyperdrive apply: Authentication error (10000) | the token in play is workers-deploy, which deliberately cannot touch Hyperdrive — the component binds `CLOUDFLARE_HYPERDRIVE_TOKEN` |
| db-migrate: checksum mismatch | an applied migration's file changed. Never edit one; add a new migration |
| db-migrate: `row-level security would lock the app out of …` | migration 020's guard: the tables in `public` are not owned by `postgres` (the role Hyperdrive connects as), and `postgres` has neither SUPERUSER nor BYPASSRLS. Nothing was enabled and the app did not deploy. Give `postgres` the tables (`ALTER TABLE … OWNER TO postgres`) or BYPASSRLS, then re-run the phase |
| app smoke: `/api/health` 503, or api smoke: `/cron/keep-alive` 500 | the database is unreachable through the binding or not migrated — the Hyperdrive and db-migrate lanes for that environment say which |
| web smoke: `/api/health` 503 | the site has no `RATE_LIMIT` namespace — the cloudflare-kv lane for that environment says why |
| deploy: `exceeded the size limit of 3 MiB` | a change grew a Worker past Workers Free's limit (the product's README, "Worker size") |
| `build-app` fails: `Symlink apps/<app>/node_modules/next is invalid, it points out of the filesystem root` | the product's intent pins stack-tectonic ≥ 0.20.0 (lane-scoped install), which Next 16's build refuses. Pin 0.19.0 — `intent.yaml` says why |
| `verify-app-structure` fails: `test -f wrangler.jsonc` | `apps/<app>/wrangler.jsonc` is not committed. It must be: the check runs before the build, in a fresh checkout (`pnpm run wire:fixture` renders it) |
| the watch says green, the probe says 404 | another workflow ran on the push and the watch took its run. Only `ci.yml` may run on a push to main |
| re-run lands nothing | the hooks did not run (`--run-hooks`), or the contract names no component — `node tooling/bootstrap/retouch.mjs --check --affects .baseline/tasks/01-product.TaskContract.yaml` in the product's tree says which |

## Re-running

Idempotent: placement is additive, the rebrand is a no-op on branded files,
`git init` and the repo step are guarded, the Supabase project, the
Hyperdrive config, the bucket and the namespace are adopted rather than
recreated, and the migration
ledger lives in the database, so only missing migrations apply. A re-run of
a phase whose PR already merged lands the retouch markers alone, which
re-plans exactly the components they name. Once the tree is branded the
phase derives as `drifted`, so `--resume` leaves it alone; re-run it
deliberately with `--phase 01-product` (or `--redo 01-product`).

## What one convergence will run, before running it

From a placed product's tree:

```bash
node <baseline>/tooling/bootstrap/promotion.mjs --defer && node <baseline>/tooling/bootstrap/dev-lanes.mjs --defer
orun plan --intent intent.yaml --trigger github-push-main -v lanes
git checkout intent.yaml
```
