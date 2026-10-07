# ZENIT working agreements

ZENIT is an independent public Motion Studies edition. The canonical creative brief and source audit live in `emmettl/motionstudies`, under `docs/ZENIT.md` and `docs/ZENIT-SOURCES.md`.

- Keep acquisition, raw captures, credentials and work stores outside the public artifact. Data publication needs a retained source and rights audit.
- The stellar reference uses the pinned HYG 4.4 bright subset; the ISS proof uses one retained CelesTrak GP record. Preserve its source hash, J2000 epoch, attribution and CC BY-SA data licence. Preserve its TEME frame, WGS72/AFSPC SGP4 contract, 24-hour element-age limit and dated study interval. Do not invent satellites, observed tracks or stellar motion.
- Edition code owns orbital frames, camera composition and adapters. Consume exact published shared packages; never import sibling repository source or use filesystem package links.
- Keep relative assets working at `/zenit/`, the subdomain root and GitHub Pages. The canonical URL is `https://zenit.motionstudies.app/`.
- Run `npm run check` and `npm run test:browser` for application changes. Publishing uses a successful main Pages artifact followed by the independent Cloudflare workflow. No provider fetches during CI builds or from visitors.
- The night-side Sydney ISS pass and coupled stellar clock are implemented; larger orbital cohorts remain subsequent composition work. Gaia stellar depth and long-time motion remain distant optional research.
