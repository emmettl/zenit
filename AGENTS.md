# ZENIT working agreements

ZENIT is an independent public Motion Studies edition. The canonical creative brief and source audit live in `emmettl/motionstudies`, under `docs/ZENIT.md` and `docs/ZENIT-SOURCES.md`.

- Keep acquisition, raw captures, credentials and work stores outside the public artifact. Data publication needs a retained source and rights audit.
- The stellar reference uses the pinned HYG 4.4 bright subset; orbital data remains pending. Preserve its source hash, J2000 epoch, attribution and CC BY-SA data licence. Do not invent satellites or observed stellar motion.
- Edition code owns orbital frames, camera composition and adapters. Consume exact published shared packages; never import sibling repository source or use filesystem package links.
- Keep relative assets working at `/zenit/`, the subdomain root and GitHub Pages. The canonical URL is `https://zenit.motionstudies.app/`.
- Run `npm run check` and `npm run test:browser` for application changes. Publishing uses a successful main Pages artifact followed by the independent Cloudflare workflow. No provider fetches during CI builds or from visitors.
- The visible-star field and surface descent are active composition goals. Gaia stellar depth and long-time motion remain distant optional research.
