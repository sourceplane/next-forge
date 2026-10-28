# api-tests

The API's tests (health, the keep-alive and its Cron Trigger, the webhooks verified over SubtleCrypto, the wrangler config), run on every pull request

The test suite for **api**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/api`          |
| Package      | `@app/api-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
