# ZENIT hosting

Canonical: `https://zenit.motionstudies.app/`. Parallel custom-domain path: `https://motionstudies.app/zenit/`. Independent GitHub copy: `https://emmettl.github.io/zenit/`.

The relative Vite base lets the same checked artifact run at all three addresses. GitHub Pages uses Actions and no custom-domain CNAME. Cloudflare publishes the completed successful main Pages artifact, not an independent rebuild. Motion Studies owns the pinned publisher, data allowlist, `zenit-hosting` Worker configuration and root-to-prefix asset adapter.

The `cloudflare` environment permits the `main` branch only. `CLOUDFLARE_API_TOKEN` is an encrypted environment secret; `CLOUDFLARE_ENABLED=true` enables publishing. No credentials belong in the artifact. A failed Cloudflare run does not undo GitHub Pages.

Retry by dispatching `cloudflare.yml` with a successful latest Pages run ID. The publisher records source repository, run, commit and content digest in `_release.json`, and checks both addresses and their cache policies. To roll back, set `CLOUDFLARE_ENABLED=false`, then use the trusted publisher to deploy an earlier successful artifact without `--require-latest`. Restore the variable after reviewing the rollback.

The initial public allowlist admits only `data/zenit-manifest.json`, whose evidence is pending. Orbital and stellar releases need a reviewed allowlist and attribution update before publication. No collector or paid storage service is enabled.
