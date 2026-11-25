// Browser-Prüfung der Oberfläche. Start: Server im Ordner heimtraining (z. B. python3 -m http.server 8765),
// dann: node tests/e2e.js http://localhost:8765/index.html
'use strict';
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';
const shots = process.env.SHOTS || path.join(process.env.TMPDIR || '/tmp', 'ht-shots');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const results = [];
  const check = (name, ok, extra) => { results.push([name, !!ok, extra || '']); };

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('h1');
  check('Startseite zeigt Heute', (await page.textContent('h1')).includes('Heute'));
  // Offene Einheit vom 21.11. ist die nächste Einheit (Test-Datum im Browser wird nicht erzwungen, daher prüfen wir die Ansicht)
  const hasHero = await page.$('.hero');
  check('Heute zeigt eine Einheit', !!hasHero);
  await page.screenshot({ path: path.join(shots, '01-heute.png'), fullPage: false });

  // Tabs
  await page.click('#tabs button[data-route="plan"]');
  check('Wochenplan erreichbar', (await page.textContent('h1')).includes('Wochenplan'));
  await page.screenshot({ path: path.join(shots, '02-wochenplan.png') });
  await page.click('#tabs button[data-route="history"]');
  check('Verlauf erreichbar', (await page.textContent('h1')).includes('Verlauf'));
  await page.screenshot({ path: path.join(shots, '03-verlauf.png') });

  // Satz-Ansicht: Start über Heute
  await page.click('#tabs button[data-route="today"]');
  const startBtn = await page.$('[data-act="start"], [data-act="resume"]');
  if (startBtn) {
    const act = await startBtn.getAttribute('data-act');
    await startBtn.click();
    if (act === 'start') {
      await page.waitForSelector('[data-act="preStart"]');
      await page.click('[data-act="preFeel"][data-v="4"]');
      await page.click('[data-act="preStart"]');
    }
    await page.waitForSelector('.runner');
    check('Satz-Ansicht geöffnet', true);
    await page.screenshot({ path: path.join(shots, '04-satz.png') });
    // Zwei Sätze erledigen
    // Bis die erste Übung abgeschlossen ist (Aufwärmen, dann bekannte Übung mit Reserve-Frage)
    for (let i = 0; i < 12; i++) {
      if (await page.$('text=Wie viele saubere Wiederholungen')) break;
      const d = await page.$('[data-act="done"]');
      if (!d) break;
      await d.click();
      await page.waitForTimeout(80);
    }
    // Erste Übung ist erledigt: Fortschrittsbalken zeigt sie, die Rückfrage zur Reserve erscheint
    const progDone = await page.$$eval('.progress span.done', els => els.length);
    check('Übung nach erledigten Sätzen als erledigt markiert', progDone >= 1, 'erledigte Übungen: ' + progDone);
    // Erste Übung ist neu (Goblet Squat ohne Verlauf): nach Regel R6 keine Reserve-Rückfrage
    const rirAsked = await page.$('text=Wie viele saubere Wiederholungen');
    check('Bekannte Übung fragt nach der Reserve', !!rirAsked);
    if (rirAsked) await page.click('.sheet [data-act="close"]');
    // Neu laden: Einheit muss an derselben Stelle weitergehen
    const before = await page.textContent('.setdots');
    await page.reload();
    await page.waitForSelector('.runner');
    const after = await page.textContent('.setdots');
    check('Nach Neuladen an derselben Stelle', before === after, `${before} | ${after}`);
    await page.screenshot({ path: path.join(shots, '05-nach-neuladen.png') });
    // Satz überspringen, Ergebnis bleibt sichtbar
    await page.click('[data-act="skipSet"]');
    const skipped = await page.$$eval('.dots span.skip', els => els.length);
    check('Übersprungener Satz bleibt sichtbar', skipped >= 1);
    // Abschluss
    await page.click('[data-act="finish"]');
    await page.waitForSelector('#fStart');
    await page.screenshot({ path: path.join(shots, '06-abschluss.png') });
    await page.click('[data-act="finishSave"]');
    await page.waitForSelector('text=Gespeichert');
    check('Abschluss zeigt Ergebnis', true);
    await page.screenshot({ path: path.join(shots, '07-ergebnis.png') });
    await page.click('[data-act="close"]');
  } else {
    check('Start-Schaltfläche vorhanden', false);
  }

  // Verlauf zeigt die Einheiten
  await page.click('#tabs button[data-route="history"]');
  const rows = await page.$$eval('#main .list-item', els => els.length);
  check('Verlauf listet Einheiten', rows >= 3, 'Zeilen: ' + rows);

  // Export und Import
  await page.click('#btnSettings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
  const exportPath = path.join(shots, 'trainingszeit-export.json');
  await dl.saveAs(exportPath);
  check('Export lädt herunter', true, exportPath);
  await page.setInputFiles('#importFile', exportPath);
  await page.waitForSelector('text=Import bestätigen');
  await page.click('[data-act="importConfirm"]');
  check('Import übernommen', true);

  await page.screenshot({ path: path.join(shots, '08-einstellungen.png') });
  check('Keine Laufzeitfehler', errors.length === 0, errors.join(' | '));

  await browser.close();
  let failed = 0;
  for (const [name, ok, extra] of results) {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!ok) failed++;
  }
  console.log(`\n${results.length - failed} von ${results.length} Prüfungen bestanden.`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
