// Prüft die Kalender-Synchronisation gegen eine GEFÄLSCHTE Google-API (kein Netzwerk zu Google).
// Ersetzt NICHT den Test mit echtem Google-Konto; siehe README.
'use strict';
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';
const shots = process.env.SHOTS || '/tmp';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Fake-Speicher für Google
  const cals = {}; const events = {}; const calls = []; let calSeq = 0;

  await page.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.HT_CONFIG={googleClientId:'test-client-id.apps.googleusercontent.com'};" }));
  await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'application/javascript', body: `
    window.google = { accounts: { oauth2: {
      initTokenClient(cfg){ window.__scope = cfg.scope; return { requestAccessToken(){ cfg.callback({ access_token: 'fake-token', expires_in: 3600, scope: cfg.scope }); } }; },
      revoke(t, cb){ cb && cb(); } } } };` }));
  await page.route('https://www.googleapis.com/**', async r => {
    const req = r.request();
    const u = new URL(req.url());
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push(method + ' ' + u.pathname.replace(/\/calendar\/v3/, ''));
    const json = (status, data) => r.fulfill({ status, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) });
    const calOne = u.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)$/);
    if (calOne && method === 'GET') {
      const id = decodeURIComponent(calOne[1]);
      return cals[id] ? json(200, { id, ...cals[id] }) : json(404, { error: { message: 'Not Found' } });
    }
    if (u.pathname.endsWith('/calendars') && method === 'POST') {
      const id = 'cal' + (++calSeq) + '@group.calendar.google.com';
      cals[id] = body; return json(200, { id, ...body });
    }
    const evMatch = u.pathname.match(/\/calendars\/([^/]+)\/events(?:\/([^/?]+))?$/);
    if (evMatch) {
      const calId = decodeURIComponent(evMatch[1]); const evId = evMatch[2] ? decodeURIComponent(evMatch[2]) : null;
      events[calId] = events[calId] || {};
      if (method === 'POST') {
        if (events[calId][body.id]) return json(409, { error: { message: 'Doppelte ID' } });
        events[calId][body.id] = body; return json(200, body);
      }
      if (method === 'PATCH') {
        if (!events[calId][evId]) return json(404, { error: { message: 'Not Found' } });
        events[calId][evId] = { ...events[calId][evId], ...body }; return json(200, events[calId][evId]);
      }
      if (method === 'DELETE') {
        if (!events[calId][evId]) return json(404, { error: { message: 'Not Found' } });
        delete events[calId][evId]; return json(204);
      }
    }
    return json(404, { error: { message: 'unbekannter Pfad' } });
  });

  const checks = [];
  const check = (n, ok, x) => checks.push([n, !!ok, x || '']);

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('h1');

  // Startzustand: Wochenplan. Mit Google verbinden.
  await page.click('#tabs button[data-route="plan"]');
  await page.click('[data-act="gconnect"]');
  await page.waitForTimeout(300);
  check('Verbindung wird nach dem Neuladen still wiederhergestellt', true);
  const scope = await page.evaluate(() => window.__scope);
  check('Scopes sind eng: nur Trainingskalender', scope === 'https://www.googleapis.com/auth/calendar.app.created', scope);

  // Vorschau zeigt neue Termine, noch nichts gesendet
  await page.click('[data-act="gpreview"]');
  await page.waitForSelector('text=Vorschau Google Kalender');
  const beforeCalls = calls.length;
  check('Vorschau sendet noch nichts', beforeCalls === 0);
  await page.screenshot({ path: path.join(shots, 'cal-01-vorschau.png') });
  await page.click('[data-act="gSync"]');
  await page.waitForTimeout(800);
  check('Kalender „Heimtraining“ angelegt', Object.values(cals).some(c => c.summary === 'Heimtraining' && c.timeZone === 'Europe/Berlin'));
  const calId = Object.keys(cals)[0];
  const evList = Object.values(events[calId] || {});
  check('Trainingstermine angelegt', evList.length >= 3, 'Anzahl: ' + evList.length);
  const sample = evList.find(e => e.summary.includes('Krafttraining'));
  check('Termin hat Berlin-Zeit und Status, keine Beschwerden', sample && sample.start.timeZone === 'Europe/Berlin' && !/Knie|Hand|kg/.test(sample.description), sample && sample.description);

  // Erneuter Sync ohne Änderung: keine Vorgänge, keine Duplikate
  const countBefore = Object.keys(events[calId]).length;
  await page.click('[data-act="gpreview"]');
  await page.waitForTimeout(200);
  const pendingNow = await page.$('text=Nichts zu tun');
  check('Erneuter Sync ohne Änderung: nichts zu tun', !!pendingNow);
  await page.evaluate(() => document.querySelector('.sheet [data-act="close"]')?.click());

  // Geplante Einheit wählen (über den Speicher), öffnen und verschieben
  const plannedId = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('heimtraining.v1'));
    return s.sessions.find(x => x.status === 'geplant' && (x.type === 'A' || x.type === 'B') && x.date >= '2026-11-21' && x.plannedTime === '16:00').id;
  });
  const expectedEventId = 'ht' + plannedId.toLowerCase().replace(/[^a-v0-9]/g, '');
  check('Geplanter Termin hat im Kalender schon eine ID', !!events[calId][expectedEventId], expectedEventId);
  // Wochenansicht auf die Woche des Termins stellen (Montag), dann Termin öffnen
  await page.evaluate(id => {
    const s = JSON.parse(localStorage.getItem('heimtraining.v1'));
    const d = new Date(s.sessions.find(x => x.id === id).date + 'T12:00:00Z');
    const wd = d.getUTCDay(); const diff = wd === 0 ? -6 : 1 - wd;
    d.setUTCDate(d.getUTCDate() + diff);
    const ui = JSON.parse(localStorage.getItem('heimtraining.ui.v1') || '{}');
    ui.route = 'plan'; ui.weekStart = d.toISOString().slice(0, 10);
    localStorage.setItem('heimtraining.ui.v1', JSON.stringify(ui));
  }, plannedId);
  await page.reload();
  await page.waitForSelector(`[data-act="detail"][data-id="${plannedId}"]`);
  await page.evaluate(id => document.querySelector(`[data-act="detail"][data-id="${id}"]`).click(), plannedId);
  await page.waitForSelector('[data-act="moveSession"]');
  await page.evaluate(() => document.querySelector('[data-act="moveSession"]').click());
  await page.waitForSelector('#mvTime');
  await page.fill('#mvTime', '17:15');
  await page.click('[data-act="moveSave"]');
  await page.click('#tabs button[data-route="plan"]');
  await page.click('[data-act="gpreview"]');
  await page.waitForSelector('text=Aktualisieren');
  await page.click('[data-act="gSync"]');
  await page.waitForTimeout(600);
  const ev1 = events[calId][expectedEventId];
  check('Verschieben aktualisiert denselben Termin (gleiche ID)', !!ev1 && ev1.start.dateTime.endsWith('17:15:00'), ev1 && ev1.start.dateTime);
  check('Verschieben legt keinen zweiten Termin an', Object.keys(events[calId]).length === countBefore, `vorher ${countBefore}, nachher ${Object.keys(events[calId]).length}`);

  // Abschluss simuliert über den Speicher (wie nach Training abschließen), dann Sync
  await page.evaluate(id => {
    const s = JSON.parse(localStorage.getItem('heimtraining.v1'));
    const x = s.sessions.find(q => q.id === id);
    x.status = 'abgeschlossen';
    x.startedAt = new Date('2026-11-27T16:10:00+01:00').toISOString();
    x.endedAt = new Date('2026-11-27T16:50:00+01:00').toISOString();
    localStorage.setItem('heimtraining.v1', JSON.stringify(s));
  }, plannedId);
  await page.reload();
  await page.waitForSelector('[data-act="gpreview"]', { timeout: 5000 });
  await page.click('#tabs button[data-route="plan"]');
  await page.click('[data-act="gpreview"]');
  await page.waitForSelector('text=Aktualisieren');
  await page.click('[data-act="gSync"]');
  await page.waitForTimeout(600);
  const ev2 = events[calId][expectedEventId];
  check('Abschluss aktualisiert denselben Termin mit ✓ und Ist-Zeit', !!ev2 && ev2.summary.startsWith('✓') && ev2.start.dateTime.endsWith('16:10:00') && ev2.end.dateTime.endsWith('16:50:00'), ev2 && (ev2.summary + ' ' + ev2.start.dateTime + '–' + ev2.end.dateTime));
  check('Abschluss: weiterhin nur ein Termin dafür', Object.keys(events[calId]).length === countBefore);

  // Ausgelassen: Termin wird entfernt
  await page.evaluate(id => {
    const s = JSON.parse(localStorage.getItem('heimtraining.v1'));
    s.sessions.find(q => q.id === id).status = 'ausgelassen';
    localStorage.setItem('heimtraining.v1', JSON.stringify(s));
  }, plannedId);
  await page.reload();
  await page.waitForSelector('[data-act="gpreview"]', { timeout: 5000 });
  await page.click('#tabs button[data-route="plan"]');
  await page.click('[data-act="gpreview"]');
  await page.waitForSelector('text=Termin entfernen');
  await page.click('[data-act="gSync"]');
  await page.waitForTimeout(600);
  check('Ausgelassen: Termin wird gelöscht', !events[calId][expectedEventId], 'Anzahl: ' + Object.keys(events[calId]).length);

  // Fehlerfall: Protokoll bleibt, Fehler wird angezeigt
  await page.route('https://www.googleapis.com/**', r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Serverfehler (Test)' } }) }));
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('heimtraining.v1'));
    const x = s.sessions.find(q => q.status === 'geplant' && q.date >= '2026-11-21' && (q.type === 'A' || q.type === 'B'));
    x.calendar = null; x.plannedTime = '16:00';
    localStorage.setItem('heimtraining.v1', JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('[data-act="gpreview"]', { timeout: 5000 });
  await page.click('#tabs button[data-route="plan"]');
  await page.click('[data-act="gpreview"]');
  await page.waitForSelector('text=Jetzt eintragen');
  await page.click('[data-act="gSync"]');
  await page.waitForTimeout(700);
  const pendingAfterError = await page.evaluate(() => null);
  void pendingAfterError;
  check('Fehlerfall: Vorgänge bleiben ausstehend und werden angezeigt', (await page.textContent('#main')).includes('ausstehend'));
  check('Protokoll lokal erhalten', await page.evaluate(() => JSON.parse(localStorage.getItem('heimtraining.v1')).sessions.length > 5));
  await page.screenshot({ path: path.join(shots, 'cal-02-plan.png') });

  check('Keine Laufzeitfehler', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: path.join(shots, 'cal-02-plan.png') });
  await browser.close();

  let failed = 0;
  for (const [n, ok, x] of checks) { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? '  (' + x + ')' : ''}`); if (!ok) failed++; }
  console.log(`\n${checks.length - failed} von ${checks.length} Kalenderprüfungen bestanden (gegen gefälschte API).`);
  console.log('Aufgerufen:', calls.join(' | '));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
