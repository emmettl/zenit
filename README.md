# ZENIT

[Canonical edition](https://zenit.motionstudies.app/) · [Path address](https://motionstudies.app/zenit/) · [GitHub Pages](https://emmettl.github.io/zenit/) · [Study brief](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md) · [Source audit](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT-SOURCES.md)

An Earth-orbit Motion Studies edition: the orbital population, its families, and a descent to the surface beneath a naked-eye stellar field.

## Current state

ZENIT now joins **one propagated ISS object**, a **5,070-record HYG 4.4 stellar field**, and a reversible twelve-second descent to a night-side surface viewpoint in **Sydney**. Select the ISS or a star, toggle the ISS trail or stars, pause, reverse and seek the shared study clock, or return to orbit without losing the selected record and instant.

**Watch Sydney pass** seeks to 90 study seconds before culmination, pauses the study during descent, then starts 10× playback on arrival. Reduced motion jumps directly and stays paused. Clicking the culmination reading seeks to the peak without starting playback. Camera and clock controls remain independent; hidden tabs pause the study. Playback stops at the dated window boundaries.

The frozen twelve-hour window is **7 October 2026, 11:58:49–23:58:49 UTC**. The modelled pass rises at **17:53:22.867**, culminates at **17:58:49** at **44.9° elevation**, and sets at **18:04:12.677 UTC**. The Sun is about **17.9° below the horizon** at culmination. The retained elements give Zurich daytime passes; Sydney supplies the first night-side composition. This is a replay from dated elements, not a live position service or an optical visibility prediction.

## Orbital evidence and frame

The [ISS release audit](docs/evidence/iss-release-2026-10-08.json) records a single CelesTrak `CATNR=25544&FORMAT=json` response, upstream attribution to USSPACECOM / 18 SDS via Space-Track, SHA-256, capture time and the retained epoch. The input epoch is **7 October, 13:30:47.478528 UTC**, captured at **22:09:38 UTC**. The chosen pass precedes acquisition; the edition does not claim these elements were known at pass time. No optional provider enrichment or attachment records are included. Raw input, capture headers and reviewed source-rights pages remain in ignored `work/sources/iss-2026-10-08/`.

Satellite.js **7.1.0**, WGS72 constants and **AFSPC mode `a`** supply SGP4 TEME positions in kilometres. GMST rotates TEME to the Earth-fixed PEF approximation; UT1 is approximated by UTC and polar motion omitted. HYG J2000 directions use Astronomy Engine **2.1.19** for precession, nutation and Earth rotation into the same Earth-fixed viewing axes. The camera and geographic grid use a WGS84 ellipsoid and a geodetic Sydney observer at 58 m. The orbital view is Earth-fixed; Earth does not rotate beneath an inertial camera in this edition.

JavaScript truncates the source epoch's sub-millisecond fraction; the full source epoch remains inspectable. There is no state interpolation. The **previous 60 study seconds** form a 31-point model trail sampled every two seconds, rebuilt directly and identically on seek or reverse. The [numerical audit](docs/evidence/iss-numerical-2026-10-08.json) measures a maximum roughly **4 m** chord error on five-minute-spaced checks throughout the study, below a 6 m test ceiling. This is trail approximation error, not overall orbital prediction accuracy. Fixed elements do not model unrecorded manoeuvres; the 24-hour eligibility rule is editorial rather than an accuracy guarantee.

Independent **Python sgp4 2.27 / Vallado C++** references cover ISS, low-orbit and deep-space verification cases at positive and negative epoch offsets, including a decayed case. TEME tests use a 2 cm position tolerance and 0.1 mm/s velocity tolerance. Astropy **8.0.1 / PyERFA 2.0.1.5** independently checks WGS84 observer geometry, Earth-fixed positions and above/below-horizon crossings. Its IERS polar motion explains part of the allowed 50 m Earth-fixed and 0.01° horizon differences. Independent pressure-zero Sun geometry also agrees within 0.02° at the selected pass and study bounds. Reference tolerances validate implementation agreement, not source accuracy.

The geometric pass overlays an idealised stellar sky. In the surface view, an authored solar-altitude fade is fully bright below −18° and disappears by −6°; daytime stars are suppressed. This is a compositional twilight rule rather than atmospheric photometry. The ISS diamond and trail use authored screen size and brightness; illumination, satellite reflectance, atmospheric extinction and actual observing conditions are not reconstructed. Stellar proper motion, annual aberration, parallax and refraction remain omitted. B−V uses an authored palette, missing colour is neutral, and variable-star brightness remains static.

Reproduce the frozen orbital release offline with `node scripts/compile-orbital.mjs`. The compiler verifies the retained source hash, supplies explicit documented Earth/TEME/UTC/SGP4 defaults, searches qualifying Sydney passes, and records selection and crossings. CI and visitors never contact the provider. Both datasets are checked against their compiled SHA-256 before browser use; each has an independent failure/retry state. Basic orbital data is redistributed with citations under the documented basic-SSA redistribution approval; see [orbital notice](public/data/orbital/NOTICE.txt).

## Stellar evidence and reproduction

[Release audit](docs/evidence/stellar-release-2026-10-07.json) records the pinned upstream revision, input hash, exclusions and compiled artifact hash. The 119,614 source records become 5,070 after excluding the Sun and 114,543 fainter entries. No invalid records or ceiling exclusions occur. The subset has 104 unavailable distances, 23 unavailable colours and 778 variability designations. Its gzip transfer is about 334 KB, beneath the 500 KB stellar budget.

The original HYG gzip, README and licence are retained under ignored `work/sources/hyg-v44/`. To reproduce the subset offline, run:

```sh
python3 scripts/compile-stellar.py --source work/sources/hyg-v44/hyg_v44.csv.gz --captured-at 2026-10-07T21:40:20.822126Z --output .
```

The compiler verifies source SHA-256 before parsing. The browser verifies the compiled SHA-256 before rendering and provides a retry state on failure. HYG data and this adapted subset are **CC BY-SA 4.0**, credited to David Nash / Astronomy Nexus. See [source notice](public/data/stellar/NOTICE.txt) and [licence](public/licences/HYG-CC-BY-SA-4.0.txt).

## Development

Use Node 24 (`nvm use`) and npm 11.21.0. Run `npm ci`, then `npm run dev`.

- `npm run check` validates ellipsoid clearance, catalogue integrity, independent stellar/orbital frames, horizon crossings, deterministic trails and reversible clock boundaries, TypeScript, the production build, relative asset URLs, canonical identity, evidence state and a two-megabyte compressed artifact ceiling.
- `npx playwright install chromium webkit` then `npm run test:browser` checks desktop and phone layouts, full animated cue, reduced motion, identity/time preservation, selection, reversal, boundary stops, retry and tamper rejection.

## Publication

A successful main `Deploy Pages` run publishes to GitHub Pages. A separate Cloudflare workflow downloads that exact checked artifact using pinned Motion Studies hosting tools. It serves both custom-domain addresses, verifies release identity and cache policies at each, and keeps the canonical HTML link at the subdomain root. Builds do not fetch provider data.

Cloudflare uses a main-only `cloudflare` environment with `CLOUDFLARE_API_TOKEN`, enabled by `CLOUDFLARE_ENABLED=true`. The token belongs in GitHub's encrypted environment secret. See [hosting](docs/HOSTING.md) for staging, retry and rollback.

## Next composition

Expand the validated one-object composition into bounded station, navigation and geosynchronous cohorts, with attachment handling and explicit source groups. Measure the complete playback on a named physical phone before claiming the 30 fps target. Gaia stellar depth and much longer clocks remain distant optional research.

The build includes dependency and font licence notices under `licences/`. Code is MIT licensed. The stellar dataset retains its separate CC BY-SA 4.0 licence and attribution; the code licence does not grant data rights.
