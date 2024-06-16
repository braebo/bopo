# Changesets Monorepo

Personal notes: internal packges should be scoped and have `private: true`

## Getting Started

1. Update configs

    | File                          | Step                                                                       |
    | ----------------------------- | -------------------------------------------------------------------------- |
    | .changeset/config.json        | Replace REPO_NAME with your username/repo e.g. ghostdevv/neru              |
    | package.json                  | Replace REPO_URL with your repo url e.g. https://github.com/ghostdevv/neru |
    | LICENSE                       | Put your License into here (if not MIT also change package.json)           |
    | .github/workflows/release.yml | Replace REPO_NAME with your username/repo e.g. ghostdevv/neru              |

2. Add changeset bot to repo

    https://github.com/apps/changeset-bot

3. Secrets

    Add `NPM_TOKEN` to github action secrets


## Git Submodules

All folders in `packages/` are git submodules.

To add a new git submodule, run `git submodule add` from the root of the monorepo:

```bash
git submodule add https://github.com/USER/REPO packages/REPO
```

`pnpm pull` will update all submodules to their latest commit by running this command for you:

```bash
git submodule update --remote --merge
```