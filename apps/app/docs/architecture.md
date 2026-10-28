# app — architecture

Built by the turbo pipeline from `apps/app` and deployed with wrangler.

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| Worker config       | `apps/app/wrangler.template.jsonc`              |
| Entry               | `.open-next/worker.js`                          |
| Compatibility date  | `2026-10-01`                                    |
| Compatibility flags | `nodejs_compat`, `global_fetch_strictly_public` |

## Bindings

| Binding      | Kind                         | Source                                       |
| ------------ | ---------------------------- | -------------------------------------------- |
| `STORAGE`    | R2 bucket                    | `r2_bucket_name` from `cloudflare-r2`        |
| `HYPERDRIVE` | Hyperdrive (pooled Postgres) | `hyperdrive_id` from `cloudflare-hyperdrive` |
| `AI`         | Workers AI                   | account-level; no resource to provision      |
| `ASSETS`     | Static assets                | `.open-next/assets`                          |

Identifiers marked _from_ a component are filled in at deploy time from
that component's published outputs for the environment being deployed.

## Wiring

Resolved at deploy time from secrets the infrastructure lanes publish (names only):

- `WIRING_CLOUDFLARE_HYPERDRIVE_PROD`
- `WIRING_CLOUDFLARE_HYPERDRIVE_STAGE`
- `WIRING_CLOUDFLARE_R2_PROD`
- `WIRING_CLOUDFLARE_R2_STAGE`

## Secrets resolved by the lane (names only)

- `BETTERSTACK_API_KEY` (optional)
- `BETTERSTACK_URL` (optional)
- `CLERK_SECRET_KEY` (optional)
- `FLAGS_SECRET` (optional)
- `KNOCK_SECRET_API_KEY` (optional)
- `LIVEBLOCKS_SECRET` (optional)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (optional)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_KNOCK_API_KEY` (optional)
- `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID` (optional)
- `NEXT_PUBLIC_POSTHOG_HOST` (optional)
- `NEXT_PUBLIC_POSTHOG_KEY` (optional)
- `NEXT_PUBLIC_SENTRY_DSN` (optional)
- `OPENAI_API_KEY` (optional)
- `RESEND_FROM` (optional)
- `RESEND_TOKEN` (optional)
- `SVIX_TOKEN` (optional)
