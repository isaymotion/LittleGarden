# Little Garden: handoff

## 1. Project and audience
- **What:** Little Garden, Dr. Isabella Navarro's personal monthly expense tracker in Philippine pesos (PHP). Private, offline, data only in the browser (localStorage). Originally built by ChatGPT; rebuilt and extended by Claude on 2026-11-16.
- **Repo:** `isaymotion/LittleGarden` (GitHub; the clone URL is lowercase `littlegarden`). Live from `main` on GitHub Pages: https://isaymotion.github.io/LittleGarden/
- **Branches:** `main` = the site. `dev-tools` = this doc plus `tools/` (browser_test.py, update_test.py, README; never merged into main).
- **Current version:** 2.3.1 (2026-11-16, PR #5 merged). Open PRs: none.

## 2. Fixed rules
- Footer and About attribution, exact: `App created by Isabella Navarro, MD. Latest version November 2026. isaymotion@gmail.com` (email is a mailto link). Only the month ever changes.
- Matches her other isaymotion apps (design skill `isaymotion-app-design`): dark top bar with ☰, sidebar toggle, back, forward, brand, search, Aa, theme, in that order. Drawer under 1100px, docked sidebar above. Bottom tab bar on phones: Home, Transactions, Insights, Menu. 3-state theme (match device / light / dark).
- Keeps its own **garden greens and system fonts** (no Google Fonts), so it makes no outside requests. Keep the pixel-art banner `welcome-banner.jpg` and icon `app-icon.png`.
- **Storage keys never change** (`little-garden-expenses-v1` etc.). Changing them loses her data.
- `sw.js` deletes only caches starting with `little-garden-` (all her apps share the isaymotion.github.io origin).
- Every release bumps three things that must agree: newest entry in `data/changelog.js`, `version` in `data/app-meta.js`, `VERSION` in `sw.js`. The footer month stays "November 2026" until a release in a later month.
- Pay me account list (`PAY_ACCOUNTS` in app.js) is fixed: e-wallets GCash, Maya (PayMaya); banks in alphabetical order BDO, BPI, GoTyme, MariBank, Maya Bank, Metrobank, Security Bank, UnionBank (GoTyme and BDO added in 2.3.1). Ids are storage keys, never rename them. Badges are coloured letters from each entry's `short` field (no bank logos); 3-letter badges get `.pay-badge--3`. To add a bank: one line in `PAY_ACCOUNTS` with a unique id and `short`, then update the test's account counts (10 add rows, 9 after one save).
- Category list: 14 fixed; **Miscellaneous must stay last** (`getCategory` falls back to the last entry).
- Her preference: use subagents for simple tasks to save tokens; Claude keeps design and final review.
- She tests on iPhone (Safari, installed to the home screen, usually dark mode).

## 3. Architecture and data formats
Plain HTML/CSS/JS, no build step.
```
index.html            shell (topbar, sidenav, tab bar, footer) + every screen as <div class="page-view" data-view="...">
styles.css            original styles, then appended blocks: "Version 2 shell", "Version 2.1", iOS date fix
app.js                one IIFE: data + rendering, "Version 2.1" features, "Version 2.3" Pay me + initUpdates, then the app shell (router, menu, theme...)
data/app-meta.js      window.APP_META {name, short, tagline, version, repo}, APP_LINKS, SHOW_OTHER_APPS=false
data/changelog.js     window.APP_CHANGELOG, newest first
sw.js                 network-first cache, PREFIX "little-garden-"
manifest.webmanifest  icons/icon-192.png + app-icon.png (512)
icons/                icon-192, apple-touch-icon (180), favicon-32 (made from app-icon.png)
README.md             features, upload list, release steps
```
**Routes** (hash): `#/` home, `#/pay-me` (menu group Start), `#/transactions`, `#/insights`, `#/calendar`, `#/budget`, `#/tools`, `#/whats-new`, `#/about`. Old `#journal` and `#reports` redirect. Adding a screen means a `page-view` in index.html plus an entry in `ROUTES` in app.js (label, icon, group); the menu builds itself.

**localStorage keys** (`KEYS` in app.js):
- Data: `little-garden-expenses-v1`, `-saved-views`, `-budgets`, `-recurring`, `-income-v1`.
- Settings: `-theme`, `-text-size`, `-nav-collapsed`, `-seen-news`, `-last-category`, `-last-method`.
- Pay me details: `little-garden-pay-me-v1` = `{gcash:{name,number,note,updatedAt}}`. **Pictures are NOT in localStorage**: IndexedDB database `little-garden-pay-me`, store `qr`, key = account id, value = JPEG data URL (scaled to 1400 px). Reason: every isaymotion app shares one origin and its ~5 MB localStorage.
- Housekeeping: `-last-backup`, `-backup-snooze`, `-import-undo`, `-expenses-recovery`.

Examples:
- Expense: `{"id":"uuid","date":"2026-11-16","item":"Groceries","price":450.5,"category":"Groceries","method":"GCash","notes":"","createdAt":"ISO","updatedAt":"ISO"}`. `method` is one of Cash, GCash, Card, Bank transfer, Other, or "".
- Budget: `{"overall":20000,"categories":{"Groceries":5000}}`
- Recurring: `{"id","item":"Internet","price":1699,"category":"Utilities & Internet","method":"","day":31,"doneMonth":"2026-11"}`
- Income: `{"id","date":"2026-11-15","source":"Salary","amount":50000}`
- Changelog entry: `{version:'2.2.0', date:'2026-11-16', title:'…', items:[{type:'feature'|'update'|'correction', text:'…', href:'#/budget'}]}`. The type shows as New, Improved or Fixed.

**JSON backup** = `{app, schemaVersion:1, appVersion, currency, exportedAt, categories, expenses, savedViews, budgets, recurring, income, payMe:{accounts:{id:{name,number,note,updatedAt,qr}}}}`. `exportJSON` is async (reads IndexedDB). Import accepts older files: sections that are missing are left alone. Pay me import: on merge, accounts already on the device win; on replace, accounts in the file overwrite and the rest are kept. Undo import does not cover Pay me. CSV columns: `id,date,item,price,category,method,notes,createdAt,updatedAt`.

## 4. Per-release recipe
1. `git fetch --depth=5 origin main && git checkout -B claude/<topic> origin/main`
2. Make the change. Reuse existing classes (`.panel`, `.section-heading`, `.button-primary/-outline/-quiet`, `.recent-transaction`, `.chart-card`, `.mini-form`).
3. Bump version in 3 places (section 2) and add a plain-language changelog entry at the top.
4. Update README.md if features changed; update any "N categories" text.
5. `node --check app.js`, then run the browser test (section 5) and add checks for the new feature.
6. Run `check_sw.py` from the `isaymotion-app-design` skill on the repo. Must PASS.
7. Commit (attribution lines per the system reminder), then `git -c push.negotiate=true push -u origin claude/<topic>`.
8. Open the PR with `gh api repos/isaymotion/LittleGarden/pulls -f title=… -f head=… -f base=main -f body=…`, then merge with `gh api -X PUT repos/isaymotion/LittleGarden/pulls/N/merge -f merge_method=merge`. She asked for updates to be pushed live, so merge.
9. Tell her: wait a minute or two for Pages, then close and reopen the app.

## 5. Commands
```bash
git clone --depth 1 https://github.com/isaymotion/littlegarden /home/claude/littlegarden
git -C /home/claude/littlegarden fetch --depth=1 origin dev-tools:refs/remotes/origin/dev-tools   # the plain fetch leaves no origin/dev-tools ref in a shallow clone
git -C /home/claude/littlegarden show origin/dev-tools:tools/browser_test.py > /home/claude/browser_test.py
git -C /home/claude/littlegarden show origin/dev-tools:tools/update_test.py > /home/claude/update_test.py
cd /home/claude/littlegarden && (python3 -m http.server 8765 >/dev/null 2>&1 &) && sleep 1
python3 /home/claude/browser_test.py | grep -v '^PASS'    # passing = only "ERRORS []" (169 PASS lines; needs Pillow)
pkill -f "http.server 8765"
python3 /home/claude/update_test.py /home/claude/littlegarden   # only if sw.js or initUpdates changed: 4 PASS, "ERRORS []"
```
Screenshots go to `/tmp/lg-shots` (phone-*.png, desktop-*.png). Look at them after visual changes.

## 6. Status
| Area | State |
|---|---|
| Bug audit of ChatGPT code | Done (2.0.0): about 15 fixes, listed in the changelog |
| Shared shell, menu, back/forward, search, theme, Aa | Done (2.0.0) |
| What's New, About, Calendar screen | Done (2.0.0) |
| Budget, recurring, income, payment method, suggestions, backup reminder, phone cards | Done (2.1.0) |
| iPhone date-field overflow | Fixed (2.1.1); **not yet confirmed on her phone** |
| Clothes and Books categories (Lifestyle & other) | Done (2.2.0) |
| Pay me (QR codes, viewer, Home row, backup) | Done (2.3.0); GoTyme and BDO added (2.3.1); **not yet tried on her iPhone** |
| Automatic updates (stale 2.1.0 on her phone) | Fixed (2.3.0); verified in Chromium with service workers on; **not yet confirmed on her iPhone** |
| Browser test | 169 checks, all pass on 2.3.1 |

## 7. Next steps
- First ask: (1) after closing and reopening the app, does About show 2.3.0? Once she is on 2.3.0 later updates arrive by themselves. (2) Do the date boxes fit (2.1.1)? (3) Did a Pay me QR upload, show and share work on her iPhone?
- Pay me ideas not built (offer only if she asks): more accounts (one line each, see section 2), reordering, auto-cropping the QR from a full screenshot, raising screen brightness (not possible from a web page).
- Open choice from 2.2.0: she may want Clothes moved to the "Health & care" area beside Shopping & Personal Care. It is a one-line `area:` change in `categories` in app.js, plus the README table.
- Known limits she was told about, if she asks:
  - income is not in the PDF report or the yearly charts;
  - recurring items are monthly only;
  - the payment-method list is fixed.
- Other apps menu group: `SHOW_OTHER_APPS` is false in `data/app-meta.js`, as in her other apps. Turn it on only when she interlinks them all.
- The next version is 2.3.1 for a fix or 2.4.0 for a feature.

## 8. Pitfalls learned
- **iOS Safari date and month inputs** have a native minimum width and centred text, so they overflow cards. The fix is at the end of styles.css (`appearance:none; min-width:0`). WebKit can't be installed here, so ask for a screenshot.
- `gh pr create` fails (GraphQL is blocked). Use the REST calls in section 4. The Pages status API is also blocked, so you can't confirm a deploy; just tell her to wait.
- In Playwright, click radio buttons inside `.seg` with `pg.check('input[...]')`, not by clicking the span (the transparent input covers it).
- `data-view` names must match the `ROUTES` keys (`transactions`, `insights`), or the screen never shows.
- Home's summary and comparison always use the **current** month; Insights and Calendar share `#reportMonth` (Calendar's `#calendarMonth` mirrors it).
- `setJournalFilters({query, category, month, sort, date, method})` is the one entry point for jumping to filtered Transactions. Use it, then `go("transactions")`.
- `go(name, after)` runs `after` once the screen shows (used for focusing the form on Edit).
- CSV rows without IDs are de-duplicated on date+item+price+category+notes (method left out on purpose).
- The What's New badge for an existing user counts every entry after the first release. A brand-new visitor starts at zero.

- **Update logic** (`initUpdates`): registers `sw.js` with `updateViaCache:"none"`, calls `reg.update()` when the app becomes visible (30 s throttle), reloads on `controllerchange` except the very first takeover (a fresh page with no controller). If she is typing (focus in a field, form has text, or a Pay me editor is open) the reload waits until the app is hidden. Bug found and fixed while building: a plain `hadController` const made a first-visit page ignore every later update.
- To test updates for real, run `tools/update_test.py` (section 5). browser_test.py blocks service workers, so it cannot catch update bugs.
- Headless Chromium has no file sharing, so Pay me shows "Save picture" there; on iPhone it shows "Share". Share builds the File synchronously before `navigator.share()` because iOS needs the call right after the tap.
- In Playwright, give the clipboard permission with `ctx.grant_permissions([...], origin=...)` before testing Copy.
- On a shallow clone, re-fetching dev-tools may be refused as non-fast-forward; use `git fetch --depth=3 origin +dev-tools:refs/remotes/origin/dev-tools`.

## 9. Files to re-attach
None. Everything is in the repo. Her other apps' repos (for design reference) are public under `isaymotion`.
