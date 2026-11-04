# ZENIT hosting

Canonical: `https://zenit.motionstudies.app/`. Parallel custom-domain path: `https://motionstudies.app/zenit/`. Independent GitHub copy: `https://emmettl.github.io/zenit/`.

The relative Vite base lets the same checked artifact run at all three addresses. GitHub Pages uses Actions and no custom-domain CNAME. Cloudflare publishes the completed successful main Pages artifact, not an independent rebuild. Motion Studies owns the pinned publisher, data allowlist, `zenit-hosting` Worker configuration and root-to-prefix asset adapter.

The `cloudflare` environment permits the `main` branch only. `CLOUDFLARE_API_TOKEN` is an encrypted environment secret; `CLOUDFLARE_ENABLED=true` enables publishing. No credentials belong in the artifact. A failed Cloudflare run does not undo GitHub Pages.

Retry by dispatching `cloudflare.yml` with a successful latest Pages run ID. The Pages deployment artifact is retained for seven days, matching the checked site artifact. If the Pages archive has expired but the checked `zenit-site` artifact remains available, rerun the successful Pages deployment job to regenerate it before retrying Cloudflare. The publisher records source repository, run, commit and content digest in `_release.json`, and checks both addresses and their cache policies. To roll back, set `CLOUDFLARE_ENABLED=false`, then use the trusted publisher to deploy an earlier successful artifact without `--require-latest`. Restore the variable after reviewing the rollback.

The public allowlist admits `data/zenit-manifest.json`, `data/stellar/NOTICE.txt` and immutable `data/stellar/hyg-v44-bright-<12 hex>.json` releases, plus `data/orbital/NOTICE.txt` and immutable `data/orbital/iss-<12 hex>.json`, `data/orbital/cohorts-<12 hex>.json`, `data/orbital/window-<12 hex>.json` and `data/orbital/constellation-<12 hex>.json` snapshots. The Cloudflare workflow pins publisher commit `eedc6309450903d7c122118db07b347e78377e11`, which admits the audited constellation format while rejecting raw, unversioned and malformed data paths. The retained source and compiled SHA-256 are checked before build and catalogue rendering. Raw CSV and gzip captures are excluded. Additional orbital cohort formats need a separate allowlist and attribution update. No collector or paid storage service is enabled.

The check job uses GitHub's macOS 26 runner for Chromium and native WebKit, avoiding Ubuntu browser-runtime package mirror failures. Pages deployment and Cloudflare publishing remain separate Linux jobs. Both browser projects must pass before a Pages artifact is admitted.
