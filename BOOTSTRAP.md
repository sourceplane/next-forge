# BOOTSTRAP — a new next-forge product from this baseline, in one landing

How to go from **nothing** to **a next-forge product live on stage and prod —
its own Supabase project per environment with Hyperdrive in front of it, an
R2 bucket and a KV namespace, the schema applied, the app, the marketing
site and the API deployed — documented**, with two provider consents.

There is one artifact: **`repo-blueprint.yaml`**. It declares what to place,
in what order, what each phase needs first, and what to say while it runs.
`orun new` is the whole runtime — the phases below are its `--phase` names,
not separate workflows. The console card the platform renders is
**`blueprint.yaml`**; it names the build document and states the inputs, the
brokered secrets and the programme, and `testing/manifest.test.sh` holds it
to what the build document does.

Target wall-clock: **about twenty minutes** — an estimate summed from the
phases (19 + 1) until a bootstrap measures it. The shape: the task set-up in
the background while ONE landing is placed, branded and checked in the box
(`orun validate` and `orun plan`, no runner waited for), then one convergence
per environment (stage and prod side by side until `02-docs` restores the
promotion gate) that creates the Supabase project (five to seven minutes),
the Hyperdrive config, applies the migrations and builds and deploys the app
and the API, in that order, with the R2 bucket, the KV namespace and the
marketing site beside them, then a short docs landing.

## 0. What you need

- GitHub org access (repository creation) and a machine with `git`, `node`
  (≥ 22), `pnpm` (10.12.1), `python3` with PyYAML, `curl`, and the `orun`
  CLI **≥ v2.88.0** — the floor for RUNNING the bootstrap (the phase overlay,
  `githubOwner` on the doctor probe, `from: workspace`, the deploy
  credentials minted in one `secrets` reconcile per provider, the task set-up
  run in the background (`background: true`), and landings checked in the box
  before they merge (`checks: local`)). The product's own `ci.yml` pins its
  lanes separately (v2.78.4), and that pin — or anything newer, as the floor
  is — is what reads the per-edge `mode` rules the convergence order relies
  on.
- A **Cloudflare** account (the free plan is enough: three Workers with
  static assets, each under 3 MiB, Hyperdrive, KV, one Cron Trigger per
  environment; **R2 must be enabled** on the account, which Cloudflare asks
  a payment method for even on the free tier) and its Account API token with
  the permission groups the console's Connect recipe lists — Workers Scripts,
  Workers KV, Hyperdrive and R2 among them.
- A **Supabase** organization the platform can create projects in, connected
  to the workspace (console → Integrations → Supabase). Each environment gets
  its own project — mind your plan's project limit.
- An Orun Cloud workspace for the product — `orunWorkspace`, or the workspace
  the build runs in (ORUN_WORKSPACE) when that is unset — with an
  **admin-role API key** for headless runs (secret writes below admin are
  masked as `not_found`).
- **The repository allow-listed in the workspace** (console → Settings → Git
  repos), unless the credential can write links. `01-product`'s `link` step
  stops and names the fix if it is not.
- **No SaaS account.** No platform brokers Clerk, Stripe, BaseHub or the
  rest: the product deploys without their keys and its owner stores them
  afterwards (§3).

## 1. One command: `--resume`

The whole bootstrap, unattended. `--resume` places every phase not already
derived as done, in order, honouring each phase's barrier:

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/next-forge
cd next-forge

orun new --blueprint repo-blueprint.yaml \
  --out ~/products/acme-forge --run-hooks --resume \
  --set reponame=acme-forge --set productname="Acme Forge" \
  --set githuborg=acme-inc \
  --set orunWorkspace=ws_XXXXXXXX \
  --set subdomain=<workers-dev-subdomain>
```

`subdomain` is the workers.dev subdomain of the Cloudflare account you deploy
into (Workers & Pages → your subdomain). A build started from the console, or
with `orun baseline new --from bst_…`, never asks for it: the platform reads
it from the workspace's Cloudflare connection, the same one the deploy tokens
mint from. Only a hand-run build like this one passes it.

**`--run-hooks` is the difference between placing files and bootstrapping a
product.** Without it `orun new` writes the tree and stops: no repository, no
landing, no convergence watch, no probe. That is deliberate — it is what
makes the offline bootstrap in `testing/` possible with no workspace and no
provider.

`--resume` is safe to re-run from anywhere, a fresh container with a fresh
`--out` included: **phase state is derived from the tree, never stored.** A
phase whose files are present but branded derives as `drifted`, and
`--resume` leaves it placed rather than reverting the product's identity.

## 1b. Or phase by phase

| phase | what it lands | verified by |
|---|---|---|
| `01-product` | the repository, created and linked; the six brokered credentials; then the whole product in one PR — intent, CI, tooling, identity, the Supabase, Hyperdrive, R2 and KV Terraform roots, the migrations, the packages, the three apps and their tests | its commit validated and planned in the box (as the PR and as the merge), then merged; the convergence green (supabase → cloudflare-hyperdrive → db-migrate → app and api, cloudflare-r2 → app, cloudflare-kv → web, per environment — each resolving what the apply before it published); each Worker's health check answering on both workers.dev URLs |
| `02-docs` | `ai/context/deployment.md` from probed facts (which services are connected included); prod's promotion gate and dev's push lanes restored | the render's own probes, recorded; the commit checked in the box and merged |

```bash
orun new --blueprint repo-blueprint.yaml --out ~/products/acme-forge --run-hooks \
  --phase 01-product --values ~/acme-forge.values.yaml
# … then 02-docs
```

`02-docs` reads the identity back from `.rebrand/values.json` in the placed
tree, but the blueprint's **required** inputs — `reponame`, `productname`,
`githuborg` — are validated before anything runs, so pass them every time (a
`--values` file is easier). The domain is not one of them: the app goes live
on workers.dev, and `productdomain` defaults to empty, which brands the
reserved placeholder `<reponame>.example.com` into `BASE_DOMAIN` for an owner
to replace when they attach a domain (README, "Custom domain"). Pass
`--set productdomain=` only for a product that already has its domain.
The full guide, one page per phase: [docs/phases/README.md](docs/phases/README.md).

| flag | what it does |
|---|---|
| `--status` | derives and prints every phase's state and writes nothing. It parses the document, validates each hook against the action registry and compiles every template; it needs no credential and no network |
| `--phase <name>` | places exactly that phase; its `requires.phases` still gates |
| `--until <name>` | places every phase through that one and stops |

What lands in the product is PRODUCT-ONLY: the app, the Terraform roots, the
migrations and their runner, the tests, its CI, its tooling, its README and
its two context pages. None of this repository's machinery (`.baseline/`, the
blueprints, `tooling/rebrand`, `tooling/bootstrap`, `hooks/`, `testing/`,
`docs/phases/`, `specs/`, `tasks/`, this file) ships, and no shipped file
names any of it. That promise is a test: `testing/leak.test.sh` derives what
every phase would place and gates the set and every file's text, and
`testing/placement.test.sh` gates the same rules over a placed, branded tree.

## 2. Headless / container mode

The blueprint's source is this repository (`sources: [{kind: dir, path: .}]`),
so the container contract is a shallow clone at a pinned tag plus two
tokens:

```bash
export ORUN_TOKEN=…          # orun auth, headless
export GITHUB_TOKEN=…        # fine-grained PAT (below)

git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/next-forge
cd next-forge
orun new --blueprint repo-blueprint.yaml \
  --out /work/acme-forge --run-hooks --resume --progress json \
  --values /work/acme-forge.values.yaml
```

| requirement | detail |
|---|---|
| `GITHUB_TOKEN` | fine-grained PAT: **read** on this repository; on the PRODUCT's repository **contents write**, **pull-requests write**, **actions read+write** (`orun.run/watch@v1` resumes runs with `gh run rerun`), **checks read**; **repository create** on the owner if `01-product` creates it (or pre-create it — supported) |
| classic token caveat | a classic PAT or gh OAuth token also needs the `workflow` scope to push `.github/workflows/` |
| pinning | the clone's `--branch <tag>` pins everything: the blueprint, its modules and its hooks' scripts all come from that one commit |

## 3. After the product is live

- **Connect a service** (per environment): store its keys as the product's
  Orun secrets under the names the template reads, then redeploy the Worker
  that reads them (the Deploy button):

  ```bash
  orun secrets set CLERK_SECRET_KEY --env prod
  orun secrets set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --env prod
  ```

  Until then the app runs as a sample user, the blog shows sample posts and
  every page that needs a service says which one. The product's README,
  "Connecting a service", lists every key and the Worker that reads it.
- **Custom domain**: attach it to each Worker in Cloudflare, then set
  `APP_URL`, `WEB_URL` and `API_URL` under each environment's `env:` in the
  product's `intent.yaml` (its README, "Custom domain"). There is no domain
  phase: attaching a domain needs zone permissions the brokered
  `workers-deploy` token does not carry.
- **Refresh the record**: re-run `--phase 02-docs`; it is idempotent, and it
  records which services are connected.

## 4. Testing this baseline

`.github/workflows/baseline.yml` runs three tiers on every pull request, and
each runs locally the same way:

```bash
for t in manifest phases coverage rebrand retouch bootstrap-defer wire; do bash testing/$t.test.sh; done
python3 tooling/catalog/gen-component-docs.py --check
bash testing/leak.test.sh        # needs orun
bash testing/placement.test.sh   # needs orun, node, pnpm: the offline bootstrap and the product's own plans
bash testing/e2e.test.sh         # + network for pnpm, psql and a PostgreSQL server install
```

The offline bootstrap (`testing/lib/bootstrap.sh`) places both phases in
order and finishes each with the blueprint's OWN `run:` hooks — read out of
`repo-blueprint.yaml`, not transcribed — so the retouch marker, the rebrand,
the re-tenant, the deferrals and their restore and the deployment record
all run exactly as a real bootstrap runs them. Only the platform's typed
actions (task, repo, reconcile, land, watch, probe) and the `link` step are
stood in for, a landing becoming a commit.

What no test here can do is the clouds' half: create a Supabase project,
apply the Hyperdrive config, the bucket and the namespace, mint a token,
deploy for real. The Terraform
roots are held to `fmt`, `init -backend=false` and `validate` (a real `plan`
reads Supabase's API and the platform's state backend); the convergence
ORDER is proven on the product's own `orun plan`; and the migrations are
applied by the product's own runner to a local Postgres through a stand-in
for the one Supabase Management API endpoint it calls
(`testing/lib/fake-supabase-api.py`), before the three built Workers serve
over that database with no SaaS key.

## 5. Cutting a baseline tag (maintainers)

Every product built from this repository resolves a `baseline-vN` tag, so the
tag is cut by a workflow rather than by hand:

```bash
gh workflow run tag.yml -f version=baseline-v1          # from main
gh workflow run tag.yml -f version=baseline-v1 -f ref=<sha>
```

It refuses a version that is not `baseline-v<N>` and a tag that already
exists: a baseline tag is never moved. Then add (or move) the registry row in
orun-cloud's `infra/baselines-registry/baselines.yaml` by pull request —
after the tag exists, because the registry's sync fetches `blueprint.yaml`
at the tag and refuses the whole catalogue if it 404s.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `01-product` parks: `waiting for github for <org>` | the workspace's GitHub connection is to another account. Connect the App installation on `<org>` (console → Integrations → GitHub), then `--resume` |
| `01-product` parks on the `providers` probe for cloudflare or supabase | that connection is missing. Connect it (console → Integrations); the probe is a wait, not a failure |
| `01-product` stops at `link` | the repository is not linked to the workspace and the credential cannot link it. Allow-list it (console → Settings → Git repos) and re-run the phase |
| Secret WRITE fails `not_found` while listings work | the API key's role is below admin; re-mint it with the admin role |
| supabase apply: `does not support oauth access` | a supabase provider ≥ 1.6 reads billing endpoints the brokered OAuth token cannot; the root pins `~> 1.5.1` — keep it |
| supabase apply: project limit reached | the Supabase org's plan allows fewer projects than stage + prod need; free one or upgrade, then re-run `01-product` |
| hyperdrive apply: Authentication error (10000) | the Hyperdrive token lacks the permission; reconnect Cloudflare with the recipe's permission groups and re-run the phase — the reconcile re-mints only what is missing |
| hyperdrive or db-migrate: `secret resolution failed … SUPABASE_*` | the supabase apply for that environment did not publish; its lane's log says why. Both wait on it, enforced |
| app, web or api: `secret resolution failed … WIRING_CLOUDFLARE_{HYPERDRIVE,R2,KV}_*` | that root's apply published no wiring: the root lost its `secretOutputs`, or its lane was not in the plan. Re-run the phase; its retouch marker re-plans the roots |
| r2 apply: `Please enable R2` (10042) | R2 is not enabled on the Cloudflare account. Enable it in the dashboard (R2 → Purchase/Enable, free tier) and re-run `01-product` |
| `land` stops: `the landing's own check failed — orun plan for …` | the product's tree does not plan — the line after it is orun's own error (an unknown component type, a composition that does not resolve). Nothing was pushed. Fix the tree (or the baseline) and re-run the phase |
| `land` waits on CI after all | the product's repository requires a status check on `main` (branch protection or a ruleset), so GitHub refused the early merge; the landing waits for the check as a `checks: ci` landing would, then merges |
| db-migrate: `row-level security would lock the app out of …` | migration 020 refused: `postgres` (Hyperdrive's role) neither owns the tables in `public` nor bypasses RLS. Nothing was enabled; give `postgres` the tables or BYPASSRLS and re-run `01-product` |
| app smoke: `/api/health` 503, or api smoke: `/cron/keep-alive` 500 | the database is unreachable — the Hyperdrive config is wrong, the project is paused, or db-migrate did not run for that environment |
| web smoke: `/api/health` 503 | the Worker has no `RATE_LIMIT` namespace bound: the KV apply did not run for that environment |
| deploy: `Your Worker exceeded the size limit of 3 MiB` | a product change grew a Worker past Workers Free's limit. Trim the dependency, or move the account to Workers Paid (10 MiB) |
| `build-app` fails: `Symlink apps/<app>/node_modules/next is invalid, it points out of the filesystem root` | the product's intent pins stack-tectonic ≥ 0.20.0, whose lane-scoped install links each job's node_modules out of its tree, which Next 16's Turbopack refuses. Pin 0.19.0 (`intent.yaml` says why) |
| `verify-app-structure` fails: `test -f "wrangler.jsonc"` | the product's `apps/<app>/wrangler.jsonc` is not committed. It must be — the check runs before the build in a fresh checkout (`pnpm run wire:fixture` renders it) |
| Convergence failed AFTER the PR merged; re-running lands nothing | expected on its own — the files are on main. Re-run the phase (`--phase 01-product`, `--redo 01-product`, or the console's Retry): its `retouch` hook gives the landing a diff and the components re-plan; the project, the config, the bucket and the namespace are adopted, not recreated |
| The convergence reported green, then `verify` got 404 | a second workflow ran on the push to main and the watch took its run. Only `ci.yml` may run on a push to main |
| The product's `intent.yaml` says `workspace: ws_SET_ME` | `orunWorkspace` was empty and the build ran outside a workspace; set it and re-run `01-product` |
| A bootstrap stopped before `02-docs`; prod no longer waits on stage | the gate is deferred, not dropped: run `02-docs`, or `node tooling/bootstrap/promotion.mjs --restore --file <product>/intent.yaml` |
| `✕ input "productname" is required` | all three required inputs (`reponame`, `productname`, `githuborg`) must be set on every invocation, single-phase ones included |
| `unknown flag: --phase`, `has no parameter "checks"`, `has no parameter "secrets"` or another parse error in the blueprint | the CLI is below the v2.88.0 floor |
