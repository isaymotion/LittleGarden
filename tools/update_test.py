"""Check the automatic-update logic (initUpdates in app.js) with service workers switched ON.

browser_test.py blocks service workers, so it cannot see this. This script serves a throwaway copy of
the repo, then publishes fake new versions by editing VERSION in the copy's sw.js:
  1. first visit (fresh install)       -> must NOT reload
  2. new version while idle            -> must reload once
  3. another new version after that    -> must reload again
  4. new version while typing an item  -> must NOT reload (waits until the app is hidden)

Usage:  python3 update_test.py /path/to/littlegarden-clone      (prints 4 PASS lines, ends "ERRORS []")
"""
import os, re, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
PORT = int(os.environ.get('LG_UPDATE_PORT', '8766'))
work = tempfile.mkdtemp(prefix='lg-update-')
site = os.path.join(work, 'site')
shutil.copytree(REPO, site, ignore=shutil.ignore_patterns('.git'))
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=site,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []

def check(name, ok):
    print(('PASS ' if ok else 'FAIL ') + name)
    if not ok: errors.append(name)

def publish(tag):
    p = os.path.join(site, 'sw.js'); s = open(p).read()
    open(p, 'w').write(re.sub(r'PREFIX \+ "[^"]+"', f'PREFIX + "{tag}"', s))

UPDATE = "navigator.serviceWorker.getRegistration().then(r=>r.update())"
CONTROLLED = "navigator.serviceWorker.controller!==null"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context().new_page()
        pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function(CONTROLLED, timeout=15000)
        pg.evaluate("window.__m=1"); pg.wait_for_timeout(800)
        check('first install keeps the page', pg.evaluate("window.__m") == 1)
        publish('test1'); pg.evaluate(UPDATE); pg.wait_for_timeout(2500)
        check('idle update reloads', pg.evaluate("window.__m") is None)
        pg.wait_for_function(CONTROLLED)
        pg.evaluate("window.__m=2"); publish('test2'); pg.evaluate(UPDATE); pg.wait_for_timeout(2500)
        check('second update reloads again', pg.evaluate("window.__m") is None)
        pg.wait_for_function(CONTROLLED)
        pg.evaluate("window.__m=3"); pg.fill('#expenseItem', 'half typed'); publish('test3'); pg.evaluate(UPDATE); pg.wait_for_timeout(2500)
        check('update waits while typing', pg.evaluate("window.__m") == 3 and pg.input_value('#expenseItem') == 'half typed')
        b.close()
finally:
    server.terminate(); shutil.rmtree(work, ignore_errors=True)
print('ERRORS', errors)
