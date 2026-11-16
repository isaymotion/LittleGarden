/* What's new. Newest entry FIRST. version = semver string (also the key for the unseen badge),
   date = ISO YYYY-MM-DD. Item type: feature | update | correction.
   Optional per item: href (an in-app '#/...' link) shown as "Open".
   Add an entry for every release, then bump APP_META.version in data/app-meta.js, VERSION in sw.js,
   and "Latest version" in the footer of index.html. */
window.APP_CHANGELOG = [
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
