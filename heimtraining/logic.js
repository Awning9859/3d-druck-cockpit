/* Reine Logik ohne DOM und ohne Netzwerk. Wird von der App und von den Tests genutzt. */
(function (root) {
  'use strict';
  const D = (typeof require === 'function') ? require('./data.js') : root.HT_DATA;
  const { EXERCISES, TEMPLATES, SEED_SESSIONS, SETTINGS_DEFAULT } = D;

  const TZ = 'Europe/Berlin';
  const SESSION_STATUS = ['geplant', 'begonnen', 'abgeschlossen', 'teilweise', 'abgebrochen', 'verschoben', 'ausgelassen'];
  const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  // ---------- Datum (Europe/Berlin) ----------
  function berlinParts(date) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const p = {};
    f.formatToParts(date).forEach(x => { p[x.type] = x.value; });
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  }
  function todayStr(now) { return berlinParts(now || new Date()).date; }
  function berlinOf(iso) { return berlinParts(new Date(iso)); }
  // Lokale Berlin-Zeit ohne Offset, wie sie Google mit timeZone erwartet
  function berlinLocal(iso) { const p = berlinOf(iso); return `${p.date}T${p.time}:00`; }
  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.toISOString().slice(0, 10);
  }
  function weekdayOf(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function mondayOf(dateStr) { const wd = weekdayOf(dateStr); return addDays(dateStr, wd === 0 ? -6 : 1 - wd); }
  function fmtDate(dateStr, long) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const wd = weekdayOf(dateStr);
    return long ? `${WEEKDAYS_LONG[wd]}, ${d}. ${MONTHS[m - 1]}` : `${WEEKDAYS[wd]}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
  }
  function fmtTime(iso) { return iso ? berlinOf(iso).time : '–'; }
  function fmtDuration(sec) { const m = Math.floor(sec / 60), s = Math.abs(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }

  // ---------- Vorlagen, Ziele, Sätze ----------
  function templateSlots(type) { return (TEMPLATES[type] || { slots: [] }).slots; }

  // Ausgangsziel einer Übung aus der Vorlage (erster Treffer, Alternativen eingeschlossen)
  function defaultTarget(exerciseId) {
    for (const t of Object.values(TEMPLATES)) {
      for (const s of t.slots) {
        if (s.exerciseId === exerciseId) return targetFromSlot(s, false);
        if (s.alternativeId === exerciseId) return targetFromSlot(s, true);
      }
    }
    return { sets: 2, repMin: 8, repMax: 12, goal: 8, weight: null, perSide: false };
  }
  function targetFromSlot(s, alt) {
    const ex = EXERCISES[alt ? s.alternativeId : s.exerciseId];
    const kind = ex.kind;
    const t = {
      sets: alt ? s.altSets : s.sets,
      repMin: alt ? s.altRepMin : s.repMin,
      repMax: alt ? s.altRepMax : s.repMax,
      weight: alt ? s.altWeight : s.weight,
      perSide: !!(ex.perSide || s.perSide),
      kind,
      holdMin: s.holdMin || null, holdMax: s.holdMax || null,
      tempo: null, source: 'vorlage'
    };
    if (kind === 'hold') { t.goal = t.holdMin; t.holdGoal = t.holdMin; }
    else { t.goal = t.repMin; }
    return t;
  }
  function currentTarget(state, exerciseId) {
    return (state.targets && state.targets[exerciseId]) || defaultTarget(exerciseId);
  }
  function setCount(target) { return target.sets * (target.perSide ? 2 : 1); }

  function makeSets(target) {
    const n = target.sets;
    const sides = target.perSide ? ['links', 'rechts'] : [null];
    const out = [];
    for (const side of sides) {
      for (let i = 0; i < n; i++) {
        out.push({
          side, status: 'offen', reps: null,
          weight: target.weight, holdSec: null, rir: null
        });
      }
    }
    return out;
  }

  // Übungen einer Einheit: slot-basiert. Überschreibungen (Wechsel, Erleichterung) stehen in session.swaps.
  function buildExercises(state, type) {
    return templateSlots(type).map(slot => {
      // Erleichterte Übung ersetzt die Vorlage für künftige Einheiten (bis rückgängig gemacht)
      const repl = state.targets && state.targets[slot.exerciseId] && state.targets[slot.exerciseId].replacedBy;
      const exerciseId = repl || slot.exerciseId;
      const target = repl ? defaultTarget(repl) : currentTarget(state, exerciseId);
      return {
        slotId: slot.slot, exerciseId, originalExerciseId: exerciseId, substituted: false,
        status: 'offen', note: '', pain: false, technique: null, rir: null, effort: null,
        target: { ...target, goal: target.goal },
        sets: makeSets(target)
      };
    });
  }

  function estimateMinutes(type) {
    if (type === 'cardio') return 32;
    const ex = templateSlots(type);
    const sets = ex.reduce((a, s) => a + s.sets * (s.perSide ? 2 : 1), 0);
    const perSet = 40 / 60 + 75 / 60; // Arbeit ca. 40 s, Pause 75 s
    return Math.round(7 + sets * perSet + 2);
  }

  // ---------- Sitzungen ----------
  function sessionId(date, kind) { return `s-${date}-${kind}`; }
  function newSession(date, kind, extra) {
    return Object.assign({
      id: sessionId(date, kind), date, type: kind, status: 'geplant',
      plannedTime: null, startedAt: null, endedAt: null, effort: null, feeling: null,
      pain: { knee: false, leftHand: false }, notes: '', exercises: [], swaps: {},
      source: 'plan', calendar: null
    }, extra || {});
  }

  function lastCompletedStrength(sessions) {
    const done = sessions.filter(s => s.status === 'abgeschlossen' && (s.type === 'A' || s.type === 'B'));
    done.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return done[done.length - 1] || null;
  }
  // Anker ist die zuletzt abgeschlossene Krafteinheit. Eine begonnene, offene Einheit verschiebt
// die Planung für die Folgetage, damit A/B nicht doppelt geplant wird.
  function nextStrengthType(sessions) {
    const anchors = sessions
      .filter(s => (s.type === 'A' || s.type === 'B') && (s.status === 'abgeschlossen' || s.status === 'begonnen'))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const last = anchors[anchors.length - 1];
    if (!last) return 'A';
    return last.type === 'A' ? 'B' : 'A';
  }

  // Terminfenster aus den Einstellungen (Mi/Fr 16 Uhr, Ausdauer optional am Wochenende)
  function planSlots(settings, today, days) {
    const slots = [];
    for (let d = today, i = 0; i < days; i++, d = addDays(d, 1)) {
      const wd = weekdayOf(d);
      settings.slots.forEach(s => { if (s.weekday === wd) slots.push({ date: d, kind: 'strength', time: s.time }); });
      if (settings.cardio && settings.cardio.weekday === wd && settings.cardio.optional) {
        slots.push({ date: d, kind: 'cardio', time: settings.cardio.time });
      }
    }
    slots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return slots;
  }

  // Plan für die nächsten Tage: fehlende Einheiten als geplant anlegen (idempotent)
  function ensurePlan(state, today, days) {
    days = days || 28;
    const slots = planSlots(state.settings, today, days);
    let next = nextStrengthType(state.sessions);
    for (const slot of slots) {
      if (slot.kind === 'strength') {
        // Vorhandene Krafteinheit an diesem Tag (z. B. begonnen oder verschoben) bleibt erhalten
        const ex = state.sessions.find(s => (s.planDate || s.date) === slot.date && (s.type === 'A' || s.type === 'B'));
        if (ex) { if (ex.status !== 'abgeschlossen') next = ex.type === 'A' ? 'B' : 'A'; continue; }
        const id = sessionId(slot.date, next);
        state.sessions.push(newSession(slot.date, next, { id, plannedTime: slot.time, source: 'plan' }));
        next = next === 'A' ? 'B' : 'A';
      } else {
        const id = sessionId(slot.date, 'cardio');
        if (!state.sessions.find(s => s.id === id)) {
          state.sessions.push(newSession(slot.date, 'cardio', { id, plannedTime: slot.time, source: 'plan' }));
        }
      }
    }
    state.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return state;
  }

  // Ablauf einer Einheit beim Start: Ziele werden aus dem aktuellen Verlauf übernommen
  function startSession(state, session, nowIso, pain) {
    if (session.status === 'geplant' || session.status === 'verschoben' || !session.exercises.length) {
      session.exercises = buildExercises(state, session.type === 'cardio' ? null : session.type);
    }
    session.status = 'begonnen';
    session.startedAt = session.startedAt || nowIso;
    if (pain) session.pain = { knee: !!pain.knee, leftHand: !!pain.leftHand };
    if (pain && pain.feeling != null) session.feeling = pain.feeling;
    return session;
  }

  function nextSetIndex(ex) { return ex.sets.findIndex(s => s.status === 'offen'); }

  // Aktuelle Position: erste Übung mit offenem Satz
  function currentPosition(session) {
    for (let e = 0; e < session.exercises.length; e++) {
      const i = nextSetIndex(session.exercises[e]);
      if (i >= 0) return { ex: e, set: i };
    }
    return null;
  }

  function logSet(session, exIdx, setIdx, values) {
    const ex = session.exercises[exIdx];
    const s = ex.sets[setIdx];
    if (!s) return session;
    Object.assign(s, { status: 'erledigt', reps: nullable(values.reps), weight: nullable(values.weight), holdSec: nullable(values.holdSec) });
    s.rir = s.status === 'erledigt' && values.rir !== undefined ? values.rir : s.rir;
    updateExerciseStatus(ex);
    return session;
  }
  function skipSet(session, exIdx, setIdx) {
    const ex = session.exercises[exIdx];
    ex.sets[setIdx].status = 'übersprungen';
    updateExerciseStatus(ex);
    return session;
  }
  function reopenSet(session, exIdx, setIdx) {
    const ex = session.exercises[exIdx];
    ex.sets[setIdx].status = 'offen';
    updateExerciseStatus(ex);
    return session;
  }
  function nullable(v) { return v === '' || v === undefined || v === null || Number.isNaN(v) ? null : v; }
  function updateExerciseStatus(ex) {
    const st = ex.sets.map(s => s.status);
    if (st.every(x => x === 'erledigt')) ex.status = 'erledigt';
    else if (st.every(x => x === 'offen')) ex.status = 'offen';
    else if (st.includes('übersprungen') && !st.includes('offen') && !st.includes('erledigt')) ex.status = 'übersprungen';
    else ex.status = 'teilweise';
  }

  // Übung wechseln oder erleichtern: nur diese Übung, Sätze bleiben, gelöschte Ergebnisse werden nicht übernommen
  function swapExercise(session, exIdx, newExerciseId, target) {
    const ex = session.exercises[exIdx];
    if (ex.sets.some(s => s.status === 'erledigt')) return { ok: false, reason: 'Bereits erledigte Sätze bleiben bei der alten Übung.' };
    const t = target || currentTarget({ targets: {} }, newExerciseId);
    ex.exerciseId = newExerciseId;
    ex.substituted = newExerciseId !== ex.originalExerciseId;
    ex.target = { ...t };
    ex.sets = makeSets(t);
    ex.status = 'offen';
    return { ok: true };
  }

  function skipExercise(session, exIdx) {
    const ex = session.exercises[exIdx];
    ex.sets.forEach(s => { if (s.status === 'offen') s.status = 'übersprungen'; });
    updateExerciseStatus(ex);
    return session;
  }

  // Abschluss: Status ergibt sich aus den Sätzen, fehlende Angaben bleiben null
  function completeSession(session, data) {
    const all = session.exercises.flatMap(e => e.sets);
    const done = all.filter(s => s.status === 'erledigt').length;
    if (all.length && done === all.length) session.status = 'abgeschlossen';
    else if (done > 0) session.status = 'teilweise';
    else session.status = 'abgebrochen';
    session.endedAt = data && data.endedAt !== undefined ? data.endedAt : (session.endedAt || null);
    if (data && data.startedAt !== undefined && data.startedAt !== null) session.startedAt = data.startedAt;
    session.effort = data && data.effort !== undefined ? nullable(data.effort) : session.effort;
    session.feeling = data && data.feeling !== undefined ? nullable(data.feeling) : session.feeling;
    if (data && typeof data.notes === 'string') session.notes = data.notes;
    return session;
  }

  // ---------- Anpassung ----------
  // Regeln (siehe README):
  // R1 Grundlage: schlechtester abgeschlossener Satz einer Übung. Übersprungene Sätze zählen nicht.
  // R2 Unter dem Bereich: Ziel = min(Bereichsminimum, letzte Wdh. + 1), gilt automatisch.
  // R3 Reserve >= 4 Wdh., gute Technik, kein Schmerz, im Bereich: Ziel + 1 (bei Reserve >= 5: + 2), gilt automatisch.
  // R4 Oberes Ende erreicht, Reserve <= 3, gute Technik, kein Schmerz: nur Vorschlag (nächste Stufe), wird bestätigt.
  // R5 Schmerz oder unsichere Technik: keine Steigerung, Vorschlag zum Erleichtern.
  // R6 Erste Messung einer Übung ist nur Ausgangspunkt, keine Änderung. Fehlende Angaben ändern nichts.
  // R7 Jede Übung wird nur anhand ihres eigenen Verlaufs geändert. Gesamtanstrengung wird nicht verwendet.
  function hasPreviousData(sessions, exerciseId, excludeId) {
    return sessions.some(s => s.id !== excludeId && s.status !== 'geplant' && s.status !== 'begonnen' &&
      s.exercises.some(e => e.exerciseId === exerciseId && e.sets.some(x => x.status === 'erledigt')));
  }

  function adjustFromSession(state, session, nowIso) {
    const changes = [];
    const proposals = [];
    for (const ex of session.exercises) {
      const done = ex.sets.filter(s => s.status === 'erledigt');
      if (!done.length) continue;
      const t = currentTarget(state, ex.exerciseId);
      const known = hasPreviousData(state.sessions, ex.exerciseId, session.id);
      const exDef = EXERCISES[ex.exerciseId];
      const painHit = (session.pain.knee && exDef.knee) || (session.pain.leftHand && exDef.grip) || ex.pain;
      const badTech = ex.technique === 'unsicher';
      const easier = exDef.easier;
      if (painHit || badTech) {
        if (easier) proposals.push({ exerciseId: ex.exerciseId, type: 'leichter', label: `Leichter: ${EXERCISES[easier].name}`, change: { exerciseId: easier } });
        continue;
      }
      if (!known) continue; // R6

      if (t.kind === 'hold') {
        const vals = done.map(s => s.holdSec).filter(v => v != null);
        if (!vals.length) continue;
        const worst = Math.min(...vals);
        const cur = t.holdGoal || t.holdMin;
        if (worst < cur) continue;
        if (worst >= (t.holdMax || cur)) {
          proposals.push({ exerciseId: ex.exerciseId, type: 'stufe', label: 'Haltezeit um 10 Sekunden verlängern', change: { holdGoal: (t.holdMax || cur) + 10 } });
        }
        continue;
      }

      const reps = done.map(s => s.reps).filter(v => v != null);
      if (!reps.length) continue; // R6 fehlende Angaben
      const worst = Math.min(...reps);
      const rirVals = done.map(s => s.rir).filter(v => v != null);
      const rir = rirVals.length ? Math.min(...rirVals) : null;
      const goal = t.goal;
      let newGoal = null, reason = null;

      if (worst < t.repMin) {
        newGoal = Math.min(t.repMin, worst + 1);
        reason = `Letzter schlechtester Satz ${worst} Wdh. liegt unter dem Bereich ${t.repMin}–${t.repMax}. Ziel für nächstes Mal: ${newGoal}.`;
      } else if (worst < t.repMax && rir !== null && rir >= 4 && !badTech) {
        const delta = rir >= 5 ? 2 : 1;
        newGoal = Math.min(t.repMax, worst + delta);
        reason = `Reserve ${rir >= 5 ? '5+' : rir} Wdh., Technik gut, kein Schmerz: Ziel für nächstes Mal ${newGoal} Wdh. (im Bereich ${t.repMin}–${t.repMax}).`;
      } else if (worst >= t.repMax && rir !== null && rir <= 3) {
        const stage = nextStage(ex.exerciseId, t);
        if (stage) proposals.push({ exerciseId: ex.exerciseId, type: 'stufe', label: stage.label, change: stage.change, reason: `Oberes Ende ${t.repMax} Wdh. erreicht, Reserve ${rir}.` });
      }

      if (newGoal !== null && newGoal !== goal) {
        const before = snapshotTarget(t);
        const after = { ...t, goal: newGoal };
        state.targets[ex.exerciseId] = after;
        const adj = { id: `adj-${Date.now()}-${ex.exerciseId}`, date: session.date, at: nowIso, exerciseId: ex.exerciseId, before, after, reason, undone: false, auto: true };
        state.adjustments.push(adj);
        changes.push(adj);
      }
    }
    proposals.forEach(p => { state.proposals = state.proposals || []; state.proposals.push({ ...p, sessionId: session.id, open: true }); });
    return { changes, proposals };
  }

  function snapshotTarget(t) { return JSON.parse(JSON.stringify(t)); }

  function nextStage(exerciseId, t) {
    const ex = EXERCISES[exerciseId];
    return (ex.stages || [])[0] || null;
  }

  // Vorschlag bestätigen (Gewicht, Tempo, Variante). Nur diese Übung wird geändert.
  function acceptProposal(state, proposal, nowIso) {
    const t = currentTarget(state, proposal.exerciseId);
    const before = snapshotTarget(t);
    let after;
    if (proposal.type === 'leichter') {
      after = { ...t, replacedBy: proposal.change.exerciseId, source: 'erleichtert' };
      state.targets[proposal.exerciseId] = after;
    } else {
      after = { ...t, ...(proposal.change.weight != null ? { weight: proposal.change.weight } : {}), ...(proposal.change.tempo ? { tempo: proposal.change.tempo } : {}), goal: t.repMin, holdGoal: proposal.change.holdGoal || t.holdGoal, source: 'bestätigt' };
      state.targets[proposal.exerciseId] = after;
    }
    state.adjustments.push({ id: `adj-${Date.now()}-${proposal.exerciseId}`, date: nowIso.slice(0, 10), at: nowIso, exerciseId: proposal.exerciseId, before, after, reason: proposal.label, undone: false, auto: false });
    proposal.open = false;
    return state;
  }

  function undoAdjustment(state, adjId) {
    const adj = state.adjustments.find(a => a.id === adjId);
    if (!adj || adj.undone) return state;
    state.targets[adj.exerciseId] = adj.before;
    adj.undone = true;
    return state;
  }

  // ---------- Verlauf ----------
  // Verlauf einer Übung: je abgeschlossener Einheit der schlechteste Satz und die Last
  function exerciseHistory(sessions, exerciseId) {
    return sessions
      .filter(s => s.status !== 'geplant' && s.status !== 'begonnen')
      .flatMap(s => s.exercises.filter(e => e.exerciseId === exerciseId).map(e => {
        const done = e.sets.filter(x => x.status === 'erledigt');
        const reps = done.map(x => x.reps).filter(v => v != null);
        const holds = done.map(x => x.holdSec).filter(v => v != null);
        const weights = done.map(x => x.weight).filter(v => v != null);
        return {
          date: s.date, sessionId: s.id, status: s.status,
          sets: done.length, planned: e.sets.length,
          worstReps: reps.length ? Math.min(...reps) : null,
          worstHold: holds.length ? Math.min(...holds) : null,
          weight: weights.length ? Math.max(...weights) : null,
          summary: done.length ? `${done.length}× ${reps.length ? Math.min(...reps) : '–'}${weights.length ? ' · ' + Math.max(...weights) + ' kg' : ''}` : 'keine Sätze erfasst'
        };
      })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  // ---------- Kalender-Vorschau (rein) ----------
  // Addiert Minuten auf eine Wand-Uhr-Zeit (ohne Zeitzone, Sommerzeit spielt hier keine Rolle)
  function addMinutesLocal(local, minutes) {
    const [datePart, timePart] = local.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
    const pad = n => String(n).padStart(2, '0');
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`;
  }
  function calendarEventId(sessionIdStr) { return 'ht' + sessionIdStr.toLowerCase().replace(/[^a-v0-9]/g, ''); }
  function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
  const KIND_LABEL = { A: 'Krafttraining A', B: 'Krafttraining B', cardio: 'Ausdauer (optional)' };

  function eventBody(session) {
    if (!session.plannedTime && !session.startedAt) return null; // Termin offen: nicht eintragen
    const dur = session.type === 'cardio' ? 32 : 40;
    let startLocal, endLocal;
    const dateStr = session.date;
    if (session.startedAt) startLocal = berlinLocal(session.startedAt);
    else startLocal = `${dateStr}T${session.plannedTime}:00`;
    if (session.endedAt) endLocal = berlinLocal(session.endedAt);
    else endLocal = addMinutesLocal(startLocal, dur);
    const label = KIND_LABEL[session.type] || 'Training';
    let title = label, statusText = 'geplant';
    if (session.status === 'abgeschlossen') { title = `✓ ${label}`; statusText = 'abgeschlossen'; }
    else if (session.status === 'teilweise') { title = `◐ ${label} (teilweise)`; statusText = 'teilweise absolviert'; }
    else if (session.status === 'abgebrochen') { title = `✕ ${label} (abgebrochen)`; statusText = 'abgebrochen'; }
    else if (session.status === 'begonnen') { title = `${label} (läuft)`; statusText = 'begonnen'; }
    return {
      id: calendarEventId(session.id),
      summary: title,
      description: `Status: ${statusText}. Details bleiben in der Trainings-App.`,
      start: { dateTime: startLocal, timeZone: TZ },
      end: { dateTime: endLocal, timeZone: TZ }
    };
  }

  // Ops: create / update / delete. Nur geänderte Einträge (über Hash) werden angefasst.
  function planCalendarOps(state) {
    const ops = [];
    for (const s of state.sessions) {
      const cal = s.calendar || {};
      if (s.status === 'ausgelassen' && cal.eventId) { ops.push({ op: 'delete', sessionId: s.id, eventId: cal.eventId, label: 'Termin entfernen (ausgelassen)' }); continue; }
      const body = eventBody(s);
      if (!body) continue;
      const h = hash(JSON.stringify(body));
      // Neue Termine nur für geplante Einheiten oder wenn ich es bei einer spontanen Einheit ausdrücklich wähle.
      // Importierte Vergangenheit wird nie automatisch eingetragen.
      const mayCreate = (s.source === 'plan' && s.status !== 'ausgelassen') || s.calendarOptIn === true;
      if (!cal.eventId && !mayCreate) continue;
      if (!cal.eventId) ops.push({ op: 'create', sessionId: s.id, body, hash: h, label: `Neu: ${body.summary}` });
      else if (cal.hash !== h) ops.push({ op: 'update', sessionId: s.id, eventId: cal.eventId, body, hash: h, label: `Aktualisieren: ${body.summary}` });
    }
    return ops;
  }

  // ---------- Import / Export ----------
  const EXPORT_VERSION = 1;
  function exportPayload(state, nowIso) {
    return {
      app: 'heimtraining', version: EXPORT_VERSION, exportedAt: nowIso,
      data: { sessions: state.sessions, targets: state.targets, adjustments: state.adjustments, settings: state.settings, media: state.media || {} }
    };
  }
  function validateImport(obj) {
    const errors = [];
    if (!obj || obj.app !== 'heimtraining') errors.push('Keine Trainingsdatei (app fehlt oder falsch).');
    if (obj && obj.version !== EXPORT_VERSION) errors.push(`Version ${obj && obj.version} wird nicht unterstützt.`);
    const d = obj && obj.data;
    if (!d || typeof d !== 'object') errors.push('Datenteil fehlt.');
    else {
      if (!Array.isArray(d.sessions)) errors.push('sessions ist keine Liste.');
      else d.sessions.forEach((s, i) => {
        if (!s || typeof s.id !== 'string') errors.push(`Einheit ${i + 1}: id fehlt.`);
        if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) errors.push(`Einheit ${i + 1}: Datum ungültig.`);
        if (!s || !SESSION_STATUS.includes(s.status)) errors.push(`Einheit ${i + 1}: Status ungültig.`);
        if (s && !Array.isArray(s.exercises)) errors.push(`Einheit ${i + 1}: exercises fehlt.`);
      });
      if (d.targets && typeof d.targets !== 'object') errors.push('targets ungültig.');
      if (d.adjustments && !Array.isArray(d.adjustments)) errors.push('adjustments ungültig.');
    }
    return { ok: errors.length === 0, errors };
  }
  function importPayload(obj) {
    const v = validateImport(obj);
    if (!v.ok) return { ok: false, errors: v.errors };
    const d = obj.data;
    return { ok: true, state: {
      sessions: d.sessions, targets: d.targets || {}, adjustments: d.adjustments || [],
      settings: Object.assign(JSON.parse(JSON.stringify(SETTINGS_DEFAULT)), d.settings || {}), proposals: [], media: d.media || {}
    } };
  }

  // Nach einer Änderung der Trainingszeiten: geplante, noch nicht begonnene Termine in der Zukunft,
  // die nicht mehr zum Plan gehören, entfernen. Mit Kalendertermin werden sie als ausgelassen markiert,
  // damit der Termin beim nächsten Eintragen gelöscht wird.
  function pruneFuturePlanned(state, today, days) {
    days = days || 28;
    const end = addDays(today, days - 1);
    const slots = planSlots(state.settings, today, days);
    const isPlanned = s => s.source === 'plan' && s.status === 'geplant' && s.date >= today && s.date <= end;
    state.sessions = state.sessions.filter(s => {
      if (!isPlanned(s)) return true;
      const isStrength = s.type === 'A' || s.type === 'B';
      const slotExists = slots.some(x => x.date === (s.planDate || s.date) && (x.kind === 'strength') === isStrength);
      if (slotExists) return true;
      if (s.calendar && s.calendar.eventId) { s.status = 'ausgelassen'; return true; }
      return false;
    });
    return state;
  }

  // Berlin-Zeit (Datum + HH:MM) in ISO-Zeitpunkt umrechnen, Sommer- und Winterzeit beachten
  function berlinIso(date, time) {
    for (const off of ['+01:00', '+02:00']) {
      const iso = new Date(`${date}T${time}:00${off}`).toISOString();
      const p = berlinOf(iso);
      if (p.date === date && p.time === time) return iso;
    }
    return new Date(`${date}T${time}:00+01:00`).toISOString();
  }

  function initialState() {
    return {
      version: 1,
      sessions: JSON.parse(JSON.stringify(SEED_SESSIONS)),
      targets: {}, adjustments: [], proposals: [],
      settings: JSON.parse(JSON.stringify(SETTINGS_DEFAULT))
    };
  }

  const api = {
    TZ, SESSION_STATUS, WEEKDAYS, WEEKDAYS_LONG, MONTHS,
    todayStr, berlinOf, berlinLocal, addDays, weekdayOf, mondayOf, fmtDate, fmtTime, fmtDuration,
    defaultTarget, currentTarget, setCount, makeSets, buildExercises, estimateMinutes,
    sessionId, newSession, nextStrengthType, lastCompletedStrength, ensurePlan,
    startSession, currentPosition, logSet, skipSet, reopenSet, swapExercise, skipExercise, completeSession, updateExerciseStatus,
    adjustFromSession, acceptProposal, undoAdjustment, exerciseHistory,
    calendarEventId, eventBody, planCalendarOps, hash,
    exportPayload, validateImport, importPayload, initialState, templateSlots, KIND_LABEL,
    planSlots, hasPreviousData, pruneFuturePlanned, berlinIso
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HT_LOGIC = api;
})(typeof window !== 'undefined' ? window : globalThis);
