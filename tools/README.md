# Little Garden dev tools

Kept on the `dev-tools` branch so they are never published with the site (GitHub Pages serves `main`).

## browser_test.py
End-to-end Playwright test (Chromium) of the live app files: navigation, edit, search, calendar,
saved views, What's New, About, theme, text size, import/undo, export, PDF, budget, recurring,
income, payment method, suggestions, backup reminder, phone card layout, Pay me (QR upload,
IndexedDB, viewer, copy, backup and restore), no horizontal overflow. Needs Pillow (makes the fake QR pictures).
Runs twice: phone 390px light, desktop 1366px dark. Takes about 2 minutes.

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

When a release adds or changes a feature, add checks to this file and push it back to `dev-tools`.
