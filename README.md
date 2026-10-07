# ZENIT

[Canonical edition](https://zenit.motionstudies.app/) · [Path address](https://motionstudies.app/zenit/) · [GitHub Pages](https://emmettl.github.io/zenit/) · [Study brief](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md) · [Source audit](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT-SOURCES.md)

An Earth-orbit Motion Studies edition: the orbital population, its families, and a descent to the surface beneath a naked-eye stellar field.

## Current state

The first scaffold mounts an independent React/Three.js application with exact published Motion Studies packages. A spherical Earth and geographic graticule support a reversible twelve-second camera rehearsal from the orbital view to a Zurich surface viewpoint. Scrubbing, pause, return and reduced motion work independently of a study clock.

**No orbital or stellar dataset is loaded.** No satellite points, star catalogue, day/night calculation or observed terrain is displayed. The public manifest records zero data records and the camera-only observer preset. The camera frame is an authored spherical composition, not TEME or an astronomical frame. This is an engineering scaffold, not an admitted catalogue work.

## Development

Use Node 24 (`nvm use`) and npm 11.21.0. Run `npm ci`, then `npm run dev`.

- `npm run check` validates camera geometry and reproducibility, TypeScript, the production build, relative asset URLs, canonical identity, evidence state and a two-megabyte compressed artifact ceiling.
- `npx playwright install chromium webkit` then `npm run test:browser` checks the desktop and phone layouts, reduced motion, pause and publication state.

## Publication

A successful main `Deploy Pages` run publishes to GitHub Pages. A separate Cloudflare workflow downloads that exact checked artifact using pinned Motion Studies hosting tools. It serves both custom-domain addresses, verifies release identity and cache policies at each, and keeps the canonical HTML link at the subdomain root. Builds do not fetch provider data.

Cloudflare uses a main-only `cloudflare` environment with `CLOUDFLARE_API_TOKEN`, enabled by `CLOUDFLARE_ENABLED=true`. The token belongs in GitHub's encrypted environment secret. See [hosting](docs/HOSTING.md) for staging, retry and rollback.

## Next composition

Retain a bounded orbital evidence release; validate SGP4/TEME and the common celestial frame; compile the visible-star catalogue; then join a declared night-side landing to real modelled passes. Keep age rules, attachments, licence records and the optical-visibility distinction explicit. Gaia stellar depth and motion over much longer clocks remain distant optional research.

Code is MIT licensed. Future data artifacts must retain their own source licences and attribution; the code licence does not grant data rights.
