#!/usr/bin/env bash
# THE REBRAND WRITES EACH VALUE ONCE, AND WHAT IT WROTE STAYS WRITTEN.
#
# Drives the real tooling/rebrand/rebrand.mjs over one-file trees and compares
# the file. Each case is a shape this baseline's identity actually takes in the
# tree — the name seam, the worker name, the Worker's own origin, the
# placeholder domain, a secret ref, the `repo` the Supabase project is named
# after — and each runs through as many passes as a bootstrap might make, so a
# value written once must survive every later pass unchanged. Three things
# must NOT be renamed although they spell the slug: the upstream template's
# own mentions (its GitHub repository, next-forge.com, "Vercel's next-forge" —
# its name is this baseline's slug), a migration (its checksum is in the
# manifest and in every database it was applied to), and upstream's licence.
#
# The identity is PINNED (fixtures/baseline-identity.next-forge.json) rather
# than read from .baseline/identity.json: what this tests is the engine, and
# its fixtures spell the identity out literally.
#
# Needs: node, git. No network.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rebrand="$here/../tooling/rebrand/rebrand.mjs"
identity="$here/fixtures/baseline-identity.next-forge.json"

fail=0
# check NAME VALUES-JSON FILE CONTENT WANT [PASSES]
check() {
  local name="$1" values="$2" file="$3" content="$4" want="$5" passes="${6:-1}"
  local tmp got out i
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  for ((i = 1; i <= passes; i++)); do
    git -C "$tmp" add -A
    if ! out="$(cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty 2>&1)"; then
      echo "   ✕  $name: rebrand pass $i failed:" >&2
      printf '%s\n' "$out" | sed 's/^/        /' >&2
      fail=1
      rm -rf "$tmp"
      return
    fi
  done
  got="$(cat "$tmp/$file")"
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then
    echo "   ok  $name"
  else
    echo "   ✕  $name:" >&2
    echo "        got:  $got" >&2
    echo "        want: $want" >&2
    fail=1
  fi
}

acme='{"reponame":"acme-forge","productname":"Acme Cloud","productdomain":"acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'

echo "── rebrand: the product's own identity"
check "the name seam takes the product's name" \
  "$acme" packages/seo/site.ts 'export const SITE_NAME = "Acme Inc";' \
  'export const SITE_NAME = "Acme Cloud";'
check "…and stays a valid string for a name with an apostrophe and an ampersand" \
  '{"reponame":"sams-seats","productname":"Sam'"'"'s Seats & Billing","productdomain":"sam.dev"}' \
  packages/seo/site.ts 'export const SITE_NAME = "Acme Inc";' \
  'export const SITE_NAME = "Sam'"'"'s Seats & Billing";'
check "the display name elsewhere is content, and is left alone" \
  "$acme" apps/web/app/x.tsx '<p>Welcome to Acme Inc.</p>' \
  '<p>Welcome to Acme Inc.</p>'
check "the worker name is re-prefixed, the environment suffix kept" \
  "$acme" apps/web/component.yaml 'workerName: next-forge-web' \
  'workerName: acme-forge-web'
check "the Workers' origins (how the three link each other): worker name and subdomain" \
  "$acme" apps/app/.env.production \
  'NEXT_PUBLIC_API_URL=https://next-forge-api-stage.your-workers-subdomain.workers.dev' \
  'NEXT_PUBLIC_API_URL=https://acme-forge-api-stage.acme.workers.dev'
check "…and the build's own fallback for them" \
  "$acme" apps/web/component.yaml \
  'NEXT_PUBLIC_APP_URL="${APP_URL:-https://next-forge-app-${ORUN_ENVIRONMENT}.your-workers-subdomain.workers.dev}"' \
  'NEXT_PUBLIC_APP_URL="${APP_URL:-https://acme-forge-app-${ORUN_ENVIRONMENT}.acme.workers.dev}"'
check "the placeholder domain is the product's domain, not a renamed slug" \
  "$acme" intent.yaml '      BASE_DOMAIN: next-forge.example.com' \
  '      BASE_DOMAIN: acme.dev'
check "no domain given: the reserved placeholder, for an owner to replace later" \
  '{"reponame":"acme-forge","productname":"Acme Cloud","githuborg":"acme-inc","subdomain":"acme"}' \
  intent.yaml '      BASE_DOMAIN: next-forge.example.com' \
  '      BASE_DOMAIN: acme-forge.example.com'
check "an empty domain is no domain" \
  '{"reponame":"acme-forge","productname":"Acme Cloud","productdomain":""}' \
  intent.yaml '      BASE_DOMAIN: next-forge.example.com' \
  '      BASE_DOMAIN: acme-forge.example.com'
check "the repo slug" \
  "$acme" package.json '  "name": "next-forge",' \
  '  "name": "acme-forge",'
check "the repo Terraform names the Supabase project, the config, the bucket and the namespace after" \
  "$acme" intent.yaml '        repo: next-forge' \
  '        repo: acme-forge'
check "the fixture's Hyperdrive name follows it" \
  "$acme" apps/app/wiring.fixture.json '    "hyperdrive_name": "stg-next-forge-stage"' \
  '    "hyperdrive_name": "stg-acme-forge-stage"'
check "…and its bucket name" \
  "$acme" apps/app/wiring.fixture.json '  "cloudflare-r2/stage": { "r2_bucket_name": "stg-next-forge-stage" },' \
  '  "cloudflare-r2/stage": { "r2_bucket_name": "stg-acme-forge-stage" },'
check "a secret ref names the product's workspace and project" \
  "$acme" infra/db-migrate/component.yaml \
  '    SUPABASE_ACCESS_TOKEN: "secret://next-forge/next-forge/{{ .environment }}/SUPABASE_ACCESS_TOKEN"' \
  '    SUPABASE_ACCESS_TOKEN: "secret://ws_79BDXAZQ/acme-forge/{{ .environment }}/SUPABASE_ACCESS_TOKEN"'
check "this repository's source link names the product's owner and repository" \
  "$acme" README.md 'See https://github.com/sourceplane/next-forge.' \
  'See https://github.com/acme-inc/acme-forge.'
check "the product's own name in prose is the product's" \
  "$acme" README.md '# next-forge' \
  '# acme-forge'
check "org-owned identity is not renamed" \
  "$acme" intent.yaml 'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai' \
  'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai'

echo "── rebrand: what spells the slug and is not this baseline's"
check "the upstream template's repository is upstream's" \
  "$acme" apps/web/eslint.config.mjs '// Vercel'"'"'s next-forge (https://github.com/vercel/next-forge) lints with Biome.' \
  '// Vercel'"'"'s next-forge (https://github.com/vercel/next-forge) lints with Biome.'
check "…and so is its website" \
  "$acme" packages/cms/sample.ts 'const docs = "https://www.next-forge.com/docs";' \
  'const docs = "https://www.next-forge.com/docs";'
check "…and its name, as a link's text" \
  "$acme" README.md 'Vercel'"'"'s [next-forge](https://github.com/vercel/next-forge) — on Cloudflare' \
  'Vercel'"'"'s [next-forge](https://github.com/vercel/next-forge) — on Cloudflare'
check "…while this product's Worker on the same line is the product's" \
  "$acme" README.md 'Vercel'"'"'s next-forge, deployed as next-forge-web-prod.' \
  'Vercel'"'"'s next-forge, deployed as acme-forge-web-prod.'
check "a migration is never rewritten (its checksum is in the manifest)" \
  "$acme" packages/db/src/migrations/020_x/up.sql '-- next-forge: a comment the checksum covers' \
  '-- next-forge: a comment the checksum covers'
check "nor is upstream's licence" \
  "$acme" LICENSE 'Copyright (c) 2025 Vercel — next-forge' \
  'Copyright (c) 2025 Vercel — next-forge'

echo "── rebrand: a written value is not rewritten, in any later pass"
contains='{"reponame":"next-forge-2","productname":"Acme Inc 2","productdomain":"next-forge.example.com.au","githuborg":"sourceplane","subdomain":"your-workers-subdomain-2"}'
check "a repo slug containing the baseline's slug survives three passes" \
  "$contains" package.json '  "name": "next-forge",' \
  '  "name": "next-forge-2",' 3
check "a worker name built on it survives three passes" \
  "$contains" apps/web/component.yaml 'workerName: next-forge-web' \
  'workerName: next-forge-2-web' 3
check "a domain containing the baseline's domain survives three passes" \
  "$contains" intent.yaml 'BASE_DOMAIN: next-forge.example.com' \
  'BASE_DOMAIN: next-forge.example.com.au' 3
check "a subdomain containing the placeholder survives three passes" \
  "$contains" apps/web/component.yaml 'workersDevSubdomain: your-workers-subdomain' \
  'workersDevSubdomain: your-workers-subdomain-2' 3
check "a name containing the baseline's name survives three passes" \
  "$contains" packages/seo/site.ts 'export const SITE_NAME = "Acme Inc";' \
  'export const SITE_NAME = "Acme Inc 2";' 3

# --verify runs after every rebrand. Without the product's values it cannot
# tell the product's own identity from a leftover; with them it can. A real
# leftover must fail it either way.
verify() { # NAME VALUES FILE CONTENT WANT(pass|fail) [--values]
  local name="$1" values="$2" file="$3" content="$4" want="$5" withvalues="${6:-}" tmp got
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  git -C "$tmp" add -A
  if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --verify ${withvalues:+--values .rebrand/values.json} >/dev/null 2>&1); then got=pass; else got=fail; fi
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else echo "   ✕  $name: --verify ${got}ed, want $want" >&2; fail=1; fi
}
echo "── rebrand --verify: the product's own identity is not residue"
verify "given the values, a slug containing the baseline's passes" \
  "$contains" package.json '"name": "next-forge-2"' pass --values
verify "without them it cannot know, and fails" \
  "$contains" package.json '"name": "next-forge-2"' fail
verify "given the values, a real leftover still fails" \
  "$acme" package.json '"name": "next-forge"' fail --values
verify "a leftover worker name fails" \
  "$acme" apps/web/component.yaml 'workerName: next-forge-web' fail --values
verify "a leftover code identifier fails (no rule renames it — so nothing may spell it)" \
  "$acme" apps/web/app/x.ts 'export class NextForge {}' fail --values
verify "the upstream template's mentions are not residue" \
  "$acme" packages/auth/connected.ts "// Vercel's next-forge signs in with Clerk: https://github.com/vercel/next-forge, https://www.next-forge.com" pass --values
verify "a clean product passes" \
  "$acme" package.json '"name": "acme-forge"' pass --values

echo "── rebrand: a residue it cannot rename fails the rebrand itself"
tmp="$(mktemp -d)"; git -C "$tmp" init -q; mkdir -p "$tmp/.rebrand" "$tmp/apps/web"
printf '%s\n' "$acme" > "$tmp/.rebrand/values.json"
printf 'const x = "NEXT_FORGE_TOKEN"\n' > "$tmp/apps/web/x.ts"
git -C "$tmp" add -A
if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty >/dev/null 2>&1); then
  echo "   ✕  an unrenamable env-var prefix passed the rebrand" >&2; fail=1
else
  echo "   ok  an unrenamable env-var prefix fails the rebrand, naming the file"
fi
rm -rf "$tmp"

[ "$fail" -eq 0 ] || exit 1
echo "rebrand.test.sh: ok"
