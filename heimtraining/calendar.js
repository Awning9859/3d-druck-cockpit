/* Google-Kalender-Anbindung. Netzwerk nur nach ausdrücklicher Bestätigung durch den Nutzer.
   Scopes:
   - calendar.app.created: nur Kalender und Termine, die diese App anlegt (Trainingskalender)
   - calendar.freebusy: nur Frei-/Belegt-Zeiten, nur wenn die Option aktiv ist
   Der Zugriffstoken liegt nur im Speicher der Seite und wird nicht gespeichert. */
(function (root) {
  'use strict';
  const SCOPE_APP = 'https://www.googleapis.com/auth/calendar.app.created';
  const SCOPE_FREEBUSY = 'https://www.googleapis.com/auth/calendar.freebusy';
  const API = 'https://www.googleapis.com/calendar/v3';
  const GIS_URL = 'https://accounts.google.com/gsi/client';
  const CAL_NAME = 'Heimtraining';

  let token = null;        // { access_token, expires_at, scope }
  let tokenClient = null;
  let gisLoading = null;

  function configured() { return !!(root.HT_CONFIG && root.HT_CONFIG.googleClientId); }

  function loadGis() {
    if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = root.document.createElement('script');
      s.src = GIS_URL; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Google-Anmeldung konnte nicht geladen werden.')); };
      root.document.head.appendChild(s);
    });
    return gisLoading;
  }

  function scopeString(withFreeBusy) {
    return withFreeBusy ? `${SCOPE_APP} ${SCOPE_FREEBUSY}` : SCOPE_APP;
  }

  // Interaktiv anmelden (Nutzer tippt auf "Verbinden")
  // silent: true versucht nur eine stille Erneuerung (ohne Fenster). Scheitert sie, wird nur abgelehnt.
  async function connect(withFreeBusy, silent) {
    if (!configured()) throw new Error('Google-Client-ID fehlt. Anleitung: README, Abschnitt Google-Kalender.');
    await loadGis();
    return new Promise((resolve, reject) => {
      tokenClient = root.google.accounts.oauth2.initTokenClient({
        client_id: root.HT_CONFIG.googleClientId,
        scope: scopeString(withFreeBusy),
        include_granted_scopes: true,
        callback: (resp) => {
          if (resp.error) return reject(new Error('Anmeldung abgebrochen oder abgelehnt (' + resp.error + ').'));
          token = { access_token: resp.access_token, expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000, scope: resp.scope || scopeString(withFreeBusy) };
          resolve(token);
        },
        error_callback: (e) => reject(new Error('Anmeldung fehlgeschlagen: ' + (e && e.type || 'unbekannt')))
      });
      tokenClient.requestAccessToken({ prompt: silent ? 'none' : (token ? '' : 'consent') });
    });
  }

  function disconnect() {
    if (token && root.google && root.google.accounts && root.google.accounts.oauth2 && token.access_token) {
      try { root.google.accounts.oauth2.revoke(token.access_token, () => {}); } catch (e) { /* ignorieren */ }
    }
    token = null;
  }

  function isConnected() { return !!(token && token.expires_at > Date.now() + 30000); }

  async function authed(method, path, body) {
    if (!isConnected()) throw new Error('Nicht mit Google verbunden. Bitte in den Einstellungen erneut verbinden.');
    const res = await root.fetch(API + path, {
      method,
      headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return { status: 204 };
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Trainingskalender anlegen oder wiederfinden
  async function ensureCalendar(calendarId) {
    if (calendarId) {
      try { await authed('GET', '/calendars/' + encodeURIComponent(calendarId)); return calendarId; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
    }
    const cal = await authed('POST', '/calendars', { summary: CAL_NAME, timeZone: 'Europe/Berlin', description: 'Trainingstermine aus der Heimtraining-App' });
    return cal.id;
  }

  // Ausführung einer bestätigten Operationsliste. onResult(sessionId, patch) aktualisiert das Protokoll.
  async function runOps(ops, calendarId, onResult) {
    const results = { ok: 0, failed: [] };
    for (const op of ops) {
      try {
        if (op.op === 'create') {
          try {
            const ev = await authed('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, op.body);
            onResult(op.sessionId, { eventId: ev.id || op.body.id, hash: op.hash, calendarId, error: null });
          } catch (e) {
            if (e.status !== 409) throw e;
            // Termin mit dieser ID existiert schon (z. B. nach Abbruch): aktualisieren statt doppelt anlegen
            await authed('PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${op.body.id}`, op.body);
            onResult(op.sessionId, { eventId: op.body.id, hash: op.hash, calendarId, error: null });
          }
        } else if (op.op === 'update') {
          try {
            await authed('PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(op.eventId)}`, op.body);
          } catch (e) {
            if (e.status !== 404 && e.status !== 410) throw e;
            // Termin wurde in Google gelöscht: mit derselben ID neu anlegen
            await authed('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, op.body);
          }
          onResult(op.sessionId, { eventId: op.eventId, hash: op.hash, calendarId, error: null });
        } else if (op.op === 'delete') {
          try { await authed('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(op.eventId)}`); }
          catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
          onResult(op.sessionId, { eventId: null, hash: null, calendarId: null, error: null });
        }
        results.ok++;
      } catch (e) {
        results.failed.push({ sessionId: op.sessionId, message: e.message });
        onResult(op.sessionId, { error: e.message });
      }
    }
    return results;
  }

  // Frei-/Belegt-Zeiten des Hauptkalenders (nur mit freebusy-Scope)
  async function busyBlocks(timeMinIso, timeMaxIso) {
    const data = await authed('POST', '/freeBusy', { timeMin: timeMinIso, timeMax: timeMaxIso, timeZone: 'Europe/Berlin', items: [{ id: 'primary' }] });
    const cal = data && data.calendars && data.calendars.primary;
    return (cal && cal.busy) || [];
  }

  root.HT_CAL = { configured, connect, disconnect, isConnected, ensureCalendar, runOps, busyBlocks, SCOPE_APP, SCOPE_FREEBUSY };
  if (typeof module === 'object' && module.exports) module.exports = root.HT_CAL;
})(typeof window !== 'undefined' ? window : globalThis);
