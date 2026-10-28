# cloudflare-hyperdrive

Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-hyperdrive`                                                              |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- **supabase** — Provisions Supabase projects for stage and prod and wires credentials into orun secrets

## Depended on by

- **api** — The API — Stripe and Clerk webhooks, health, and the daily keep-alive on a Cron Trigger (Next.js route handlers on Cloudflare Workers via @opennextjs/cloudflare, per environment)
- **app** — The product — the Clerk-authenticated dashboard, its database page, search, webhooks portal, collaboration and notifications (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment)
- **db-migrate** — Applies database migrations to stage and prod Supabase instances
