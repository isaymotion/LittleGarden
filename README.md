# Little Garden — Monthly Expense Tracker

A mobile-first, garden-inspired monthly expense tracker for GitHub Pages. Records use Philippine pesos (PHP), with 12 fixed categories, search, monthly reports, charts, CSV/JSON backup and restore, and optional install/offline support.

## Features

- **Local-first storage:** expenses are saved in this browser using `localStorage`; no account or server/database is needed.
- **Entry fields:** date, item/description, price in PHP, fixed category, and optional notes.
- **12 fixed categories:** Groceries; Restaurants & Dining; Medications & Healthcare; Property & Real Estate; Utilities & Internet; Pets; Transportation; Shopping & Personal Care; Hobbies & Entertainment; Education & Professional Development; Gifts & Donations; Miscellaneous.
- **Reports:** monthly total, number of entries, daily average, category pie chart, broader-area pie chart, and daily spending bar chart.
- **Find records:** text search, category/month filters, and sort options.
- **Backup/restore:** JSON backup and CSV export; imports validate records, support merge/replace, and show useful errors.
- **PWA:** manifest, app icon, install prompt where supported, and a service worker for offline app-shell caching.
- **Responsive garden theme:** works on mobile and desktop; no third-party libraries or external runtime requests.

### Four spending areas

| Spending area | Categories |
|---|---|
| Daily living | Groceries, Restaurants & Dining, Utilities & Internet |
| Health & care | Medications & Healthcare, Pets, Shopping & Personal Care |
| Property & transport | Property & Real Estate, Transportation |
| Lifestyle & other | Hobbies & Entertainment, Education & Professional Development, Gifts & Donations, Miscellaneous |

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
- CSV is intended for spreadsheet portability. JSON preserves record IDs and metadata and is the preferred full-fidelity backup.
- During import, **Merge** adds/updates records by ID; **Replace** replaces the current records with the imported file. CSV files that do not include IDs receive generated IDs, so repeated imports of the same CSV may create duplicate records.
- Imported data is validated. The fixed category names must match exactly. Keep a backup before replacing records.
- The service worker caches the app shell for offline loading after the app has been opened online at least once. Browser storage and offline behavior vary by browser.
- This is a personal record-keeping tool, not a bank-connected app or financial advice service.

## Updating the app

After changing files, commit and push them to the `main` branch. If a service worker cache makes an older version appear, bump `CACHE_NAME` in `sw.js` (for example, `little-garden-v2`) so clients install the new shell.

## Dark mode and search

- Use the **Dark mode / Light mode** button in the header. The chosen theme is saved locally in this browser and does not change expense data.
- Search supports multiple words (all words must match) across description, notes, category, broader spending area, date in ISO or readable format, day/month, amount (including PHP-formatted amount), and record ID. You can combine search with the category and month filters.
- Example searches: `groceries`, `2026-10`, `October 10 2026`, `Pets`, `Health & care`, or `250.00`.
- The footer displays the requested creator attribution and email link.
