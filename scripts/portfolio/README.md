# Portfolio Actions synchronizer

This directory contains the Node-only synchronizer used by the GitHub Actions
workflow. It writes the checked-in GitHub data files and does not use
Cloudflare KV or change display settings.

```bash
node scripts/portfolio/sync.mjs full \
  --state .cache/portfolio-state.json

node scripts/portfolio/sync.mjs repo 123456 \
  --state .cache/portfolio-state.json

node scripts/portfolio/sync.mjs build \
  --state .cache/portfolio-state.json \
  --output data/portfolio/projects.json
```

`GITHUB_TOKEN` is read only from the process environment and is never written
to state or logs. `GITHUB_OWNER`, `GITHUB_OWNER_TYPE`, and
`GITHUB_API_VERSION` can also be supplied through the environment. The
non-secret `GITHUB_AUTH_SCOPE` value separates caches when the authorization
scope changes. Public
repositories can be read without a token, subject to GitHub's anonymous rate
limit.

`full` follows all repository pages and updates the complete inventory before
syncing repositories. If enumeration is interrupted, the previous inventory
is retained and no checked-in data is changed. `repo` accepts a numeric GitHub
repository ID or an `owner/name`; it preserves the numeric ID across a rename.
`build` reads only `settings.json` and `sources.json`, applies the v1
publication gate, and emits only `PublicProject` records in stable order.
Equivalent output is not rewritten, so Actions can skip the commit.
