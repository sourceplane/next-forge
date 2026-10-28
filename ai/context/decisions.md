# next-forge — decisions

The decisions a reader should know before changing this baseline. Each links
where it is argued in full.

| # | Decision | Why | Where |
|---|---|---|---|
| 1 | One OpenNext Worker per app (app, web, api); the docs (Mintlify), the email preview server, Storybook and Prisma Studio are not carried | the three deployable apps are Next.js; the rest are another host's or dev tools | design.md §2 |
| 2 | `@repo/database` keeps Prisma's `database.page` calls over postgres.js, one client per call on Hyperdrive | the apps' code is unchanged; a socket cannot outlive its request on Workers, and Hyperdrive is the pool | design.md §2, risk NF-C |
| 3 | The schema is SQL migrations in `packages/db`, applied by db-migrate through Supabase's Management API; RLS on every table in `public` | Orun applies the schema; Supabase's Data API serves `public` to the anon key | IMPLEMENTATION-STATUS #5 |
| 4 | Every SaaS optional, Clerk included: a sample user, sample CMS content and per-page notices | a product is deployed by a convergence nobody attends, before its owner has any account | risks NF-B, NF-D |
| 5 | Arcjet and BaseHub's all-language Shiki out; Sentry and BetterStack's SDKs → Workers Logs and `fetch` | Workers Free's 3 MiB per Worker | risk NF-A |
| 6 | The `@repo/*` packages are no components; each app names `packages/**` and the lockfile as change inputs | the apps compile them; a package component would deploy nothing | the apps' `component.yaml` |
| 7 | Server SaaS keys stay out of the build and reach the Worker as Worker secrets at deploy; public ones are inlined | no bundle, build cache or log holds a server secret | the apps' `component.yaml`, `tooling/wire/worker-secrets.mjs` |
| 8 | Infra before app on main, enforced; advisory on a pull request | each component reads what the one before it published; a migration runs last before the Workers | design.md §3 |
| 9 | The turso-starter v8 shape on orun v2.88.0: no `checks.yml`, one `secrets` reconcile per provider, generated component docs, tasks in the background, landings checked in the box, the watch at 5 s | the fast bootstrap every baseline in this programme follows | `repo-blueprint.yaml`, `testing/` |
| 10 | The console asks for no domain; an empty `productdomain` brands `<reponame>.example.com` | the Workers go live on workers.dev | `repo-blueprint.yaml`, `tooling/rebrand/rebrand.mjs` |
| 11 | The slug is also upstream's name: prose naming the template says "Vercel's next-forge" (or links github.com/vercel/next-forge or next-forge.com), which the rebrand protects | otherwise a product would credit itself with the template | `tooling/rebrand/rebrand.mjs` |
