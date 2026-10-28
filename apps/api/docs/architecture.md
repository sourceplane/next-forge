# api — architecture

Built by the turbo pipeline from `apps/api` and deployed with wrangler.

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| Worker config       | `apps/api/wrangler.template.jsonc`              |
| Entry               | `worker.ts`                                     |
| Compatibility date  | `2026-10-01`                                    |
| Compatibility flags | `nodejs_compat`, `global_fetch_strictly_public` |

## Bindings

| Binding      | Kind                         | Source                                       |
| ------------ | ---------------------------- | -------------------------------------------- |
| `HYPERDRIVE` | Hyperdrive (pooled Postgres) | `hyperdrive_id` from `cloudflare-hyperdrive` |
| `ASSETS`     | Static assets                | `.open-next/assets`                          |

Identifiers marked _from_ a component are filled in at deploy time from
that component's published outputs for the environment being deployed.

## Scheduled triggers

- `0 0 * * *`

## Wiring

Resolved at deploy time from secrets the infrastructure lanes publish (names only):

- `WIRING_CLOUDFLARE_HYPERDRIVE_PROD`
- `WIRING_CLOUDFLARE_HYPERDRIVE_STAGE`

## Secrets resolved by the lane (names only)

- `BETTERSTACK_API_KEY` (optional)
- `BETTERSTACK_URL` (optional)
- `CLERK_SECRET_KEY` (optional)
- `CLERK_WEBHOOK_SECRET` (optional)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (optional)
- `NEXT_PUBLIC_POSTHOG_HOST` (optional)
- `NEXT_PUBLIC_POSTHOG_KEY` (optional)
- `NEXT_PUBLIC_SENTRY_DSN` (optional)
- `STRIPE_SECRET_KEY` (optional)
- `STRIPE_WEBHOOK_SECRET` (optional)
