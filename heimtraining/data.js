/* Katalog, Vorlagen und Startdaten. Keine Logik hier. */
(function (root) {
  'use strict';

  const EXERCISES = {
    warmup: {
      name: 'Aufwärmen: Laufband und Mobilisation', group: 'Aufwärmen', kind: 'check', equipment: ['laufband', 'matte'],
      cues: ['Laufband 0–2 Min. bei 3,0 km/h, 2–4 Min. bei 4,0 km/h, 4–5 Min. bei 4,5–5,0 km/h, Steigung 3 %.',
             'Danach 8 Kniebeugen und 8 Hüftbeugen ohne Gewicht.'],
      easier: null, stages: []
    },
    row_kb_double: {
      name: 'Beidhändiges Kettlebell-Rudern (8 kg)', group: 'Rücken', kind: 'reps',
      equipment: ['kettlebell'],
      cues: ['Kettlebell am Horn mit beiden Händen, Oberkörper vorgebeugt, Rücken gerade.', 'Zum Bauch rudern, Schulterblätter zusammenziehen, langsam absenken.'],
      easier: 'row_bent', stages: []
    },
    kb_swing: {
      name: 'Kettlebell-Swing (8 kg)', group: 'Hüfte', kind: 'reps', equipment: ['kettlebell'],
      cues: ['Die Kraft kommt aus der Hüfte, die Arme bleiben locker wie Seile.', 'Hüfte nach hinten, Kettlebell zwischen den Beinen, dann die Hüfte nach vorn schnappen lassen.', 'Rücken bleibt gerade, ausatmen beim Hochschwingen.'],
      easier: 'kb_deadlift', stages: []
    },
    goblet_squat: {
      name: 'Goblet Squat', group: 'Kniebeuge', kind: 'reps',
      equipment: ['kettlebell'], knee: true, grip: true,
      cues: ['Kettlebell vor der Brust am Horn halten, Ellbogen zeigen nach unten.',
             'Zuerst ohne Gewicht üben, Griff und Bewegung prüfen.',
             'Fersen fest, Knie in Richtung Fußspitzen, Rücken gerade.'],
      easier: 'squat_dumbbell',
      stages: []
    },
    squat_dumbbell: {
      name: 'Kniebeugen mit Kurzhanteln', group: 'Kniebeuge', kind: 'reps',
      equipment: ['dumbbell'], knee: true,
      cues: ['Je 2,5 kg in den Händen, Brust hoch.', 'Etwa 3 Sekunden absenken.', 'Knie bleiben über den Zehen.'],
      easier: null,
      stages: []
    },
    kb_deadlift: {
      name: 'Kettlebell-Kreuzheben', group: 'Hüfte', kind: 'reps',
      equipment: ['kettlebell'], grip: true,
      cues: ['Hüfte nach hinten schieben, Rücken gerade.', 'Kettlebell nah am Körper führen.', 'Oberschenkel anspannen, nicht den Rücken.'],
      easier: null,
      stages: []
    },
    row_bent: {
      name: 'Vorgebeugtes Rudern (je 2,5 kg)', group: 'Rücken', kind: 'reps',
      equipment: ['dumbbell'],
      cues: ['Oberkörper gerade, Bauch fest.', 'Ellbogen nah am Körper nach hinten ziehen.'],
      easier: null,
      stages: []
    },
    row_kb_single: {
      name: 'Einarmiges Kettlebell-Rudern', group: 'Rücken', kind: 'reps',
      equipment: ['kettlebell'], grip: true, perSide: true,
      cues: ['Erst bei sicherem Griff und stabiler Ausführung 8 kg nutzen.', 'Rücken parallel zum Boden, nicht drehen.'],
      easier: 'row_bent',
      stages: []
    },
    press_floor: {
      name: 'Brustdrücken am Boden (je 2,5 kg)', group: 'Drücken', kind: 'reps',
      equipment: ['dumbbell', 'matte'],
      cues: ['Schulterblätter am Boden, Ellbogen etwa 45 Grad.', 'Langsam absenken, kontrolliert drücken.'],
      easier: null,
      stages: [{ label: 'Langsamer absenken (3 Sekunden)', change: { tempo: '3s' } }]
    },
    shoulder_press: {
      name: 'Schulterdrücken (je 1,5 kg)', group: 'Drücken', kind: 'reps',
      equipment: ['dumbbell'],
      cues: ['Rippen eng, kein Hohlkreuz beim Drücken.', 'Handgelenke gerade über den Ellbogen.'],
      easier: null,
      stages: [{ label: 'Auf je 2,5 kg steigern', change: { weight: 2.5 } }]
    },
    bridge_single: {
      name: 'Einbeinige Brücke', group: 'Po & Beinrückseite', kind: 'reps',
      equipment: ['matte'], perSide: true,
      cues: ['Hüfte hoch, Becken gerade halten.', 'Oben kurz halten, dann langsam ablegen.'],
      easier: null,
      stages: []
    },
    hamstring_ball: {
      name: 'Beinbeugen mit Gymnastikball', group: 'Po & Beinrückseite', kind: 'reps',
      equipment: ['ball', 'matte'],
      cues: ['Fersen auf dem Ball, Hüfte oben halten.', 'Ball langsam zu dir ziehen, dann kontrolliert strecken.'],
      easier: null,
      stages: []
    },
    plank_forearm: {
      name: 'Unterarmstütz', group: 'Rumpf', kind: 'hold',
      equipment: ['matte'],
      cues: ['Ellbogen unter den Schultern, Körper als gerade Linie.', 'Bauch und Gesäß fest, Atmung ruhig.'],
      easier: null,
      stages: []
    },
    dead_bug: {
      name: 'Dead Bug', group: 'Rumpf', kind: 'reps',
      equipment: ['matte'], perSide: true,
      cues: ['Lendenwirbelsäule bleibt auf der Matte.', 'Langsam gegenüberliegenden Arm und Bein strecken.'],
      easier: null,
      stages: []
    }
  };

  // Trainingsplan: sieben Einheiten vom 27.11. bis 18.12. Die Werte sind die Vorgaben je Einheit.
  // min/max = Wiederholungen, hmin/hmax = Haltezeit in Sekunden, weight in kg (Kurzhantel je Hand).
  const PLAN = [
    { n: 1, date: '2026-11-27', type: 'A', phase: 'Basis', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'goblet_squat', sets: 3, min: 8, max: 10, weight: 8 },
      { id: 'kb_deadlift', sets: 3, min: 10, max: 12, weight: 8 },
      { id: 'row_kb_double', sets: 3, min: 10, max: 12, weight: 8 },
      { id: 'press_floor', sets: 3, min: 12, max: 15, weight: 2.5, tempo: '3 s absenken' },
      { id: 'shoulder_press', sets: 3, min: 10, max: 12, weight: 2.5 },
      { id: 'plank_forearm', sets: 3, hmin: 30, hmax: 30 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ] },
    { n: 2, date: '2026-12-02', type: 'B', phase: 'Basis', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'squat_dumbbell', sets: 3, min: 12, max: 12, weight: 2.5, tempo: '3 s absenken' },
      { id: 'kb_deadlift', sets: 3, min: 10, max: 12, weight: 8 },
      { id: 'bridge_single', sets: 2, min: 10, max: 10, weight: 8, perSide: true, note: 'Kettlebell auf der Hüfte' },
      { id: 'row_bent', sets: 3, min: 12, max: 12, weight: 2.5 },
      { id: 'shoulder_press', sets: 3, min: 12, max: 12, weight: 1.5 },
      { id: 'hamstring_ball', sets: 2, min: 10, max: 10 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ] },
    { n: 3, date: '2026-12-04', type: 'A', phase: 'Steigerung', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'goblet_squat', sets: 3, min: 10, max: 12, weight: 8 },
      { id: 'kb_deadlift', sets: 3, min: 12, max: 15, weight: 8 },
      { id: 'row_kb_double', sets: 3, min: 12, max: 15, weight: 8 },
      { id: 'press_floor', sets: 3, min: 12, max: 15, weight: 2.5 },
      { id: 'shoulder_press', sets: 3, min: 10, max: 12, weight: 2.5 },
      { id: 'plank_forearm', sets: 3, hmin: 35, hmax: 35 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ] },
    { n: 4, date: '2026-12-09', type: 'B', phase: 'Steigerung', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'squat_dumbbell', sets: 3, min: 12, max: 15, weight: 2.5, tempo: '3 s absenken' },
      { id: 'kb_deadlift', sets: 3, min: 12, max: 15, weight: 8, tempo: '3-1-1' },
      { id: 'bridge_single', sets: 2, min: 12, max: 12, weight: 8, perSide: true, note: 'Kettlebell auf der Hüfte' },
      { id: 'row_bent', sets: 3, min: 12, max: 15, weight: 2.5 },
      { id: 'shoulder_press', sets: 3, min: 12, max: 15, weight: 1.5 },
      { id: 'hamstring_ball', sets: 2, min: 10, max: 12 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ] },
    { n: 5, date: '2026-12-11', type: 'A', phase: 'Tempo', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'goblet_squat', sets: 3, min: 12, max: 12, weight: 8, tempo: '2 s unten halten' },
      { id: 'kb_deadlift', sets: 3, min: 15, max: 15, weight: 8, tempo: '3-1-1' },
      { id: 'row_kb_double', sets: 3, min: 15, max: 15, weight: 8, tempo: '2 s oben halten' },
      { id: 'press_floor', sets: 3, min: 15, max: 15, weight: 2.5, tempo: '3 s runter, 1 s unten' },
      { id: 'shoulder_press', sets: 3, min: 12, max: 12, weight: 2.5 },
      { id: 'plank_forearm', sets: 3, hmin: 40, hmax: 40 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ] },
    { n: 6, date: '2026-12-16', type: 'B', phase: 'Tempo und Schwung', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'squat_dumbbell', sets: 3, min: 15, max: 15, weight: 2.5, tempo: '3 s absenken' },
      { id: 'kb_deadlift', sets: 3, min: 15, max: 15, weight: 8, tempo: '3-1-1' },
      { id: 'kb_swing', sets: 2, min: 10, max: 10, weight: 8 },
      { id: 'bridge_single', sets: 2, min: 12, max: 12, weight: 8, perSide: true, note: 'Kettlebell auf der Hüfte' },
      { id: 'row_bent', sets: 3, min: 15, max: 15, weight: 2.5, tempo: '2 s oben halten' },
      { id: 'shoulder_press', sets: 3, min: 15, max: 15, weight: 1.5 },
      { id: 'hamstring_ball', sets: 2, min: 12, max: 12 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ] },
    { n: 7, date: '2026-12-18', type: 'A', phase: 'Abschluss und Messung', ex: [
      { id: 'warmup', sets: 1 },
      { id: 'goblet_squat', sets: 3, min: 12, max: 12, weight: 8, tempo: '2 s unten halten' },
      { id: 'kb_deadlift', sets: 3, min: 15, max: 15, weight: 8, tempo: '3-1-1' },
      { id: 'row_kb_double', sets: 3, min: 15, max: 15, weight: 8, tempo: '2 s oben halten' },
      { id: 'press_floor', sets: 3, min: 15, max: 15, weight: 2.5, tempo: '3 s absenken' },
      { id: 'shoulder_press', sets: 3, min: 12, max: 12, weight: 2.5 },
      { id: 'plank_forearm', sets: 3, hmin: 40, hmax: 40 },
      { id: 'dead_bug', sets: 2, min: 10, max: 10, perSide: true }
    ], measure: true }
  ];

  // Vorlagen laut Trainingsplan. sets = Sätze je Seite bei perSide, sonst gesamt.
  const TEMPLATES = {
    A: {
      id: 'A', label: 'Krafttraining A', durationMin: 40,
      slots: [
        { slot: 'Kniebeuge', exerciseId: 'goblet_squat', sets: 2, repMin: 8, repMax: 10, weight: 8, alternativeId: 'squat_dumbbell', altSets: 2, altRepMin: 12, altRepMax: 15, altWeight: 2.5 },
        { slot: 'Hüfte', exerciseId: 'kb_deadlift', sets: 2, repMin: 10, repMax: 12, weight: 8 },
        { slot: 'Rücken', exerciseId: 'row_bent', sets: 3, repMin: 12, repMax: 15, weight: 2.5 },
        { slot: 'Drücken', exerciseId: 'press_floor', sets: 3, repMin: 12, repMax: 15, weight: 2.5 },
        { slot: 'Po & Beinrückseite', exerciseId: 'bridge_single', sets: 2, repMin: 10, repMax: 12, weight: null, perSide: true },
        { slot: 'Rumpf', exerciseId: 'plank_forearm', sets: 2, holdMin: 30, holdMax: 40, weight: null }
      ]
    },
    B: {
      id: 'B', label: 'Krafttraining B', durationMin: 40,
      slots: [
        { slot: 'Kniebeuge', exerciseId: 'squat_dumbbell', sets: 2, repMin: 12, repMax: 15, weight: 2.5, alternativeId: 'goblet_squat', altSets: 2, altRepMin: 8, altRepMax: 10, altWeight: 8 },
        { slot: 'Hüfte', exerciseId: 'kb_deadlift', sets: 2, repMin: 10, repMax: 12, weight: 8 },
        { slot: 'Rücken', exerciseId: 'row_kb_single', sets: 2, repMin: 6, repMax: 8, weight: 8, perSide: true, alternativeId: 'row_bent', altSets: 3, altRepMin: 12, altRepMax: 15, altWeight: 2.5 },
        { slot: 'Drücken', exerciseId: 'shoulder_press', sets: 3, repMin: 10, repMax: 12, weight: 1.5 },
        { slot: 'Po & Beinrückseite', exerciseId: 'hamstring_ball', sets: 2, repMin: 8, repMax: 12, weight: null },
        { slot: 'Rumpf', exerciseId: 'dead_bug', sets: 2, repMin: 10, repMax: 10, weight: null, perSide: true }
      ]
    }
  };

  const EQUIPMENT = {
    kettlebell: '8-kg-Kettlebell',
    dumbbell: '2 × 1,5 kg und 2 × 2,5 kg Kurzhanteln',
    ball: 'Gymnastikball',
    matte: 'Matte',
    rudergeraet: 'Rudergerät',
    laufband: 'Laufband (3 % Steigung)'
  };

  // Startdaten aus dem bisherigen Training. Zeiten sind Europe/Berlin.
  const SEED_SESSIONS = [
    { id: 's-2026-11-12', date: '2026-11-12', type: 'B', status: 'abgeschlossen', startedAt: '2026-11-12T14:14:00+01:00', endedAt: '2026-11-12T14:52:00+01:00',
      effort: 3, effortNote: 'Angabe 2–3/10', feeling: null, pain: { knee: false, leftHand: false }, notes: 'Hand und Knie okay. Sätze nicht erfasst.', exercises: [], detailsMissing: true, source: 'import' },
    { id: 's-2026-11-15', date: '2026-11-15', type: 'B', status: 'abgeschlossen', startedAt: null, endedAt: null,
      effort: null, feeling: null, pain: { knee: false, leftHand: false }, notes: 'Selbstständig wiederholt. Uhrzeit und Anstrengung offen.', exercises: [], detailsMissing: true, source: 'import' },
    { id: 's-2026-11-18', date: '2026-11-18', type: 'B', status: 'abgeschlossen', startedAt: '2026-11-18T16:25:00+01:00', endedAt: '2026-11-18T16:47:00+01:00',
      effort: 2, feeling: null, pain: { knee: false, leftHand: false }, notes: '', source: 'import',
      exercises: [
        { slotId: 'Hüfte', exerciseId: 'kb_deadlift', effort: 2, technique: null, sets: [ s(8, 8), s(8, 8) ] },
        { slotId: 'Kniebeuge', exerciseId: 'squat_dumbbell', effort: 3, technique: null, sets: [ s(12, 2.5), s(12, 2.5) ] },
        { slotId: 'Rücken', exerciseId: 'row_bent', substituted: true, effort: null, technique: null, sets: [ s(12, 2.5), s(12, 2.5), s(12, 2.5) ] },
        { slotId: 'Drücken', exerciseId: 'shoulder_press', effort: null, technique: null, sets: [ s(10, 1.5), s(10, 1.5), s(10, 1.5) ] },
        { slotId: 'Po & Beinrückseite', exerciseId: 'hamstring_ball', effort: null, technique: null, sets: [ s(8, null), s(8, null) ] },
        { slotId: 'Rumpf', exerciseId: 'dead_bug', effort: null, technique: null, sets: [ s(10, null), s(10, null), s(10, null), s(10, null) ] }
      ] },
    { id: 's-2026-11-19', date: '2026-11-19', type: 'cardio', status: 'abgeschlossen', startedAt: null, endedAt: '2026-11-19T17:51:00+01:00',
      durationMin: 25, effort: 2, effortNote: 'höchstens 2/10', feeling: null, pain: { knee: false, leftHand: false },
      notes: 'Gehen und Slow Jogging, etwa 25 Minuten.', exercises: [], source: 'import' },
    { id: 's-2026-11-23-A', date: '2026-11-23', type: 'A', status: 'abgeschlossen', startedAt: '2026-11-23T12:25:00+01:00', endedAt: '2026-11-23T13:32:00+01:00',
      effort: null, feeling: 4, pain: { knee: false, leftHand: false }, source: 'import', plannedTime: null,
      notes: 'Urlaubstraining A mit anschließender Ausdauer. Gesamtdauer 67 Min. Genaue Wiederholungen teils nicht erfasst.',
      exercises: [
        { slotId: 'Kniebeuge', exerciseId: 'goblet_squat', effort: null, technique: null, sets: [ s(null, 8), s(null, 8) ] },
        { slotId: 'Hüfte', exerciseId: 'kb_deadlift', effort: null, technique: null, sets: [ s(10, 8), s(null, 8) ] },
        { slotId: 'Rücken', exerciseId: 'row_bent', effort: null, technique: null, sets: [ s(null, 2.5), s(15, 2.5), s(null, 2.5) ] },
        { slotId: 'Drücken', exerciseId: 'press_floor', effort: null, technique: null, sets: [ s(null, 2.5), s(15, 2.5), s(null, 2.5) ] },
        { slotId: 'Po & Beinrückseite', exerciseId: 'bridge_single', effort: null, technique: null, sets: [ s(null, null), s(null, null) ] },
        { slotId: 'Rumpf', exerciseId: 'plank_forearm', effort: null, technique: null, sets: [ s(null, null), s(null, null) ] }
      ] },
    { id: 's-2026-11-25-B', date: '2026-11-25', type: 'B', status: 'abgeschlossen', startedAt: null, endedAt: '2026-11-25T17:36:00+01:00',
      effort: null, feeling: null, pain: { knee: false, leftHand: false }, source: 'import', plannedTime: '16:00',
      notes: 'Kraftteil Ende 17:36 Uhr. Beginn unbekannt. Gesamtrückmeldung: sehr gut, noch 2–3 Wiederholungen möglich. Schulterdrücken mit je 2,5 kg gesteigert.',
      exercises: [
        { slotId: 'Kniebeuge', exerciseId: 'squat_dumbbell', effort: null, technique: null, sets: [ s(15, 2.5), s(12, 2.5) ] },
        { slotId: 'Hüfte', exerciseId: 'kb_deadlift', effort: null, technique: null, sets: [ s(null, 8), s(null, 8) ] },
        { slotId: 'Rücken', exerciseId: 'row_bent', effort: null, technique: null, sets: [ s(20, 2.5), s(20, 2.5), s(20, 2.5) ] },
        { slotId: 'Drücken', exerciseId: 'shoulder_press', effort: null, technique: null, sets: [ s(8, 2.5), s(8, 2.5), s(10, 2.5) ] },
        { slotId: 'Po & Beinrückseite', exerciseId: 'hamstring_ball', effort: null, technique: null, sets: [ s(8, null), s(8, null) ] },
        { slotId: 'Rumpf', exerciseId: 'dead_bug', effort: null, technique: null, sets: [ s(null, null), s(null, null), s(null, null), s(null, null) ] }
      ] },
    { id: 's-2026-11-25-cardio', date: '2026-11-25', type: 'cardio', status: 'abgeschlossen', startedAt: '2026-11-25T17:37:00+01:00', endedAt: null,
      durationMin: 32, effort: null, feeling: null, pain: { knee: false, leftHand: false }, source: 'import', plannedTime: '17:37',
      notes: 'Laufband gestartet 17:37 Uhr, 32 Min. geplant. Ende nicht bestätigt.', exercises: [] },
    { id: 's-2026-11-21', date: '2026-11-21', type: 'A', status: 'begonnen', startedAt: '2026-11-21T13:58:00+01:00', endedAt: null,
      effort: null, feeling: null, pain: { knee: false, leftHand: false }, notes: 'Abschluss und Sätze noch offen.', exercises: [], source: 'import' }
  ];

  function s(reps, weight) { return { reps, weight, status: 'erledigt', rir: null }; }

  const SETTINGS_DEFAULT = {
    slots: [
      { weekday: 3, time: '16:00', label: 'Krafttraining' },
      { weekday: 5, time: '16:00', label: 'Krafttraining' }
    ],
    cardio: { weekday: 0, time: null, label: 'Ausdauer (optional)', optional: true },
    restSec: 75,
    timerOn: true
  };

  const api = { EXERCISES, TEMPLATES, EQUIPMENT, SEED_SESSIONS, SETTINGS_DEFAULT, PLAN };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HT_DATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
