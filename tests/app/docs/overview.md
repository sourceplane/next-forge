# app-tests

The app's and its packages' tests (Clerk's sample mode, the database client over Hyperdrive, storage over R2, the health check, the wrangler config), run on every pull request

The test suite for **app**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/app`          |
| Package      | `@app/app-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
