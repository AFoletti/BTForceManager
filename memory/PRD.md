# PRD

## Original Problem Statement
I need your help to fix a minor but in my repo https://github.com/AFoletti/BTForceManager
I see that the build github actions fails because Node.js 20 is deprecated. Can you please fix it?

## Architecture Decisions
- Kept the existing GitHub Actions workflow structure unchanged.
- Applied a targeted CI fix by updating the workflow Node.js version from 20 to 22.
- Limited scope to repository workflows that referenced deprecated Node.js versions.

## What's Implemented
- Scanned repository workflows for deprecated Node.js usage.
- Updated `.github/workflows/build-frontend.yml` from `node-version: '20'` to `node-version: '22'`.
- Verified the workflow file change and confirmed no other workflow files in the repo required the same update.
- Ran a frontend production build locally to validate the CI build path.

## Prioritized Backlog
### P0
- Confirm the GitHub Actions build passes on the next run.

### P1
- Optionally refresh `actions/setup-node` and other GitHub Actions to their latest supported majors.
- Optionally add workflow triggers beyond manual dispatch if automated CI is desired.

### P2
- Add a dedicated CI status badge to the README.
- Add lightweight workflow caching or artifact checks if build time becomes a concern.

## Next Tasks
- Re-run the `Build Frontend` workflow in GitHub Actions.
- If desired, extend CI to run on push and pull requests.
