# app

The product — the Clerk-authenticated dashboard, its database page, search, webhooks portal, collaboration and notifications (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment)

A Cloudflare Worker with Static Assets (server rendering plus static files), deployed per environment by its CI lane.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Type         | `cloudflare-workers-assets-turbo`                                                                                  |
| Source       | `apps/app`                                                                                                         |
| Package      | `@app/app`                                                                                                         |
| Environments | `dev`: `verify` · `stage`: `verify`, `deploy` on a push to `main` · `prod`: `verify`, `deploy` on a push to `main` |

## Depends on

- **cloudflare-hyperdrive** — Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases
- **cloudflare-r2** — Provisions the Cloudflare R2 bucket the app binds (stage and prod)
- **db-migrate** — Applies database migrations to stage and prod Supabase instances

## Depended on by

- (none)
