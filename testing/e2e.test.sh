#!/usr/bin/env bash
# TIER 2 — the product a bootstrap produces builds, migrates, deploys (dry)
# and serves its three Workers, with no SaaS key at all.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree,
# and that its own plan converges in the right order. This proves it WORKS,
# by doing to it what its own pipelines will:
#
#   1. at the 01-product landing (the commit its PR merges), install with the
#      lockfile the product ships, render the wrangler fixtures (which must
#      change nothing: the renders are committed), typecheck, lint, test,
#      build. The landing itself is checked in the build box with `orun
#      validate` and `orun plan` alone (`checks: local`), and its PR runs
#      `plan` alone (an `orun/BASE-*` branch), so THIS is where a product
#      those steps refuse is caught: before the tag, not after a build has
#      merged it;
#   2. a Postgres of its own on a random port, with Supabase's roles — the
#      database a Supabase project would be: `postgres` a login role WITHOUT
#      superuser or BYPASSRLS, `anon` and `authenticated` with the Data API's
#      default grants (testing/lib/local-postgres.sh) — and a stand-in for the
#      ONE Supabase Management API endpoint the migration runner calls
#      (testing/lib/fake-supabase-api.py), connected as `postgres`;
#   3. the db-migrate lane's own steps, rendered by `orun plan` for a push to
#      main and run IN THE TREE THE RUNNER STAGES for the job: install, build
#      @saas/db, apply — the template's table and row-level security on every
#      table in `public` — then apply again, which must apply nothing, and the
#      pull-request profile's offline plan;
#   4. each app's lane for stage — app, api, web — rendered for a pull request
#      (the verify profile carries deploy-dry-run; the deploy profile does
#      not) and run in its own staged job tree: install, `verify-app-structure`
#      (the committed wrangler.jsonc must exist BEFORE the build, in a tree
#      with no build output), `build-app` — which re-renders the config from
#      the stage wiring documents it is handed, as the deploy does — then
#      `verify-build-output` and `deploy-dry-run` (which also measures the
#      Worker against Workers Free's 3 MiB);
#   5. each built Worker under `wrangler dev` — the app and the API with their
#      HYPERDRIVE binding on that Postgres, the app's R2 bucket and the site's
#      KV namespace local — with NO .dev.vars and no SaaS key, and each
#      component's OWN `smokeCommand` against it, verbatim; then every route
#      the product promises: the dashboard as the sample user over the
#      database's rows, search, the pages that say which service is not
#      connected, the API's webhooks degrading, its Cron Trigger running the
#      keep-alive through Hyperdrive, the marketing site under the product's
#      name in two languages with its sample blog and legal pages;
#   6. the Data API's view of the same database: every table in `public` has
#      row-level security, and `anon` and `authenticated` — granted everything
#      Supabase grants them — read none of the rows the app reads and can write
#      none, while the app, as the tables' owner and nothing more, does both.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered tokens, create a real Supabase project, Hyperdrive config, bucket
# and namespace (Terraform is validated, not applied, in this repository),
# deploy for real and probe workers.dev. That is a bootstrap against a
# workspace (BOOTSTRAP.md); everything short of it is here. One stand-in: the
# app's `AI` binding (Workers AI) has no local simulator, and `wrangler dev`
# refuses to start one without a Cloudflare login, so the app is served from
# a copy of its built config without it — no route checked here calls a model.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, psql and a
# PostgreSQL server install (initdb, pg_ctl), and the network for
# `pnpm install` (or a warm store). Some minutes: four installs, four builds.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"
# shellcheck source=lib/local-postgres.sh
source "$here/lib/local-postgres.sh"

for bin in orun node pnpm python3 git curl psql; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done
pg_bin >/dev/null || { echo "e2e.test.sh needs a PostgreSQL server install (initdb, pg_ctl)" >&2; exit 1; }

scratch="$(mktemp -d)"
pgdir="$(mktemp -d)"
dev_pids=()
api_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So each
# server is started as its own process group (setsid) and the group stopped.
stop_group() {
  local pid="$1"
  [ -n "$pid" ] || return 0
  kill -TERM -- "-$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$pid" 2>/dev/null || break; sleep 0.5; done
  kill -KILL -- "-$pid" 2>/dev/null || true
}
cleanup() {
  local pid
  for pid in "${dev_pids[@]}"; do stop_group "$pid"; done
  stop_group "$api_pid"
  pg_down "$pgdir"
  [ -n "$pgdir" ] && [ -d "$pgdir" ] && rm -rf "$pgdir"
  [ -n "$scratch" ] && [ -d "$scratch" ] && rm -rf "$scratch"
}
trap cleanup EXIT
free_port() { python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()"; }
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# The landing's own checks, step for step — what the product's Checks
# workflow ran on a pull request before the product carried ci.yml alone —
# run here at once on the whole tree.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

# One job of a plan, written out as the runner would run it: each `run:` step
# (the `use:` actions are setup-node and setup-pnpm, which this machine has)
# as a numbered script, the job's env, and the component path the steps run
# in. Steps are picked BY ID when given, else every `run:` step in order.
extract_job() { # PLAN JOB-ID OUT-DIR [STEP-ID…]
  python3 - "$@" <<'PY'
import json, pathlib, sys
plan, jid, out, *want = sys.argv[1:]
job = next((j for j in json.load(open(plan))["jobs"] if j["id"] == jid), None)
if job is None:
    sys.exit(f"the plan has no job {jid}")
out = pathlib.Path(out); out.mkdir(parents=True)
steps = [s for s in job["steps"] if s.get("run")]
if want:
    by = {s["id"]: s for s in steps}
    missing = [w for w in want if w not in by]
    if missing:
        sys.exit(f"{jid} has no step(s) {missing}")
    steps = [by[w] for w in want]
for i, s in enumerate(steps):
    (out / f"{i:02d}.sh").write_text(s["run"])
    (out / f"{i:02d}.id").write_text(s["id"])
(out / "path").write_text(job.get("path") or ".")
with (out / "env").open("w") as f:
    for k, v in (job.get("env") or {}).items():
        f.write(f"export {k}={json.dumps(v)}\n")
PY
}
run_job() { # STEPS-DIR WORK-TREE ENV LOG-PREFIX
  local steps="$1" work="$2" envname="$3" logp="$4" s id
  for s in "$steps"/[0-9][0-9].sh; do
    id="$(cat "${s%.sh}.id")"
    echo "   ▸ $id"
    if ! (cd "$work/$(cat "$steps/path")" && source "$steps/env" && export ORUN_ENVIRONMENT="$envname" \
          && bash -e "$s") > "$logp-$id.log" 2>&1; then
      echo "FAIL: the lane's $id step" >&2; tail -40 "$logp-$id.log" >&2; return 1
    fi
  done
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
echo "   2 phases placed and landed"

# ── 1. the product's own pull request ──────────────────────────────────────
echo "── 01-product's landing: install, the fixture render, typecheck, lint, test, build"
s01="$(git -C "$tree" rev-parse HEAD~1)"
at01="$scratch/at-01/$repo"
git -C "$tree" worktree add -q "$at01" "$s01"
checks "$at01" "$scratch/checks.log"
dirty="$(git -C "$at01" status --porcelain)"
[ -z "$dirty" ] || { echo "FAIL: the checks changed tracked files — the committed wrangler.jsonc is not the fixture render:" >&2; echo "$dirty" >&2; exit 1; }
echo "   the checks left the tree as committed (wire:fixture rendered the committed wrangler.jsonc)"

# ── 2. a database, and the one API the migration runner calls ──────────────
echo "── a local Postgres and the Supabase Management API stand-in"
pgurl="$(pg_up "$pgdir" "$(free_port)")" || { echo "FAIL: Postgres did not start" >&2; exit 1; }
api_port="$(free_port)"
ref="localproject"
setsid python3 "$here/lib/fake-supabase-api.py" "$api_port" "$pgurl" --ref "$ref" > "$scratch/api.log" 2>&1 < /dev/null &
api_pid=$!
for _ in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$api_port/" && break; sleep 0.3; done
echo "   $pgurl; the API on :$api_port"

# The two plans the lanes below run from, each in the product's own tree: a
# push to main at the 01-product commit (the db-migrate lane's APPLY profile),
# and a pull request over the finished product against an empty base (the
# apps' VERIFY profile, which carries deploy-dry-run, and db-migrate's PLAN).
(cd "$at01" && orun plan --intent intent.yaml --trigger github-push-main --env stage --output "$scratch/plan-main.json") > "$scratch/plan-main.log" 2>&1 \
  || { echo "FAIL: orun plan (push to main)" >&2; tail -15 "$scratch/plan-main.log" >&2; exit 1; }
git -C "$tree" worktree remove --force "$at01"
mkdir -p "$scratch/pr"
git clone -q "$tree" "$scratch/pr/$repo"
prtree="$scratch/pr/$repo"
git -C "$prtree" checkout -q --orphan empty
git -C "$prtree" rm -rqf .
git -C "$prtree" -c user.email=t@example.invalid -c user.name=t commit -qm empty --allow-empty
git -C "$prtree" checkout -q main
(cd "$prtree" && orun plan --intent intent.yaml --trigger github-pull-request --base empty --head HEAD --env stage \
   --output "$scratch/plan-pr.json") > "$scratch/plan-pr.log" 2>&1 \
  || { echo "FAIL: orun plan (pull request)" >&2; tail -15 "$scratch/plan-pr.log" >&2; exit 1; }
# This tier runs the bootstrap floor, newer than the orun the product's CI
# pins, and both read the per-edge `modeRules`: on a pull request — which
# applies and deploys nothing — the infrastructure edges that order a push to
# main are advisory, so no lane waits on another. (placement.test.sh checks
# the push to main's order.)
python3 - "$scratch/plan-pr.json" <<'PY'
import json, sys
jobs = {j["component"]: j for j in json.load(open(sys.argv[1]))["jobs"] if j["environment"] == "stage"}
edges = [("supabase", "cloudflare-hyperdrive"), ("supabase", "db-migrate"), ("cloudflare-hyperdrive", "db-migrate"),
         ("cloudflare-hyperdrive", "app"), ("cloudflare-r2", "app"), ("db-migrate", "app"),
         ("cloudflare-hyperdrive", "api"), ("db-migrate", "api"), ("cloudflare-kv", "web")]
for a, b in edges:
    ja, jb = jobs[a], jobs[b]
    if ja["id"] in (jb.get("dependsOn") or []) or ja["id"] not in (jb.get("advisoryDependsOn") or []):
        sys.exit(f"FAIL: on a pull request {b}@stage must name {a}@stage as advisory, not wait on it")
print(f"   pull request: all {len(edges)} edges into app, api and web advisory")
PY

# ── 3. the db-migrate lane, in its staged job tree ─────────────────────────
echo "── the stage db-migrate lane: install, build @saas/db, apply — then apply again, and the PR's plan"
extract_job "$scratch/plan-main.json" db-migrate.stage.migrate "$scratch/steps-migrate" \
  install-dependencies build-db-package "Migration Apply"
extract_job "$scratch/plan-main.json" db-migrate.stage.migrate "$scratch/steps-migrate-again" "Migration Apply"
extract_job "$scratch/plan-pr.json" db-migrate.stage.migrate "$scratch/steps-migrate-plan" "Migration Plan"
# Staged from the fresh clone (a CI checkout: no build output, no
# node_modules); its migrations are the 01-product commit's, byte for byte.
mwork="$prtree/.orun/runs/e2e/db-migrate.stage.migrate/work"
python3 "$here/lib/stage-job.py" "$prtree" "$mwork"
# The component's secretEnv, as the lane resolves it: the supabase apply's
# published credentials and the brokered access token. SUPABASE_API_URL is
# the one value no lane has — it points the runner at the stand-in.
export SUPABASE_ACCESS_TOKEN=e2e-token SUPABASE_PROJECT_REF="$ref" SUPABASE_DB_PASSWORD=postgres \
       SUPABASE_DB_URL="$pgurl" SUPABASE_API_URL="http://127.0.0.1:$api_port"
run_job "$scratch/steps-migrate" "$mwork" stage "$scratch/migrate"
applied() { python3 -c "import json,sys;t=open(sys.argv[1]).read();print(' '.join(json.loads(t[t.index('{'):t.rindex('}')+1])['applied']))" "$1"; }
want="000_control_baseline 010_pages 020_row_level_security"
[ "$(applied "$scratch/migrate-Migration Apply.log")" = "$want" ] \
  || { echo "FAIL: the first apply applied '$(applied "$scratch/migrate-Migration Apply.log")', not '$want'" >&2; exit 1; }
echo "   applied $want"
run_job "$scratch/steps-migrate-again" "$mwork" stage "$scratch/migrate-again"
[ -z "$(applied "$scratch/migrate-again-Migration Apply.log")" ] \
  || { echo "FAIL: a second apply applied '$(applied "$scratch/migrate-again-Migration Apply.log")'" >&2; exit 1; }
echo "   a second apply applied nothing (the ledger holds $(psql "$pgurl" -XAtc 'select count(*) from _migrations.applied') migrations)"
run_job "$scratch/steps-migrate-plan" "$mwork" stage "$scratch/migrate-plan"
[ "$(applied "$scratch/migrate-plan-Migration Plan.log")" = "$want" ] \
  || { echo "FAIL: the pull request's offline plan did not verify every migration" >&2; exit 1; }
echo "   the pull request's plan step verifies every migration's checksum offline"
unset SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD SUPABASE_DB_URL SUPABASE_API_URL
rm -rf "$mwork"

# ── 4. each app's lane, for stage ──────────────────────────────────────────
# The stage wiring documents, as the Hyperdrive, R2 and KV applies publish
# them and each lane resolves them (its secretEnv WIRING_*_STAGE).
hd_id="e2e0000000000000000000000000c0de"
kv_id="e2e00000000000000000000000000kv0"
bucket="e2e-$repo-stage"
wiring_for() { # APP → the KEY=VALUE documents its lane resolves
  local hd="WIRING_CLOUDFLARE_HYPERDRIVE_STAGE={\"hyperdrive_id\":\"$hd_id\",\"hyperdrive_name\":\"stg-$repo-stage\"}"
  case "$1" in
    app) echo "$hd"; echo "WIRING_CLOUDFLARE_R2_STAGE={\"r2_bucket_name\":\"$bucket\"}" ;;
    api) echo "$hd" ;;
    web) echo "WIRING_CLOUDFLARE_KV_STAGE={\"app_kv_id\":\"$kv_id\",\"app_kv_title\":\"$repo-app-kv-stage\"}" ;;
  esac
}
rendered_from() { # APP → a string the re-rendered config must carry
  case "$1" in
    app) echo "\"bucket_name\": \"$bucket\"" ;;
    api) echo "\"id\": \"$hd_id\"" ;;
    web) echo "\"id\": \"$kv_id\"" ;;
  esac
}
for app in app api web; do
  echo "── the stage $app lane: install, verify-app-structure, build-app, verify-build-output, deploy-dry-run"
  extract_job "$scratch/plan-pr.json" "$app.stage.verify-deploy" "$scratch/steps-$app" \
    install-workspace-dependencies verify-app-structure build-app verify-build-output deploy-dry-run
  work="$prtree/.orun/runs/e2e/$app.stage.verify-deploy/work"
  # The job's private tree, staged as orun stages it — no build output, no
  # node_modules: under stack-tectonic 0.19.0 the job installs inside it.
  python3 "$here/lib/stage-job.py" "$prtree" "$work"
  [ ! -e "$work/apps/$app/.open-next" ] && [ -f "$work/apps/$app/wrangler.jsonc" ] \
    || { echo "FAIL: the staged tree is not a fresh checkout with the committed wrangler.jsonc" >&2; exit 1; }
  docs=()
  while IFS= read -r d; do docs+=("$d"); done < <(wiring_for "$app")
  (export "${docs[@]}"; run_job "$scratch/steps-$app" "$work" stage "$scratch/$app") || exit 1
  grep -q '(webpack)' "$scratch/$app-build-app.log" \
    || { echo "FAIL: the staged $app build did not run on webpack" >&2; grep -m3 'Next.js' "$scratch/$app-build-app.log" >&2; exit 1; }
  grep -q "$(rendered_from "$app")" "$work/apps/$app/wrangler.jsonc" \
    || { echo "FAIL: $app's build-app did not re-render wrangler.jsonc from the stage wiring documents" >&2; exit 1; }
  [ "$(node -e 'const fs=require("fs");process.stdout.write(String(fs.readdirSync(process.argv[1]).length))' "$work/node_modules")" -gt 0 ] && [ ! -L "$work/node_modules" ] \
    || { echo "FAIL: the $app job's install did not land inside its own tree" >&2; exit 1; }
  size="$(grep -Eo 'Total Upload: [0-9.]+ KiB / gzip: [0-9.]+ KiB' "$scratch/$app-deploy-dry-run.log" | tail -1)"
  gzip_kib="$(printf '%s' "$size" | sed -n 's/.*gzip: \([0-9.]*\) KiB/\1/p')"
  [ -n "$gzip_kib" ] && python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) < 3072 else 1)" "$gzip_kib" \
    || { echo "FAIL: the $app Worker is ${gzip_kib:-?} KiB compressed — over Workers Free's 3 MiB" >&2; exit 1; }
  echo "   built on webpack inside its own tree, bound to the stage ids it was handed; $size"
done

# ── 5. serve each Worker with no SaaS key ──────────────────────────────────
serve() { # APP PORT CONFIG [EXTRA-ARGS…] — wrangler dev in the app's staged tree, its own process group
  local app="$1" port="$2" config="$3" pid; shift 3
  local dir="$prtree/.orun/runs/e2e/$app.stage.verify-deploy/work/apps/$app"
  [ ! -e "$dir/.dev.vars" ] || { echo "FAIL: the staged $app carries a .dev.vars" >&2; return 1; }
  (cd "$dir" && CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$pgurl" \
     exec setsid pnpm exec wrangler dev --config "$config" --ip 127.0.0.1 --port "$port" \
     --name "$repo-$app-stage" --show-interactive-dev-session=false "$@") > "$scratch/dev-$app.log" 2>&1 < /dev/null &
  pid=$!
  dev_pids+=("$pid")
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "http://127.0.0.1:$port/favicon.ico" && return 0
    kill -0 "$pid" 2>/dev/null || { echo "FAIL: wrangler dev for $app exited" >&2; tail -30 "$scratch/dev-$app.log" >&2; return 1; }
    sleep 1
  done
  echo "FAIL: wrangler dev for $app never answered" >&2; tail -30 "$scratch/dev-$app.log" >&2; return 1
}
smoke() { # APP URL — the component's own smokeCommand, verbatim
  local cmd
  cmd="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/$1/component.yaml")"
  echo "   ▸ $1's own smokeCommand, DEPLOYED_URL=$2"
  DEPLOYED_URL="$2" bash -c "$cmd" || { echo "FAIL: the $1 deploy's smoke refused the product" >&2; tail -20 "$scratch/dev-$1.log" >&2; return 1; }
}

echo "── wrangler dev over the three built Workers: Hyperdrive on the local Postgres, R2 and KV local"
# The app's config, less the AI binding (the one stand-in; the header says why).
appdir="$prtree/.orun/runs/e2e/app.stage.verify-deploy/work/apps/app"
python3 - "$appdir/wrangler.jsonc" "$appdir/wrangler.e2e.jsonc" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
out, n = re.subn(r',\s*(//[^\n]*\n\s*)*"ai":\s*\{[^}]*\}', "", text)
if n != 1:
    sys.exit("FAIL: the app's wrangler.jsonc binds no AI, or binds it twice — the stand-in no longer fits")
open(sys.argv[2], "w").write(out)
PY
app_port="$(free_port)"; api_port_w="$(free_port)"; web_port="$(free_port)"
serve app "$app_port" wrangler.e2e.jsonc
serve api "$api_port_w" wrangler.jsonc --test-scheduled
serve web "$web_port" wrangler.jsonc
app_url="http://127.0.0.1:$app_port"; api_url="http://127.0.0.1:$api_port_w"; web_url="http://127.0.0.1:$web_port"

# Two rows, written as the app's own role — what a product's users would
# have created — for the dashboard, search and health to read back.
psql "$pgurl" -X -q -v ON_ERROR_STOP=1 -c "INSERT INTO \"Page\" (name) VALUES ('Quarterly plan'), ('Launch notes')"

smoke app "$app_url"
smoke api "$api_url"
smoke web "$web_url"

echo "   ▸ every route the product promises"
python3 - "$app_url" "$api_url" "$web_url" "$values" "$pgurl" <<'PY' || { echo "FAIL: the routes; wrangler dev said:" >&2; tail -n 25 "$scratch"/dev-*.log >&2; exit 1; }
import html, http.client, json, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
app, api, web, values, pgurl = sys.argv[1], sys.argv[2], sys.argv[3], json.load(open(sys.argv[4])), sys.argv[5]
name, repo, sub = values["productname"], values["reponame"], values["subdomain"]
problems = []
def bad(m): problems.append(m)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)
def req(base, path, data=None, headers=None, method=None, follow=False):
    # A GET whose CONNECTION drops (not one that answers an error) is asked
    # again, twice at most, and says so: `wrangler dev` on a loaded machine
    # has dropped one. A POST is never repeated.
    for attempt in range(3):
        r = urllib.request.Request(base + path, data=data, headers=headers or {}, method=method)
        try:
            with (urllib.request.urlopen if follow else opener.open)(r, timeout=90) as resp:
                return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode()
        except (http.client.RemoteDisconnected, ConnectionResetError) as e:
            if data is not None or attempt == 2:
                raise
            print(f"   (GET {path}: the connection dropped ({e.__class__.__name__}) — asking again)")
            time.sleep(1)
def sql(q):
    return subprocess.run(["psql", pgurl, "-XAtc", q], capture_output=True, text=True, check=True).stdout.strip()
def title_of(page):
    m = re.search(r"<title>(.*?)</title>", page, re.S)
    return html.unescape(m.group(1)) if m else None
origin = lambda a: f"https://{repo}-{a}-stage.{sub}.workers.dev"

# ── the app: the dashboard, as the sample user, over the database ─────────
s, _, body = req(app, "/api/health")
if s != 200 or json.loads(body) != {"ok": True, "pages": 2}:
    bad(f"app /api/health answered {s} {body[:80]} — not the two rows in the database")
s, _, dash = req(app, "/")
if s != 200:
    bad(f"app / answered {s} — without Clerk the dashboard serves the sample user")
else:
    if 'data-pages="2"' not in dash or "Quarterly plan" not in dash or "Launch notes" not in dash:
        bad("the dashboard does not list the database's two pages")
    if title_of(dash) is None or name not in title_of(dash):
        bad(f"the dashboard's <title> is {title_of(dash)!r}, without {name!r}")
s, _, found = req(app, "/search?q=" + urllib.parse.quote("Launch"))
if s != 200 or "Launch notes" not in found or "Quarterly plan" in found:
    bad(f"search for 'Launch' answered {s} without exactly the matching page")
s, _, found = req(app, "/search?q=" + urllib.parse.quote("50%_off"))
if s != 200 or "Launch notes" in found or "Quarterly plan" in found:
    bad("search treats % and _ as wildcards — the LIKE pattern is not escaped")
for path, marker in (("/sign-in", 'data-auth="not-connected"'), ("/sign-up", 'data-auth="not-connected"'),
                     ("/webhooks", 'data-webhooks="not-connected"')):
    s, _, page = req(app, path)
    if s != 200 or marker not in page:
        bad(f"app {path} answered {s} without saying which service is not connected ({marker})")
s, _, _ = req(app, "/no-such-page")
if s != 404:
    bad(f"app /no-such-page answered {s}, not 404")

# ── the API: health, the keep-alive, the webhooks, the Cron Trigger ───────
seq = lambda: int(sql("SELECT last_value FROM \"Page_id_seq\""))
before = seq()
s, _, body = req(api, "/cron/keep-alive")
if s != 200 or body != "OK" or seq() <= before or sql('SELECT count(*) FROM "Page"') != "2":
    bad(f"api /cron/keep-alive answered {s} {body!r} without writing and removing a row through Hyperdrive")
for path in ("/webhooks/payments", "/webhooks/auth"):
    s, _, body = req(api, path, b"{}", {"content-type": "application/json"}, "POST")
    if s != 200 or json.loads(body) != {"message": "Not configured", "ok": False}:
        bad(f"api {path} without its key answered {s} {body[:80]}, not 'Not configured'")
before = seq()
s, _, body = req(api, "/__scheduled?cron=" + urllib.parse.quote("0 0 * * *"))
for _ in range(20):
    if seq() > before:
        break
    time.sleep(0.5)
if s != 200 or seq() <= before or sql('SELECT count(*) FROM "Page"') != "2":
    bad(f"the API's Cron Trigger (0 0 * * *) answered {s} and did not run the keep-alive through Hyperdrive")

# ── the marketing site, under the product's name ──────────────────────────
s, _, home = req(web, "/", follow=True)
if s != 200:
    bad(f"web / answered {s}")
else:
    if name not in html.unescape(home):
        bad(f"the home page does not carry the product's name {name!r}")
    if "Acme Inc" in home:
        bad("the home page still carries the baseline's name")
    if origin("app") not in home:
        bad(f"the home page does not link the product's own app ({origin('app')})")
s, _, de = req(web, "/", headers={"accept-language": "de"}, follow=True)
if s != 200 or "Lesen Sie unseren neuesten Artikel" not in html.unescape(de):
    bad(f"web / in German answered {s} without the German dictionary")
for path in ("/pricing", "/contact", "/legal/privacy", "/legal/terms"):
    s, _, page = req(web, path, follow=True)
    if s != 200 or name not in html.unescape(page):
        bad(f"web {path} answered {s} without the product's name")
s, _, blog = req(web, "/blog", follow=True)
if s != 200 or 'data-cms="sample"' not in blog or "/blog/welcome" not in blog:
    bad(f"web /blog answered {s} without the sample posts and their notice")
s, _, post = req(web, "/blog/on-cloudflare", follow=True)
if s != 200 or 'data-cms="sample"' not in post:
    bad(f"web /blog/on-cloudflare answered {s} without the sample post")
s, _, body = req(web, "/api/health")
if s != 200 or json.loads(body) != {"ok": True}:
    bad(f"web /api/health answered {s} {body[:80]} — the RATE_LIMIT namespace is not bound")
s, _, sitemap = req(web, "/sitemap.xml", follow=True)
if s != 200 or origin("web") not in sitemap:
    bad(f"web /sitemap.xml answered {s} without the site's own origin {origin('web')}")
s, _, _ = req(web, "/no-such-page", follow=True)
if s != 404:
    bad(f"web /no-such-page answered {s}, not 404")

if problems:
    for p in problems:
        print(f"  ✕ {p}", file=sys.stderr)
    sys.exit(1)
print(f"   app: the dashboard as the sample user over 2 rows, search (escaped), sign-in, sign-up and "
      f"webhooks saying what is not connected, a 404")
print(f"   api: health, the keep-alive and its Cron Trigger through Hyperdrive, both webhooks 'Not configured'")
print(f"   web: / as {name!r} in English and German, pricing, contact, legal, the sample blog, "
      f"health over KV, the sitemap on its own origin, a 404")
PY

# ── 6. what Supabase's Data API would see ──────────────────────────────────
echo "── the Data API's roles (anon, authenticated) against the same database"
psql "$pgurl" -X -q -v ON_ERROR_STOP=1 -At > "$scratch/rls.out" 2> "$scratch/rls.err" <<'SQL' \
  || { echo "FAIL: the row-level security checks" >&2; cat "$scratch/rls.err" >&2; exit 1; }
SELECT 'app role: superuser=' || rolsuper || ' bypassrls=' || rolbypassrls FROM pg_roles WHERE rolname = current_user;
SELECT 'public tables without RLS: ' || count(*) FILTER (WHERE NOT c.relrowsecurity) || ' of ' || count(*)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');
SELECT 'not owned by the app: ' || count(*) FILTER (WHERE pg_get_userbyid(c.relowner) <> current_user)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');
SELECT 'app sees pages: ' || count(*) FROM "Page";
SET ROLE anon;
SELECT 'anon sees pages: ' || count(*) FROM "Page";
RESET ROLE;
SET ROLE authenticated;
SELECT 'authenticated sees pages: ' || count(*) FROM "Page";
RESET ROLE;
SQL
sed 's/^/   /' "$scratch/rls.out"
grep -qx "app role: superuser=false bypassrls=false" "$scratch/rls.out" \
  && grep -qE "^public tables without RLS: 0 of [1-9][0-9]*$" "$scratch/rls.out" \
  && grep -qx "not owned by the app: 0" "$scratch/rls.out" \
  || { echo "FAIL: the app's role, the tables' owner or their row-level security is not what Supabase's would be" >&2; exit 1; }
grep -qx "app sees pages: 2" "$scratch/rls.out" || { echo "FAIL: the app does not see its two rows" >&2; exit 1; }
for line in "anon sees pages: 0" "authenticated sees pages: 0"; do
  grep -qx "$line" "$scratch/rls.out" || { echo "FAIL: expected '$line'" >&2; exit 1; }
done
# A write through the Data API's role is refused by row-level security.
for role in anon authenticated; do
  if psql "$pgurl" -X -q -At -c "SET ROLE $role; INSERT INTO \"Page\" (name) VALUES ('$role')" > "$scratch/rls-write.log" 2>&1; then
    echo "FAIL: $role wrote a page through row-level security" >&2; exit 1
  fi
  grep -q "row-level security" "$scratch/rls-write.log" \
    || { echo "FAIL: $role's write was refused for another reason:" >&2; cat "$scratch/rls-write.log" >&2; exit 1; }
done
echo "   anon and authenticated, granted what Supabase grants them, read the app's 2 rows as 0 and write none"

echo "e2e.test.sh: ok"
