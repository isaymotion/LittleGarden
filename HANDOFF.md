# Little Garden: handoff

## 1. Project and audience
- **What:** Little Garden, Dr. Isabella Navarro's personal monthly expense tracker in Philippine pesos (PHP). Private, offline, data only in the browser (localStorage + IndexedDB). Originally built by ChatGPT; rebuilt and extended by Claude from 2026-11-16.
- **Repo:** `isaymotion/LittleGarden` (GitHub; the clone URL is lowercase `littlegarden`). Live from `main` on GitHub Pages: https://isaymotion.github.io/LittleGarden/
- **Branches:** `main` = the site. `dev-tools` = this doc plus `tools/` (browser_test.py, update_test.py, README; never merged into main).
- **Current version:** 2.6.2 (2026-11-23, rename a payment method) = PR #10, merged 2026-11-23. Open PRs: none. 2.6.1 = PR #9, merged 2026-11-23. 2.6.0 = PR #8, merged 2026-11-22. 2.5.0 = PR #7 (seven new categories), merged 2026-11-21. 2.4.0 = PR #6 (trips and more), merged 2026-11-17. 2.4.1 and 2.4.2 = Ko-fi support link and card, committed straight to `main` by another chat on 2026-11-21.

## 2. Fixed rules
- Footer and About attribution, exact: `App created by Isabella Navarro, MD. Latest version November 2026. isaymotion@gmail.com` (email is a mailto link). Only the month ever changes.
- Matches her other isaymotion apps (design skill `isaymotion-app-design`): dark top bar with ☰, sidebar toggle, back, forward, brand, search, Aa, theme, in that order. Drawer under 1100px, docked sidebar above. Bottom tab bar on phones: Home, Transactions, Insights, Menu. 3-state theme (match device / light / dark).
- Keeps its own **garden greens and system fonts** (no Google Fonts), so it makes no outside requests. Keep the pixel-art banner `welcome-banner.jpg` and icon `app-icon.png`.
- **Storage keys never change** (`little-garden-expenses-v1` etc.). Changing them loses her data. New keys are fine.
- `sw.js` deletes only caches starting with `little-garden-` (all her apps share the isaymotion.github.io origin).
- Every release bumps three things that must agree: newest entry in `data/changelog.js`, `version` in `data/app-meta.js`, `VERSION` in `sw.js`. The footer month stays "November 2026" until a release in a later month.
- Pay me account list (`PAY_ACCOUNTS` in app.js) is fixed: e-wallets GCash, Maya (PayMaya); banks in alphabetical order BDO, BPI, GoTyme, MariBank, Maya Bank, Metrobank, Security Bank, UnionBank. Ids are storage keys, never rename them. Badges are coloured letters from each entry's `short` field (no bank logos); 3-letter badges get `.pay-badge--3`. To add a bank: one line in `PAY_ACCOUNTS` with a unique id and `short`, then update the test's account counts (10 add rows, 9 after one save).
- Category list: 21 fixed; **Miscellaneous must stay last** (`getCategory` falls back to the last entry). Clothes is in the "Health & care" area since 2.4.0 (her choice). Pets (🐾, Health & care) has existed since 1.x. 2.5.0 added, each placed next to its closest relative: ☕ Coffee & Snacks and 📺 Subscriptions (Daily living), 🏠 Rent & Housing and ✈️ Travel (Property & transport), 💇 Beauty & Grooming (Health & care), 🩺 Professional Fees and 🏛️ Taxes & Government Fees (Lifestyle & other). Budget inputs are `budgetCat{index}`, so indexes shift when a category is inserted; the test finds budget boxes by label text, not index. Budgets are keyed by category name, so inserting mid-list is safe; to add one: a line in `categories` in app.js, then "N categories" in index.html (Insights subtitle) and README (list and area table), and the count in the browser test.
- `price` on an expense is **always pesos**. A foreign amount is extra (`fxAmount`, `fxCurrency`), never a replacement.
- **Ko-fi support** (2.4.1/2.4.2, same as her other apps): `kofi` in `data/app-meta.js`, a `.support-line` link under the footer attribution, and a `.support-card` panel at the end of Home (index.html) and About (`renderAbout` in app.js), link `https://ko-fi.com/isaymotion`. Keep them.
- Her preference: use subagents for simple tasks to save tokens; Claude keeps design and final review.
- She tests on iPhone (Safari, installed to the home screen, usually dark mode).

## 3. Architecture and data formats
Plain HTML/CSS/JS, no build step.
```
index.html            shell (topbar, sidenav, tab bar, + button, footer) + every screen as <div class="page-view" data-view="...">
styles.css            original styles, then appended blocks: "Version 2 shell", "Version 2.1", iOS date fix, "Version 2.3: Pay me", "Version 2.4"
app.js                one IIFE: data + rendering, "Version 2.1" features, "Version 2.4" block (phone form, repeat, methods, trips), "Version 2.3" Pay me + initUpdates, then the app shell (router, menu, theme...)
data/app-meta.js      window.APP_META {name, short, tagline, version, repo}, APP_LINKS, SHOW_OTHER_APPS=false
data/changelog.js     window.APP_CHANGELOG, newest first
(app.js also has a "Version 2.6: Subscriptions" block just before the Pay me block; styles.css ends with a "Version 2.6" block)
sw.js                 network-first cache, PREFIX "little-garden-"
manifest.webmanifest  icons/icon-192.png + app-icon.png (512)
icons/                icon-192, apple-touch-icon (180), favicon-32 (made from app-icon.png)
README.md             features, upload list, release steps
```
**Routes** (hash): `#/` home, `#/pay-me` (menu group Start), `#/transactions`, `#/insights`, `#/calendar`, `#/budget`, `#/trips`, `#/subscriptions` (2.6, badge "subs"), `#/tools`, `#/whats-new`, `#/about`. Old `#journal` and `#reports` redirect. Adding a screen means a `page-view` in index.html plus an entry in `ROUTES` in app.js (label, icon, group); the menu builds itself. `route()` also sets `body[data-route]`.

**localStorage keys** (`KEYS` in app.js):
- Data: `little-garden-expenses-v1`, `-saved-views`, `-budgets`, `-recurring`, `-income-v1`, `-methods` (2.4), `-trips-v1` (2.4), `-subscriptions-v1` (2.6). Flag `-subs-migrated` (2.6) marks the one-time move from Recurring. `-subs-skipped` (2.6.1) = array of normalized names she marked "Not a subscription".
- Settings: `-theme`, `-text-size`, `-nav-collapsed`, `-seen-news`, `-last-category`, `-last-method`.
- Pay me details: `little-garden-pay-me-v1` = `{gcash:{name,number,note,updatedAt}}`. **Pictures are NOT in localStorage**: IndexedDB database `little-garden-pay-me`, store `qr`, key = account id, value = JPEG data URL (scaled to 1400 px). Reason: every isaymotion app shares one origin and its ~5 MB localStorage.
- Housekeeping: `-last-backup`, `-backup-snooze`, `-import-undo`, `-expenses-recovery`.

Examples:
- Expense: `{"id":"uuid","date":"2026-11-16","item":"Ramen","price":480,"category":"Restaurants & Dining","method":"GCash","notes":"","createdAt":"ISO","updatedAt":"ISO","trip":"<trip id>","fxAmount":1200,"fxCurrency":"JPY"}`. `trip`, `fxAmount`, `fxCurrency` are present only when used. `method` is any string up to 30 characters or "" (no longer a fixed list).
- Payment methods: `["Cash","GCash","Card","Bank transfer","BPI credit card"]` (max 20; key absent = the five defaults). An expense keeps a method that was later removed from the list; charts show it as an extra slice.
- Trip: `{"id","name":"Kansai","start":"2026-11-30","end":"2026-12-14","currency":"JPY","rate":0.4}`. `rate` = pesos for 1 unit; `currency:"PHP"` means no conversion (rate 1).
- Budget: `{"overall":20000,"categories":{"Groceries":5000}}`
- Recurring: `{"id","item":"Internet","price":1699,"category":"Utilities & Internet","method":"","freq":"monthly","day":31,"done":"2026-11"}`. `freq` = monthly | weekly (`weekday` 0-6, Sunday 0) | quarterly (`day`, `month` = any month it falls in) | yearly (`day`, `month`). `done` = the period already handled: `YYYY-MM`, or for weekly the Monday `YYYY-MM-DD` of that week. Data from before 2.4 has `doneMonth` and no `freq`; `cleanRecurring` reads it as monthly.
- Income: `{"id","date":"2026-11-15","source":"Salary","amount":50000}`
- Subscription (2.6): `{"id","name":"Netflix","price":549,"cycle":"monthly"|"yearly","next":"2026-12-01","day":1,"auto":true,"remind":-1|0|1|3|7,"method":"GCash","notes":"","status":"active"|"ended","endedOn"?}`. `next` = date it next renews (auto) or expires (by hand). `day` = anchor day of month so the 31st stays at month end (`addCycle`). Payments are plain expenses in category Subscriptions with notes "Auto-debit" or "Renewed"; no link back.
- Changelog entry: `{version:'2.2.0', date:'2026-11-16', title:'…', items:[{type:'feature'|'update'|'correction', text:'…', href:'#/budget'}]}`. The type shows as New, Improved or Fixed.

**JSON backup** = `{app, schemaVersion:1, appVersion, currency, exportedAt, categories, expenses, savedViews, budgets, recurring, income, methods, trips, subscriptions, payMe:{accounts:{id:{name,number,note,updatedAt,qr}}}}`. Built by `buildBackup()` (async, reads IndexedDB); `exportJSON` downloads it, `shareBackup` hands it to the share sheet. Import accepts older files: sections that are missing are left alone. On merge: methods are joined, trips and subscriptions merge by id. Pay me import: on merge, accounts already on the device win; on replace, accounts in the file overwrite and the rest are kept. Undo import covers methods and trips but not Pay me. CSV columns: `id,date,item,price,category,method,notes,createdAt,updatedAt,trip,foreignAmount,foreignCurrency` (`trip` holds the trip's **name**; on import it is matched to an existing trip, otherwise dropped).

## 4. Per-release recipe
1. `git fetch --depth=5 origin main && git checkout -B claude/<topic> origin/main`. Always start from the latest `main`: other chats (cross-app rollouts such as Ko-fi) commit to it directly, and the version may have moved on.
2. Make the change. Reuse existing classes (`.panel`, `.section-heading`, `.button-primary/-outline/-quiet`, `.recent-transaction`, `.chart-card`, `.mini-form`, `.seg`).
3. Bump version in 3 places (section 2) and add a plain-language changelog entry at the top.
4. Update README.md if features changed; update any "N categories" text.
5. `node --check app.js`, then run the browser test (section 5) and add checks for the new feature.
6. Run `check_sw.py` from the `isaymotion-app-design` skill on the repo. Must PASS.
7. Commit (attribution lines per the system reminder), then `git -c push.negotiate=true push -u origin claude/<topic>`.
8. Open the PR with `gh api repos/isaymotion/LittleGarden/pulls -f title=… -f head=… -f base=main -f body=…`, then merge with `gh api -X PUT repos/isaymotion/LittleGarden/pulls/N/merge -f merge_method=merge`. She asked for updates to be pushed live. The merge call can be denied by the session's permission check when she has not said "merge" in the chat (it happened with PR #6): do not try another route; leave the PR open and ask her. Once she said "Merge please" it went through.
9. Tell her: wait a minute or two for Pages, then close and reopen the app.

## 5. Commands
```bash
git clone --depth 1 https://github.com/isaymotion/littlegarden /home/claude/littlegarden
git -C /home/claude/littlegarden fetch --depth=1 origin dev-tools:refs/remotes/origin/dev-tools   # the plain fetch leaves no origin/dev-tools ref in a shallow clone
git -C /home/claude/littlegarden show origin/dev-tools:tools/browser_test.py > /home/claude/browser_test.py
git -C /home/claude/littlegarden show origin/dev-tools:tools/update_test.py > /home/claude/update_test.py
cd /home/claude/littlegarden && (python3 -m http.server 8765 >/dev/null 2>&1 &) && sleep 1
python3 /home/claude/browser_test.py | grep -v '^PASS'    # passing = only "ERRORS []" (283 PASS lines on 2.6.2, 279 on 2.6.1; needs Pillow)
pkill -f "http.server 8765"
python3 /home/claude/update_test.py /home/claude/littlegarden   # only if sw.js or initUpdates changed: 4 PASS, "ERRORS []"
```
Screenshots go to `/tmp/lg-shots` (phone-*.png, desktop-*.png, phone-dark-*.png). Look at them after visual changes. Full-page phone shots show the sticky top bar and tab bar in the middle of the picture; that is the screenshot, not a bug.

## 6. Status
| Area | State |
|---|---|
| Bug audit of ChatGPT code | Done (2.0.0) |
| Shared shell, menu, back/forward, search, theme, Aa | Done (2.0.0) |
| What's New, About, Calendar screen | Done (2.0.0) |
| Budget, recurring, income, payment method, suggestions, backup reminder, phone cards | Done (2.1.0) |
| iPhone date-field overflow | Fixed (2.1.1); **confirmed by her on 2026-11-16** |
| Clothes and Books categories | Done (2.2.0); Clothes moved to Health & care (2.4.0) |
| Pay me (QR codes, viewer, Home row, backup) | Done (2.3.x); **upload, show and share confirmed on her iPhone** |
| Automatic updates | Fixed (2.3.0); **confirmed: her iPhone showed 2.3.1** |
| Trips with foreign-currency entry | Built (2.4.0); not yet tried on her iPhone |
| Phone + button, tucked-away form, toast with Undo | Built (2.4.0); not yet tried on her iPhone |
| Repeat an expense | Built (2.4.0) |
| Budget "Getting close" + per-day figure | Built (2.4.0). The amber bar at 80% already existed; 2.4.0 added the wording and the per-day figure |
| Income in PDF and Insights chart with savings rate | Built (2.4.0) |
| Recurring weekly / every 3 months / yearly | Built (2.4.0) |
| Editable payment methods | Built (2.4.0) |
| Save to Files or iCloud button | Built (2.4.0); **tested only with a stubbed share sheet, never on a real iPhone** |
| Ko-fi support link and card | Done (2.4.1, 2.4.2), by another chat |
| Seven new categories (Travel, Rent & Housing, Subscriptions, Coffee & Snacks, Beauty & Grooming, Taxes & Government Fees, Professional Fees) | Built and merged (2.5.0, PR #7); not yet seen on her iPhone |
| Subscriptions screen: auto-debit, Renewed / Let it end, Home card + menu count, Add to Calendar (.ics), migration from Recurring | Built and merged (2.6.0, PR #8). **.ics on iPhone untested** (headless Chromium only checks the file contents) |
| Subscriptions found in expenses (her bug report 2026-11-23: "HBO Max annual till Nov 12, 2027" typed as a plain expense never appeared in Subscriptions) | Built and merged (2.6.1, PR #9). "Found in your expenses" box + Track button in the add toast |
| Payment method rename (✎ in Budget and income; renames list, expenses, recurring, subscriptions, last method; GCash/Maya keeps GCash colour via prefix match in `methodColor`) | Built and merged (2.6.2, PR #10). She asked for GCash → "GCash/Maya"; she does the rename herself on her phone (data is on-device) |
| Browser test | 283 checks on 2.6.2 (rename checks at the end of the "found" context); 279 checks, all pass on 2.6.1 (2026-11-23; new "found" block in its own context at the very end); 271 on 2.6.0. Update test PASS and check_sw PASS on 2.6.1 |

## 7. Next steps
- **2.6.1 (PR #9) is live** (merged 2026-11-23). Ask whether it worked: she should open Subscriptions, tap Track on HBO Max, check the date and the Auto-debit box, and tap Add subscription.
- 2.6.1 design: an expense counts as tracked when its normalized item contains a subscription's name (or the subscription name contains the cleaned item name); ended subscriptions count too. `subGuessName` strips a date, a trailing "till/until/to/expires…" and words like annual/monthly. `guessSub`: yearly if those words appear or the date in the text is >200 days away; next = date in the text if today or later, else paid date plus cycles until not in the past. Only the last 400 days, one row per name, max 12. Auto-debit stays at its default (on); she checks it.
- **2.6.2 (PR #10) is live** (merged 2026-11-23). Ask if the rename worked: she taps ✎ beside GCash in Budget and income and types GCash/Maya.
- Small 2.6.1 gap seen in her screenshot: `subGuessName` does not strip numeric dates like "till 11/25" (name stayed "Claude max till 11/25"); `SUB_DATE_RE` only knows "Nov 12, 2027" and YYYY-MM-DD. Offer to fix if she wants.
- iPhone check answers from 2026-11-23: (fill in below when she replies)
- 2.6.0 is live (merged 2026-11-22). Ask, after she has reopened the app: (0) does Add to Calendar on a subscription open the iPhone "Add to Calendar" sheet (or land in Files, where tapping it adds it)? If it does neither, switch `subCalendarFile` to `navigator.share` with a text/calendar File or a data: URL. (1) does About show 2.6.0, and are the new categories in the form? (2) does the + button open the form and does the keyboard come up? (3) does "Save to Files or iCloud" appear in Tools and backup, and does the file arrive in Files? (4) does typing a price in yen on a trip work?
- Her Japan trip runs Nov 30 to Dec 14, 2026. She has to add the trip herself in Trips, with her own exchange rate. The app has no live rates (it makes no outside requests) and Claude must not suggest a rate from memory.
- Trip ideas not built (offer only if she asks): a budget per trip, a trip section in the PDF report, more than one currency per trip, splitting a shared cost.
- Recurring limit: an item not added before its period ends is not carried over (same as before 2.4).
- Known limits she was told about, if she asks: income is not in the category trend chart (it has its own chart); custom payment methods get an automatic colour.
- Pay me ideas not built (offer only if she asks): more accounts, reordering, auto-cropping the QR from a full screenshot.
- Other apps menu group: `SHOW_OTHER_APPS` is false in `data/app-meta.js`, as in her other apps. Turn it on only when she interlinks them all.
- The next version is 2.6.1 for a fix or 2.7.0 for a feature (check `data/app-meta.js` on `main` first, in case another chat released since).
- Ko-fi checks were added to the browser test in 2.5.0.
- Subscriptions design (her choices, 2026-11-22): own screen; auto-debit adds the payment by itself with Undo; Add to Calendar for real phone notifications (the app has no server, so no push); monthly/yearly recurring items in Subscriptions moved over once as paid by hand (weekly/quarterly ones stay in Recurring). New and edited dates must be today or later (the input has `min`), so nothing is back-filled by surprise. Undo of an auto-debit removes the payment but keeps the date moved on (otherwise it would be re-added); Undo of Renewed also restores the date.
- Subscription ideas not built (offer only if she asks): quarterly cycle, free-trial end dates, price-change history, a subscriptions section in the PDF report.
- Category ideas offered 2026-11-21 that she did NOT pick (offer only if she asks): Insurance, Loan/credit card payments, Family support/padala, Fitness & sports.

## 8. Pitfalls learned
- **iOS Safari date and month inputs** have a native minimum width and centred text, so they overflow cards. The fix is at the end of the 2.1 block in styles.css (`appearance:none; min-width:0`). WebKit can't be installed here, so ask for a screenshot.
- Pushing and `gh api` fail with 403 until the repo is attached with push access: call `add_repo` (owner isaymotion, repo LittleGarden, access push) first.
- `gh pr create` fails (GraphQL is blocked). Use the REST calls in section 4. The Pages status API is also blocked, so you can't confirm a deploy; just tell her to wait.
- In Playwright, click radio buttons inside `.seg` with `pg.check('input[...]')`, not by clicking the span (the transparent input covers it).
- `data-view` names must match the `ROUTES` keys (`transactions`, `insights`), or the screen never shows.
- Home's summary and comparison always use the **current** month; Insights and Calendar share `#reportMonth` (Calendar's `#calendarMonth` mirrors it).
- `setJournalFilters({query, category, month, sort, date, method, trip})` is the one entry point for jumping to filtered Transactions. Use it, then `go("transactions")`.
- `go(name, after)` runs `after` once the screen shows (used for focusing the form on Edit).
- **Top-of-file order in app.js matters**: `budgets`, `recurring`, `income`, `trips` and `METHODS` are loaded on the first lines, so anything their `clean…` functions use as a `const` (`FREQS`, `DEFAULT_METHODS`, `NO_METHOD`) must be declared above them. Functions are hoisted; consts are not.
- **Phone entry form** (700px and under): hidden unless `body.entry-open`. `setEntryOpen()` toggles it; `focusEntryForm()` opens it first; it starts open only when there are no expenses. The + button is `#fabAdd`; it hides when the form is open on Home. A message in `#formMessage` is invisible while the form is closed, so anything she must see goes through `showUndoToast(message, canUndo)` or a `.notice` in `#homeNotices` (the damaged-record warning does both).
- `showUndoToast` serves delete (`undoEntry={entry,index}`), quick add and repeat (`undoEntry={addedId}`), and plain messages (`canUndo=false`). In tests, hide a leftover toast with `document.getElementById('undoToast').hidden=true` before clicking things near the bottom of the screen.
- **Foreign-currency entry**: `fxMode()` returns the trip when the Trip box holds a non-PHP trip and the "price typed in" switch is on the foreign side. `onSave` converts at the trip's current rate, except when an edit leaves `fxAmount` unchanged: then the pesos first saved are kept. `autoTrip()` picks the trip by the form's date unless she chose one (`tripTouched`).
- Removing a trip strips the `trip` label from its expenses and keeps `fxAmount`.
- The Insights charts in `.trend-chart` are wider than a phone and scroll sideways; `scrollFlowChart()` brings the latest month into view (also called from `route()` because a hidden box cannot be scrolled).
- CSV rows without IDs are de-duplicated on date+item+price+category+notes (method left out on purpose).
- The What's New badge for an existing user counts every entry after the first release. A brand-new visitor starts at zero.
- **Update logic** (`initUpdates`): registers `sw.js` with `updateViaCache:"none"`, calls `reg.update()` when the app becomes visible (30 s throttle), reloads on `controllerchange` except the very first takeover. If she is typing (focus in a field, form has text, or a Pay me editor is open) the reload waits until the app is hidden.
- To test updates for real, run `tools/update_test.py` (section 5). browser_test.py blocks service workers, so it cannot catch update bugs.
- Headless Chromium has no file sharing, so Pay me shows "Save picture" and the Save to Files tool stays hidden there. The test stubs `navigator.canShare`/`share` in its last context. On iPhone `share()` must follow the tap directly: Pay me builds its File synchronously; the backup cannot (it reads IndexedDB), so a refused first try shows a second button, "Open the share sheet".
- In Playwright, give the clipboard permission with `ctx.grant_permissions([...], origin=...)` before testing Copy.
- On a shallow clone, re-fetching dev-tools may be refused as non-fast-forward; use `git fetch --depth=3 origin +dev-tools:refs/remotes/origin/dev-tools`.
- Bash calls were sometimes refused for a few minutes by the session's safety check ("no verdict"). Keep working with Write/Edit and retry later.

## 9. Files to re-attach
None. Everything is in the repo. Her other apps' repos (for design reference) are public under `isaymotion`.
