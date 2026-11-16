/* App identity. The version here, the newest entry in data/changelog.js and VERSION in sw.js must agree. */
window.APP_META = {
  name: 'Little Garden',
  short: 'Little Garden',
  tagline: 'Monthly expense journal',
  version: '2.2.0',
  repo: 'LittleGarden',
  attribution: 'App created by Isabella Navarro, MD. Latest version November 2026. isaymotion@gmail.com'
};

/* Other isaymotion apps, shown as the last group ("Other apps") in the menu when SHOW_OTHER_APPS is true.
   Off for now, the same as in the other apps: set it to true when you are ready to interlink them. */
window.SHOW_OTHER_APPS = false;

window.APP_LINKS = [
  { name: 'MSE Trainer', href: 'https://isaymotion.github.io/MSEtrainer/' },
  { name: 'Usap Tayo (Tagalog)', href: 'https://isaymotion.github.io/Tagalog/' },
  { name: 'DSM-5-TR Study Companion', href: 'https://isaymotion.github.io/DSMVapp/' },
  { name: 'Stahl Study Companion', href: 'https://isaymotion.github.io/Stahl/' },
  { name: 'Kaplan Study', href: 'https://isaymotion.github.io/KaplanStudy/' },
  { name: 'Shea Trainer', href: 'https://isaymotion.github.io/sheatrainer/' }
];
