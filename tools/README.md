# Little Garden dev tools

Kept on the `dev-tools` branch so they are never published with the site (GitHub Pages serves `main`).

## browser_test.py
End-to-end Playwright test (Chromium) of the live app files: navigation, edit, search, calendar,
saved views, What's New, About, theme, text size, import/undo, export, PDF, budget, recurring,
income, payment method, suggestions, backup reminder, phone card layout, Pay me (QR upload,
IndexedDB, viewer, copy, backup and restore), and the 2.4 features (phone + button and toast, repeat,
payment methods, weekly/yearly recurring, budget warnings, trips with yen entry, income chart and PDF,
backup of methods and trips, Save to Files with a stubbed share sheet), no horizontal overflow. Needs Pillow (makes the fake QR pictures).
Runs twice: phone 390px light, desktop 1366px dark, then two short phone runs (new visitor; dark with
stubbed file sharing). 243 checks on version 2.4.0. Takes about 3 minutes.

Put it anywhere; it only talks to a local web server.

```bash
git clone --depth 1 https://github.com/isaymotion/LittleGarden lg && cd lg
python3 -m http.server 8765 &          # serve the app
python3 /path/to/browser_test.py       # prints PASS/FAIL lines, ends with: ERRORS []
pkill -f "http.server 8765"
```

Options (environment variables):
- `LG_URL`  default `http://localhost:8765/index.html`
- `LG_OUT`  screenshot folder, default `/tmp/lg-shots`

Needs: `pip install playwright` (already present in Claude's workspace) and Chromium.
WebKit cannot be installed in Claude's workspace (download blocked), so iPhone Safari quirks
cannot be tested here: ask her for a screenshot.

## update_test.py
Checks the automatic-update logic with service workers ON (browser_test.py blocks them). Serves a
throwaway copy of the repo on port 8766 (`LG_UPDATE_PORT`), publishes fake versions by editing the
copy's sw.js, and checks: first install no reload, idle update reloads, second update reloads, typing defers.

```bash
python3 /path/to/update_test.py /path/to/littlegarden    # 4 PASS lines, ends with: ERRORS []
```
Run it whenever `initUpdates` in app.js or `sw.js` changes.

When a release adds or changes a feature, add checks to this file and push it back to `dev-tools`.
