# ZENIT

[Canonical edition](https://zenit.motionstudies.app/) · [Path address](https://motionstudies.app/zenit/) · [GitHub Pages](https://emmettl.github.io/zenit/) · [Study brief](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT.md) · [Source audit](https://github.com/emmettl/motionstudies/blob/main/docs/ZENIT-SOURCES.md)

An Earth-orbit Motion Studies edition: the orbital population, its families, and a descent to the surface beneath a naked-eye stellar field.

## Current state

ZENIT now opens a three-family population: **635 retained independent movers**, with **616 eligible at the opening instant**, from CelesTrak's stations, GNSS and active geosynchronous groups. The 5,070-record HYG field and reversible twelve-second Sydney ISS descent remain available. Isolate families, select a satellite or attachment, switch whole-orbit / near-Earth framing, toggle the selected model trail, and pause, reverse or seek one shared clock.

The overview opens paused at **600×**. Whole-orbit framing uses linear physical distances and pulls back enough for the outer population, adapting to portrait aspect ratio. Near-Earth framing uses the original close view. Station movers are cyan, navigation violet, geosynchronous amber; shared navigation/geosynchronous membership is mint. These are source groups rather than complete orbital-regime partitions.

**Watch Sydney pass** seeks to 90 study seconds before culmination, pauses the study during descent, then starts 10× playback on arrival. Reduced motion jumps directly and stays paused. Clicking the culmination reading seeks to the peak without starting playback. Camera and clock controls remain independent; hidden tabs pause the study. Playback stops at the dated window boundaries.

The frozen twelve-hour window is **7 October 2026, 11:58:49–23:58:49 UTC**. The modelled pass rises at **17:53:22.867**, culminates at **17:58:49** at **44.9° elevation**, and sets at **18:04:12.677 UTC**. The Sun is about **17.9° below the horizon** at culmination. The retained elements give Zurich daytime passes; Sydney supplies the first night-side composition. This is a replay from dated elements, not a live position service or an optical visibility prediction.

## Cohort evidence and eligibility

The [cohort release](docs/evidence/cohorts-release-2026-10-08.json) uses the **original 7 October source-probe bodies**, newly retained in ignored `work/sources/cohorts-2026-10-07/` after verification against all four recorded SHA-256 hashes. No provider request was repeated. Their HTTP response dates are known; exact original local acquisition timestamps were not recorded and remain unavailable. Later retention time is recorded separately.

The 762 GP rows contain **716 distinct identities**, with **46 overlapping membership rows**. Twelve docked records are attachments, not independent lights. Sixty-nine other identities cannot enter the frozen study under the 24-hour element-offset rule. The remaining **635** are below the 1,000-mover ceiling, with no cap exclusions, invalid-element exclusions, propagation-screening failures or missing station metadata. All membership is retained after choosing the newest epoch per identity; epoch ties preserve source order stations, GNSS, GEO.

| Source group | Input rows | Retained movers | Initially eligible | Attachments | Excluded independent IDs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stations | 23 | 11 | 11 | 12 | 0 |
| GNSS / Navigation | 172 | 130 | 124 | 0 | 42 |
| Active geosynchronous | 567 | 533 | 518 | 0 | 34 |

Group counts overlap and must not be summed into a population total. At the initial instant, selecting navigation and geosynchronous together gives **605** distinct eligible movers; adding stations gives **616**. Eligibility is evaluated at the displayed instant, so an older retained identity can become unavailable as the clock advances. The source ledger explains exclusions; disappearance under this rule is not a reentry claim.

Docked records remain selectable under their parent, including **eight ISS** and **four Tianhe** attachments. Their position and trail follow the parent. The SATCAT relationship is frozen across this study; docking and undocking history is not reconstructed. Available object type and catalogue launch date are preserved as supplied; missing metadata remains unknown. Provider memberships and docking facts are explicitly attributed, and optional operating-status enrichment is omitted.

The [numerical/performance audit](docs/evidence/cohorts-numerical-2026-10-08.json) verifies 16 independent C++ SGP4 vectors for four actual retained station, navigation and deep-space records at positive and negative offsets, with 10 cm position and 0.1 mm/s velocity tolerances. A dedicated module worker calculates direct states at a nominal 33 ms cadence, with one outstanding request and no queued history. Position packets use transferable Float64 coordinates. Manual seeks invalidate older revisions; the displayed UTC clock, stellar sky, selected record and all lights use the same packet timestamp. No position interpolation is applied.

The cohort payload is about **54 KB gzip**. A local arm64 Node benchmark of 616 eligible movers measured roughly **0.46 ms median / 0.66 ms p95** for propagation and Earth-fixed conversion, excluding transfer, rendering and UI. Across five-minute-spaced checks, selected two-second trail chords deviate by at most about **4.23 m** from direct model positions, within the 6 m trail ceiling. The largest measured geocentric radius is about **45,315 km**. These are model and local-cost checks, not source accuracy or physical-phone frame-rate measurements.

Reproduce offline with `node scripts/compile-cohorts.mjs`. The retained ISS group element set is identical to the existing pass input, so the signature sequence is preserved. Independent cohort, ISS and stellar load failures have explicit retry states. The compiler and browser verify each published data hash; CI and visitors do not contact providers.

## Camera interaction

Drag the sky to orbit Earth and scroll to zoom. Clicking a visible satellite selects and follows it; the object selector and **Focus and follow** button provide the same route without precision pointing. Attachments focus on their parent station. While following, drag around the selected object and zoom toward or away from it. **Stop following** returns to the previous Earth view; **Reset orbital view** restores the chosen whole/near framing. Zoom buttons support touch screens. Focus the sky for arrow-key orbiting, plus/minus zoom and Home reset.

Camera gestures leave study time and physical positions unchanged. Follow uses the displayed packet timestamp, including direct seeks and reversal. A hidden, unavailable or expired selection ends follow. Camera distance stays within 1.08–60 Earth radii around Earth or 0.15–60 around a followed body; an ellipsoid clearance clamp prevents passing through Earth. Follow initially looks from 2.5 Earth radii outward from the body and carries its orientation in the body’s radial frame, with authored screen-size glyphs unchanged.

Descent captures the current orbital pose and travels to the same Sydney observer on a reversible great-circle radial path. Rotation joins the starting view to the surface aim; clearance also covers antipodal starts. Orbit gestures are suspended during descent and at the surface. The **Watch Sydney pass** cue resets manual orbit/follow before descending to its retained composition. Reduced motion still lands directly and leaves study playback paused.

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
- `npx playwright install chromium webkit` then `npm run test:browser` checks desktop and phone layouts, drag/wheel/keyboard navigation, focus/follow and expiry, reversible custom-view descent, full animated cue, reduced motion, identity/time preservation, selection, reversal, boundary stops, retry and tamper rejection.

## Publication

A successful main `Deploy Pages` run publishes to GitHub Pages. A separate Cloudflare workflow downloads that exact checked artifact using pinned Motion Studies hosting tools. It serves both custom-domain addresses, verifies release identity and cache policies at each, and keeps the canonical HTML link at the subdomain root. Builds do not fetch provider data.

Cloudflare uses a main-only `cloudflare` environment with `CLOUDFLARE_API_TOKEN`, enabled by `CLOUDFLARE_ENABLED=true`. The token belongs in GitHub's encrypted environment secret. See [hosting](docs/HOSTING.md) for staging, retry and rollback.

## Next composition

Refine Earth geography, the horizon and the visual space around the interactive camera, while retaining explicit source groups and attachment handling. Measure the complete playback on a named physical phone before claiming the 30 fps target. Gaia stellar depth and much longer clocks remain distant optional research.

The build includes dependency and font licence notices under `licences/`. Code is MIT licensed. The stellar dataset retains its separate CC BY-SA 4.0 licence and attribution; the code licence does not grant data rights.
