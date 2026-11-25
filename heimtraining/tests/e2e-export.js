// Prüft den kostenlosen Kalender-Export im Browser und dass keine Anfrage an Google-APIs oder Google-Konten geht.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';
const shots = process.env.SHOTS || '/tmp';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { const h = new URL(r.url()).hostname; if (h.endsWith('google.com') || h.endsWith('googleapis.com')) external.push(h + ' ' + new URL(r.url()).pathname); });
  const checks = [];
  const check = (n, ok, x) => checks.push([n, !!ok, x || '']);

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#tabs button[data-route="plan"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="icsExport"]')]);
  const file = path.join(shots, 'trainingszeit-test.ics');
  await dl.saveAs(file);
  const text = fs.readFileSync(file, 'utf-8');
  check('Download ist eine .ics-Datei', dl.suggestedFilename().endsWith('.ics'), dl.suggestedFilename());
  check('Datei hat Kalenderformat', text.startsWith('BEGIN:VCALENDAR') && text.includes('END:VCALENDAR'));
  check('Datei enthält Trainingstermine', (text.match(/BEGIN:VEVENT/g) || []).length >= 3, String((text.match(/BEGIN:VEVENT/g) || []).length));
  check('Zeitzone Berlin als UTC-Zeit kodiert', /DTSTART:\d{8}T\d{6}Z/.test(text));
  await page.screenshot({ path: path.join(shots, 'export-plan.png') });
  check('Keine Anfrage an Google-APIs oder Google-Konten', external.filter(h => !h.includes('fonts.')).length === 0, external.join(' | '));
  check('Keine Laufzeitfehler', errors.length === 0, errors.join(' | '));
  await browser.close();
  let failed = 0;
  for (const [n, ok, x] of checks) { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? '  (' + x + ')' : ''}`); if (!ok) failed++; }
  console.log(`\n${checks.length - failed} von ${checks.length} Export-Prüfungen bestanden.`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
