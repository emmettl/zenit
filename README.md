# ZENIT

[Canonical edition](https://zenit.motionstudies.app/) · [Path address](https://motionstudies.app/zenit/) · [GitHub Pages](https://emmettl.github.io/zenit/) · [Study brief](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md) · [Source audit](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT-SOURCES.md)

An Earth-orbit Motion Studies edition: the orbital population, its families, and a descent to the surface beneath a naked-eye stellar field.

## Current state

The first scaffold mounts an independent React/Three.js application with exact published Motion Studies packages. A spherical Earth and geographic graticule support a reversible twelve-second camera rehearsal from the orbital view to a Zurich surface viewpoint. Scrubbing, pause, return and reduced motion work independently of a study clock.

The basic stellar release contains **5,070 HYG 4.4 records with V ≤ 6.0**, including 428 named stars. Catalogue directions form a sky without artificial camera parallax. Stars can be picked in the scene or selected by name; the layer can be hidden. Selection exposes source identity, visual magnitude, B−V colour, distance, J2000 coordinates and the Zurich geometric horizon reading. Missing or dubious distances remain unavailable. Satellite positions remain pending.

The sky orientation is frozen at **7 October 2026, 21:00 UTC**. Astronomy Engine 2.1.19 supplies precession, nutation and Earth rotation; proper motion, annual aberration, parallax and atmospheric refraction are omitted. A source-motion scale of about 0.0393° over 26.77 years describes the largest retained catalogue motion, not a guaranteed error bound. Independent pressure-zero Astropy reference cases in both hemispheres agree within one arcminute. The horizon is geometric, and the field represents an idealised dark sky rather than actual observing conditions.

Point sizes and opacity use bounded linear mappings from visual magnitude; an authored B−V palette supplies colour, with neutral white for missing indices. Components retain separate source records and glyphs. Variable-star designations are retained, but brightness is static. Positions and source metadata are frozen and are not fetched from providers during builds or visitor sessions.

## Stellar evidence and reproduction

[Release audit](docs/evidence/stellar-release-2026-10-07.json) records the pinned upstream revision, input hash, exclusions and compiled artifact hash. The 119,614 source records become 5,070 after excluding the Sun and 114,543 fainter entries. No invalid records or ceiling exclusions occur. The subset has 104 unavailable distances, 23 unavailable colours and 778 variability designations. Its gzip transfer is about 334 KB, beneath the 500 KB stellar budget.

The original HYG gzip, README and licence are retained under ignored `work/sources/hyg-v44/`. To reproduce the subset offline, run:

```sh
python3 scripts/compile-stellar.py --source work/sources/hyg-v44/hyg_v44.csv.gz --captured-at 2026-10-07T21:40:20.822126Z --output .
```

The compiler verifies source SHA-256 before parsing. The browser verifies the compiled SHA-256 before rendering and provides a retry state on failure. HYG data and this adapted subset are **CC BY-SA 4.0**, credited to David Nash / Astronomy Nexus. See [source notice](public/data/stellar/NOTICE.txt) and [licence](public/licences/HYG-CC-BY-SA-4.0.txt).

## Development

Use Node 24 (`nvm use`) and npm 11.21.0. Run `npm ci`, then `npm run dev`.

- `npm run check` validates camera geometry, catalogue integrity, independent sky transforms and reproducibility, TypeScript, the production build, relative asset URLs, canonical identity, evidence state and a two-megabyte compressed artifact ceiling.
- `npx playwright install chromium webkit` then `npm run test:browser` checks desktop and phone layouts, reduced motion, pause, catalogue selection, horizon readings, retry and tamper rejection.

## Publication

A successful main `Deploy Pages` run publishes to GitHub Pages. A separate Cloudflare workflow downloads that exact checked artifact using pinned Motion Studies hosting tools. It serves both custom-domain addresses, verifies release identity and cache policies at each, and keeps the canonical HTML link at the subdomain root. Builds do not fetch provider data.

Cloudflare uses a main-only `cloudflare` environment with `CLOUDFLARE_API_TOKEN`, enabled by `CLOUDFLARE_ENABLED=true`. The token belongs in GitHub's encrypted environment secret. See [hosting](docs/HOSTING.md) for staging, retry and rollback.

## Next composition

Retain a bounded orbital evidence release; validate SGP4/TEME and the common celestial frame; join real modelled passes to the stellar reference and a declared night-side landing. Keep age rules, attachments, licence records and the optical-visibility distinction explicit. Gaia stellar depth and motion over much longer clocks remain distant optional research.

The build includes dependency and font licence notices under `licences/`. Code is MIT licensed. The stellar dataset retains its separate CC BY-SA 4.0 licence and attribution; the code licence does not grant data rights.
