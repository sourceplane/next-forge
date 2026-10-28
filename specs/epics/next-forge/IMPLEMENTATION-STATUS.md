# next-forge — implementation status

| Milestone | State | Landed |
|---|---|---|
| NF0 — the spec | ✅ | NF-1 (#1) |
| NF1 — the apps on Workers | ✅ | NF-2 (#2) |
| NF2 — the data plane | ✅ | NF-3 (#3) |
| NF3 — ready to instantiate | ✅ | NF-4 |
| NF4 — a baseline | — | |

Measured (`wrangler deploy --dry-run`, gzip): app 2,869 KiB, web 2,602 KiB,
api 1,315 KiB — under Workers Free's 3 MiB. Proven offline: every route of
the three Workers under `wrangler dev` with no key set, the app's and the
API's against a local Postgres, the Cron Trigger running the keep-alive.

## Departures from the upstream template

Everything not listed here is the template as it is upstream at `f189de7`.

| # | What | Why |
|---|---|---|
| 1 | bun + Biome → pnpm 10.12.1, Node 22, ESLint 9 (eslint-config-next for the apps, the shared config for the packages); the apps are `@app/{app,web,api}`; dependencies resolved to upstream's lockfile versions (`--config.resolution-mode=lowest-direct`) | the baselines' toolchain |
| 2 | Next 16.1.6 → 16.4.3, `next build --webpack`, `output: "standalone"`, the `@repo/*` packages as `transpilePackages`; `initOpenNextCloudflareForDev()` only under `next dev` | OpenNext 1.20.13 needs ≥ 16.4.1; webpack is the smaller Worker; the dev proxy would need a Cloudflare login at build for Workers AI |
| 3 | Each app → a Worker + Static Assets (`wrangler.template.jsonc`, `wiring.fixture.json`, committed `wrangler.jsonc`, `open-next.config.ts`, `cloudflare-env.d.ts`, `component.yaml`) | the deploy contract |
| 4 | `@repo/database`: Prisma 7 + Neon → the same `database.page` calls (and `count`) over postgres.js, one client per call on `HYPERDRIVE`; `DATABASE_URL` optional, local only | a socket cannot outlive its request on Workers |
| 5 | The Prisma schema → `packages/db` migrations (`010_pages`, `020_row_level_security`) applied by `infra/db-migrate`; Prisma's client, Studio and `apps/studio` removed | Orun applies the schema; RLS because Supabase's Data API serves `public` |
| 6 | `@repo/storage`: Vercel Blob → the `STORAGE` R2 binding (`put`, `get`, `head`, `list`, `del`); `@repo/storage/client` (client uploads with a Blob token) removed | R2 is private: a product serves files through its own route |
| 7 | `@repo/rate-limit`: Upstash → the same sliding window over the `RATE_LIMIT` KV namespace; the contact form always rate-limits, keyed by `cf-connecting-ip` | KV is always bound; Cloudflare's header for the visitor |
| 8 | `@repo/ai`: OpenAI → Workers AI (`workers-ai-provider`, `@cf/zai-org/glm-4.7-flash`, `@cf/baai/bge-base-en-v1.5`) unless `OPENAI_API_KEY`; the AI SDK 5+ `UIMessage` and `@ai-sdk/react` | no key; upstream's code used the AI SDK 4 names on AI SDK 6 |
| 9 | `@repo/observability`: `@sentry/nextjs` and `@logtail/next` → Workers Logs, and errors posted to Sentry's envelope endpoint over `fetch` when `NEXT_PUBLIC_SENTRY_DSN` is set; Session Replay not carried | both SDKs instrument Node and are hundreds of KiB per Worker |
| 10 | `@repo/security`: Arcjet (`secure()`, `ARCJET_KEY`) removed; the Nosecone headers stay | the analyzer is 3.6 MB of WebAssembly (1.1 MB compressed) and needs Node's http2; Cloudflare's edge rules replace it |
| 11 | `@repo/analytics`: Vercel Analytics removed; `@repo/feature-flags`: the Vercel Toolbar and its `.well-known/vercel/flags` routes removed | Vercel's own |
| 12 | `@repo/payments`: the Stripe client over `fetch`, webhooks verified with `constructEventAsync` over SubtleCrypto; the Stripe agent toolkit (`payments/ai.ts`, unused by any app) removed | no Node `http` or `crypto` on Workers |
| 13 | `@repo/auth`: Clerk optional — `auth()`/`currentUser()` return a sample user and organization, the proxy runs its callback without Clerk's middleware, the sidebar's widgets become labels, sign-in and sign-up say what to set, the dashboard shows a notice; Clerk 7's appearance names (`options`, `theme`) | a product goes live before it has a Clerk application |
| 14 | `@repo/cms`: with no `BASEHUB_TOKEN`, sample posts and legal pages shaped like BaseHub's answers, fed to the pages' own render functions under a notice; non-BaseHub images served unoptimized; BaseHub's toolbar only when connected; the `basehub build` step removed (the types are committed) | upstream rendered an empty blog; the build has no token |
| 15 | BaseHub's code block → Shiki with thirteen languages on its JavaScript regex engine, same theme | all of Shiki is 1.7 MB compressed in the site's Worker |
| 16 | The API's Vercel cron → a Cron Trigger on `apps/api/worker.ts`, running the same `/cron/keep-alive` route | Cloudflare's scheduler |
| 17 | `/api/health` added to the app (Hyperdrive) and the site (KV); the site's proxy matcher skips `/api/` | the deploys' smokes |
| 18 | The webhooks page shows a notice without `SVIX_TOKEN` (upstream: a 500) | every page says what to connect |
| 19 | `SITE_NAME` (`packages/seo/site.ts`) is the site's logo text, the app's sign-in panel and dashboard title and every title's suffix; the metadata's author and publisher are the product (upstream: "next-forge", "Acme Inc", Vercel, @vercel) | one rename seam; the product's own identity |
| 20 | `VERCEL_PROJECT_PRODUCTION_URL` → each app's own origin (`NEXT_PUBLIC_SITE_URL`, and the site's `NEXT_PUBLIC_WEB_URL` for robots, the sitemap and the blog's JSON-LD), set per environment by the build | not on Vercel |
| 21 | Missing workspace dependencies declared (`@repo/email` in app and api, `@repo/auth` in web); upstream's shadcn `chart` and `resizable` updated for recharts 3 and react-resizable-panels 4; Knock's client built with `{ apiKey }` | pnpm resolves strictly; upstream's own typecheck fails at its lockfile's versions |
| 22 | `apps/docs` (Mintlify), `apps/email` (react-email's preview server), `apps/storybook`, `apps/studio`, the apps' `vercel.json` and `scripts/skip-ci.js` not carried; upstream's three app tests moved to `tests/{app,api}` | not Workers / Vercel's |
