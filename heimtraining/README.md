# Trainingszeit – Heimtraining-App

Eine Web-App für dein Training zu Hause, auf Deutsch, für das Smartphone gebaut.
**Komplett kostenlos:** keine Konten, keine Abos, keine Google-Anbindung, keine KI-Dienste. Alle Daten bleiben auf deinem Gerät.

Ordner: `heimtraining/` im Repository. Die 3D-Druck-App im Root bleibt unberührt.

## Was die App kann

- **Heute**: nächste Einheit, Dauer, Geräte, „Training starten“ oder „Fortsetzen“. Vorab Befinden und Beschwerden (Knie, linke Hand) angeben. Bei Beschwerden Übung leichter machen, austauschen oder auslassen.
- **Satz für Satz**: Gewicht und Wiederholungen oder Haltezeit eintragen, „Satz erledigt“, Pausentimer läuft automatisch. Sätze überspringen, Übung wechseln, Sätze später nachholen oder korrigieren.
- **Fortsetzen**: Eine laufende Einheit bleibt nach Schließen oder Neuladen an derselben Stelle. Auch die Pause läuft weiter.
- **Abschließen**: Start- und Endzeit, Gesamtanstrengung (0–10), Befinden (1–5), Notiz. Fehlende Werte bleiben offen. Abgebrochene Einheiten behalten ihre erledigten Sätze und heißen „teilweise“.
- **Spontan trainieren** (A oder B, sofort) und **Einheit nachtragen** (Datum, Startzeit, Einheit).
- **Abweichend trainieren**: Beim Start wählst du A oder B. Der Plan folgt danach der tatsächlich abgeschlossenen Einheit.
- **Technikprobe**: Neue Kettlebell-Übungen starten ohne Gewicht, bis du Griff und Bewegung bestätigt hast.
- **Wochenplan** für vier Wochen: Krafttage Mi und Fr 16 Uhr, Ausdauer optional am Sonntag mit offener Zeit. Zeiten in den Einstellungen änderbar. Ein Hinweis erscheint, wenn Krafttraining am Dienstag, Montag oder Donnerstag liegt.
- **Plan neu berechnen**: zeigt, welche Ziele, Gewichte oder Reihenfolgen sich geändert haben und warum.
- **Verlauf**: alle Einheiten mit Details, je Übung eine Kurve des schlechtesten Satzes, alle Anpassungen mit „Rückgängig“.
- **Ausdauer**: 32 Minuten (5 Min. Einlaufen, 4 × 4 Min. Slow Jogging mit 2 Min. Gehen dazwischen, 5 Min. Auslaufen). Alternativen: zügiges Gehen, lockeres Rudern. Anzeige im Format „5,0 km/h bis 9:00“.
- **Kalender-Datei** (.ics) zum Import in deinen Kalender, siehe unten.
- **Export und Import** aller Daten als JSON.

Statusangaben haben immer Symbol und Text: ✓ abgeschlossen, ◐ teilweise, ✕ abgebrochen, ● offen, ○ geplant.

## Gestaltung

Creme `#F8F6F0` als Hintergrund, Petrol `#163C39` für Text und Hauptaktionen, Salbei `#DCE7DE` für Karten, Terrakotta `#BC583B` als Akzent. Schrift DM Sans, lokal eingebettet (Lizenz: SIL Open Font License, siehe `fonts/OFL-LICENSE.txt`).

Ein Kettlebell-Foto ist nicht enthalten, weil ich kein Foto mit geklärten Rechten habe. Die Karte zeigt stattdessen eine Grafik. Übungsvideos fügst du pro Übung über „Technik ansehen“ mit einem eigenen Link hinzu.

## Auf dem Handy nutzen – drei kostenlose Wege

### Weg 1: Einzeldatei (ohne Hosting, ohne Konto)
1. Auf deinem Computer `trainingszeit.html` aus diesem Ordner nehmen. Die Datei enthält alles, auch die Schrift.
2. Die Datei auf das Handy bringen, zum Beispiel per E-Mail an dich selbst, über iCloud Drive, Google Drive-App oder einen USB-Stick.
3. Auf dem Handy die Datei öffnen (iPhone: Dateien-App, Android: Dateien-App) und mit Safari bzw. Chrome öffnen.
4. Ein Lesezeichen setzen oder die Seite in die Startseite ablegen (Teilen → „Zum Home-Bildschirm“, je nach Browser eingeschränkt).

Hinweis: In dieser Form sind die Daten an den Browser gebunden. Ob sie beim Schließen dauerhaft bleiben, hängt vom Browser ab. Deshalb lohnt sich der Export (siehe unten).

### Weg 2: GitHub Pages (wenn das Repository öffentlich ist)
1. Im Repository: Settings → Pages → Branch wählen, Ordner `/ (root)`.
2. Die App liegt dann unter `https://<dein-nutzername>.github.io/3d-druck-cockpit/heimtraining/` und lässt sich auf dem Handy als App auf den Startbildschirm legen.
3. Kostenlos nur bei einem öffentlichen Repository. Ist das Repository privat, verlangt GitHub für Pages einen bezahlten Plan. Siehe [GitHub-Pläne](https://docs.github.com/en/get-started/learning-about-github/githubs-plans).

### Weg 3: Kostenloser statischer Hoster
Cloudflare Pages oder Netlify bieten kostenlose Pläne für statische Seiten. Den Ordner `heimtraining/` hochladen. Die Gratisbedingungen musst du dort selbst prüfen, sie ändern sich.

**Lokal ausprobieren:** `cd heimtraining && python3 -m http.server 8000`, dann `http://localhost:8000`.

**Die Einzeldatei neu erzeugen** (nach Änderungen am Code): `node build-standalone.js`. Es braucht nur Node.js, keine Installation.

## Kalender (kostenlos, ohne Google-Anbindung)

Die App erzeugt eine Kalender-Datei (`.ics`) mit allen Trainingsterminen: geplante Einheiten, und spontane oder nachgetragene nur, wenn du sie beim Abschluss ausdrücklich aufnimmst. Titel, Zeit und Status stehen darin, nach dem Abschluss mit ✓ und deiner tatsächlichen Zeit. Beschwerden und Satzdetails bleiben in der App.

**Import:**
- **iPhone**: Datei öffnen → „Zu Kalender hinzufügen“ (oder in der Kalender-App „Datei importieren“).
- **Android / Google Kalender am Computer**: Google Kalender → Einstellungen → „Importieren & exportieren“ → Datei auswählen.

**Wichtig, ehrlich gesagt:**
- Die Datei ist ein Schnappschuss. Änderungen wie Verschieben oder Abschließen landen erst im Kalender, wenn du die neue Datei importierst.
- Ob ein erneuter Import denselben Termin aktualisiert oder ein Doppel anlegt, hängt von der Kalender-App ab. Das habe ich nicht getestet. Prüfe es beim ersten Mal mit einem Testtermin.
- Ausgelassene Einheiten entfernt die Datei nicht aus dem Kalender. Die löschst du dort von Hand.
- Eine automatische Synchronisation mit Google ist bewusst nicht enthalten. Die Google-Schnittstelle ist für die Nutzung derzeit kostenlos, Google plant aber laut [Quota-Dokumentation](https://developers.google.com/calendar/quota) künftig Kosten oberhalb von Tageslimits. Mit dem Ziel „100 % kostenlos“ passt das nicht.

## Anpassungsregeln

Jede Übung wird nur anhand ihres eigenen Verlaufs angepasst. Die Gesamtanstrengung einer Einheit ändert nichts.

| Regel | Was passiert |
|---|---|
| R1 Grundlage | Der schlechteste abgeschlossene Satz einer Übung zählt. Übersprungene Sätze zählen nicht. |
| R2 Unter dem Bereich | Liegt der schlechteste Satz unter dem Bereichsminimum, ist das Ziel fürs nächste Mal eine Wiederholung mehr (bis zum Minimum). Automatisch, mit Grund, rückgängig machbar. |
| R3 Reserve | Reserve 4 oder mehr, gute Technik, kein Schmerz, im Bereich: Ziel +1 Wiederholung (bei 5 oder mehr: +2), höchstens bis zum Bereichsende. Automatisch, mit Grund, rückgängig machbar. |
| R4 Oberes Ende | Bereichsende erreicht, Reserve 3 oder weniger, gute Technik, kein Schmerz: Vorschlag der nächsten Stufe (z. B. Schulterdrücken auf je 2,5 kg). Erst deine Bestätigung ändert etwas, und nur bei dieser Übung. |
| R5 Schmerz oder unsichere Technik | Keine Steigerung, Vorschlag einer leichteren Variante. |
| R6 Neue Übung | Die erste Messung ist nur Ausgangspunkt. Keine Änderung, keine Reserve-Frage. Fehlende Angaben ändern nichts. |
| R7 Trennung | Jede Übung hat ihren eigenen Verlauf. Grundübungen bleiben vergleichbar, Varianten bringen Abwechslung. |

Der Plan richtet A und B nach der letzten **abgeschlossenen** oder begonnenen Krafteinheit aus. Machst du heute B statt A, werden die künftigen Termine neu abgewechselt. Abgeschlossene Einheiten bleiben unverändert.

Beispiel aus deinen Daten: Kreuzheben stand am 18.11. bei 2 × 8 mit 8 kg. Der Plan will 2 × 10–12. Wird der Satz wieder unter 10 gemacht, wird das Ziel auf 9 gesetzt, dann auf 10 gehoben. Im Verlauf unter „Übungen“ siehst du, wann welche Wiederholungszahl erreicht wurde.

## Daten

- Alles liegt im Speicher des Browsers (localStorage). Die App sendet nichts ins Netz.
- **Bitte regelmäßig exportieren**: Einstellungen → Daten exportieren. Auf dem iPhone können Browserdaten von Seiten, die lange nicht genutzt wurden, gelöscht werden.
- Beim ersten Start sind deine bisherigen Einheiten (12.11. bis 21.11.) eingetragen. „Auf Startdaten zurücksetzen“ löscht alles lokal und lädt sie neu.

## Was getestet wurde

Automatisch geprüft:
- `node --test tests/logic.test.js`: 27 Prüfungen der Logik (Startdaten, Plan, Satzsteuerung, alle Anpassungsregeln, Rückgängig, Kalenderdatei mit stabiler UID, Import/Export, Zeitzone).
- `tests/e2e.js`: 14 Prüfungen im Browser bei Handy-Breite. Heute, Wochenplan, Verlauf, Satz-Ansicht, Neuladen mitten im Training, Überspringen, Abschluss, Export, Import.
- `tests/e2e-flows.js`: 7 Ablaufprüfungen (abweichende Einheit, spontan, nachtragen, Plan neu berechnen).
- `tests/e2e-export.js`: 6 Prüfungen des Kalender-Exports und dass keine Anfrage an Google geht.

**Nicht getestet:** Ob deine Kalender-App eine erneut importierte Datei als Aktualisierung erkennt. Das musst du einmal mit einem Testtermin prüfen.

## Dateien

| Datei | Zweck |
|---|---|
| `trainingszeit.html` | Die fertige Einzeldatei für Weg 1 |
| `index.html`, `styles.css`, `fonts/` | Oberfläche und lokal eingebettete Schrift |
| `app.js` | Ansichten, Satz-Bildschirm, Dialoge |
| `logic.js` | Plan, Satzsteuerung, Anpassung, Kalenderdatei, Import/Export (ohne DOM) |
| `data.js` | Übungskatalog, Vorlagen A/B, Startdaten |
| `build-standalone.js` | Erzeugt `trainingszeit.html` |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline-Nutzung und Startbildschirm-Symbol (für Weg 2 und 3) |
| `tests/` | Logik-Tests und Browser-Prüfungen |
