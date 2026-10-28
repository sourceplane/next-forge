# cloudflare-kv

Provisions the Cloudflare KV namespace the app binds (stage and prod)

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-kv`                                                                      |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- (none)

## Depended on by

- **web** — The marketing site — home, pricing, blog, legal pages and the contact form, in six languages (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment)
