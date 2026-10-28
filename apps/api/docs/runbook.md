# api — runbook

## How it runs

Pull requests verify it; a merge to `main` deploys it to `stage`, `prod`.
CI plans what changed (`orun plan --changed`) and runs each lane with `orun run`;
the plan orders a component after everything it depends on.

## Local commands

```bash
pnpm --filter @app/api dev
pnpm --filter @app/api build
pnpm --filter @app/api typecheck
pnpm --filter @app/api lint
pnpm --filter @app/api preview
```

## Verify

After a deploy the lane runs this smoke against the environment it
deployed (`ORUN_ENVIRONMENT`); `DEPLOYED_URL` overrides the URL:

```bash
test "$(curl -sf "${DEPLOYED_URL}/health")" = OK && test "$(curl -sf "${DEPLOYED_URL}/cron/keep-alive")" = OK
```

## Rollback

Revert the commit on `main`. The next convergence applies the previous desired
state; nothing was changed out of band, so there is nothing else to undo.

## Common failures

- **A `WIRING_*` secret is missing at deploy**: an infrastructure lane upstream
  has not applied for this environment yet. Within one convergence the plan
  runs it first; on its own, re-run that lane.
- **The smoke fails right after a first deploy**: a new workers.dev route can
  answer 4xx for a few seconds and the lane retries. A failure that persists
  is a regression in the deployed code.
