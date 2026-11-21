/* What's new. Newest entry FIRST. version = semver string (also the key for the unseen badge),
   date = ISO YYYY-MM-DD. Item type: feature | update | correction.
   Optional per item: href (an in-app '#/...' link) shown as "Open".
   Add an entry for every release, then bump APP_META.version in data/app-meta.js, VERSION in sw.js,
   and "Latest version" in the footer of index.html. */
window.APP_CHANGELOG = [
  {
    version: '2.4.1', date: '2026-11-21', title: 'Support this app',
    items: [
      { type: 'update', text: 'This app stays free. If it helps you, there is now a “Support this app on Ko-fi” link at the bottom of every page.' }
    ]
  },
  {
    version: '2.4.0',
    date: '2026-11-16',
    title: 'Trips with yen, a quicker Home, and more ways to budget',
    items: [
      { type: 'feature', text: 'Trips: add a trip with its dates, its currency and your exchange rate. While you are away, new expenses join the trip on their own and you can type prices in that currency (yen, dollars, won and others). Each one is saved in pesos, so your monthly totals and budget stay right. Each trip shows its total, its daily average and its top categories.', href: '#/trips' },
      { type: 'update', text: 'On phones, Home is shorter: the entry form now waits behind a round + button at the bottom right, so your budget, recurring items and recent entries come first. After you add an expense, a short message offers Undo.' },
      { type: 'feature', text: 'Repeat an expense: tap ↻ beside a recent entry on Home, or on any entry in Transactions, to add it again for today.' },
      { type: 'update', text: 'Budget bars turn amber and say “Getting close” once 80% of a limit is used, and each bar shows about how much is left to spend per day for the rest of the month.' },
      { type: 'feature', text: 'Income now appears in the PDF report (income received, what was left, and your savings rate) and in Insights, with a new chart of income, spending and the share you kept each month.', href: '#/insights' },
      { type: 'feature', text: 'Recurring expenses can now be weekly, every 3 months or yearly, as well as monthly. Good for insurance, subscriptions and yearly dues.', href: '#/budget' },
      { type: 'feature', text: 'Your own payment methods: add a particular card or bank to the “Paid with” list, or take away the ones you never use. Expenses already saved keep the method they had.', href: '#/budget' },
      { type: 'feature', text: 'Save to Files or iCloud: a new button in Tools and backup sends your full backup to the iPhone share sheet.', href: '#/tools' },
      { type: 'update', text: 'Clothes now sits in the Health & care spending area, beside Shopping & Personal Care.' }
    ]
  },
  {
    version: '2.3.1',
    date: '2026-11-16',
    title: 'GoTyme and BDO in Pay me',
    items: [
      { type: 'update', text: 'Pay me now has GoTyme and BDO too. Banks are listed alphabetically, and each account has its own short letters on its badge.', href: '#/pay-me' }
    ]
  },
  {
    version: '2.3.0',
    date: '2026-11-16',
    title: 'Pay me, and updates that arrive on their own',
    items: [
      { type: 'feature', text: 'Pay me: save the QR codes of your GCash, Maya, MariBank, BPI, Maya Bank, UnionBank, Security Bank and Metrobank accounts, with the account name and number. Show one full screen for scanning, copy the number, or share the picture in a chat. They stay on this device and are included in your JSON backup.', href: '#/pay-me' },
      { type: 'feature', text: 'Once you have saved a QR code, Home shows a Pay me row so any code is one tap away.' },
      { type: 'correction', text: 'Updates now reach the installed app on their own. Little Garden checks for a new version each time you come back to it and refreshes itself once, never while you are typing.' }
    ]
  },
  {
    version: '2.2.0',
    date: '2026-11-16',
    title: 'Clothes and Books categories',
    items: [
      { type: 'feature', text: 'Two new categories, 👗 Clothes and 📖 Books, in the Lifestyle & other spending area. They appear in the entry form, filters, charts, budgets and recurring expenses. Expenses you already saved keep their category; tap Edit to move one.' }
    ]
  },
  {
    version: '2.1.1',
    date: '2026-11-16',
    title: 'Date boxes fit on iPhone',
    items: [
      { type: 'correction', text: 'Date and month boxes no longer spill past the edge of the card on iPhone and iPad.' }
    ]
  },
  {
    version: '2.1.0',
    date: '2026-11-16',
    title: 'Budget, recurring expenses, income, and easier entry',
    items: [
      { type: 'feature', text: 'Monthly budget: set a total, a limit for any category, or both. Home shows a progress bar for each, turning amber near the limit and red once you pass it.', href: '#/budget' },
      { type: 'feature', text: 'Recurring expenses such as rent, internet and subscriptions. Each month they wait on Home until you tap Add or Skip.', href: '#/budget' },
      { type: 'feature', text: 'Income, if you want it: record what you receive and Home shows what is left after spending.', href: '#/budget' },
      { type: 'feature', text: 'Paid with: mark an expense as Cash, GCash, Card, Bank transfer or Other. Insights has a new chart by payment method, and search finds it too.' },
      { type: 'feature', text: 'Description suggestions: start typing something you have entered before, pick it, and the category and payment method fill in.' },
      { type: 'feature', text: 'A backup reminder on Home when your last backup is more than 30 days old. Tap Later to hide it for a week.' },
      { type: 'update', text: 'On phones, Transactions are now cards, so there is no more sideways scrolling.', href: '#/transactions' },
      { type: 'update', text: 'Backups now carry your budget, recurring expenses and income along with your expenses and saved views. Older backups still restore.' }
    ]
  },
  {
    version: '2.0.0',
    date: '2026-11-16',
    title: 'New menu, a What’s new page, and a round of fixes',
    items: [
      { type: 'feature', text: 'A menu like the other apps: tap ☰ for every screen, with back and forward buttons beside it. Your phone’s back button now moves between screens instead of leaving the app.' },
      { type: 'feature', text: 'Search from the top bar on any screen. Results open in Transactions as you type.' },
      { type: 'feature', text: 'The spending calendar has its own screen, with previous and next month buttons. Tap a day to list what you spent, add an expense on that day, or open it in Transactions.', href: '#/calendar' },
      { type: 'feature', text: 'This What’s new page, and an About page with theme and text size settings.', href: '#/about' },
      { type: 'feature', text: 'Theme can now match your device, or stay light or dark. Text size (Aa) has four steps.' },
      { type: 'feature', text: 'Undo last import, in Tools and backup. Replacing all records now asks first.', href: '#/tools' },
      { type: 'feature', text: 'Delete a saved view you no longer need. Backups now include your saved views.' },
      { type: 'correction', text: 'Edit now opens the expense in the form. Before, it filled the form on Home while you stayed on Transactions, so nothing seemed to happen.' },
      { type: 'correction', text: 'Tapping a chart slice, a top expense, a trend label or a heatmap day now opens Transactions with the matching entries.' },
      { type: 'correction', text: 'One damaged record can no longer hide every expense when the app opens. Damaged records are skipped and a safety copy of the original data is kept.' },
      { type: 'correction', text: 'The Healthcare saved view now shows only Medications & Healthcare. It used to include Pets and Shopping & Personal Care.' },
      { type: 'correction', text: 'Home always shows the current month. It used to follow the month picked in Insights.' },
      { type: 'correction', text: 'The monthly PDF chart now adds up every day, in weeks. It used to show only days 1, 5, 10, 15 and so on.' },
      { type: 'correction', text: 'Year menus pick up a new year as soon as you add or import expenses from it. Impossible dates such as 31 February are refused on import.' },
      { type: 'correction', text: 'Importing the same CSV twice no longer doubles your records.' },
      { type: 'correction', text: 'Updating this app no longer clears the offline copies of the other apps on the same site.' },
      { type: 'update', text: 'A proper home screen icon on iPhone and iPad.' }
    ]
  },
  {
    version: '1.0.0',
    date: '2026-10-13',
    title: 'Little Garden opens',
    items: [
      { type: 'feature', text: 'Quick expense entry in Philippine pesos with 12 categories, monthly summary and recent transactions.' },
      { type: 'feature', text: 'Insights: category and spending-area charts, daily spending, top expenses, yearly summary, trends, heatmap, calendar, and comparison of any two periods.' },
      { type: 'feature', text: 'Transactions with search, filters, sorting and saved views.' },
      { type: 'feature', text: 'JSON and CSV backup and restore, PDF reports, dark mode, and offline use once installed.' }
    ]
  }
];
