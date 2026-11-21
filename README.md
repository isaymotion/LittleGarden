# Little Garden — Monthly Expense Tracker

A mobile-first, garden-inspired monthly expense tracker for GitHub Pages. Records use Philippine pesos (PHP), with 14 fixed categories, search, monthly reports, charts, CSV/JSON backup and restore, and optional install/offline support.

## Features

- **Local-first storage:** expenses are saved in this browser using `localStorage`; no account or server/database is needed.
- **Entry fields:** date, item/description, price in PHP, fixed category, and optional notes.
- **21 fixed categories:** Groceries; Restaurants & Dining; Coffee & Snacks; Medications & Healthcare; Property & Real Estate; Rent & Housing; Utilities & Internet; Subscriptions; Pets; Transportation; Travel; Shopping & Personal Care; Beauty & Grooming; Clothes; Hobbies & Entertainment; Education & Professional Development; Professional Fees; Books; Gifts & Donations; Taxes & Government Fees; Miscellaneous.
- **Home dashboard:** quick expense entry, monthly summary, and the five most recent transactions; select a recent item to jump to its matching transaction.
- **Insights:** monthly totals, category and area charts, daily spending, comparisons, calendar, and yearly trends.
- **Transactions:** searchable, filterable, sortable history with edit and delete actions; shown as cards on phones.
- **Find records:** text search, category/month filters, and sort options.
- **Backup/restore:** JSON backup and CSV export; imports validate records, support merge/replace, and show useful errors.
- **PDF report export:** printable weekly, monthly, or yearly reports with spreadsheet-style (default) and visual layouts, charts, insights, and all transactions.
- **Budget and income:** a monthly total and optional per-category limits with progress bars on Home (amber from 80% used, red when over, with an "about ₱X a day" figure for the days left); recurring expenses (weekly, monthly, every 3 months or yearly) that wait on Home when due until added or skipped; optional income entries with "left after spending". Income also appears in the PDF report and in an Insights chart of income, spending and savings rate by month.
- **Payment method:** optional on each expense, from a list she can edit in Budget and income (starts as Cash / GCash / Card / Bank transfer / Other; stored under `little-garden-methods`). An expense keeps its method even after that method is taken off the list. There is a chart by payment method and a `method` column in the CSV.
- **Trips:** a trip has a name, dates, a currency and an exchange rate (pesos for 1 unit). New expenses dated within a trip join it automatically, and on a trip abroad the price can be typed in that currency: it is saved in pesos (`price`) with the typed amount kept beside it (`fxAmount`, `fxCurrency`). Each trip shows its total, daily average and top categories, and Home shows a card while a trip is under way. Trips are stored under `little-garden-trips-v1` and travel in the JSON backup; the CSV has `trip`, `foreignAmount` and `foreignCurrency` columns.
- **Repeat an expense:** the ↻ button on a recent entry or a transaction adds it again for today, with Undo.
- **Phones:** the entry form waits behind a round + button, so Home starts with the summary, budget and recurring items.
- **Save to Files or iCloud:** where the browser can share files, Tools and backup offers the JSON backup to the share sheet.
- **Faster entry:** description suggestions from past entries fill in the category and payment method.
- **Pay me:** save QR codes for GCash and Maya (PayMaya), and for BDO, BPI, GoTyme, MariBank, Maya Bank, Metrobank, Security Bank and UnionBank, with the name and number on each account. Show a code full screen (white card, readable in dark mode), copy the number, or share the picture. Pictures are kept in IndexedDB (`little-garden-pay-me` database), details in `localStorage`; both are in the JSON backup. Home shows a one-tap row once a code is saved.
- **Automatic updates:** the installed app checks for a new version each time it returns to the screen and reloads once when one takes over (later if you are typing).
- **Backup reminder:** shown on Home when the last export is more than 30 days old.
- **PWA:** manifest, app icon, install prompt where supported, and a service worker for offline app-shell caching.
- **Quick expense entry:** the form sits directly below the garden banner, with compact mobile spacing and comfortable touch targets.
- **Navigation shared with the other isaymotion apps:** dark top bar with ☰ menu, back/forward buttons (Alt+Left / Alt+Right), search, text size (Aa) and theme; docked sidebar on wide screens, drawer plus bottom tab bar (Home, Transactions, Insights, Menu) on phones and tablets. Each screen has its own address (`#/transactions`, `#/insights`, `#/calendar`, `#/budget`, `#/trips`, `#/pay-me`, `#/tools`, `#/whats-new`, `#/about`), so the browser's Back button works.
- **What's new page** with an unseen-changes badge, and an **About** page with theme and text size settings.
- **Responsive garden theme:** light, dark, or match device; no third-party libraries or external runtime requests.

### Four spending areas

| Spending area | Categories |
|---|---|
| Daily living | Groceries, Restaurants & Dining, Coffee & Snacks, Utilities & Internet, Subscriptions |
| Health & care | Medications & Healthcare, Pets, Shopping & Personal Care, Beauty & Grooming, Clothes |
| Property & transport | Property & Real Estate, Rent & Housing, Transportation, Travel |
| Lifestyle & other | Hobbies & Entertainment, Education & Professional Development, Professional Fees, Books, Gifts & Donations, Taxes & Government Fees, Miscellaneous |

## Run locally

Because service workers require HTTPS or localhost, use a local web server rather than opening `index.html` directly if you want to test offline/PWA features.

With Python installed:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

## Publish with GitHub Pages

1. Create a new GitHub repository, for example `little-garden-expenses`.
2. Upload all project files from this folder to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `data/app-meta.js`
   - `data/changelog.js`
   - `icons/` (`icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`)
   - `app-icon.png`
   - `welcome-banner.jpg`
   - `manifest.webmanifest`
   - `sw.js`
   - `icon.svg`
   - `README.md`
3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose branch `main` and folder `/(root)`, then click **Save**.
6. Wait for GitHub Pages to finish publishing. The site URL will look like `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.
7. Open the published URL using HTTPS. Add it to your phone's home screen or use the **Install app** prompt where supported.

If you deploy to a project site (a repository other than `YOUR-USERNAME.github.io`), keep all file references relative (`./styles.css`, `./app.js`, etc.), as they are in this project. This allows the app to work under the repository subpath.

## Data and privacy notes

- Your expense records are stored in the browser profile on the device where you enter them. They do not automatically sync between devices or browsers.
- Clearing browser site data can erase your entries. **Export JSON backups regularly.**
- CSV is intended for spreadsheet portability. JSON preserves record IDs and metadata, plus saved views, budget, recurring expenses, income, payment methods, trips and Pay me accounts, and is the preferred full-fidelity backup.
- During import, **Merge** adds/updates records by ID; **Replace** asks first, then replaces the current records with the imported file. CSV rows without IDs are matched on date, item, price, category and notes, so importing the same CSV twice does not create duplicates. **Undo last import** restores the records you had before the most recent import.
- Imported data is validated. The fixed category names must match exactly. Keep a backup before replacing records.
- The service worker caches the app shell for offline loading after the app has been opened online at least once. Browser storage and offline behavior vary by browser.
- This is a personal record-keeping tool, not a bank-connected app or financial advice service.

## Updating the app

For every release, change these together so they agree:

1. Add an entry at the top of `data/changelog.js` (this is the What's new page).
2. Set `version` in `data/app-meta.js`.
3. Set `VERSION` in `sw.js` (for example `PREFIX + "2.0.1"`), so phones pick up the new files.
4. Update "Latest version <Month YYYY>" in the footer of `index.html` and in `data/app-meta.js`.

Then commit and push to the `main` branch. The service worker only ever deletes caches whose names start with `little-garden-`, because all isaymotion apps share one site and one cache storage.

## Dark mode and search

- Use the theme button in the top bar to switch between match device, light and dark. The choice is saved locally in this browser and does not change expense data.
- Search supports multiple words (all words must match) across description, notes, category, broader spending area, date in ISO or readable format, day/month, amount (including PHP-formatted amount), and record ID. You can combine search with the category and month filters.
- Example searches: `groceries`, `2026-10`, `October 10 2026`, `Pets`, `Health & care`, or `250.00`.
- The footer displays the requested creator attribution and email link.


## Spending insights and garden artwork

This build includes clickable category/spending-area pie chart segments and legend items, top 5/10 expenses, a yearly summary, category trends across 12 months, a daily spending heatmap, and comparisons between any two custom date ranges. Clicking a chart item filters the journal to the matching category or spending area for the selected month. Heatmap dates open the corresponding day in the journal.

The welcome banner uses `welcome-banner.jpg`; the install/app icon uses `app-icon.png`, with smaller copies in `icons/` for the home screen and browser tab. All are cached for offline use.
