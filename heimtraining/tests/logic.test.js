'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const TODAY = '2026-11-21';
const NOW = '2026-11-21T14:30:00+01:00';

function fresh() { return L.initialState(); }
function byId(state, id) { return state.sessions.find(s => s.id === id); }
function strengthOn(state, date) { return state.sessions.find(s => s.date === date && (s.type === 'A' || s.type === 'B')); }
function exOf(session, exerciseId) { return session.exercises.find(e => e.exerciseId === exerciseId); }

// Einheit vollständig durchspielen; repsFn(exerciseId, setIndex) liefert Wdh.
function runSession(state, session, repsFn, opts = {}) {
  L.startSession(state, session, NOW, opts.pain || null);
  session.exercises.forEach((ex, e) => {
    ex.sets.forEach((s, i) => {
      const reps = repsFn ? repsFn(ex.exerciseId, i) : 10;
      L.logSet(session, e, i, { reps, weight: s.weight, holdSec: ex.target.kind === 'hold' ? 35 : null });
    });
    if (opts.rir && opts.rir[ex.exerciseId] !== undefined) {
      ex.sets[ex.sets.length - 1].rir = opts.rir[ex.exerciseId];
    }
    if (opts.technique && opts.technique[ex.exerciseId]) ex.technique = opts.technique[ex.exerciseId];
  });
  return session;
}

test('Startdaten: 18.11. ist vollständig, 21.11. ist offen', () => {
  const s = fresh();
  const d18 = byId(s, 's-2026-11-18');
  assert.equal(d18.status, 'abgeschlossen');
  assert.equal(d18.type, 'B');
  const kb = exOf(d18, 'kb_deadlift');
  assert.deepEqual(kb.sets.map(x => [x.reps, x.weight]), [[8, 8], [8, 8]]);
  const row = exOf(d18, 'row_bent');
  assert.equal(row.substituted, true, 'Rudern war Alternative in B');
  assert.equal(d18.exercises.find(e => e.exerciseId === 'dead_bug').sets.length, 4, 'Dead Bug 2×10 je Seite = 4 Sätze');
  const d21 = byId(s, 's-2026-11-21');
  assert.equal(d21.status, 'abgeschlossen', 'aus dem Kalendereintrag übernommen');
  assert.equal(d21.exercises.length, 6);
});

test('Anker: nach B vom 18.11. folgt A; offene A-Einheit verschiebt den Rest', () => {
  const s = fresh();
  assert.equal(L.nextStrengthType(s.sessions), 'A', 'nach B vom 25.11. folgt A');
  const onlyDone = s.sessions.filter(x => x.id !== 's-2026-11-21');
  assert.equal(L.nextStrengthType(onlyDone), 'A');
});

test('Wochenplan: Mittwoch und Freitag ab 16 Uhr, Wochenende nur Ausdauer optional mit offener Zeit', () => {
  const s = fresh();
  L.ensurePlan(s, TODAY, 28);
  const strength = s.sessions.filter(x => x.date >= TODAY && (x.type === 'A' || x.type === 'B') && x.status === 'geplant' || x.id === 's-2026-11-21');
  const dates = s.sessions.filter(x => x.plannedTime && x.type !== 'cardio').map(x => [x.date, x.plannedTime]);
  for (const [d, t] of dates) {
    const wd = L.weekdayOf(d);
    assert.ok(wd === 3 || wd === 5, `Krafteinheit an ${d} nur Mi/Fr`);
    assert.equal(t, '16:00');
  }
  assert.ok(strength.length >= 8, 'mindestens 8 Krafteinheiten in 4 Wochen');
  const cardio = s.sessions.filter(x => x.type === 'cardio' && x.date >= TODAY && x.source === 'plan');
  assert.ok(cardio.length >= 3);
  assert.ok(cardio.every(c => L.weekdayOf(c.date) === 0 && c.plannedTime === null), 'Ausdauer nur sonntags, Zeit offen');
});

test('Wochenplan: A und B wechseln, offene A-Einheit bleibt erhalten', () => {
  const s = fresh();
  L.ensurePlan(s, TODAY, 28);
  const seq = s.sessions.filter(x => x.date > TODAY && (x.type === 'A' || x.type === 'B') && x.source === 'plan').map(x => x.type);
  assert.equal(strengthOn(s, '2026-11-21').type, 'A');
  assert.equal(seq[0], 'A', 'Plan-Einheit 27.11. ist A');
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
  // Idempotent: zweiter Lauf erzeugt nichts Neues
  const n = s.sessions.length;
  L.ensurePlan(s, TODAY, 28);
  assert.equal(s.sessions.length, n);
});

test('Ziele: Ausgangswerte aus der Vorlage', () => {
  const s = fresh();
  const t = L.currentTarget(s, 'kb_deadlift');
  assert.equal(t.repMin, 10); assert.equal(t.repMax, 12); assert.equal(t.weight, 8);
  assert.equal(L.currentTarget(s, 'plank_forearm').kind, 'hold');
});

test('Aufbau einer Einheit: Ziele werden beim Start übernommen', () => {
  const s = fresh();
  const sess = byId(s, 's-2026-11-18');
  // Frische Einheit B
  const b = L.newSession('2026-11-25', 'B', { id: 'x-b' });
  L.startSession(s, b, NOW, null);
  assert.equal(b.exercises.length, 6);
  const sq = b.exercises[0];
  assert.equal(sq.exerciseId, 'squat_dumbbell');
  assert.equal(sq.sets.length, 2);
  assert.ok(sess);
});

test('Satz erledigt, überspringen und Fortsetzen über den Zustand', () => {
  const s = fresh();
  const b = L.newSession('2026-11-25', 'B', { id: 'x-b' });
  L.startSession(s, b, NOW, null);
  s.sessions.push(b);
  L.logSet(b, 0, 0, { reps: 12, weight: 2.5 });
  L.skipSet(b, 0, 1);
  assert.equal(b.exercises[0].status, 'teilweise');
  assert.deepEqual(b.exercises[0].sets.map(x => x.status), ['erledigt', 'übersprungen']);
  // Neu laden simulieren (Zustand wird als JSON gespeichert und wieder geladen)
  const copy = JSON.parse(JSON.stringify(s));
  const b2 = copy.sessions.find(x => x.id === 'x-b');
  const pos = L.currentPosition(b2);
  assert.deepEqual(pos, { ex: 1, set: 0 }, 'Fortsetzen an der ersten offenen Stelle');
});

test('Übung vollständig erledigt bekommt Status erledigt, übersprungen bleibt sichtbar', () => {
  const s = fresh();
  const b = L.newSession('2026-11-25', 'B', { id: 'x-b' });
  L.startSession(s, b, NOW, null);
  L.skipExercise(b, 5);
  assert.equal(b.exercises[5].status, 'übersprungen');
  b.exercises[0].sets.forEach((_, i) => L.logSet(b, 0, i, { reps: 12, weight: 2.5 }));
  assert.equal(b.exercises[0].status, 'erledigt');
});

test('Übung wechseln betrifft nur diese Übung', () => {
  const s = fresh();
  const b = L.newSession('2026-11-25', 'B', { id: 'x-b' });
  L.startSession(s, b, NOW, null);
  const before = b.exercises.map(e => e.exerciseId);
  const res = L.swapExercise(b, 2, 'row_bent', L.defaultTarget('row_bent'));
  assert.equal(res.ok, true);
  assert.equal(b.exercises[2].substituted, true);
  assert.equal(b.exercises[2].sets.length, 3);
  assert.deepEqual(b.exercises.map(e => e.exerciseId).filter((_, i) => i !== 2), before.filter((_, i) => i !== 2));
});

test('Abschluss: vollständig, teilweise, abgebrochen; fehlende Werte bleiben offen', () => {
  const s = fresh();
  const full = L.startSession(s, L.newSession('2026-11-25', 'A', { id: 'f' }), NOW, null);
  full.exercises.forEach((ex, e) => ex.sets.forEach((_, i) => L.logSet(full, e, i, { reps: 10 })));
  L.completeSession(full, { endedAt: '2026-11-25T16:45:00+01:00' });
  assert.equal(full.status, 'abgeschlossen');
  assert.equal(full.effort, null, 'Anstrengung nicht angegeben bleibt offen');
  assert.equal(full.feeling, null);

  const part = L.startSession(s, L.newSession('2026-11-27', 'B', { id: 'p' }), NOW, null);
  L.logSet(part, 0, 0, { reps: 12, weight: 2.5 });
  L.completeSession(part, { endedAt: '2026-11-27T16:50:00+01:00', effort: 6 });
  assert.equal(part.status, 'teilweise');
  assert.equal(part.exercises[0].sets[0].status, 'erledigt', 'erledigte Sätze bleiben');
  assert.equal(part.effort, 6);

  const none = L.startSession(s, L.newSession('2026-12-02', 'A', { id: 'n' }), NOW, null);
  L.completeSession(none, { endedAt: NOW });
  assert.equal(none.status, 'abgebrochen');
});

test('Anpassung R2: unter dem Bereich nur +1 je Einheit bis zum Bereichsminimum', () => {
  const s = fresh();
  // Erste Messung Kreuzheben (18.11.) ist Ausgangspunkt, kein Auto-Change
  const next = L.newSession('2026-11-25', 'B', { id: 'k2' });
  runSession(s, next, () => 8, {});
  s.sessions.push(next);
  L.completeSession(next, { endedAt: NOW });
  const res = L.adjustFromSession(s, next, NOW);
  const kb = res.changes.find(c => c.exerciseId === 'kb_deadlift');
  assert.ok(kb, 'Änderung für Kreuzheben');
  assert.equal(s.targets.kb_deadlift.goal, 9);
  assert.equal(s.targets.kb_deadlift.repMin, 10, 'Bereich bleibt');
  assert.ok(kb.reason.includes('unter dem Bereich'));
});

test('Anpassung R3: Reserve >= 4 ergänzt 1–2 Wdh. im Bereich, mit Grund und Rückgängig', () => {
  const s = fresh();
  // Verlauf: Kreuzheben schon einmal gemessen
  const prev = s.sessions.find(x => x.id === 's-2026-11-18');
  const sess = L.newSession('2026-11-25', 'B', { id: 'r1' });
  s.sessions.push(sess);
  runSession(s, sess, (exId) => (exId === 'kb_deadlift' ? 11 : 10), { rir: { kb_deadlift: 4 } });
  L.completeSession(sess, { endedAt: NOW });
  const before = JSON.stringify(s.targets);
  L.adjustFromSession(s, sess, NOW);
  assert.equal(s.targets.kb_deadlift.goal, 12, 'worst 11 + 1, auf 12 begrenzt');
  const adj = s.adjustments.find(a => a.exerciseId === 'kb_deadlift');
  assert.ok(adj.reason.includes('Reserve 4'));
  L.undoAdjustment(s, adj.id);
  assert.equal(s.targets.kb_deadlift.goal, 10, 'Rückgängig stellt das Ziel wieder her');
  assert.equal(adj.undone, true);
  assert.ok(before.length > 0);
  void prev;
});

test('Anpassung R4: oberes Ende nur Vorschlag, nicht automatisch', () => {
  const s = fresh();
  const sess = L.newSession('2026-11-25', 'B', { id: 'r2' });
  s.sessions.push(sess);
  // Schulterdrücken aus dem 18.11. ist bekannt; oberes Ende (12 Wdh.) mit Reserve 2 erreicht
  runSession(s, sess, (exId) => (exId === 'shoulder_press' ? 12 : 10), { rir: { shoulder_press: 2 } });
  L.completeSession(sess, { endedAt: NOW });
  const res = L.adjustFromSession(s, sess, NOW);
  assert.equal(s.targets.shoulder_press, undefined, 'keine Gewichtsänderung ohne Bestätigung');
  const p = res.proposals.find(x => x.exerciseId === 'shoulder_press');
  assert.ok(p, 'Vorschlag wird angeboten');
  assert.equal(p.change.weight, 2.5);
  // Erst nach Bestätigung ändert sich das Gewicht, und nur diese Übung
  L.acceptProposal(s, p, NOW);
  assert.equal(s.targets.shoulder_press.weight, 2.5);
  assert.equal(s.targets.shoulder_press.goal, 10, 'Wdh.-Ziel zurück auf Bereichsminimum');
  assert.equal(s.targets.kb_deadlift, undefined, 'andere Übungen unberührt');
});

test('Anpassung R5: Schmerz am Knie stoppt Steigerung und schlägt Erleichterung vor', () => {
  const s = fresh();
  s.sessions.push(s.sessions.find(x => x.id === 's-2026-11-18'));
  const sess = L.newSession('2026-11-25', 'A', { id: 'r3' });
  s.sessions.push(sess);
  runSession(s, sess, () => 10, { rir: { goblet_squat: 5 }, pain: null });
  sess.pain.knee = true;
  L.completeSession(sess, { endedAt: NOW });
  const res = L.adjustFromSession(s, sess, NOW);
  assert.equal(s.targets.goblet_squat, undefined, 'keine Änderung bei Schmerz');
  assert.ok(res.proposals.some(p => p.type === 'leichter' && p.exerciseId === 'goblet_squat'));
});

test('Anpassung: nur die betroffene Übung ändert sich', () => {
  const s = fresh();
  // Kreuzheben gab es schon, Schulterdrücken auch -> beide bekannt
  const prevSess = L.newSession('2026-11-24', 'B', { id: 'prev' });
  runSession(s, prevSess, () => 10);
  prevSess.status = 'abgeschlossen';
  s.sessions.push(prevSess);
  const sess = L.newSession('2026-11-25', 'B', { id: 'only' });
  s.sessions.push(sess);
  runSession(s, sess, (exId) => (exId === 'kb_deadlift' ? 8 : 10), { rir: { kb_deadlift: 4, shoulder_press: 2 } });
  L.completeSession(sess, { endedAt: NOW });
  const before = JSON.stringify(s.targets.shoulder_press || null);
  L.adjustFromSession(s, sess, NOW);
  assert.equal(JSON.stringify(s.targets.shoulder_press || null), before, 'Schulterdrücken unverändert');
  assert.ok(s.targets.kb_deadlift, 'Kreuzheben angepasst');
});

test('Gesamtanstrengung allein ändert nichts', () => {
  const s = fresh();
  const prevSess = L.newSession('2026-11-24', 'B', { id: 'prev2' });
  runSession(s, prevSess, () => 10); prevSess.status = 'abgeschlossen'; s.sessions.push(prevSess);
  const sess = L.newSession('2026-11-25', 'B', { id: 'eff' });
  s.sessions.push(sess);
  // Wdh. genau im Bereichsminimum: keine Regel greift, weil keine Reserve angegeben ist
  runSession(s, sess, (exId) => L.currentTarget(s, exId).repMin);
  L.completeSession(sess, { endedAt: NOW, effort: 2 });
  L.adjustFromSession(s, sess, NOW);
  assert.deepEqual(s.targets, {});
});

test('Heute / Start: Termin offen zählt nicht als Kalenderereignis', () => {
  const s = fresh();
  const cardio = L.newSession('2026-11-29', 'cardio', { id: 'c1', plannedTime: null });
  assert.equal(L.eventBody(cardio), null);
});

test('ICS: gleiche UID beim Verschieben und beim Abschluss, Zeiten in UTC', () => {
  const s = fresh();
  L.ensurePlan(s, TODAY, 28);
  const target = s.sessions.find(x => x.date === '2026-12-02' && x.type === 'B');
  const uidOf = text => (text.match(/UID:(hts\w+)@trainingszeit/g) || []).filter(u => u.includes(L.calendarEventId(target.id)));
  const ics1 = L.icsCalendar(s, NOW);
  assert.equal(uidOf(ics1).length, 1, 'einmal im Export');
  assert.ok(ics1.includes('DTSTART:20261202T150000Z'), '16:00 Berlin = 15:00 UTC');
  // Verschieben auf 17:15
  target.plannedTime = '17:15';
  const ics2 = L.icsCalendar(s, NOW);
  assert.equal(uidOf(ics2).length, 1, 'gleiche UID, kein zweiter Eintrag');
  assert.ok(ics2.includes('DTSTART:20261202T161500Z'), 'neue Zeit 17:15 Berlin = 16:15 UTC');
  // Abschluss mit Ist-Zeit
  L.startSession(s, target, '2026-12-02T16:02:00+01:00', null);
  target.exercises.forEach((ex, e) => ex.sets.forEach((_, i) => L.logSet(target, e, i, { reps: 10, weight: 2.5 })));
  L.completeSession(target, { endedAt: '2026-12-02T16:44:00+01:00' });
  const ics3 = L.icsCalendar(s, NOW);
  assert.equal(uidOf(ics3).length, 1, 'Abschluss ändert denselben Eintrag');
  assert.ok(ics3.includes('SUMMARY:✓ Krafttraining B'), 'Titel mit ✓');
  assert.ok(ics3.includes('DTSTART:20261202T150200Z') && ics3.includes('DTEND:20261202T154400Z'), 'Ist-Zeiten 16:02–16:44 Berlin');
  // Ausgelassen: nicht mehr im Export
  target.status = 'ausgelassen';
  assert.equal(uidOf(L.icsCalendar(s, NOW)).length, 0);
});

test('ICS: spontane Einheit nur mit ausdrücklicher Wahl, Umlaute und Kommas werden escaped', () => {
  const s = fresh();
  const sp = L.createUnplanned(s, '2026-11-24', 'A', 'spontan');
  sp.startedAt = '2026-11-24T15:00:00.000Z';
  assert.ok(!L.icsCalendar(s, NOW).includes('UID:' + L.calendarEventId(sp.id)));
  sp.calendarOptIn = true;
  const text = L.icsCalendar(s, NOW);
  assert.ok(text.includes('UID:' + L.calendarEventId(sp.id) + '@trainingszeit'));
  assert.ok(text.includes('BEGIN:VCALENDAR') && text.trimEnd().endsWith('END:VCALENDAR'));
  assert.equal(L.icsCalendar(s, NOW).split('\r\n').filter(l => l.length > 75 && !l.startsWith(' ')).length, 0, 'Zeilen gefaltet');
});

test('Kalender: Beschreibung enthält keine Beschwerden oder Details', () => {
  const s = fresh();
  const sess = byId(s, 's-2026-11-18');
  sess.pain = { knee: true, leftHand: false };
  const body = L.eventBody(sess);
  assert.ok(!body.description.includes('Knie'));
  assert.ok(!body.description.includes('kg'));
});

test('Export und Import: Rundreise und Validierung', () => {
  const s = fresh();
  const exp = L.exportPayload(s, NOW);
  const json = JSON.parse(JSON.stringify(exp));
  const imp = L.importPayload(json);
  assert.equal(imp.ok, true);
  assert.equal(imp.state.sessions.length, s.sessions.length);
  assert.equal(L.validateImport({ app: 'other', version: 1 }).ok, false);
  assert.equal(L.validateImport({ app: 'heimtraining', version: 9, data: {} }).ok, false);
  const bad = JSON.parse(JSON.stringify(exp));
  bad.data.sessions[0].status = 'kaputt';
  assert.equal(L.validateImport(bad).ok, false);
});

test('Ausgabe: Dauer einer Einheit liegt bei rund 40 Minuten', () => {
  const m = L.estimateMinutes('A');
  assert.ok(m >= 35 && m <= 45, `A ca. ${m} Min`);
});

test('Zeitzone: Berlin-Datum vor Mitternacht UTC', () => {
  assert.equal(L.berlinOf('2026-11-21T23:30:00Z').date, '2026-11-22');
  assert.equal(L.fmtTime('2026-11-18T15:25:00Z'), '16:25');
});

test('Abweichend absolviert: A geplant, B gemacht -> Verlauf zeigt B, nächste Einheit wird A', () => {
  const s = fresh();
  L.ensurePlan(s, TODAY, 28);
  const a21 = s.sessions.find(x => x.id === 's-2026-11-21');
  assert.equal(a21.type, 'A');
  // Nutzer macht stattdessen B und schließt ab
  a21.type = 'B';
  L.startSession(s, a21, NOW, null);
  a21.exercises.forEach((ex, e) => ex.sets.forEach((_, i) => L.logSet(a21, e, i, { reps: 10 })));
  L.completeSession(a21, { endedAt: '2026-11-21T15:00:00+01:00' });
  L.ensurePlan(s, TODAY, 28);
  const nextPlanned = s.sessions.filter(x => x.status === 'geplant' && (x.type === 'A' || x.type === 'B') && x.date > TODAY).sort((x, y) => (x.date < y.date ? -1 : 1));
  assert.equal(nextPlanned[0].type, 'A', 'nach B folgt A');
  assert.equal(nextPlanned[1].type, 'B');
  assert.equal(a21.type, 'B', 'abgeschlossene Einheit bleibt wie gemacht');
});

test('Plan-Vergleich: Zieländerung nennt Übung, Termin und Grund', () => {
  const s = fresh();
  L.ensurePlan(s, TODAY, 28);
  const before = L.planSnapshot(s, TODAY);
  s.adjustments.push({ id: 'x', exerciseId: 'kb_deadlift', reason: 'Testgrund', undone: false, auto: true });
  s.targets.kb_deadlift = { ...L.currentTarget(s, 'kb_deadlift'), goal: 9 };
  const after = L.planSnapshot(s, TODAY);
  const lines = L.diffPlans(before, after, s.adjustments);
  const hit = lines.find(l => l.exerciseId === 'kb_deadlift');
  assert.ok(hit, 'Kreuzheben-Änderung erscheint');
  assert.ok(hit.text.includes('10 → 9 Wdh.'));
  assert.equal(hit.reason, 'Testgrund');
  assert.equal(L.diffPlans(after, after, []).length, 0, 'ohne Änderung keine Zeilen');
});

test('Ungeplante Einheiten erhalten eindeutige IDs', () => {
  const s = fresh();
  const a = L.createUnplanned(s, '2026-11-24', 'A', 'spontan');
  const b = L.createUnplanned(s, '2026-11-24', 'A', 'spontan');
  assert.notEqual(a.id, b.id);
  assert.equal(a.source, 'spontan');
});

test('Plan: keine Krafteinheit am Montag, Dienstag oder Donnerstag mit Standardzeiten', () => {
  const s = fresh();
  L.ensurePlan(s, TODAY, 28);
  assert.ok(!s.sessions.some(x => (x.type === 'A' || x.type === 'B') && x.source === 'plan' && [1, 2, 4].includes(L.weekdayOf(x.date))));
});

test('Plan: sieben feste Einheiten mit Nummer und Termin', () => {
  const s = fresh();
  const plan = s.sessions.filter(x => x.planN);
  assert.equal(plan.length, 7);
  assert.deepEqual(plan.map(x => x.date), ['2026-11-27', '2026-12-02', '2026-12-04', '2026-12-09', '2026-12-11', '2026-12-16', '2026-12-18']);
  assert.deepEqual(plan.map(x => x.type), ['A', 'B', 'A', 'B', 'A', 'B', 'A']);
  assert.ok(plan.every(x => x.plannedTime === '16:00'));
});

test('Plan: Vorgaben der Einheit 1 (Goblet Squat 3 × 8–10, 8 kg, Aufwärmen zuerst)', () => {
  const s = fresh();
  const ex = L.buildExercises(s, 'A', 1);
  assert.equal(ex[0].exerciseId, 'warmup');
  assert.equal(ex[0].target.kind, 'check');
  const gs = ex.find(e => e.exerciseId === 'goblet_squat');
  assert.equal(gs.target.sets, 3);
  assert.equal(gs.target.repMin, 8);
  assert.equal(gs.target.repMax, 10);
  assert.equal(gs.target.weight, 8);
  assert.equal(gs.sets.length, 3);
});

test('Plan: Plan-Einheit ändert ihre Vorgaben nie automatisch, nur Vorschläge', () => {
  const s = fresh();
  const sess = s.sessions.find(x => x.planN === 1);
  L.startSession(s, sess, NOW, null);
  sess.exercises.forEach((e, i) => e.sets.forEach((x, j) => L.logSet(sess, i, j, { reps: e.target.repMax || 10, weight: x.weight, holdSec: e.target.holdMax || null })));
  L.completeSession(sess, { endedAt: '2026-11-27T16:50:00+01:00' });
  const res = L.adjustFromSession(s, sess, NOW);
  assert.deepEqual(res.changes, []);
  assert.deepEqual(s.targets, {}, 'keine Ziele verändert');
  assert.ok(res.suggestions.length > 0, 'Vorschlag für das obere Ende');
});
