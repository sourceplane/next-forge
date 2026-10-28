#!/usr/bin/env bash
# Render the product's LIVE-DEPLOYMENT documentation from verified state.
# Called by phase 02-docs as a `run:` hook (and safe to run by hand, from the
# product's checkout). Idempotent: the generated file and the README section
# are fully re-rendered on every run, so re-running after a redeploy, a custom
# domain or connecting a service refreshes them.
#
#   hooks/render-deployment-docs.sh <out> <workspace> <baseline-dir>
#
# What it writes (in <out>):
#   ai/context/deployment.md   — REGENERATED: URLs with live probe results
#                                (the three Workers and their health checks,
#                                whether Clerk and BaseHub are connected yet),
#                                identity, and the secrets the deployment uses
#                                BY NAME
#   ai/context/operations.md   — healed from the baseline's copy if absent
#                                (the static operating contract; never rewritten)
#   README.md                  — the section between <!-- 02-docs:begin/end -->
#                                is replaced (appended after the title if the
#                                README predates the markers)
#
# No secret VALUE is ever read or written here — secrets are named, not read.
#
# IT ASKS THE PLATFORM NOTHING. The record used to carry the workspace's slug,
# its secrets listed per rung and its integrations — five CLI calls, one after
# another, from the build box — and all of it is what the console shows live
# and this file could only show as it was the day it was written. The record
# keeps what the repository is the right place for: the identity the code
# names, what answered at the URLs, and where to look for the rest.
set -euo pipefail

out="${1:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"
ws="${2:-}"
L="${3:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"

cd "$out"
vals=".rebrand/values.json"
[ -f "$vals" ] || { echo "render-docs: $vals missing — is this a bootstrapped product?" >&2; exit 1; }
val() { python3 -c "import json,sys;print(json.load(open('$vals')).get(sys.argv[1],'') or '')" "$1"; }

repo="$(val reponame)"
brand="$(val brandSlug)"; [ -n "$brand" ] || brand="$repo"
sub="$(val subdomain)"; [ -n "$sub" ] || sub="your-workers-subdomain"
[ -n "$ws" ] || ws="$(sed -n 's/^[[:space:]]*workspace:[[:space:]]*\([^[:space:]#]*\).*/\1/p' intent.yaml | head -1)"
[ -n "$ws" ] || ws="?"

# CI lane pin (what version the deploy lanes run).
lanepin="$(sed -n 's/^ *version: *\(v[0-9.]*\) *$/\1/p' .github/workflows/ci.yml 2>/dev/null | head -1)"
[ -n "$lanepin" ] || lanepin="?"

# curl emits the -w format even on connection failure (000) — capture, don't
# append, or a failed probe reads "000000".
probe() { local c; c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null)" || true; printf '%s' "${c:-000}"; }
badge() { case "$1" in 2*|3*) echo "LIVE ($1)" ;; 000) echo "unreachable" ;; *) echo "answering $1" ;; esac; }

url_of() { echo "https://${brand}-$1-$2.${sub}.workers.dev"; }

# Whether a service is connected yet, read from a page that only says so
# while it is not: the app's sign-in page carries data-auth="not-connected"
# until the environment has Clerk's keys, the blog data-cms="sample" until it
# has a BaseHub token (the README's "Connecting a service"). Read only from a
# page that answered 200: anything else says nothing about the service.
service_state() { # URL MARKER WHAT
  local page code
  page="$(mktemp)"
  code="$(curl -s -o "$page" -w '%{http_code}' --max-time 20 "$1" 2>/dev/null)" || true
  code="${code:-000}"
  if [ "$code" != 200 ]; then echo "unknown ($(badge "$code"))"
  elif grep -q "$2" "$page"; then echo "not connected — $3; see README, Connecting a service"
  else echo "connected"; fi
  rm -f "$page"
}

rows=""
services=""
for env in stage prod; do
  web="$(url_of web "$env")"; app="$(url_of app "$env")"; api="$(url_of api "$env")"
  rows+="| marketing site (${env}) | ${web} | $(badge "$(probe "$web/")") |"$'\n'
  rows+="| site health: KV (${env}) | ${web}/api/health | $(badge "$(probe "$web/api/health")") |"$'\n'
  rows+="| app (${env}) | ${app} | $(badge "$(probe "$app/sign-in")") |"$'\n'
  rows+="| app health: database (${env}) | ${app}/api/health | $(badge "$(probe "$app/api/health")") |"$'\n'
  rows+="| API health (${env}) | ${api}/health | $(badge "$(probe "$api/health")") |"$'\n'
  services+="| ${env} | $(service_state "$app/sign-in" 'data-auth="not-connected"' "the app runs as a sample user") | $(service_state "$web/blog" 'data-cms="sample"' "the blog shows sample posts") |"$'\n'
done

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Heal the static operating contract when the product predates it.
mkdir -p ai/context
if [ ! -f ai/context/operations.md ] && [ -f "$L/ai/context/operations.md" ]; then
  cp "$L/ai/context/operations.md" ai/context/operations.md
  git add ai/context/operations.md 2>/dev/null || true
  node "$L/tooling/rebrand/rebrand.mjs" --values "$vals" --allow-dirty >/dev/null 2>&1 || true
  echo "render-docs: healed ai/context/operations.md"
fi

cat > ai/context/deployment.md <<EOF
# ${repo} — live deployment manifest

> GENERATED by the \`02-docs\` phase on ${now}; re-run it to refresh
> (idempotent; see [operations.md](operations.md)). Hand-edits here are
> overwritten. No secret values appear in this file — secrets are named only.

## Identity

| | |
|---|---|
| repository / project slug | \`${repo}\` |
| Orun workspace | \`${ws}\` |
| declared in | \`intent.yaml\` → \`execution.state.workspace\` |
| Workers | \`${brand}-{app,web,api}-stage\`, \`${brand}-{app,web,api}-prod\` on \`${sub}.workers.dev\` |
| CI lane CLI pin | orun \`${lanepin}\` (\`.github/workflows/ci.yml\`) |

## Public URLs (probed ${now})

| surface | URL | status |
|---|---|---|
${rows}
The app's \`/api/health\` answers 200 only when its Worker reaches the
Supabase database through Hyperdrive and the migrations are applied; the
site's, only when its KV namespace is bound. The \`dev\` environment is
verify-only by design — no deployed URL.

## Services

| environment | Clerk (sign-in) | BaseHub (blog) |
|---|---|---|
${services}
Every SaaS the template wires is optional and none is a provider the
platform brokers: its keys are this repository's Orun secrets, stored by the
owner per environment and handed to the Workers on their next deploy
(README, "Connecting a service"). Without them every page still serves.

## Secrets (names only)

| secret | where | what it is |
|---|---|---|
| \`CLOUDFLARE_API_TOKEN\` | the workspace | BROKERED from its Cloudflare connection (\`workers-deploy\`): deploys the three Workers and applies the KV namespace |
| \`CLOUDFLARE_HYPERDRIVE_TOKEN\` | the workspace | BROKERED (\`hyperdrive-edit\`): applies the Hyperdrive config — the deploy token cannot touch Hyperdrive |
| \`CLOUDFLARE_R2_TOKEN\` | the workspace | BROKERED (\`r2-data\`): applies the R2 bucket — the deploy token cannot touch R2 |
| \`CLOUDFLARE_ACCOUNT_ID\` | the workspace | the Cloudflare connection's account id — a fact, not a credential |
| \`SUPABASE_ACCESS_TOKEN\` | the workspace | BROKERED from its Supabase connection (\`management-access\`): creates the project and runs the migrations |
| \`SUPABASE_ORG_ID\` | the workspace | the Supabase connection's organization id — a fact, not a credential |
| \`SUPABASE_PROJECT_REF\`, \`SUPABASE_DB_PASSWORD\`, \`SUPABASE_DB_URL\` | \`${repo}\` on stage and on prod | written by the Supabase root's apply: the project's ref, its database password and its connection URL, read by Hyperdrive and the migrations |
| \`WIRING_CLOUDFLARE_HYPERDRIVE\`, \`WIRING_CLOUDFLARE_R2\`, \`WIRING_CLOUDFLARE_KV\` | \`${repo}\` on stage and on prod | written by the Hyperdrive, R2 and KV roots' applies: the config's id, the bucket's name, the namespace's id — not credentials |
| \`CLERK_SECRET_KEY\`, \`STRIPE_SECRET_KEY\`, \`BASEHUB_TOKEN\`, … | \`${repo}\`, per environment, when the owner stores them | the SaaS keys (README, "Connecting a service"): optional, handed to the Workers as Worker secrets on deploy |

Brokered secrets are minted per run, so no long-lived value is at rest.
The SaaS keys are the product's own, not brokered (above). What the
workspace holds right now (every secret by name, and its integrations and
their health) is on the console's Secrets and Integrations pages for
\`${ws}\`.

## How this deployment changes

Merges to \`main\` converge automatically: CI plans the changed components and
runs each lane with \`orun run --remote-state\` against the workspace above.
See [operations.md](operations.md) for the full operating contract.
EOF
echo "render-docs: wrote ai/context/deployment.md"

python3 - <<'PY'
import re
begin, end = "<!-- 02-docs:begin -->", "<!-- 02-docs:end -->"
body = f"""{begin}
This product is **live**. Verified URLs, identity, which services are connected
and the secrets it uses are recorded in
[ai/context/deployment.md](ai/context/deployment.md) (re-rendered by the
`02-docs` phase); how it deploys and how to operate it:
[ai/context/operations.md](ai/context/operations.md).
{end}"""
s = open("README.md").read()
if begin in s and end in s:
    s = re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _m: body, s, count=1, flags=re.S)
else:
    lines = s.splitlines(keepends=True)
    at = 1
    while at < len(lines) and lines[at].strip() == "":
        at += 1
    lines.insert(at, f"\n## Live deployment\n\n{body}\n")
    s = "".join(lines)
open("README.md", "w").write(s)
print("render-docs: README live-deployment section rendered")
PY
echo "render-docs: done"
