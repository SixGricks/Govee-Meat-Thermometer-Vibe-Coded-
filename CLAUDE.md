# Project notes — Govee BBQ Alarms

HACS-distributed Home Assistant integration plus a Lovelace card.

- Integration: `custom_components/govee_bbq/` (domain `govee_bbq`, `config_flow`)
- Lovelace card: `govee-bbq-card.js`
- HACS metadata: `hacs.json`, repo info in `info.md` / `README.md`

## Releases & versioning (IMPORTANT)

HACS detects updates from **published GitHub Releases**. With no releases it
falls back to the default branch, which makes update prompts unreliable. So:

- **Every PR that changes the integration or card must bump the `version` in
  `custom_components/govee_bbq/manifest.json`** using semver (e.g. `1.1.0`).
- **Tagging/releasing is automated**: `.github/workflows/release.yml` creates
  the matching `vX.Y.Z` git tag + GitHub Release whenever the manifest version
  changes on `main` (or via a manual "Run workflow" for the current version).
  So a version bump merged to `main` is all that's needed.
- A bare git tag is **not** enough for HACS — it must be a published GitHub
  *Release* (which the workflow does) for HACS to pick it up.
- After a user updates via HACS, the integration needs a **full Home Assistant
  restart** (not just a config-entry reload) to load new Python code. Frontend
  card changes need a browser hard-refresh and may need the resource `?v=`
  bumped.

### Tag history
- `v1.1.0` — first tagged release; redesigned BBQ card + QA fixes (commit `db76c8f`).
