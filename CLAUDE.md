# CLAUDE.md

Static dashboard for CISA's Known Exploited Vulnerabilities (KEV) catalog: a Python/Jinja2 generator builds a fully static site into `site/`, deployed to GitHub Pages by CI (https://badxkarma.github.io/cisa-kev/).

## Commands

These mirror CI (`.github/workflows/deploy.yml`). Python >=3.13 (pyproject.toml `requires-python`; `.python-version` pins 3.13), uv-managed — use `uv run`, not system python.

```bash
uv sync --locked                                  # install Python deps (requests, jinja2 only)
npm ci                                            # install frontend test deps (vitest + jsdom only)
uv run python -m unittest discover -s tests -v    # Python unit tests (stdlib unittest — pytest is NOT installed)
npm run test:frontend                             # frontend tests (vitest run); watch: npm run test:frontend:watch
uv run python app/generate_static.py              # fetch/refresh KEV data + regenerate site/ (hits live CISA endpoint)
uv run python -m py_compile app/*.py              # Python syntax check
python3 -m http.server 4173 --directory site      # local preview (.claude/launch.json "site"); no watch — re-run generator first
```

## Architecture

- **Generator** (`app/generate_static.py`): calls `update_if_changed()` from `app/data_utils.py` (fetches the CISA feed, writes `data/known_exploited_vulnerabilities.json` only if changed, falls back to local copy on fetch failure), then deletes and rebuilds `site/`: renders `app/templates/index.html` (the only template) via Jinja2, copies `app/static/` → `site/static/`, copies the data JSON → `site/known_exploited_vulnerabilities.json`.
- **Frontend**: six plain IIFE scripts in `app/static/js/` — no bundler, no ES modules, no build step. Load order in `index.html` is load-bearing (each module captures upstream namespaces at execution time): `dashboard-config.js` → `dashboard-date.js` → `dashboard-toast.js` → `dashboard-dom.js` → `dashboard-table.js` → `dashboard.js`. Each publishes one `Object.freeze`d namespace on `window` (`KevDashboardConfig/Date/Toast/Dom/Table`); `dashboard.js` is the bootstrap and publishes nothing.
- **Data flow**: `dashboard.js` fetches `./known_exploited_vulnerabilities.json` on DOMContentLoaded and builds all table rows once (dataset attributes + hidden detail rows). `dashboard-table.js` then does all filtering/sorting/pagination/triage-chips/CSV export purely against those DOM rows — it never re-fetches or touches the JSON model.
- **Settings**: persisted in localStorage key `kevDashboardSettingsV1` (search, perPage, density, columns, columnOrder). The `view` value is saved but deliberately NOT restored — it resets to `recent` on every load; don't "fix" this.
- **Data shape**: records have `cveID, vendorProject, product, vulnerabilityName, dateAdded, shortDescription, requiredAction, dueDate, knownRansomwareCampaignUse, notes, cwes`. `knownRansomwareCampaignUse` is exactly the string `Known` or `Unknown`.

## CI / deploy

- Main workflow `.github/workflows/deploy.yml`: push/PR to main, daily cron, manual dispatch. PRs run the full build (tests, generator, smoke test) but skip the data auto-commit, Pages artifact upload, and deploy. The auto-commit is gated on event != `pull_request`; the deploy job additionally requires ref == `refs/heads/main`.
- CI auto-commits the refreshed `data/known_exploited_vulnerabilities.json` as github-actions[bot] with `chore: update KEV data [skip ci]`.
- A second workflow, `.github/workflows/dependabot-auto-merge.yml`, auto-merges Dependabot patch/minor PRs (squash) via `pull_request_target` with `contents: write` — be careful editing it.
- The smoke test hard-codes required tokens in `site/index.html` (`id="main-table"`, `id="view-selector"`, `id="main-search"`, the dashboard-dom.js/dashboard-table.js script paths) and requires exactly the six dashboard JS files. Renaming IDs/files or adding a JS module means updating the "Validate JavaScript syntax" and "Smoke test generated site" steps too.

## Constraints & gotchas

- **Strict CSP** (meta tag in `index.html`): no external origins for scripts, styles, fonts, or fetch; no inline `<script>`/`<style>` (no `unsafe-inline`). Self-host everything — Inter fonts live in `app/static/fonts/`. One exception: `img-src 'self' data:` — the favicon is an inline `data:` SVG and depends on it. JS-set `element.style.*` is fine.
- **`data/known_exploited_vulnerabilities.json` is bot-managed** by CI. Never hand-edit or commit changes to it — discard local edits. Note that running the generator refreshes it as a side effect.
- **`site/` is gitignored build output**, destroyed (`rmtree`) on every generator run. Edit sources under `app/`, never `site/`.
- **Column labels live in two places**: the frozen `COLUMNS` array in `app/static/js/dashboard-config.js` AND the hard-coded `<th>` row in `app/templates/index.html`. Headers are bound to COLUMNS positionally — change both together.
- **Frontend test mock must mirror the template**: `tests/frontend/dashboard.test.js` evals the real production scripts and runs them against a hand-written DOM replica (`createBaseDom()`) of `index.html`. Any change to table headers, triage chips, or element IDs must be mirrored in the mock. Run vitest from the repo root (script paths resolve from cwd). `vitest.config.js` sets `globals: true` — no vitest imports in test files.
- `tests/test_data_utils.py` patches module-level attributes (`data_utils.LOCAL_PATH/requests/time`) — refactors like `from requests import get` or moving `LOCAL_PATH` into a function silently break the mocks.
- Dates are compared as ISO strings (lexicographic `YYYY-MM-DD`) in `dashboard-table.js` — keep them zero-padded ISO.
- New table columns must set dataset metadata via `setCellMetadata` (`dashboard-dom.js`) or column visibility/reorder/CSV export will skip them.
- Offline generator runs work only if the local data JSON already exists; missing file + failed fetch aborts the build.
- Commit style: imperative sentence case (`Add MIT LICENSE file`); bot/Dependabot commits use `chore:`/`deps:`/`ci:` prefixes.
