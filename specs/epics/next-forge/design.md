# next-forge — design

## 1. What the template is

A Turborepo of Next.js 16 apps and shared packages, built with bun and linted
with Biome (ultracite):

| App | Port | What it is |
|---|---|---|
| `apps/app` | 3000 | The product: a Clerk-authenticated dashboard (sidebar, organization switcher, user button), a page listing the database's `Page` rows, full-text-ish user search, a Svix webhooks portal, Liveblocks cursors and an avatar stack, Knock notifications |
| `apps/web` | 3001 | The marketing site, `[locale]`-routed (next-international): home, pricing, a BaseHub blog, BaseHub legal pages, a contact form that mails through Resend behind an Upstash rate limit |
| `apps/api` | 3002 | Route handlers: `/health`, `/cron/keep-alive` (a Vercel Cron that writes and deletes a row so Neon does not sleep), `/webhooks/auth` (Clerk, via Svix), `/webhooks/payments` (Stripe) |
| `apps/docs` | 3004 | A Mintlify site |
| `apps/email` | 3003 | react-email's preview server over `packages/email/templates` |
| `apps/storybook` | 6006 | Storybook over the design system |
| `apps/studio` | 3005 | Prisma Studio |

The packages (`@repo/*`) each wrap one concern: `auth` (Clerk), `database`
(Prisma 7 + Neon), `payments` (Stripe), `cms` (BaseHub), `email` (Resend +
react-email), `analytics` (PostHog, Google Analytics, Vercel Analytics),
`observability` (Sentry, BetterStack), `security` (Arcjet, Nosecone),
`rate-limit` (Upstash), `collaboration` (Liveblocks), `notifications` (Knock),
`webhooks` (Svix), `feature-flags` (the Flags SDK over PostHog, the Vercel
Toolbar), `storage` (Vercel Blob), `ai` (the AI SDK over OpenAI),
`internationalization`, `seo`, `design-system` (shadcn/ui), `next-config`,
`typescript-config`. Every SaaS key is optional in each package's `keys.ts`
except Clerk's, which the apps' proxies and layouts call unconditionally.

## 2. The mapping (Vercel → Cloudflare + Supabase)

| Vercel / SaaS piece | Here |
|---|---|
| Three Vercel projects (app, web, api) | Three Cloudflare Workers + Static Assets, `<repo>-{app,web,api}-<env>`, each `@opennextjs/cloudflare`'s output of its app |
| `proxy.ts` (Next 16 middleware) | Unchanged, bundled by OpenNext as Node.js middleware inside each Worker |
| Neon Postgres through Prisma 7 + `@prisma/adapter-neon` | A Supabase project's Postgres through Cloudflare Hyperdrive. `@repo/database` keeps the `database.page.findMany/create/delete` calls the apps make, over postgres.js **per call** (a socket opened in one request cannot serve another on Workers) |
| `prisma migrate` | The schema as SQL migrations in `packages/db`, applied by Orun's `db-migrate` component through Supabase's Management API before the Workers deploy |
| Prisma Studio (`apps/studio`) | Supabase's Table Editor; not a Worker |
| Vercel Cron → `/cron/keep-alive` | A Cron Trigger on the API Worker (a custom `worker.ts` adding `scheduled` beside OpenNext's `fetch`), calling the same route once a day — Supabase's free projects pause after a week idle, as Neon's do |
| Vercel Blob (`@repo/storage`) | An R2 bucket bound to the app Worker as `STORAGE`; `put`/`head`/`list`/`del` over the binding |
| Upstash Redis rate limit (`@repo/rate-limit`) | A Workers KV namespace bound to the web Worker as `RATE_LIMIT`; the same `createRateLimiter({ limiter: slidingWindow(n, window) })` API |
| OpenAI through the AI SDK (`@repo/ai`) | Workers AI through the AI SDK (`workers-ai-provider`) and the app Worker's `AI` binding — no key; OpenAI stays optional |
| Sentry (`@sentry/nextjs`), BetterStack (`@logtail/next`) | Workers Logs (`observability.enabled`); Sentry and BetterStack optional, posted to over `fetch` when their keys are set |
| Vercel Analytics | Not ported (Vercel-only); Cloudflare Web Analytics is a dashboard switch on a custom domain. PostHog and Google Analytics stay optional |
| Vercel Toolbar (`@vercel/toolbar`, `.well-known/vercel/flags`) | Not ported (Vercel-only); the Flags SDK's flags stay, decided by PostHog when its key is set |
| Clerk | Optional: with no keys the app runs as a sample user under a "connect Clerk" notice, sign-in and sign-up say what to set, and the proxies skip Clerk's middleware |
| BaseHub | Optional: with no token the blog and the legal pages render sample entries under a "connect BaseHub" notice |
| Stripe, Resend, Arcjet, Liveblocks, Knock, Svix, PostHog, Google Analytics | Optional, exactly as upstream gates them on their keys |
| `apps/docs` (Mintlify) | Not a Worker: Mintlify hosts a docs site from its own GitHub integration. Not carried |
| `apps/email` (react-email's preview server), `apps/storybook` | Dev tools, not Workers. Not carried; the templates stay in `packages/email` and render in the Worker that sends them |
| Project env vars in the Vercel dashboard | Each SaaS key is an optional Orun secret per environment: the build reads the public ones (`NEXT_PUBLIC_*`, inlined), the deploy pushes the rest as Worker secrets (`tooling/wire/worker-secrets.mjs`, values over stdin) |
| bun, Biome | pnpm 10 and Node 22; ESLint 9 flat configs, as every baseline in this programme |

## 3. Three Workers and what they bind

```
browser ─► <repo>-web-<env>   marketing site   RATE_LIMIT (KV)          proxy: i18n → /en, security headers
        ─► <repo>-app-<env>   the product      HYPERDRIVE, STORAGE (R2), AI
        ─► <repo>-api-<env>   webhooks, health HYPERDRIVE                + Cron Trigger "0 0 * * *" → /cron/keep-alive

HYPERDRIVE ─► Hyperdrive config <prefix>-<repo>-<env> ─► Supabase project <repo>-<env> (Postgres)
                                                          ▲ db-migrate: packages/db/src/migrations, before the Workers deploy
```

Each app's URLs to the others (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEB_URL`,
`NEXT_PUBLIC_API_URL`) are the sibling Workers' workers.dev origins for the
environment, set by the build.

## 4. What is out of scope

The Mintlify docs, the email preview server, Storybook and Prisma Studio (dev
tools, §2); Vercel Analytics and the Vercel Toolbar (Vercel-only); a custom
domain (an owner's step after the bootstrap); Liveblocks rooms, Knock
workflows, Svix apps, Stripe products and BaseHub repositories, which belong
to the owner's own accounts.
