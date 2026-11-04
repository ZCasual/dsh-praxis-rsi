# Browser acceptance & evidence (test/praxis/acceptance)

This directory holds the **real-browser acceptance gate** for the Praxis v2 contract
(`docs/praxis/redesign/10-v2-contract.md` §5.6/§5.7, §6, D2/D5). `browser.test.js` drives a
locally running DSH web instance with local Chrome over the zero-dependency CDP driver in
`tools/evidence/cdp.mjs`; it never uses npm browser libraries and never asserts against mock
DOM. When the configured instance is unreachable, has no token, or Chrome is missing, the
suite **skips with an explicit reason** (never silently passes).

**How to run.** Start (or reuse) an isolated test instance with an independent `statePath`
and Chrome profile — `capture.mjs` does this for you: `node tools/evidence/capture.mjs
--manage-server --theme light` (and `--theme dark` for the dark instance). For the browser
gate: `PRAXIS_BASE_URL=http://127.0.0.1:3081 PRAXIS_TOKEN=<token> PRAXIS_SERVER_LOG=/tmp/praxis-3081.log
node --test test/praxis/acceptance/browser.test.js`. Use `PRAXIS_THEME=dark` only against an
instance whose patch pins `ui-theme.preference: dark`; on a light instance the dark case skips
and points at the capture-generated evidence instead of faking a pass. Node 25 does not accept
a bare directory for `--test`, so pass the file or a glob.

**How evidence is generated.** `node tools/evidence/capture.mjs --all` (or two runs with
`--manage-server --theme light|dark`) starts its own DSH instance on a random free port, seeds
the requested scenarios through the Host API, captures `empty` / `running` / `selected` /
`blueprint` at 1440×1000 and 1024×900 (plus `selected-noncurrent`, `drawer-source`, `loading`,
`cognitive-map`), computes §5.6/§5.7 metrics (node visibility, bbox ratios/area, primary count,
internal-code count, overflow, font-size × world scale, sampled contrast) and writes
`docs/praxis/evidence/manifest.json` with sha256, build hash, git commit, node/package version,
port, masked token URL, statePath, viewport, theme, scenario and time. `violations` (unexpected)
and `expectedViolations` (documented allowances such as loading having no `.px-shell`, or the
drawer/map rule where drawer primaries are excluded) are reported separately; `ok` is true only
when there are no errors, no unexpected metric violations, and at least 8 required scene shots.
