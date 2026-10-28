# db-migrate

Applies database migrations to stage and prod Supabase instances

Applies this repository's ordered database migrations per environment: plan on pull requests, apply on merge to `main`.

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| Type         | `db-migrate`                                                                               |
| Source       | `infra/db-migrate`                                                                         |
| Environments | `stage`: `plan`, `apply` on a push to `main` · `prod`: `plan`, `apply` on a push to `main` |

## Depends on

- **db** — The database migrations and their runner (built by the db-migrate component before it plans or applies)
- **supabase** — Provisions Supabase projects for stage and prod and wires credentials into orun secrets
- **cloudflare-hyperdrive** — Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases

## Depended on by

- **api** — The API — Stripe and Clerk webhooks, health, and the daily keep-alive on a Cron Trigger (Next.js route handlers on Cloudflare Workers via @opennextjs/cloudflare, per environment)
- **app** — The product — the Clerk-authenticated dashboard, its database page, search, webhooks portal, collaboration and notifications (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment)
