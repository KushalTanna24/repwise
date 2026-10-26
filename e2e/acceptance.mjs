// Acceptance walk-through against the local dev server (brief Part 11).
// Run: npm run dev -- --port 5199, then npm run e2e. Uses the installed Chrome; set CHROME_PATH to override.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const APP = process.env.APP_URL ?? 'http://127.0.0.1:5199/';
const OUT = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().split('\n')[0].slice(0, 160)}`));

page.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(0, 120), r.failure()?.errorText));
const results = [];
process.on('unhandledRejection', async (e) => {
  console.log('ERROR', e.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}zz-failure.png` }).catch(() => {});
  console.log(results.join('\n'));
  await browser.close();
  process.exit(1);
});
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` | ${detail}` : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });
const text = () => page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
const click = async (sel) => {
  try {
    await page.waitForSelector(sel, { visible: true, timeout: 5000 });
  } catch (e) {
    await page.screenshot({ path: `${OUT}zz-failed.png` });
    console.log('FAILED AT', sel, '|', (await text()).slice(0, 300));
    const st = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => { const g = r.result.transaction('keyval').objectStore('keyval').get('repwise_v4'); g.onsuccess = () => { const d = JSON.parse(g.result).state.data; res({ active: !!d.activeSession, plan: d.plannedSession && d.plannedSession.key, sessions: d.sessions.length, rot: d.program.rotation['full-body-abc'] }); }; }; }));
    console.log('STATE', JSON.stringify(st));
    throw e;
  }
  // Centre first so fixed bars (tab bar, Next bar) never sit on top of the target.
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(150);
  await page.click(sel);
  await sleep(350);
};
const dumpState = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => { const g = r.result.transaction('keyval').objectStore('keyval').get('repwise_v4'); g.onsuccess = () => { const d = JSON.parse(g.result).state.data; res(JSON.stringify({ active: !!d.activeSession, plan: d.plannedSession && d.plannedSession.key, hash: location.hash })); }; }; }));
const hist = () => page.evaluate(() => JSON.stringify({ hash: location.hash, len: history.length, state: history.state }));
const typeInto = async (sel, value) => {
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(150);
  await page.click(sel);
  await page.type(sel, value);
};
// Profile rows carry their summary as text ("Full Body A/B/C"), so match on the title div only.
const openRow = async (title) => {
  await page.waitForFunction((t) => [...document.querySelectorAll('main button, button')].some((b) => b.firstElementChild?.nextElementSibling?.firstElementChild?.firstElementChild?.textContent === t), { timeout: 5000 }, title);
  await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.firstElementChild?.nextElementSibling?.firstElementChild?.firstElementChild?.textContent === t)?.click(), title);
  await sleep(500);
};
const noSplash = () => page.waitForFunction(() => !document.querySelector('[data-splash]'), { timeout: 8000 });
const reload = async () => {
  await page.reload({ waitUntil: 'networkidle0' });
  await noSplash();
  await sleep(300);
};

/** Fill empty load inputs with `kg` and tick every set, leaving the last `leave` exercises untouched. */
async function logAll(kg, leave = 0) {
  const cards = await page.$$('[data-vaul-drawer] .rounded-card');
  for (let i = 0; i < cards.length - leave; i++) {
    for (const inp of await cards[i].$$('input[aria-label$="load"]')) {
      if (!(await inp.evaluate((e) => e.value))) {
        await inp.click();
        await inp.type(String(kg));
      }
    }
    for (const t of await cards[i].$$('button[aria-label^="Complete set"]')) {
      await t.click();
      await sleep(120);
    }
  }
}

async function finish() {
  await click('button::-p-text(Finish)');
  if (await page.$('[role="alertdialog"]')) await click('[role="alertdialog"] button::-p-text(Finish)');
  await page.waitForSelector('::-p-text(Workout saved)', { timeout: 5000 });
}

await page.goto(APP, { waitUntil: 'networkidle0' });
await noSplash();
await page.evaluate(() => {
  localStorage.clear();
  indexedDB.deleteDatabase('keyval-store');
});
await reload();
await shot('01-empty-today');
check('Empty state asks for a split', (await text()).includes('Pick how you train'));

// Split persistence
await click('button::-p-text(Full Body)');
await sleep(500);
await shot('02-today-plan');
let t = await text();
check('Full Body A proposed after picking split', t.includes('Full Body A') && t.includes('Cycle 1'));
await reload();
check('Split survives refresh', (await text()).includes('Full Body A'));
await click('nav button::-p-text(History)');
await click('nav button::-p-text(Today)');
check('Split survives navigation', (await text()).includes('Full Body A'));

// Rebuild keeps main lifts, changes accessories
const planIds = () => page.$$eval('ol li .truncate.text-body', (els) => els.map((e) => e.textContent));
const beforeRebuild = await planIds();
await click('button[aria-label="Session options"]');
await click('[role="menuitem"]::-p-text(Rebuild workout)');
await sleep(400);
const afterRebuild = await planIds();
check('Rebuild workout changes accessories, keeps main lifts', afterRebuild.slice(0, 3).join() === beforeRebuild.slice(0, 3).join() && afterRebuild.join() !== beforeRebuild.join(), `${beforeRebuild.slice(3).join('/')} -> ${afterRebuild.slice(3).join('/')}`);
await reload();
check('Rebuilt plan survives refresh', (await planIds()).join() === afterRebuild.join());

// Guide
await click('ol li button[aria-label="How to do this exercise"]');
await sleep(700);
await shot('02b-guide');
t = await text();
check('Exercise guide opens with setup, steps and demo link', t.includes('Setup') && t.includes('Common mistakes') && t.includes('Watch a demo'));
await click('[data-vaul-drawer] button::-p-text(Done)');
await sleep(500);

// Water: one tap per glass, persists
if (await page.$('button::-p-text(Not now)')) {
  await click('button::-p-text(Not now)');
  check('Notification prompt can be dismissed', !(await text()).includes('Rest timer alerts'));
}
const waterCount = await page.$$eval('button[aria-label="Add a glass of water"]', (els) => els.length);
console.log('DBG water buttons', waterCount);
await click('button[aria-label="Add a glass of water"]');
await click('button[aria-label="Add a glass of water"]');
t = await text();
check('Two taps log two glasses', t.includes('2 / 8 glasses') && t.includes('0.5 L'));
await reload();
check('Water survives refresh and shows in the ring stats', (await text()).includes('2/8'));

// Workout A, refresh mid-way, finish with the last exercise untouched
await click('button[aria-label="Start workout"]');
await sleep(800);
await shot('03-workout-start');
check('Freestyle Next bar suggests the first set', (await text()).includes('Next · set 1'));
await logAll(40, 1);
await shot('04-workout-logged');
await reload();
const persisted = await page.$$eval('[data-vaul-drawer] input[aria-label$="load"]', (els) => els.map((e) => e.value));
check('Logged values survive refresh mid-workout', persisted.filter((v) => v === '40').length >= 3);
await finish();
await shot('05-finish-summary');
await click('[data-vaul-drawer] button::-p-text(Done)');
await sleep(600);
check('Rotation advanced to B after finishing A', (await text()).includes('Full Body B'));
t = await text();
check('Done-today card and Next line after finishing', t.includes('Done today') && t.includes('Next:') && !t.includes('Start workout'));
await shot('05b-today-done');
/** After today's workout the start button lives in the session menu as Train again. */
async function startAgain() {
  if (await page.$('button[aria-label="Start workout"]')) return click('button[aria-label="Start workout"]');
  await click('button[aria-label="Session options"]');
  await sleep(300);
  await click('[role="menuitem"]::-p-text(Train again)');
}

await reload();
check('Refresh does not advance rotation', (await text()).includes('Full Body B'));

// Discard does not advance
await startAgain();
await sleep(700);
await click('button::-p-text(Discard workout)');
await click('[role="alertdialog"] button::-p-text(Discard)');
await sleep(600);
check('Discard keeps Full Body B', (await text()).includes('Full Body B'));

// History detail; viewing it does not move rotation
await click('nav button::-p-text(History)');
await sleep(400);
await shot('06-history');
await click('button::-p-text(Full Body A)');
await sleep(700);
await shot('07-session-detail');
t = await text();
check('History detail shows target vs actual, unticked sets not done', t.includes('Target') && t.includes('40 kg \u00d7 6') && t.includes('Not done'));
await page.keyboard.press('Escape');
await sleep(500);
await click('nav button::-p-text(Today)');
check('Viewing history does not advance rotation', (await text()).includes('Full Body B'));

// Finish B and C, expect A of cycle 2 with progression from the logged sets
for (let k = 0; k < 2; k++) {
  await startAgain();
  await sleep(700);
  await logAll(30);
  await finish();
  await click('[data-vaul-drawer] button::-p-text(Done)');
  await sleep(1200);
}
t = await text();
check('C completes the cycle: next is Full Body A', t.includes('Next: Full Body A'));
await shot('08-today-cycle2');
await startAgain();
await sleep(900);
t = await text();
check('Targets explain themselves from last session', t.includes('Keeping 40 kg. Beat 6 \u00b7 6 \u00b7 6.'));
check('Previous performance shown', t.includes('Last \u00b7 40 kg \u00d7 6 \u00b7 6 \u00b7 6'));
await shot('09-workout-progression');
await click('button::-p-text(Discard workout)');
await click('[role="alertdialog"] button::-p-text(Discard)');
await sleep(500);

// Body metrics
await click('nav button::-p-text(Progress)');
await sleep(500);
await shot('10-progress-strength');
await click('[role="tab"]::-p-text(Body)');
await sleep(300);
const w = await page.$('input[placeholder="60.0"]');
await w.click();
await w.type('70');
await click('button::-p-text(Save weigh-in)');
const h = await page.$('input[placeholder="Height in cm"]');
await h.click();
await h.type('175');
await click('input[placeholder="Height in cm"] + button');
await sleep(400);
t = await text();
check('BMI 22.9 from 70 kg and 175 cm', t.includes('22.9') && t.includes('70 kg \u00f7 (1.75 m)\u00b2'));
await reload();
await click('nav button::-p-text(Progress)');
await click('[role="tab"]::-p-text(Body)');
await sleep(400);
check('Weigh-in and BMI survive refresh', (await text()).includes('22.9'));
const w2 = await page.$('input[placeholder="70"]');
await w2.click();
await w2.type('71.4');
// Locale-independent: set the value through React's native setter.
await page.$eval('input[type="date"]', (el) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2026-10-10');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await click('button::-p-text(Save weigh-in)');
await sleep(1200);
const lines = await page.$$eval('.recharts-line-curve', (els) => els.length);
check('Body weight chart renders with two weigh-ins', lines === 1, `curves=${lines}`);
check('BMI still uses the latest dated weigh-in', (await text()).includes('22.9'));
await shot('11-body');

await click('nav button::-p-text(Profile)');
await sleep(400);
await openRow('Training plan');
await click('button[aria-label="Days per week"]');
await sleep(300);
await shot('12a-picker');
await click('[role="menuitemradio"]::-p-text(4)');
await sleep(300);
check('iOS picker changes days per week', (await page.$eval('button[aria-label="Days per week"]', (e) => e.textContent)).includes('4'));
await click('[data-vaul-drawer] button::-p-text(Done)');
await page.waitForFunction(() => !document.querySelector('[data-vaul-drawer]'), { timeout: 5000 });
await openRow('Body & water');
const note = await page.$('textarea');
await note.click();
await note.type('Bench 100 kg by March');
await page.keyboard.press('Tab');
await sleep(300);
await shot('12-profile');
await click('[data-vaul-drawer] button::-p-text(Done)');
await page.waitForFunction(() => !document.querySelector('[data-vaul-drawer]'), { timeout: 5000 });
// Every Profile row opens its sheet
{
  const rows = [['Training plan', 'Training plan'], ['Goals', 'Goals'], ['Body & water', 'Body & water'], ['Supplements', 'Supplements'], ['Equipment & exercises', 'Equipment & exercises'], ['Reminders', 'Reminders'], ['Your data', 'Your data']];
  let ok = true;
  for (const [row, title] of rows) {
    await openRow(row);
    const shown = await page.evaluate((t) => [...document.querySelectorAll('[role="dialog"] h2, [role="dialog"] [data-vaul-drawer] h2, [role="dialog"]')].some((e) => e.textContent.includes(t) && e.getBoundingClientRect().height > 0), title);
    if (!shown) { ok = false; console.log('row sheet missing', row); }
    await click('[data-vaul-drawer] button::-p-text(Done)');
    await page.waitForFunction(() => !document.querySelector('[data-vaul-drawer]'), { timeout: 5000 });
  }
  check('profile rows open sheets', ok);
}
await page.reload({ waitUntil: 'networkidle0' });
await sleep(900);
check('Goal note shows on the launch splash', (await text()).includes('Bench 100 kg by March') && !!(await page.$('[data-splash]')));
await shot('13-splash-note');
await noSplash();
check('Splash clears quickly', true);

// Supplements: default stack on Today, add zinc from the library, tick on Today, see in History
await page.evaluate(() => { location.hash = '#/profile/supps'; });
await sleep(600);
await typeInto('input[aria-label="Search supplements"]', 'zinc');
await sleep(200);
await click('button[aria-label="Add Zinc"]');
await page.evaluate(() => { location.hash = '#/profile'; });
await sleep(500);
await click('nav button::-p-text(Today)');
await sleep(400);
check('supplement library adds zinc', !!(await page.$('button[aria-label="Zinc"]')));
await click('button[aria-label="Creatine"]');
await sleep(300);
check('Supplement pill ticks with one tap', (await text()).includes('1 / 4 taken'));
await shot('14-today-supplements');
await click('nav button::-p-text(History)');
await sleep(500);
t = await text();
check('History shows the calendar and a daily habits row', t.includes('All supplements') && t.includes('daily habits'));
await shot('15-history-calendar');

// Loud water card: fresh context, clock pinned to 15:00 Asia/Kolkata, 0 glasses -> 4 expected, 4 behind
{
  const ctx = await browser.createBrowserContext();
  const p2 = await ctx.newPage();
  await p2.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
  p2.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
  await p2.emulateTimezone('Asia/Kolkata');
  const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const target = Date.parse(`${ist}T15:00:00+05:30`);
  await p2.evaluateOnNewDocument((t) => {
    const RealDate = Date;
    const offset = t - RealDate.now();
    class FakeDate extends RealDate {
      constructor(...a) { a.length ? super(...a) : super(RealDate.now() + offset); }
      static now() { return RealDate.now() + offset; }
    }
    globalThis.Date = FakeDate;
  }, target);
  await p2.goto(APP, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const t2 = await p2.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  check('loud water card when behind', t2.includes("You're 4 behind"), t2.includes('behind') ? '' : 'copy missing');
  await ctx.close();
}

check('No runtime errors in console', errors.length === 0, errors.slice(0, 5).join(' / '));
console.log(results.join('\n'));
await browser.close();
