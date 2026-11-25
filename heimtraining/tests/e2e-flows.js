// Prüft die Abläufe: abweichende Einheit (A geplant, B gemacht), spontan, nachtragen, Plan neu berechnen.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const checks = [];
  const check = (n, ok, x) => checks.push([n, !!ok, x || '']);
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('heimtraining.v1')));

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Start-Zustand: die offene A-Einheit vom 21.11. wird als geplant zurückgesetzt (Test für Typwechsel)
  // Die offene Einheit vom 21.11. gilt für diesen Test als abgebrochen, damit die nächste Plan-Einheit angezeigt wird
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('heimtraining.v1')); s.sessions.find(q => q.id === 's-2026-11-21').status = 'abgebrochen'; localStorage.setItem('heimtraining.v1', JSON.stringify(s)); });
  await page.reload();

  // (1) Abweichend: geplant A, gemacht B
  await page.click('[data-act="start"][data-id="s-2026-11-27-A"]');
  await page.waitForSelector('[data-act="preType"]');
  await page.click('[data-act="preType"][data-v="B"]');
  await page.click('[data-act="preStart"]');
  await page.waitForSelector('.runner');
  for (let i = 0; i < 40; i++) {
    if (await page.$('.sheet')) { await page.click('.sheet [data-act="close"]'); continue; }
    const d = await page.$('[data-act="done"]');
    if (!d) break;
    await d.click();
  }
  await page.click('[data-act="finish"]');
  await page.waitForSelector('[data-act="finishSave"]');
  await page.click('[data-act="finishSave"]');
  await page.waitForSelector('text=Gespeichert');
  await page.click('.sheet [data-act="close"]');
  let st = await store();
  const s27 = st.sessions.find(x => x.id === 's-2026-11-27-A');
  check('Abweichend: Einheit ist als B gespeichert', s27.type === 'B', s27.type);
  check('Abweichend: Status nach Abschluss', ['abgeschlossen', 'teilweise'].includes(s27.status), s27.status);
  check('Abweichend: Plan-Einheit 2 (2.12.) bleibt fest als B', st.sessions.some(x => x.planN === 2 && x.type === 'B' && x.date === '2026-12-02'));

  // (2) Spontan trainieren
  await page.click('[data-act="spontan"]');
  await page.click('.sheet [data-act="spontanStart"][data-v="B"]');
  await page.waitForSelector('.runner');
  st = await store();
  check('Spontan: Einheit startet und wird gespeichert', st.sessions.some(x => x.source === 'spontan' && x.status === 'begonnen'));
  await page.click('[data-act="leave"]');

  // (3) Nachträglich eintragen
  await page.click('[data-act="nachtrag"]');
  await page.fill('#ntDate', '2026-11-10');
  await page.fill('#ntTime', '09:30');
  await page.click('[data-act="ntType"][data-v="B"]');
  await page.click('[data-act="nachtragStart"]');
  await page.waitForSelector('.runner');
  st = await store();
  const retro = st.sessions.find(x => x.source === 'nachtrag');
  check('Nachtrag: Einheit mit Datum und Startzeit angelegt', retro && retro.date === '2026-11-10' && retro.startedAt === '2026-11-10T08:30:00.000Z', retro && retro.startedAt);
  await page.click('[data-act="leave"]');

  // (4) Plan neu berechnen: zeigt Sheet mit Erklärung
  await page.click('#tabs button[data-route="plan"]');
  await page.click('[data-act="recalc"]');
  await page.waitForSelector('text=Plan neu berechnet');
  check('Plan neu berechnen zeigt Erklärung', true);
  await page.screenshot({ path: (process.env.SHOTS || '/tmp') + '/10-plan-neu.png' });

  check('Keine Laufzeitfehler', errors.length === 0, errors.join(' | '));
  await browser.close();
  let failed = 0;
  for (const [n, ok, x] of checks) { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? '  (' + x + ')' : ''}`); if (!ok) failed++; }
  console.log(`\n${checks.length - failed} von ${checks.length} Ablaufprüfungen bestanden.`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
