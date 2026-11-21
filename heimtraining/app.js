/* Oberfläche. Logik liegt in logic.js, Google-Anbindung in calendar.js. */
(function () {
  'use strict';
  const L = window.HT_LOGIC, D = window.HT_DATA, C = window.HT_CAL;
  const KEY = 'heimtraining.v1', UIKEY = 'heimtraining.ui.v1';
  const $ = (s, r) => (r || document).querySelector(s);

  let state = null;
  const ui = { route: 'today', open: null, weekStart: null, histTab: 'sessions', histEx: 'kb_deadlift', histSession: null };
  let draft = {};        // ungespeicherte Eingaben im Satz-Bildschirm
  let pre = null;        // Zustand des Vorab-Dialogs
  let busy = null;       // Belegt-Zeiten für die Woche (nur mit Freigabe)
  let busyWeek = null;
  let sheetEl = null;
  let tick = null;
  let toastTimer = null;
  let lastOk = null;

  // ---------- Grundfunktionen ----------
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function num(v) { return v == null ? '' : String(v).replace('.', ','); }
  function today() { return L.todayStr(new Date()); }
  function nowIso() { return new Date().toISOString(); }
  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1); }
  function byDateDesc(a, b) { return -byDate(a, b); }
  function find(id) { return state.sessions.find(s => s.id === id) || null; }

  const ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    play: '<path d="M7 5v14l12-7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    skip: '<path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/>',
    swap: '<path d="M7 4v16M7 4l-3 3M7 4l3 3"/><path d="M17 20V4M17 20l-3-3M17 20l3-3"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 .5 9z"/><path d="M9 14l2 2 4-4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
  };
  function icon(name, cls) { return `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }

  function kettlebellArt() {
    return `<svg viewBox="0 0 400 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe3d9"/><stop offset=".6" stop-color="#e7f0eb"/><stop offset="1" stop-color="#f3e7d9"/></linearGradient></defs>
      <rect width="400" height="210" fill="url(#g1)"/>
      <rect x="40" y="168" width="320" height="26" rx="13" fill="#b9d3c6"/>
      <path d="M150 88a50 50 0 0 1 100 0" fill="none" stroke="#2b2f2e" stroke-width="16" stroke-linecap="round"/>
      <circle cx="200" cy="128" r="62" fill="#2b2f2e"/>
      <text x="200" y="136" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#e9ece9">8 kg</text>
    </svg>`;
  }
  function cardioArt() {
    return `<svg viewBox="0 0 400 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe3d9"/><stop offset="1" stop-color="#f3e7d9"/></linearGradient></defs>
      <rect width="400" height="210" fill="url(#g2)"/>
      <rect x="60" y="150" width="280" height="22" rx="11" fill="#2b2f2e" opacity=".85"/>
      <rect x="40" y="172" width="320" height="12" rx="6" fill="#b9d3c6"/>
      <path d="M170 100 L210 60 L240 90 L270 60" fill="none" stroke="#c4592f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="196" cy="78" r="12" fill="#c4592f"/>
    </svg>`;
  }

  // ---------- Speichern ----------
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { toast('Speichern ist gerade nicht möglich. Bitte Daten exportieren (Einstellungen).'); return false; }
  }
  function saveUi() { try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch (e) { /* ohne Speicher weiter */ } }
  function loadUi() { try { const u = JSON.parse(localStorage.getItem(UIKEY) || 'null'); if (u && typeof u === 'object') Object.assign(ui, u); } catch (e) { /* Standard */ } }
  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s && s.version === 1 && Array.isArray(s.sessions)) { s.media = s.media || {}; s.targets = s.targets || {}; s.adjustments = s.adjustments || []; s.proposals = s.proposals || []; return s; }
      } catch (e) { /* unten Sicherung */ }
      try { localStorage.setItem(KEY + '.backup', raw); } catch (e) { /* ignorieren */ }
    }
    const init = L.initialState();
    init.media = {};
    return init;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3400);
  }

  // ---------- Begriffe und Formate ----------
  function label(type) { return L.KIND_LABEL[type] || 'Training'; }
  function tagFor(status) {
    const map = {
      abgeschlossen: ['ok', 'Abgeschlossen'], teilweise: ['warn', 'Teilweise'], abgebrochen: ['bad', 'Abgebrochen'],
      begonnen: ['warn', 'Offen'], geplant: ['', 'Geplant'], verschoben: ['mute', 'Verschoben'], ausgelassen: ['mute', 'Ausgelassen']
    };
    const [cls, text] = map[status] || ['mute', status];
    return `<span class="tag ${cls}">${esc(text)}</span>`;
  }
  function weightText(ex, w) {
    if (w == null) return '';
    const def = D.EXERCISES[ex.exerciseId] || ex;
    const per = def.equipment && def.equipment.includes('dumbbell') && !def.equipment.includes('kettlebell');
    return per ? `je ${num(w)} kg` : `${num(w)} kg`;
  }
  function targetText(t, ex) {
    if (t.kind === 'hold') return `${t.sets} × ${t.holdGoal || t.holdMin} s`;
    const side = t.perSide ? ' je Seite' : '';
    const w = t.weight != null ? ' · ' + weightText({ exerciseId: ex.exerciseId }, t.weight) : '';
    return `${t.sets} × ${t.goal} Wdh.${side}${w}`;
  }
  function setLabel(set, total, idx) {
    return `Satz ${idx + 1} von ${total}${set.side ? ' · ' + set.side : ''}`;
  }
  function equipmentOf(exs) {
    const set = new Set();
    exs.forEach(e => ((D.EXERCISES[e.exerciseId] || {}).equipment || []).forEach(x => set.add(x)));
    return [...set].map(x => D.EQUIPMENT[x] || x).join(', ');
  }
  function berlinHM(iso) { return iso ? L.fmtTime(iso) : '–'; }
  function clockOf(sec) { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

  // ---------- Hauptansichten ----------
  function render() {
    const before = state.sessions.length;
    L.ensurePlan(state, today(), 28);
    if (state.sessions.length !== before) persist();
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.route === ui.route));
    const main = $('#main');
    if (ui.route === 'today') main.innerHTML = viewToday();
    else if (ui.route === 'plan') main.innerHTML = viewPlan();
    else if (ui.route === 'history') main.innerHTML = viewHistory();
    else if (ui.route === 'settings') main.innerHTML = viewSettings();
    renderOverlay();
    saveUi();
  }

  function nextUp() {
    const open = state.sessions.filter(s => s.status === 'begonnen').sort(byDate);
    if (open.length) return open[0];
    return state.sessions
      .filter(s => s.status === 'geplant' && s.date >= today())
      .sort(byDate)[0] || null;
  }

  function viewToday() {
    const t = today();
    let h = `<h1>Heute</h1><div class="date">${esc(L.fmtDate(t, true))}</div>`;
    h += proposalsBlock();
    const s = nextUp();
    if (!s) {
      h += `<div class="card empty">Keine Einheit geplant. Im Wochenplan siehst du die nächsten Termine.</div>`;
    } else if (s.type === 'cardio') {
      h += cardioHero(s);
    } else {
      h += strengthHero(s);
    }
    const last = state.sessions
      .filter(x => ['abgeschlossen', 'teilweise', 'abgebrochen'].includes(x.status))
      .sort(byDateDesc)[0];
    if (last) {
      h += `<h2 class="section">Zuletzt</h2>
        <button class="list-item" data-act="openSession" data-id="${esc(last.id)}">
          <div class="grow"><div class="title">${esc(label(last.type))}</div>
          <div class="muted">${esc(L.fmtDate(last.date, false))}${last.effort != null ? ' · Anstrengung ' + last.effort + '/10' : ''}</div></div>
          ${tagFor(last.status)}
        </button>`;
    }
    return h;
  }

  function proposalsBlock() {
    const open = (state.proposals || []).map((p, i) => ({ p, i })).filter(x => x.p.open);
    if (!open.length) return '';
    return `<h2 class="section">Vorschläge</h2>` + open.map(({ p, i }) => {
      const ex = D.EXERCISES[p.exerciseId] || { name: p.exerciseId };
      return `<div class="card">
        <div class="title">${esc(ex.name)}</div>
        <div class="muted" style="margin:4px 0 6px">${esc(p.label)}</div>
        ${p.reason ? `<div class="muted">${esc(p.reason)}</div>` : ''}
        <div class="row" style="margin-top:12px;gap:10px">
          <button class="btn small" data-act="acceptProposal" data-idx="${i}">Übernehmen</button>
          <button class="btn small ghost" data-act="dismissProposal" data-idx="${i}">Nicht jetzt</button>
        </div></div>`;
    }).join('');
  }

  function strengthHero(s) {
    const started = s.status === 'begonnen';
    const preview = s.exercises.length ? s.exercises : L.buildExercises(state, s.type);
    const when = s.plannedTime ? `${L.fmtDate(s.date, false)} · ${s.plannedTime} Uhr` : `${L.fmtDate(s.date, false)} · Zeit offen`;
    const startedNote = started && s.startedAt ? `<div class="muted" style="margin-top:6px">Begonnen um ${esc(berlinHM(s.startedAt))} Uhr · ${esc(L.fmtDate(s.date, false))}</div>` : '';
    let h = `<div class="hero"><div class="art">${kettlebellArt()}</div><div class="body">
      <h3>${esc(label(s.type))}</h3>
      <div class="meta">${icon('clock')}<span>ca. ${L.estimateMinutes(s.type)} Min.</span></div>
      <div class="meta">${icon('dumbbell')}<span>${esc(equipmentOf(preview))}</span></div>
      <div class="meta">${icon('cal')}<span>${esc(when)}</span></div>
      ${startedNote}
      <button class="btn" data-act="${started ? 'resume' : 'start'}" data-id="${esc(s.id)}">${icon('play')}${started ? 'Fortsetzen' : 'Training starten'}</button>
    </div></div>`;
    if (started) {
      h += `<div class="banner">Diese Einheit ist offen. Du kannst sie fortsetzen oder als teilweise absolviert abschließen.</div>`;
    }
    h += `<div class="card"><div class="title" style="margin-bottom:8px">Geplante Übungen</div>` +
      preview.map(e => {
        const def = D.EXERCISES[e.exerciseId] || { name: e.exerciseId };
        return `<div class="check" style="justify-content:space-between;border-bottom:1px solid var(--line)">
          <div class="grow"><div style="font-weight:700">${esc(def.name)}${e.substituted ? ' <span class="tag">Ersatz</span>' : ''}</div>
          <div class="muted">${esc(targetText(e.target || L.currentTarget(state, e.exerciseId), e))}</div></div></div>`;
      }).join('') + `</div>`;
    if (!started) {
      h += `<div class="row" style="gap:10px"><button class="btn light small grow" data-act="moveSession" data-id="${esc(s.id)}">Verschieben</button>
        <button class="btn ghost small grow" data-act="dropSession" data-id="${esc(s.id)}">Ausfallen lassen</button></div>`;
    }
    return h;
  }

  function cardioHero(s) {
    const started = s.status === 'begonnen';
    const mode = s.cardioMode || 'joggen';
    const when = s.plannedTime ? `${L.fmtDate(s.date, false)} · ${s.plannedTime} Uhr` : `${L.fmtDate(s.date, false)} · Zeit offen`;
    const modes = [['joggen', 'Slow Jogging'], ['gehen', 'Gehen'], ['rudern', 'Lockeres Rudern']];
    return `<div class="hero"><div class="art">${cardioArt()}</div><div class="body">
      <h3>Ausdauer (optional)</h3>
      <div class="meta">${icon('clock')}<span>32 Min. · lockeres Tempo</span></div>
      <div class="meta">${icon('cal')}<span>${esc(when)}</span></div>
      <div class="meta">${icon('dumbbell')}<span>Laufband mit 3 % Steigung oder Rudergerät</span></div>
      ${started ? '' : `<div class="chips" style="margin-top:10px">${modes.map(([k, t]) => `<button class="chip ${mode === k ? 'on' : ''}" data-act="cardioMode" data-mode="${k}" data-id="${esc(s.id)}">${esc(t)}</button>`).join('')}</div>`}
      <button class="btn" data-act="${started ? 'resume' : 'start'}" data-id="${esc(s.id)}">${icon('play')}${started ? 'Fortsetzen' : 'Training starten'}</button>
    </div></div>
    <div class="card"><div class="title" style="margin-bottom:8px">Ablauf</div>
      ${cardioBlocks(mode).map(b => `<div class="check" style="justify-content:space-between"><span>${esc(b.label)}</span><span class="muted">${b.sec / 60} Min. · ${esc(b.speed)}</span></div>`).join('')}
    </div>
    ${started ? '' : `<div class="row" style="gap:10px"><button class="btn ghost small grow" data-act="dropSession" data-id="${esc(s.id)}">Ausfallen lassen</button></div>`}`;
  }

  function cardioBlocks(mode) {
    const move = mode === 'gehen' ? { label: 'Zügig gehen', speed: 'Tempo nach Gefühl' }
      : mode === 'rudern' ? { label: 'Lockeres Rudern', speed: 'Tempo nach Gefühl' }
      : { label: 'Slow Jogging', speed: '5,0 km/h' };
    const walk = { label: 'Gehen', speed: '3,2 km/h' };
    const b = [{ label: 'Einlaufen', speed: '3,0 km/h', sec: 300 }];
    for (let i = 0; i < 4; i++) {
      b.push({ label: move.label, speed: move.speed, sec: 240 });
      if (i < 3) b.push({ label: walk.label, speed: walk.speed, sec: 120 });
    }
    b.push({ label: 'Auslaufen', speed: '3,2 km/h', sec: 300 });
    return b;
  }

  function viewPlan() {
    if (!ui.weekStart) ui.weekStart = L.mondayOf(today());
    const ws = ui.weekStart, we = L.addDays(ws, 6);
    const list = state.sessions.filter(s => s.date >= ws && s.date <= we).sort(byDate);
    const weekLabel = `${L.fmtDate(ws, false).replace(/^\w+, /, '')} – ${L.fmtDate(we, false).replace(/^\w+, /, '')}`;
    let h = `<h1>Wochenplan</h1><div class="date">Vorschläge nach deinen Zeiten, Mittwoch und Freitag ab 16 Uhr.</div>`;
    h += `<div class="week-nav"><button class="icon-btn" data-act="week" data-d="-7" aria-label="Vorwoche">${icon('back')}</button>
      <strong>${esc(weekLabel)}</strong>
      <button class="icon-btn" data-act="week" data-d="7" aria-label="Nächste Woche"><svg class="i" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>`;
    if (!list.length) h += `<div class="card empty">Keine Termine in dieser Woche.</div>`;
    h += list.map(s => planRow(s)).join('');
    h += calendarTile();
    return h;
  }

  function sessionSpan(s) {
    const start = s.startedAt || (s.plannedTime ? L.berlinIso(s.date, s.plannedTime) : null);
    if (!start) return null;
    const dur = s.type === 'cardio' ? 32 : 40;
    return { start: Date.parse(start), end: Date.parse(start) + dur * 60000 };
  }
  function planRow(s) {
    const isCardio = s.type === 'cardio';
    let conflict = '';
    if (busy && s.status === 'geplant' && s.plannedTime) {
      const span = sessionSpan(s);
      if (span && busy.some(b => span.start < Date.parse(b.end) && span.end > Date.parse(b.start))) conflict = `<span class="tag warn">Belegt laut Kalender</span>`;
    }
    const time = s.startedAt ? `${berlinHM(s.startedAt)} Uhr` : (s.plannedTime ? `${s.plannedTime} Uhr` : 'Zeit offen');
    return `<button class="list-item ${['abgeschlossen', 'teilweise'].includes(s.status) ? 'done' : ''}" data-act="detail" data-id="${esc(s.id)}">
      <span class="ico">${icon(isCardio ? 'bolt' : 'cal')}</span>
      <div class="grow"><div class="title">${esc(label(s.type))}${isCardio ? ' <span class="tag">Optional</span>' : ''}</div>
        <div class="muted">${esc(L.fmtDate(s.date, false))} · ${esc(time)}</div></div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${tagFor(s.status)}${conflict}</div>
    </button>`;
  }

  function calendarTile() {
    const cal = state.settings.calendar;
    const ops = L.planCalendarOps(state);
    const errs = state.sessions.filter(s => s.calendar && s.calendar.error).length;
    let status, action = '';
    if (!C.configured()) {
      status = 'Nicht eingerichtet. Die Anleitung steht im README.';
    } else if (!C.isConnected()) {
      status = 'Nicht verbunden. Die Verbindung gilt für diese Browser-Sitzung.';
      action = `<button class="btn small" data-act="gconnect">Mit Google verbinden</button>`;
    } else if (ops.length || errs) {
      status = `${ops.length} Vorgänge ausstehend${errs ? ` · ${errs} mit Fehler` : ''}`;
      action = `<button class="btn small" data-act="gpreview">Vorschau & eintragen</button>`;
    } else {
      status = 'Synchron';
      action = `<button class="btn light small" data-act="gpreview">Vorschau anzeigen</button>`;
    }
    return `<h2 class="section">Google Kalender</h2>
      <div class="card"><div class="row"><span class="ico" style="width:40px;height:40px;border-radius:12px;background:var(--mint);display:grid;place-items:center">${icon('cal')}</span>
        <div class="grow"><div class="title">Trainingskalender</div><div class="muted">${esc(status)}</div></div></div>
        ${action ? `<div style="margin-top:10px">${action}</div>` : ''}
        ${cal.freeBusy ? `<button class="btn ghost small" style="margin-top:10px" data-act="busy">Belegt-Zeiten aktualisieren</button>` : ''}
      </div>`;
  }

  function viewHistory() {
    const tabs = [['sessions', 'Einheiten'], ['exercises', 'Übungen'], ['adjust', 'Anpassungen']];
    let h = `<h1>Verlauf</h1><div class="seg">${tabs.map(([k, t]) => `<button class="${ui.histTab === k ? 'on' : ''}" data-act="histTab" data-tab="${k}">${t}</button>`).join('')}</div>`;
    if (ui.histTab === 'sessions') {
      const list = state.sessions.filter(s => s.status !== 'geplant').sort(byDateDesc);
      if (!list.length) h += `<div class="card empty">Noch keine Einheiten abgeschlossen.</div>`;
      h += list.map(s => {
        const all = s.exercises.flatMap(e => e.sets);
        const done = all.filter(x => x.status === 'erledigt').length;
        const sum = s.detailsMissing ? 'Sätze nicht erfasst' : (all.length ? `${done} von ${all.length} Sätzen` : '');
        return `<button class="list-item" data-act="detail" data-id="${esc(s.id)}">
          <div class="grow"><div class="title">${esc(label(s.type))}</div>
          <div class="muted">${esc(L.fmtDate(s.date, false))}${s.startedAt ? ' · ' + esc(berlinHM(s.startedAt)) : ''}${sum ? ' · ' + esc(sum) : ''}</div></div>
          ${tagFor(s.status)}</button>`;
      }).join('');
    } else if (ui.histTab === 'exercises') {
      const withHist = Object.keys(D.EXERCISES);
      h += `<div class="field"><label for="exSel">Übung</label><select id="exSel" data-field="histEx">${withHist.map(id => `<option value="${id}" ${id === ui.histEx ? 'selected' : ''}>${esc(D.EXERCISES[id].name)}</option>`).join('')}</select></div>`;
      const hist = L.exerciseHistory(state.sessions, ui.histEx);
      h += exerciseChart(hist);
      if (!hist.length) h += `<div class="card empty">Noch keine Einheiten mit dieser Übung.</div>`;
      h += hist.slice().reverse().map(x => `<div class="list-item" style="background:#fff"><div class="grow"><div class="title">${esc(L.fmtDate(x.date, false))}</div><div class="muted">${esc(x.summary)}</div></div>${x.status === 'begonnen' ? tagFor('begonnen') : ''}</div>`).join('');
    } else {
      const adj = state.adjustments.slice().reverse();
      if (!adj.length) h += `<div class="card empty">Noch keine Anpassungen.</div>`;
      h += adj.map(a => {
        const ex = D.EXERCISES[a.exerciseId] || { name: a.exerciseId };
        const change = a.after && a.before ? `${targetLine(a.before)} → ${targetLine(a.after)}` : '';
        return `<div class="card"><div class="row"><div class="grow"><div class="title">${esc(ex.name)}</div>
          <div class="muted">${esc(L.fmtDate(a.date, false))}${a.auto ? ' · automatisch' : ' · bestätigt'}</div></div>
          ${a.undone ? '<span class="tag mute">Rückgängig</span>' : `<button class="btn small light" data-act="undo" data-id="${esc(a.id)}">${icon('undo')} Rückgängig</button>`}</div>
          <div style="margin-top:8px">${esc(a.reason || '')}</div>
          ${change ? `<div class="muted" style="margin-top:6px">${esc(change)}</div>` : ''}</div>`;
      }).join('');
    }
    return h;
  }
  function targetLine(t) {
    if (!t) return '';
    if (t.replacedBy) return `ersetzt durch ${(D.EXERCISES[t.replacedBy] || {}).name || t.replacedBy}`;
    const w = t.weight != null ? `, ${num(t.weight)} kg` : '';
    return `${t.sets} × ${t.goal ?? t.repMin} Wdh.${w}`;
  }

  function exerciseChart(hist) {
    const pts = hist.map(x => x.worstReps ?? x.worstHold).filter(v => v != null);
    if (pts.length < 1) return '';
    const w = 320, hgt = 130, pad = 22;
    const max = Math.max(...pts, 1), min = Math.min(...pts, 0);
    const xs = (i) => pad + (pts.length === 1 ? (w - 2 * pad) / 2 : i * (w - 2 * pad) / (pts.length - 1));
    const ys = (v) => hgt - pad - ((v - min) / ((max - min) || 1)) * (hgt - 2 * pad);
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
    const dots = pts.map((v, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="4" fill="#c4592f"/><text x="${xs(i).toFixed(1)}" y="${(ys(v) - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="#0f3b35">${v}</text>`).join('');
    return `<div class="card"><div class="muted" style="margin-bottom:4px">Schlechtester Satz je Einheit</div>
      <svg class="bar-chart" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Verlauf"><path d="${d}" fill="none" stroke="#0f3b35" stroke-width="2"/>${dots}</svg></div>`;
  }

  function viewSettings() {
    const st = state.settings;
    const dayOpts = (sel) => [1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${d === sel ? 'selected' : ''}>${L.WEEKDAYS_LONG[d]}</option>`).join('');
    const cal = st.calendar;
    const cfg = C.configured();
    return `<div class="row" style="margin-top:12px"><button class="icon-btn" data-act="backToday" aria-label="Zurück">${icon('back')}</button><h1 style="margin:0 0 0 4px;font-size:28px">Einstellungen</h1></div>
      <h2 class="section">Trainingszeiten</h2>
      <div class="card">
        ${st.slots.map((s, i) => `<div class="row" style="margin-bottom:12px;flex-wrap:wrap">
          <div class="grow field" style="margin:0;min-width:140px"><label>Krafttraining ${i + 1}</label><select data-field="slotDay" data-i="${i}">${dayOpts(s.weekday)}</select></div>
          <div class="field" style="margin:0;width:120px"><label>Uhrzeit</label><input type="time" value="${esc(s.time)}" data-field="slotTime" data-i="${i}"></div></div>`).join('')}
        <div class="toggle"><span>Ausdauer optional einplanen</span><input type="checkbox" data-field="cardioOn" ${st.cardio.optional ? 'checked' : ''}></div>
        <div class="field" style="margin-top:12px"><label>Ausdauertag (Zeit bleibt offen)</label><select data-field="cardioDay">${dayOpts(st.cardio.weekday)}</select></div>
        <div class="field"><span class="flbl">Satzpause</span><div class="chips">${[60, 75, 90, 120].map(v => `<button class="chip ${st.restSec === v ? 'on' : ''}" data-act="rest" data-v="${v}">${v} s</button>`).join('')}</div></div>
        <div class="toggle"><span>Pausentimer automatisch starten</span><input type="checkbox" data-field="timerOn" ${st.timerOn ? 'checked' : ''}></div>
        <div class="muted" style="margin-top:8px">Änderungen gelten ab heute. Noch nicht begonnene Termine werden angepasst.</div>
      </div>
      <h2 class="section">Google Kalender</h2>
      <div class="card">
        ${cfg ? '' : `<div class="banner">Noch nicht eingerichtet. Ohne Google-Client-ID funktioniert alles andere wie gewohnt. Die Anleitung steht im README.</div>`}
        <div class="muted" style="margin-bottom:10px">Status: ${C.isConnected() ? 'verbunden (diese Sitzung)' : 'nicht verbunden'}</div>
        ${C.isConnected()
          ? `<button class="btn light" data-act="gdisconnect">Verbindung trennen</button>`
          : `<button class="btn" ${cfg ? '' : 'disabled'} data-act="gconnect">Mit Google verbinden</button>`}
        <div class="toggle" style="margin-top:12px"><span>Frei-/Belegt-Zeiten prüfen<br><span class="muted">Zusätzliche Berechtigung, nur Zeiten, keine Titel</span></span><input type="checkbox" data-field="freeBusy" ${cal.freeBusy ? 'checked' : ''}></div>
        <div class="muted" style="margin-top:10px">Eingetragen wird in den Kalender „Heimtraining“ (Europe/Berlin): Titel, Zeit und Status. Beschwerden und Trainingswerte bleiben in der App.</div>
        <button class="btn ghost" style="margin-top:12px" data-act="gpreview">Vorschau & eintragen</button>
      </div>
      <h2 class="section">Daten</h2>
      <div class="card">
        <div class="muted" style="margin-bottom:10px">Alle Daten liegen nur auf diesem Gerät. Bitte gelegentlich exportieren.</div>
        <button class="btn" data-act="export">Daten exportieren</button>
        <label class="btn light" style="margin-top:10px;cursor:pointer">Datei importieren<input type="file" accept="application/json,.json" id="importFile" hidden></label>
        <button class="btn danger" style="margin-top:10px" data-act="reset">Auf Startdaten zurücksetzen</button>
      </div>
      <div class="muted" style="text-align:center;margin:10px 0 0">Trainingszeit · Stand ${esc(L.fmtDate(today(), false))}</div>`;
  }

  // ---------- Vorab-Dialog ----------
  function startSheet(id) {
    const s = find(id);
    if (!s) return;
    if (s.type === 'cardio') { startCardio(s); return; }
    const preview = L.buildExercises(state, s.type);
    pre = { id, feeling: null, knee: false, leftHand: false, choices: {} };
    preRender(preview);
  }
  function preRender(preview) {
    const s = find(pre.id);
    const exs = preview || L.buildExercises(state, s.type);
    const affected = exs.filter(e => {
      const d = D.EXERCISES[e.exerciseId];
      return (pre.knee && d.knee) || (pre.leftHand && d.grip);
    });
    const newKb = exs.filter(e => {
      const d = D.EXERCISES[e.exerciseId];
      return d.equipment.includes('kettlebell') && !L.hasPreviousData(state.sessions, e.exerciseId, s.id);
    });
    const chipsFeel = [1, 2, 3, 4, 5].map(v => `<button class="chip ${pre.feeling === v ? 'on' : ''}" data-act="preFeel" data-v="${v}">${v}</button>`).join('');
    const body = `<h3>${esc(label(s.type))} starten</h3>
      <div class="field"><span class="flbl">Wie fühlst du dich? (1 schlecht – 5 sehr gut, optional)</span><div class="chips">${chipsFeel}</div></div>
      <div class="toggle"><span>Beschwerden am Knie</span><input type="checkbox" data-act="preToggle" data-k="knee" ${pre.knee ? 'checked' : ''}></div>
      <div class="toggle"><span>Beschwerden an der linken Hand</span><input type="checkbox" data-act="preToggle" data-k="leftHand" ${pre.leftHand ? 'checked' : ''}></div>
      ${affected.length ? `<h2 class="section">Anpassen für heute</h2>` + affected.map(e => {
        const d = D.EXERCISES[e.exerciseId];
        const alt = (L.templateSlots(s.type).find(x => x.exerciseId === e.exerciseId) || {}).alternativeId;
        const cur = pre.choices[e.exerciseId] || 'keep';
        const opts = [['keep', 'Unverändert']];
        if (d.easier) opts.push(['easy', 'Leichter']);
        if (alt) opts.push(['alt', 'Austauschen']);
        opts.push(['skip', 'Auslassen']);
        return `<div class="field"><span class="flbl">${esc(d.name)}</span><div class="chips">${opts.map(([k, t]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="preChoice" data-ex="${e.exerciseId}" data-c="${k}">${t}</button>`).join('')}</div></div>`;
      }).join('') : ''}
      ${newKb.length ? `<div class="banner">Neue Kettlebell-Übung: Griff und kontrollierte Ausführung zuerst prüfen, notfalls mit leichterer Last beginnen (${newKb.map(e => esc(D.EXERCISES[e.exerciseId].name)).join(', ')}).</div>` : ''}
      <button class="btn" data-act="preStart">${icon('play')}Training starten</button>
      <button class="btn ghost" data-act="close" style="margin-top:8px">Abbrechen</button>`;
    openOrUpdateSheet(body);
  }

  function startCardio(s) {
    s.status = 'begonnen';
    s.startedAt = s.startedAt || nowIso();
    s.cardioMode = s.cardioMode || 'joggen';
    ui.open = s.id;
    persist(); closeSheet(); render();
  }

  function beginSession() {
    const s = find(pre.id);
    if (!s) return;
    L.startSession(state, s, nowIso(), { knee: pre.knee, leftHand: pre.leftHand, feeling: pre.feeling });
    s.feeling = pre.feeling;
    s.exercises.forEach((ex, idx) => {
      const c = pre.choices[ex.exerciseId];
      const def = D.EXERCISES[ex.exerciseId];
      if (c === 'easy' && def.easier) L.swapExercise(s, idx, def.easier, L.currentTarget(state, def.easier));
      else if (c === 'alt') {
        const alt = (L.templateSlots(s.type).find(x => x.exerciseId === ex.originalExerciseId) || {}).alternativeId;
        if (alt) L.swapExercise(s, idx, alt, L.currentTarget(state, alt));
      } else if (c === 'skip') L.skipExercise(s, idx);
    });
    ui.open = s.id;
    pre = null;
    persist(); closeSheet(); render();
  }

  // ---------- Satz-Bildschirm ----------
  // Eine begonnene Einheit ohne Übungsliste (z. B. aus den Startdaten) bekommt ihre Übungen beim Fortsetzen
  function ensureExercises(s) {
    if (s.type !== 'cardio' && s.status === 'begonnen' && !s.exercises.length) {
      L.startSession(state, s, s.startedAt || nowIso(), null);
      persist();
    }
  }

  function renderOverlay() {
    const ov = $('#overlay');
    const s = ui.open ? find(ui.open) : null;
    if (!s || (s.status !== 'begonnen')) {
      ov.innerHTML = '';
      ui.open = null;
      stopTick();
      return;
    }
    ensureExercises(s);
    ov.innerHTML = s.type === 'cardio' ? cardioRunnerHTML(s) : runnerHTML(s);
    if (s.type !== 'cardio' && s.restEndsAt) startTick(); else if (s.type === 'cardio') startTick(); else stopTick();
  }

  function runnerHTML(s) {
    const pos = L.currentPosition(s);
    const n = s.exercises.length;
    const head = `<div class="runner"><div class="inner">
      <div class="head"><button class="icon-btn" data-act="leave" aria-label="Später fortsetzen">${icon('back')}</button><h2>${esc(label(s.type))}</h2><span></span></div>`;
    const progress = `<div class="progress">${s.exercises.map((e, i) => {
      let c = '';
      if (e.status === 'erledigt') c = 'done';
      else if (e.status === 'übersprungen') c = 'skip';
      else if (pos && pos.ex === i) c = 'cur';
      return `<span class="${c}"></span>`;
    }).join('')}</div>`;
    if (!pos) {
      return head + progress + `<div class="ctx">Alle Übungen sind durch.</div>
        <div class="card empty">Du kannst jetzt abschließen. Offene Sätze lassen sich vorher nachholen.</div>
        ${summaryList(s)}
        <button class="btn" data-act="finish">Training abschließen</button></div></div>`;
    }
    const ex = s.exercises[pos.ex];
    const set = ex.sets[pos.set];
    const t = ex.target || L.currentTarget(state, ex.exerciseId);
    const def = D.EXERCISES[ex.exerciseId] || { name: ex.exerciseId };
    const k = `${s.id}|${pos.ex}|${pos.set}`;
    const d = draft[k] || slotDefaults(s, pos);
    const isHold = t.kind === 'hold';
    const wTile = isHold ? '' : `<div class="tile"><div class="lbl">${def.equipment.includes('dumbbell') && !def.equipment.includes('kettlebell') ? 'Gewicht je Hand' : 'Gewicht'}</div>
        <input type="number" inputmode="decimal" step="0.5" min="0" value="${esc(d.weight ?? '')}" data-field="draftW" aria-label="Gewicht in kg">
        <div class="val" style="font-size:16px;margin-top:-2px"><small>kg</small></div></div>`;
    const rTile = isHold ? `<div class="tile" style="grid-column:span 2"><div class="lbl">Haltezeit</div>
        <input type="number" inputmode="numeric" step="5" min="0" value="${esc(d.holdSec ?? '')}" data-field="draftH" aria-label="Haltezeit in Sekunden"><div class="val" style="font-size:16px;margin-top:-2px"><small>Sekunden · Ziel ${t.holdMin}–${t.holdMax}</small></div></div>`
      : `<div class="tile"><div class="lbl">Wiederholungen</div>
        <input type="number" inputmode="numeric" step="1" min="0" value="${esc(d.reps ?? '')}" data-field="draftR" aria-label="Wiederholungen">
        <div class="val" style="font-size:16px;margin-top:-2px"><small>Ziel ${t.goal} · Bereich ${t.repMin}–${t.repMax}</small></div></div>`;
    const dots = ex.sets.map((x, i) => `<span class="${x.status === 'erledigt' ? 'done' : x.status === 'übersprungen' ? 'skip' : i === pos.set ? 'cur' : ''}"></span>`).join('');
    const timer = timerHTML(s);
    return head + progress + `
      <div class="ctx">Übung ${pos.ex + 1} von ${n}</div>
      <div class="ex-name">${esc(def.name)}</div>
      ${ex.substituted ? '<div class="center" style="margin-bottom:6px"><span class="tag">Ersatzübung</span></div>' : ''}
      <div class="center"><button class="pill" data-act="cues">${icon('play')} Technik ansehen</button></div>
      <div class="tiles">${wTile}${rTile}</div>
      <div class="setdots">${esc(setLabel(set, ex.sets.length, pos.set))}</div>
      <div class="dots">${dots}</div>
      <button class="btn" data-act="done">${icon('check')}Satz erledigt</button>
      ${timer}
      <div class="actions">
        <button data-act="skipSet">${icon('skip')} Satz überspringen</button>
        <button data-act="swap">${icon('swap')} Übung wechseln</button>
        <button data-act="pain">${icon('alert')} Beschwerden</button>
        <button data-act="skipEx">${icon('skip')} Übung auslassen</button>
      </div>
      ${summaryList(s)}
      <button class="btn light" data-act="finish" style="margin-top:14px">Training abschließen</button>
      <div class="muted" style="text-align:center;margin-top:12px">„Später fortsetzen“ speichert alles. Beim nächsten Öffnen geht es an derselben Stelle weiter.</div>
    </div></div>`;
  }

  // Vorgaben für den angezeigten Satz. Was angezeigt wird, wird auch gespeichert, wenn nichts geändert wurde.
  function slotDefaults(s, pos) {
    const ex = s.exercises[pos.ex];
    const set = ex.sets[pos.set];
    const t = ex.target || L.currentTarget(state, ex.exerciseId);
    return {
      reps: set.reps != null ? set.reps : t.goal,
      weight: set.weight != null ? set.weight : t.weight,
      holdSec: set.holdSec != null ? set.holdSec : (t.holdGoal || t.holdMin)
    };
  }

  function summaryList(s) {
    return `<h2 class="section">Übungen dieser Einheit</h2><div class="card" style="padding:6px 14px">` +
      s.exercises.map((e, i) => {
        const def = D.EXERCISES[e.exerciseId] || { name: e.exerciseId };
        const sets = e.sets.map((x, j) => {
          const val = x.status === 'erledigt' ? `${x.reps != null ? x.reps + ' Wdh.' : (x.holdSec != null ? x.holdSec + ' s' : '–')}${x.weight != null ? ' · ' + num(x.weight) + ' kg' : ''}` : x.status === 'übersprungen' ? 'übersprungen' : 'offen';
          const act = x.status === 'erledigt' ? `<button class="btn small light" data-act="editSet" data-ex="${i}" data-set="${j}">Ändern</button>` : (x.status === 'übersprungen' ? `<button class="btn small light" data-act="reopenSet" data-ex="${i}" data-set="${j}">Nachholen</button>` : '');
          return `<tr><td>${esc(setLabel(x, e.sets.length, j).replace(/ von \d+/, ''))}</td><td>${esc(val)}</td><td style="text-align:right">${act}</td></tr>`;
        }).join('');
        return `<details ${e.status === 'offen' ? '' : ''} style="padding:8px 0;border-bottom:1px solid var(--line)"><summary style="font-weight:700;cursor:pointer">${esc(def.name)} ${tagFor(e.status === 'erledigt' ? 'abgeschlossen' : e.status === 'übersprungen' ? 'ausgelassen' : e.status === 'teilweise' ? 'teilweise' : 'geplant')}</summary>
          <table class="sets-table">${sets}</table></details>`;
      }).join('') + `</div>`;
  }

  function timerHTML(s) {
    if (!state.settings.timerOn && !s.restEndsAt) return '';
    const rem = s.restEndsAt ? Math.ceil((Date.parse(s.restEndsAt) - Date.now()) / 1000) : 0;
    if (rem > 0) {
      return `<div class="timer"><div class="muted">Pause</div><div class="big" id="timerBig">${clockOf(rem)}</div>
        <div class="row"><button class="btn small light" data-act="restAdd">+30 s</button><button class="btn small" data-act="restStop">Weiter</button></div></div>`;
    }
    return `<div class="timer"><div class="muted">Pause</div><div class="big">${clockOf(state.settings.restSec)}</div>
      <div class="row"><button class="btn small light" data-act="restStart">Pause starten</button></div></div>`;
  }

  function cardioRunnerHTML(s) {
    const blocks = cardioBlocks(s.cardioMode || 'joggen');
    const total = blocks.reduce((a, b) => a + b.sec, 0);
    const elapsed = Math.max(0, (Date.now() - Date.parse(s.startedAt)) / 1000);
    let acc = 0, cur = null;
    for (const b of blocks) { if (elapsed < acc + b.sec) { cur = { ...b, inBlock: elapsed - acc }; break; } acc += b.sec; }
    const finished = elapsed >= total;
    const focus = finished
      ? `<div class="ex-name">Geschafft</div>`
      : `<div class="ex-name">${esc(cur.label)}</div><div class="center muted">${esc(cur.speed)}</div>
         <div class="timer"><div class="muted">verstrichen bis ${clockOf(cur.sec)}</div><div class="big" id="timerBig">${clockOf(cur.inBlock)}</div><div class="muted">noch ${clockOf(cur.sec - cur.inBlock)} bis zum Wechsel</div></div>`;
    return `<div class="runner"><div class="inner">
      <div class="head"><button class="icon-btn" data-act="leave" aria-label="Später fortsetzen">${icon('back')}</button><h2>Ausdauer</h2><span></span></div>
      <div class="ctx">Gesamt ${clockOf(elapsed)} von ${clockOf(total)}</div>
      ${focus}
      <div class="card" style="margin-top:16px">${blocks.map((b, i) => {
        const doneBlk = (blocks.slice(0, i).reduce((a, x) => a + x.sec, 0) + b.sec) <= elapsed;
        return `<div class="check" style="justify-content:space-between;opacity:${doneBlk ? .5 : 1}"><span>${doneBlk ? '✓ ' : ''}${esc(b.label)}</span><span class="muted">${b.sec / 60} Min.</span></div>`;
      }).join('')}</div>
      <button class="btn" data-act="cardioFinish">${icon('check')}Ausdauer abschließen</button>
      <div class="muted" style="text-align:center;margin-top:12px">Die Anzeige zählt weiter, auch wenn die Seite neu geladen wird.</div>
    </div></div>`;
  }

  // Laufende Uhr: aktualisiert nur die Anzeige, damit Eingaben nicht verloren gehen
  function startTick() {
    if (tick) return;
    tick = setInterval(() => {
      const s = ui.open ? find(ui.open) : null;
      if (!s || s.status !== 'begonnen') { stopTick(); return; }
      if (s.type === 'cardio') {
        const blocks = cardioBlocks(s.cardioMode || 'joggen');
        const total = blocks.reduce((a, b) => a + b.sec, 0);
        if (Date.now() - Date.parse(s.startedAt) >= total * 1000) { render(); return; }
        renderOverlay();
        return;
      }
      if (s.restEndsAt) {
        const rem = Math.ceil((Date.parse(s.restEndsAt) - Date.now()) / 1000);
        if (rem <= 0) {
          s.restEndsAt = null; persist();
          if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (e) { /* ohne Vibration */ } }
          toast('Pause vorbei. Weiter geht es.');
          render();
        } else {
          const el = document.getElementById('timerBig');
          if (el) el.textContent = clockOf(rem);
        }
      }
    }, 1000);
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  // ---------- Sheets ----------
  function openSheet(html) {
    closeSheet();
    sheetEl = document.createElement('div');
    sheetEl.className = 'scrim';
    sheetEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    sheetEl.addEventListener('click', e => { if (e.target === sheetEl) closeSheet(); });
    document.body.appendChild(sheetEl);
  }
  function openOrUpdateSheet(html) {
    if (!sheetEl) return openSheet(html);
    sheetEl.querySelector('.sheet').innerHTML = `<div class="grab"></div>${html}`;
  }
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }

  function detailSheet(id) {
    const s = find(id);
    if (!s) return;
    if (s.status === 'geplant') { return planSheet(s); }
    const rows = s.exercises.map((e, i) => {
      const def = D.EXERCISES[e.exerciseId] || { name: e.exerciseId };
      const sets = e.sets.map((x, j) => {
        const v = x.status === 'erledigt' ? `${x.reps != null ? x.reps + ' Wdh.' : (x.holdSec != null ? x.holdSec + ' s' : '–')}${x.weight != null ? ' · ' + num(x.weight) + ' kg' : ''}` : x.status;
        return `<tr><td>${esc(setLabel(x, e.sets.length, j).replace(/ von \d+/, ''))}</td><td>${esc(v)}</td><td style="text-align:right"><button class="btn small light" data-act="editHistSet" data-id="${esc(s.id)}" data-ex="${i}" data-set="${j}">Ändern</button></td></tr>`;
      }).join('');
      return `<div style="margin-bottom:10px"><div class="title" style="font-size:16px">${esc(def.name)} ${tagFor(e.status === 'erledigt' ? 'abgeschlossen' : e.status === 'übersprungen' ? 'ausgelassen' : e.status === 'teilweise' ? 'teilweise' : 'geplant')}</div><table class="sets-table">${sets}</table></div>`;
    }).join('');
    const body = `<h3>${esc(label(s.type))}</h3>
      <div class="muted" style="margin-bottom:10px">${esc(L.fmtDate(s.date, true))} ${tagFor(s.status)}</div>
      <dl class="kv">
        <dt>Zeit</dt><dd>${s.startedAt ? esc(berlinHM(s.startedAt)) : (s.plannedTime ? esc(s.plannedTime) : '–')} – ${s.endedAt ? esc(berlinHM(s.endedAt)) : '–'}</dd>
        <dt>Befinden</dt><dd>${s.feeling != null ? s.feeling + ' von 5' : 'offen'}</dd>
        <dt>Beschwerden</dt><dd>${[s.pain && s.pain.knee ? 'Knie' : '', s.pain && s.pain.leftHand ? 'linke Hand' : ''].filter(Boolean).join(', ') || 'keine'}</dd>
        <dt>Notiz</dt><dd>${esc(s.notes || '–')}</dd>
      </dl>
      ${s.detailsMissing ? '<div class="banner" style="margin-top:12px">Zu dieser Einheit liegen keine Satzdaten vor.</div>' : ''}
      ${s.type === 'cardio' ? '' : `<h2 class="section">Sätze</h2>${rows || '<div class="muted">Keine Sätze erfasst.</div>'}`}
      <h2 class="section">Anstrengung (0–10, optional)</h2>
      <div class="chips">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button class="chip ${s.effort === v ? 'on' : ''}" data-act="setEffort" data-id="${esc(s.id)}" data-v="${v}">${v}</button>`).join('')}</div>
      ${s.status === 'begonnen' ? `<button class="btn" data-act="resume" data-id="${esc(s.id)}">Fortsetzen</button>` : ''}
      <button class="btn ghost" data-act="close" style="margin-top:12px">Schließen</button>`;
    openSheet(body);
  }

  function planSheet(s) {
    const exs = L.buildExercises(state, s.type === 'cardio' ? 'A' : s.type);
    const list = s.type === 'cardio' ? '' : exs.map(e => {
      const def = D.EXERCISES[e.exerciseId];
      return `<div class="check" style="justify-content:space-between"><span>${esc(def.name)}</span><span class="muted">${esc(targetText(e.target || L.currentTarget(state, e.exerciseId), e))}</span></div>`;
    }).join('');
    const cal = s.calendar && s.calendar.eventId ? `<div class="muted" style="margin-top:8px">Kalendertermin ist angelegt.</div>` : '';
    const err = s.calendar && s.calendar.error ? `<div class="banner bad" style="margin-top:8px">Kalenderfehler: ${esc(s.calendar.error)}</div>` : '';
    openSheet(`<h3>${esc(label(s.type))}</h3>
      <div class="muted" style="margin-bottom:12px">${esc(L.fmtDate(s.date, true))} · ${s.plannedTime ? esc(s.plannedTime) + ' Uhr' : 'Zeit offen'} ${tagFor(s.status)}</div>
      ${list ? `<div class="card" style="padding:6px 14px">${list}</div>` : ''}
      ${cal}${err}
      ${s.status === 'geplant' ? `<button class="btn" data-act="start" data-id="${esc(s.id)}">${icon('play')}Training starten</button>` : ''}
      ${s.status === 'geplant' ? `<div class="row" style="gap:10px;margin-top:10px"><button class="btn light small grow" data-act="moveSession" data-id="${esc(s.id)}">Verschieben</button><button class="btn ghost small grow" data-act="dropSession" data-id="${esc(s.id)}">Ausfallen lassen</button></div>` : ''}
      <button class="btn ghost" data-act="close" style="margin-top:12px">Schließen</button>`);
  }

  function moveSheet(id) {
    const s = find(id);
    if (!s) return;
    openSheet(`<h3>Verschieben</h3>
      <div class="muted" style="margin-bottom:12px">Der Termin bleibt derselbe. Im Kalender wird er bei der nächsten Synchronisation aktualisiert.</div>
      <div class="field"><label>Datum</label><input type="date" id="mvDate" value="${esc(s.date)}"></div>
      <div class="field"><label>Uhrzeit (leer = Zeit offen)</label><input type="time" id="mvTime" value="${esc(s.plannedTime || '')}"></div>
      <button class="btn" data-act="moveSave" data-id="${esc(s.id)}">Speichern</button>
      <button class="btn ghost" data-act="close" style="margin-top:8px">Abbrechen</button>`);
  }

  function finishSheet() {
    const s = find(ui.open);
    if (!s) return;
    const all = s.exercises.flatMap(e => e.sets);
    const done = all.filter(x => x.status === 'erledigt').length;
    const startVal = s.startedAt ? L.berlinOf(s.startedAt).time : (s.plannedTime || L.berlinOf(nowIso()).time);
    const endVal = L.berlinOf(nowIso()).time;
    const painK = s.pain && s.pain.knee, painH = s.pain && s.pain.leftHand;
    openSheet(`<h3>Training abschließen</h3>
      <div class="muted" style="margin-bottom:12px">${done} von ${all.length} Sätzen erledigt. Fehlende Angaben bleiben offen.</div>
      <div class="row" style="gap:10px"><div class="field grow"><label>Start</label><input type="time" id="fStart" value="${esc(startVal)}"></div><div class="field grow"><label>Ende</label><input type="time" id="fEnd" value="${esc(endVal)}"></div></div>
      <div class="field"><span class="flbl">Gesamtanstrengung (0–10, optional)</span><div class="chips">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button class="chip" data-act="fEffort" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="field"><span class="flbl">Befinden (1–5, optional)</span><div class="chips">${[1, 2, 3, 4, 5].map(v => `<button class="chip" data-act="fFeel" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="toggle"><span>Beschwerden Knie</span><input type="checkbox" id="fKnee" ${painK ? 'checked' : ''}></div>
      <div class="toggle"><span>Beschwerden linke Hand</span><input type="checkbox" id="fHand" ${painH ? 'checked' : ''}></div>
      <div class="field" style="margin-top:12px"><label for="fNotes">Notiz</label><textarea id="fNotes" placeholder="z. B. wie es sich angefühlt hat"></textarea></div>
      ${s.source !== 'plan' ? `<div class="toggle"><span>Neuen Kalendertermin anlegen<br><span class="muted">Für eine spontan begonnene Einheit</span></span><input type="checkbox" id="fCal"></div>` : ''}
      <button class="btn" data-act="finishSave" data-id="${esc(s.id)}">Training speichern</button>
      <button class="btn ghost" data-act="close" style="margin-top:8px">Zurück</button>`);
    draft._finish = { effort: null, feeling: null };
  }

  function resultSheet(s, changes) {
    const props = (state.proposals || []).map((p, i) => ({ p, i })).filter(x => x.p.open && x.p.sessionId === s.id);
    const status = { abgeschlossen: 'Abgeschlossen.', teilweise: 'Teilweise absolviert. Die erledigten Sätze bleiben im Verlauf.', abgebrochen: 'Abgebrochen. Ohne erledigte Sätze.' }[s.status] || '';
    openSheet(`<h3>Gespeichert</h3>
      <div class="banner ok" style="background:var(--ok-bg)">${esc(status)}</div>
      ${changes.length ? `<h2 class="section">Automatisch angepasst</h2>` + changes.map(c => {
        const ex = D.EXERCISES[c.exerciseId] || { name: c.exerciseId };
        return `<div class="card"><div class="title">${esc(ex.name)}</div><div class="muted" style="margin:4px 0 8px">${esc(c.reason)}</div>
          <button class="btn small light" data-act="undo" data-id="${esc(c.id)}">${icon('undo')} Rückgängig</button></div>`;
      }).join('') : ''}
      ${props.length ? `<h2 class="section">Vorschläge</h2>` + props.map(({ p, i }) => {
        const ex = D.EXERCISES[p.exerciseId] || { name: p.exerciseId };
        return `<div class="card"><div class="title">${esc(ex.name)}</div><div class="muted" style="margin:4px 0 8px">${esc(p.label)}</div>
          <div class="row" style="gap:10px"><button class="btn small" data-act="acceptProposal" data-idx="${i}">Übernehmen</button><button class="btn small ghost" data-act="dismissProposal" data-idx="${i}">Nicht jetzt</button></div></div>`;
      }).join('') : ''}
      <button class="btn" data-act="close" style="margin-top:12px">Fertig</button>`);
  }

  function rirSheet(sid, exIdx) {
    const s = find(sid);
    const e = s.exercises[exIdx];
    const def = D.EXERCISES[e.exerciseId];
    const r = e.rir;
    openSheet(`<h3>${esc(def.name)}</h3>
      <div class="field"><span class="flbl">Wie viele saubere Wiederholungen wären noch möglich?</span>
        <div class="chips">${[0, 1, 2, 3, 4, 5].map(v => `<button class="chip ${r === v ? 'on' : ''}" data-act="rirSet" data-ex="${exIdx}" data-v="${v}">${v === 5 ? '5+' : v}</button>`).join('')}</div>
        <div class="muted" style="margin-top:6px">2–3 ist ein gutes Ziel. Bei 4 oder mehr darf die App die Wiederholungen leicht erhöhen.</div></div>
      <div class="field"><span class="flbl">Technik</span><div class="chips">
        <button class="chip ${e.technique === 'gut' ? 'on' : ''}" data-act="rirTech" data-ex="${exIdx}" data-v="gut">Gut</button>
        <button class="chip warnchip ${e.technique === 'unsicher' ? 'on' : ''}" data-act="rirTech" data-ex="${exIdx}" data-v="unsicher">Unsicher</button></div></div>
      <div class="toggle"><span>Schmerzen bei dieser Übung</span><input type="checkbox" data-act="rirPain" data-ex="${exIdx}" ${e.pain ? 'checked' : ''}></div>
      <button class="btn" data-act="rirSave" data-ex="${exIdx}">Speichern</button>
      <button class="btn ghost" data-act="close" style="margin-top:8px">Keine Angabe</button>`);
  }

  function editSetSheet(sid, exIdx, setIdx, mode) {
    const s = find(sid);
    const x = s.exercises[exIdx].sets[setIdx];
    const t = s.exercises[exIdx].target || {};
    const isHold = t.kind === 'hold';
    openSheet(`<h3>${esc(setLabel(x, s.exercises[exIdx].sets.length, setIdx))}</h3>
      <div class="muted" style="margin-bottom:10px">${esc((D.EXERCISES[s.exercises[exIdx].exerciseId] || {}).name || '')}</div>
      ${isHold ? `<div class="field"><label>Haltezeit (s)</label><input type="number" id="esH" value="${esc(x.holdSec ?? '')}" inputmode="numeric"></div>`
        : `<div class="field"><label>Wiederholungen</label><input type="number" id="esR" value="${esc(x.reps ?? '')}" inputmode="numeric"></div>
           <div class="field"><label>Gewicht (kg)</label><input type="number" id="esW" value="${esc(x.weight ?? '')}" inputmode="decimal" step="0.5"></div>`}
      <button class="btn" data-act="editSetSave" data-id="${esc(sid)}" data-ex="${exIdx}" data-set="${setIdx}" data-mode="${mode || 'runner'}">Speichern</button>
      <button class="btn light" style="margin-top:8px" data-act="reopenSetFromSheet" data-id="${esc(sid)}" data-ex="${exIdx}" data-set="${setIdx}">Wieder öffnen</button>
      <button class="btn ghost" data-act="close" style="margin-top:8px">Abbrechen</button>`);
  }

  function swapSheet(sid, exIdx) {
    const s = find(sid);
    const ex = s.exercises[exIdx];
    const cur = D.EXERCISES[ex.exerciseId];
    const group = Object.keys(D.EXERCISES).filter(id => D.EXERCISES[id].group === cur.group && id !== ex.exerciseId);
    const easier = cur.easier ? [cur.easier] : [];
    const ids = [...new Set([...easier, ...group])];
    openSheet(`<h3>Übung wechseln</h3>
      <div class="muted" style="margin-bottom:10px">Nur diese Übung wird getauscht. Erledigte Sätze bleiben bei der alten Übung.</div>
      ${ids.map(id => `<button class="list-item" data-act="swapTo" data-ex="${exIdx}" data-to="${id}" data-id="${esc(sid)}"><div class="grow"><div class="title">${esc(D.EXERCISES[id].name)}</div><div class="muted">${esc(D.EXERCISES[id].group)}${id === cur.easier ? ' · leichter' : ''}</div></div></button>`).join('')}
      <button class="btn ghost" data-act="close" style="margin-top:8px">Abbrechen</button>`);
  }

  function painSheet(sid, exIdx) {
    const s = find(sid);
    const e = s.exercises[exIdx];
    const def = D.EXERCISES[e.exerciseId];
    const opts = [];
    if (def.easier) opts.push(['easy', 'Leichter machen']);
    const alt = (L.templateSlots(s.type).find(x => x.exerciseId === e.originalExerciseId) || {}).alternativeId;
    if (alt && alt !== e.exerciseId) opts.push(['alt', 'Austauschen']);
    opts.push(['skip', 'Übung auslassen']);
    openSheet(`<h3>Beschwerden: ${esc(def.name)}</h3>
      <div class="muted" style="margin-bottom:12px">Schmerzen oder Unsicherheit stoppen die Steigerung dieser Übung. Ich passe nur diese Übung an.</div>
      ${opts.map(([k, t]) => `<button class="btn ${k === 'skip' ? 'ghost' : 'light'}" style="margin-top:8px" data-act="painDo" data-kind="${k}" data-ex="${exIdx}" data-id="${esc(sid)}">${esc(t)}</button>`).join('')}
      <button class="btn ghost" data-act="close" style="margin-top:8px">Abbrechen</button>`);
  }

  // ---------- Aktionen ----------
  function actDone(s) {
    const pos = L.currentPosition(s);
    if (!pos) return;
    const k = `${s.id}|${pos.ex}|${pos.set}`;
    const t = s.exercises[pos.ex].target || {};
    const d = { ...slotDefaults(s, pos), ...(draft[k] || {}) };
    const reps = d.reps;
    const weight = d.weight;
    const holdSec = d.holdSec;
    L.logSet(s, pos.ex, pos.set, {
      reps: t.kind === 'hold' ? null : toNum(reps),
      weight: toNum(weight),
      holdSec: t.kind === 'hold' ? toNum(holdSec) : null
    });
    delete draft[k];
    const ex = s.exercises[pos.ex];
    const exDone = ex.sets.every(x => x.status !== 'offen');
    if (exDone && L.hasPreviousData(state.sessions, ex.exerciseId, s.id) && ex.status === 'erledigt') {
      persist(); render(); rirSheet(s.id, pos.ex); return;
    }
    if (state.settings.timerOn && L.currentPosition(s)) s.restEndsAt = new Date(Date.now() + state.settings.restSec * 1000).toISOString();
    persist(); render();
  }
  function toNum(v) {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function finishSave(s) {
    const date = s.date;
    const startT = (document.getElementById('fStart') || {}).value;
    const endT = (document.getElementById('fEnd') || {}).value;
    const notes = (document.getElementById('fNotes') || {}).value || '';
    const knee = !!(document.getElementById('fKnee') || {}).checked;
    const hand = !!(document.getElementById('fHand') || {}).checked;
    const cal = document.getElementById('fCal');
    const fin = draft._finish || {};
    if (startT && endT && endT < startT) { toast('Die Endzeit liegt vor der Startzeit.'); return; }
    const startedAt = startT ? L.berlinIso(date, startT) : s.startedAt;
    const endedAt = endT ? L.berlinIso(date, endT) : nowIso();
    s.pain = { knee, leftHand: hand };
    L.completeSession(s, { startedAt, endedAt, effort: fin.effort, feeling: fin.feeling, notes });
    if (cal && cal.checked) s.calendarOptIn = true;
    const changes = L.adjustFromSession(state, s, nowIso()).changes;
    delete draft._finish;
    ui.open = null;
    persist(); closeSheet(); render();
    resultSheet(s, changes);
  }
  function berlinIsoLocal(date, time) { return L.berlinIso(date, time); }

  async function gConnect() {
    try {
      await C.connect(!!state.settings.calendar.freeBusy, false);
      state.settings.calendar.linked = true; persist();
      toast('Mit Google verbunden.');
    } catch (e) { toast(e.message); }
    render();
  }
  // Stille Wiederverbindung beim Start, nur wenn der Nutzer die Verbindung schon einmal bestätigt hat
  async function gRestore() {
    const cal = state.settings.calendar;
    if (!cal.linked || !C.configured() || C.isConnected()) return;
    try { await C.connect(!!cal.freeBusy, true); render(); } catch (e) { /* bleibt getrennt, ohne Fehlermeldung */ }
  }

  function gPreview() {
    const ops = L.planCalendarOps(state);
    const errs = state.sessions.filter(s => s.calendar && s.calendar.error);
    const list = ops.length ? ops.map(o => `<div class="check"><span class="ico" style="width:24px;height:24px;display:inline-grid;place-items:center">${icon(o.op === 'delete' ? 'alert' : 'cal')}</span><span>${esc(o.label)}</span></div>`).join('') : '<div class="muted">Nichts zu tun. Alles ist synchron.</div>';
    const errList = errs.length ? `<h2 class="section">Mit Fehler</h2>` + errs.map(s => `<div class="note-box"><strong>${esc(label(s.type))}</strong> · ${esc(L.fmtDate(s.date, false))}<div class="muted">${esc(s.calendar.error)}</div></div>`).join('') : '';
    openSheet(`<h3>Vorschau Google Kalender</h3>
      <div class="muted" style="margin-bottom:10px">Diese Termine werden eingetragen oder aktualisiert. Nur nach deiner Bestätigung.</div>
      ${list}${errList}
      ${ops.length || errs.length ? `<button class="btn" data-act="gSync">Jetzt eintragen</button>` : ''}
      <button class="btn ghost" data-act="close" style="margin-top:8px">Schließen</button>`);
  }

  async function gSync() {
    if (!C.isConnected()) { toast('Bitte zuerst mit Google verbinden.'); return; }
    const ops = L.planCalendarOps(state);
    const cal = state.settings.calendar;
    try {
      cal.calendarId = await C.ensureCalendar(cal.calendarId);
    } catch (e) { toast('Kalender konnte nicht vorbereitet werden: ' + e.message); return; }
    persist();
    const res = await C.runOps(ops, cal.calendarId, applyOpResult);
    persist(); closeSheet(); render();
    toast(res.failed.length ? `${res.ok} eingetragen, ${res.failed.length} mit Fehler. Die App behält den Stand.` : `${res.ok} Vorgänge eingetragen.`);
  }
  function applyOpResult(sid, patch) {
    const s = find(sid);
    if (!s) return;
    if (patch.error) { s.calendar = { ...(s.calendar || {}), error: patch.error }; return; }
    if (patch.eventId === null) { s.calendar = null; return; }
    s.calendar = { eventId: patch.eventId, hash: patch.hash, calendarId: patch.calendarId, syncedAt: nowIso(), error: null };
  }

  async function refreshBusy() {
    if (!state.settings.calendar.freeBusy || !C.isConnected()) { toast('Belegt-Zeiten brauchen eine Verbindung mit Frei-/Belegt-Berechtigung.'); return; }
    const ws = ui.weekStart || L.mondayOf(today());
    try {
      busy = await C.busyBlocks(berlinIsoLocal(ws, '00:00') , berlinIsoLocal(L.addDays(ws, 7), '00:00'));
      busyWeek = ws;
      render();
    } catch (e) { toast('Belegt-Zeiten konnten nicht geladen werden: ' + e.message); }
  }

  function exportFile() {
    const payload = L.exportPayload({ ...state, media: state.media || {} }, nowIso());
    payload.data.media = state.media || {};
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trainingszeit-${today()}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Export erstellt.');
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let obj;
      try { obj = JSON.parse(String(reader.result)); } catch (e) { toast('Die Datei ist kein gültiges JSON.'); return; }
      const res = L.importPayload(obj);
      if (!res.ok) { openSheet(`<h3>Import nicht möglich</h3>${res.errors.map(e => `<div class="note-box">${esc(e)}</div>`).join('')}<button class="btn ghost" data-act="close">Schließen</button>`); return; }
      const n = res.state.sessions.length, a = res.state.adjustments.length;
      openSheet(`<h3>Import bestätigen</h3>
        <div class="muted" style="margin-bottom:12px">Ersetzt alle Daten auf diesem Gerät durch ${n} Einheiten und ${a} Anpassungen aus der Datei. Vorher bitte exportieren.</div>
        <button class="btn danger" data-act="importConfirm">Ersetzen</button>
        <button class="btn ghost" data-act="close" style="margin-top:8px">Abbrechen</button>`);
      pendingImport = res.state;
    };
    reader.readAsText(file);
  }
  let pendingImport = null;

  function moveSave(id) {
    const s = find(id);
    const d = document.getElementById('mvDate').value;
    const tm = document.getElementById('mvTime').value || null;
    if (!d) { toast('Bitte ein Datum wählen.'); return; }
    if (!s.planDate) s.planDate = s.date;
    s.date = d; s.plannedTime = tm;
    persist(); closeSheet(); render(); toast('Verschoben. Der Kalendertermin folgt bei der nächsten Synchronisation.');
  }

  // ---------- Ereignisse ----------
  function handleAct(act, el) {
    const id = el.dataset.id;
    switch (act) {
      case 'start': startSheet(id); return;
      case 'resume': closeSheet(); ui.open = id; render(); return;
      case 'openSession': detailSheet(id); return;
      case 'detail': detailSheet(id); return;
      case 'moveSession': moveSheet(id); return;
      case 'moveSave': moveSave(id); return;
      case 'dropSession': {
        if (!confirm('Diese Einheit ausfallen lassen? Ein Kalendertermin wird bei der nächsten Synchronisation entfernt.')) return;
        const s = find(id); s.status = 'ausgelassen'; persist(); closeSheet(); render(); return;
      }
      case 'cardioMode': { const s = find(id); s.cardioMode = el.dataset.mode; persist(); render(); return; }
      case 'cardioFinish': {
        const s = find(ui.open); if (!s) return;
        s.status = 'abgeschlossen'; s.endedAt = nowIso();
        s.effort = null;
        ui.open = null; persist(); render(); toast('Ausdauer gespeichert. Anstrengung kannst du im Verlauf ergänzen.'); return;
      }
      case 'preFeel': pre.feeling = Number(el.dataset.v); preRender(); return;
      case 'preToggle': pre[el.dataset.k] = el.checked; preRender(); return;
      case 'preChoice': pre.choices[el.dataset.ex] = el.dataset.c; preRender(); return;
      case 'preStart': beginSession(); return;
      case 'done': actDone(find(ui.open)); return;
      case 'leave': ui.open = null; render(); toast('Gespeichert. Du kannst später weitermachen.'); return;
      case 'cues': cuesSheet(); return;
      case 'skipSet': {
        const s = find(ui.open); const pos = L.currentPosition(s); if (!pos) return;
        L.skipSet(s, pos.ex, pos.set); persist(); render(); return;
      }
      case 'skipEx': {
        const s = find(ui.open); const pos = L.currentPosition(s); if (!pos) return;
        if (!confirm('Diese Übung für heute auslassen?')) return;
        L.skipExercise(s, pos.ex); persist(); render(); return;
      }
      case 'swap': { const s = find(ui.open); const pos = L.currentPosition(s); if (pos) swapSheet(s.id, pos.ex); return; }
      case 'swapTo': {
        const s = find(id); const r = L.swapExercise(s, Number(el.dataset.ex), el.dataset.to, L.currentTarget(state, el.dataset.to));
        if (!r.ok) { toast(r.reason); return; }
        closeSheet(); persist(); render(); return;
      }
      case 'pain': { const s = find(ui.open); const pos = L.currentPosition(s); if (pos) painSheet(s.id, pos.ex); return; }
      case 'painDo': {
        const s = find(id); const idx = Number(el.dataset.ex); const kind = el.dataset.kind;
        const e = s.exercises[idx];
        e.pain = true;
        if (kind === 'skip') L.skipExercise(s, idx);
        else {
          const to = kind === 'easy' ? D.EXERCISES[e.exerciseId].easier : (L.templateSlots(s.type).find(x => x.exerciseId === e.originalExerciseId) || {}).alternativeId;
          if (to) L.swapExercise(s, idx, to, L.currentTarget(state, to));
        }
        closeSheet(); persist(); render(); return;
      }
      case 'restStart': { const s = find(ui.open); s.restEndsAt = new Date(Date.now() + state.settings.restSec * 1000).toISOString(); persist(); render(); return; }
      case 'restAdd': { const s = find(ui.open); const base = Math.max(Date.now(), Date.parse(s.restEndsAt || nowIso())); s.restEndsAt = new Date(base + 30000).toISOString(); persist(); render(); return; }
      case 'restStop': { const s = find(ui.open); s.restEndsAt = null; persist(); render(); return; }
      case 'editSet': editSetSheet(ui.open, Number(el.dataset.ex), Number(el.dataset.set), 'runner'); return;
      case 'editHistSet': editSetSheet(id, Number(el.dataset.ex), Number(el.dataset.set), 'history'); return;
      case 'editSetSave': {
        const s = find(id); const x = s.exercises[Number(el.dataset.ex)].sets[Number(el.dataset.set)];
        const t = s.exercises[Number(el.dataset.ex)].target || {};
        if (t.kind === 'hold') { x.holdSec = toNum(document.getElementById('esH').value); }
        else { x.reps = toNum(document.getElementById('esR').value); x.weight = toNum(document.getElementById('esW').value); }
        if (x.status === 'offen') x.status = 'erledigt';
        L.updateExerciseStatus(s.exercises[Number(el.dataset.ex)]);
        persist(); closeSheet(); render(); return;
      }
      case 'reopenSet': { const s = find(ui.open); L.reopenSet(s, Number(el.dataset.ex), Number(el.dataset.set)); persist(); render(); return; }
      case 'reopenSetFromSheet': {
        const s = find(id); L.reopenSet(s, Number(el.dataset.ex), Number(el.dataset.set)); persist(); closeSheet(); render(); return;
      }
      case 'rirSet': { const s = find(ui.open); s.exercises[Number(el.dataset.ex)].rir = Number(el.dataset.v); rirSheet(ui.open, Number(el.dataset.ex)); return; }
      case 'rirTech': { const s = find(ui.open); s.exercises[Number(el.dataset.ex)].technique = el.dataset.v; rirSheet(ui.open, Number(el.dataset.ex)); return; }
      case 'rirPain': return;
      case 'rirSave': {
        const s = find(ui.open); const idx = Number(el.dataset.ex); const e = s.exercises[idx];
        const pain = !!(document.querySelector('[data-act="rirPain"]') || {}).checked;
        e.pain = pain;
        const lastDone = [...e.sets].reverse().find(x => x.status === 'erledigt');
        if (lastDone && e.rir != null) lastDone.rir = e.rir;
        persist(); closeSheet(); render(); return;
      }
      case 'finish': {
        const s = find(ui.open);
        if (!s) return;
        draft._finish = { effort: null, feeling: null };
        finishSheet(); return;
      }
      case 'fEffort': draft._finish = draft._finish || {}; draft._finish.effort = Number(el.dataset.v); markChip(el); return;
      case 'fFeel': draft._finish = draft._finish || {}; draft._finish.feeling = Number(el.dataset.v); markChip(el); return;
      case 'finishSave': finishSave(find(id)); return;
      case 'acceptProposal': {
        const i = Number(el.dataset.idx); const p = state.proposals[i];
        if (!p) return;
        L.acceptProposal(state, p, nowIso()); persist(); closeSheet(); render(); toast('Übernommen. Die Änderung gilt nur für diese Übung.'); return;
      }
      case 'dismissProposal': { const p = state.proposals[Number(el.dataset.idx)]; if (p) p.open = false; persist(); closeSheet(); render(); return; }
      case 'undo': {
        const a = state.adjustments.find(x => x.id === id);
        if (!a || a.undone) return;
        L.undoAdjustment(state, id); persist(); toast('Anpassung zurückgenommen.'); render(); return;
      }
      case 'setEffort': { const s = find(id); s.effort = Number(el.dataset.v); persist(); detailSheet(id); render(); return; }
      case 'week': { ui.weekStart = L.addDays(ui.weekStart || L.mondayOf(today()), Number(el.dataset.d)); busy = null; render(); return; }
      case 'busy': refreshBusy(); return;
      case 'histTab': ui.histTab = el.dataset.tab; render(); return;
      case 'rest': state.settings.restSec = Number(el.dataset.v); persist(); render(); return;
      case 'gconnect': gConnect(); return;
      case 'gdisconnect': C.disconnect(); state.settings.calendar.linked = false; persist(); toast('Verbindung getrennt. Bereits eingetragene Termine bleiben im Kalender.'); render(); return;
      case 'gpreview': gPreview(); return;
      case 'gSync': gSync(); return;
      case 'export': exportFile(); return;
      case 'importConfirm': {
        if (!pendingImport) return;
        state = pendingImport; pendingImport = null; ui.open = null; persist(); closeSheet(); render(); toast('Import abgeschlossen.'); return;
      }
      case 'reset': {
        if (!confirm('Alle lokalen Daten löschen und die Startdaten neu laden? Vorher bitte exportieren.')) return;
        state = L.initialState(); state.media = {}; ui.open = null; persist(); render(); toast('Startdaten geladen.'); return;
      }
      case 'close': closeSheet(); return;
      case 'mediaSave': mediaSave(); return;
      case 'backToday': ui.route = 'today'; render(); return;
      default: return;
    }
  }

  function markChip(el) {
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    el.classList.add('on');
  }

  function cuesSheet() {
    const s = find(ui.open); const pos = L.currentPosition(s); if (!pos) return;
    const ex = s.exercises[pos.ex]; const def = D.EXERCISES[ex.exerciseId];
    const media = (state.media || {})[ex.exerciseId];
    openSheet(`<h3>${esc(def.name)}</h3>
      <ul class="cues">${def.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      ${def.grip ? '<div class="banner" style="margin-top:12px">Bei Kettlebell-Übungen zuerst Griff und Ausführung prüfen. Bei Unsicherheit leichter machen.</div>' : ''}
      ${media ? `<a class="btn light" style="margin-top:12px;text-decoration:none" href="${esc(media)}" target="_blank" rel="noopener">Video öffnen</a>` : ''}
      <div class="field" style="margin-top:14px"><label for="mediaUrl">Eigener Video- oder Foto-Link (optional)</label>
        <input type="text" id="mediaUrl" placeholder="https://…" value="${esc(media || '')}"></div>
      <button class="btn" data-act="mediaSave" data-id="${esc(ex.exerciseId)}">Link speichern</button>
      <button class="btn ghost" data-act="close" style="margin-top:8px">Schließen</button>`);
  }

  // ---------- Eingaben ----------
  document.addEventListener('input', e => {
    const el = e.target;
    const f = el.dataset && el.dataset.field;
    if (f === 'draftW' || f === 'draftR' || f === 'draftH') {
      const s = find(ui.open); const pos = L.currentPosition(s); if (!pos) return;
      const k = `${s.id}|${pos.ex}|${pos.set}`;
      draft[k] = Object.assign({}, draft[k] || {});
      if (el.dataset.field === 'draftW') draft[k].weight = el.value;
      if (el.dataset.field === 'draftR') draft[k].reps = el.value;
      if (el.dataset.field === 'draftH') draft[k].holdSec = el.value;
    }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    const f = el.dataset && el.dataset.field;
    if (el.id === 'importFile' && el.files && el.files[0]) { importFile(el.files[0]); el.value = ''; return; }
    if (el.id === 'exSel') { ui.histEx = el.value; render(); return; }
    if (el.dataset && el.dataset.act === 'rirPain') return;
    if (!f) return;
    const st = state.settings;
    if (f === 'slotDay') { st.slots[Number(el.dataset.i)].weekday = Number(el.value); planChanged(); }
    else if (f === 'slotTime') { st.slots[Number(el.dataset.i)].time = el.value || '16:00'; planChanged(); }
    else if (f === 'cardioDay') { st.cardio.weekday = Number(el.value); planChanged(); }
    else if (f === 'cardioOn') { st.cardio.optional = el.checked; planChanged(); }
    else if (f === 'timerOn') { st.timerOn = el.checked; persist(); render(); }
    else if (f === 'freeBusy') {
      st.calendar.freeBusy = el.checked;
      persist();
      if (el.checked && C.isConnected()) { toast('Für Frei-/Belegt-Zeiten bitte einmal erneut verbinden.'); }
      render();
    }
  });

  function planChanged() {
    L.pruneFuturePlanned(state, today(), 28);
    L.ensurePlan(state, today(), 28);
    persist(); render(); toast('Plan aktualisiert.');
  }

  // ---------- Start ----------
  document.addEventListener('click', e => {
    const tab = e.target.closest('#tabs button');
    if (tab) { ui.route = tab.dataset.route; render(); return; }
    const btnSet = e.target.closest('#btnSettings');
    if (btnSet) { ui.route = 'settings'; render(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' && el.type === 'checkbox') return;
    handleAct(el.dataset.act, el);
  });
  // Checkboxen in Dialogen reagieren auf change, nicht auf click
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.act === 'preToggle') { pre[el.dataset.k] = el.checked; preRender(); }
  });

  function mediaSave() {
    const v = (document.getElementById('mediaUrl') || {}).value || '';
    if (v && !/^https?:\/\//i.test(v)) { toast('Bitte einen Link mit https:// eingeben.'); return; }
    const s = find(ui.open); const pos = L.currentPosition(s); if (!pos) return;
    const exId = s.exercises[pos.ex].exerciseId;
    state.media = state.media || {};
    if (v) state.media[exId] = v; else delete state.media[exId];
    persist(); closeSheet(); render(); toast('Link gespeichert.');
  }
  function init() {
    loadUi();
    state = loadState();
    state.media = state.media || {};
    if (!ui.route) ui.route = 'today';
    persist();
    render();
    gRestore();
    window.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
  void lastOk; void busyWeek; void draft;
})();
