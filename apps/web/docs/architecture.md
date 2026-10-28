# web — architecture

Built by the turbo pipeline from `apps/web` and deployed with wrangler.

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| Worker config       | `apps/web/wrangler.template.jsonc`              |
| Entry               | `.open-next/worker.js`                          |
| Compatibility date  | `2026-10-01`                                    |
| Compatibility flags | `nodejs_compat`, `global_fetch_strictly_public` |

## Bindings

| Binding      | Kind                 | Source                           |
| ------------ | -------------------- | -------------------------------- |
| `RATE_LIMIT` | Workers KV namespace | `app_kv_id` from `cloudflare-kv` |
| `ASSETS`     | Static assets        | `.open-next/assets`              |

Identifiers marked _from_ a component are filled in at deploy time from
that component's published outputs for the environment being deployed.

## Wiring

Resolved at deploy time from secrets the infrastructure lanes publish (names only):

- `WIRING_CLOUDFLARE_KV_PROD`
- `WIRING_CLOUDFLARE_KV_STAGE`

## Secrets resolved by the lane (names only)

- `BASEHUB_TOKEN` (optional)
- `BETTERSTACK_API_KEY` (optional)
- `BETTERSTACK_URL` (optional)
- `CLERK_SECRET_KEY` (optional)
- `FLAGS_SECRET` (optional)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (optional)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_POSTHOG_HOST` (optional)
- `NEXT_PUBLIC_POSTHOG_KEY` (optional)
- `NEXT_PUBLIC_SENTRY_DSN` (optional)
- `RESEND_FROM` (optional)
- `RESEND_TOKEN` (optional)
