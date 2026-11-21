# Trainingszeit – Heimtraining-App

Eine kleine Web-App für dein Training zu Hause. Sie läuft im Browser und lässt sich auf dem Handy wie eine App auf den Startbildschirm legen. Alle Daten bleiben auf dem Gerät. Der Google-Kalender ist optional.

Ordner: `heimtraining/` im Repository. Die bestehende 3D-Druck-App im Root bleibt unverändert.

## Was die App kann

- **Heute**: nächste Einheit, Dauer, Geräte, Schaltfläche „Training starten“. Vor dem Start Befinden und Beschwerden (Knie, linke Hand) angeben. Bei Beschwerden kannst du Übungen leichter machen, austauschen oder auslassen.
- **Satz für Satz**: Gewicht und Wiederholungen oder Haltezeit eintragen, „Satz erledigt“ tippen, Pausentimer läuft automatisch. Sätze überspringen, Übung wechseln, Sätze später nachholen oder korrigieren.
- **Fortsetzen**: Eine laufende Einheit bleibt nach dem Schließen oder Neuladen der Seite an derselben Stelle. Auch die Pause-Anzeige läuft weiter.
- **Abschließen**: Start- und Endzeit, Gesamtanstrengung (0–10), Befinden (1–5) und Notiz. Alles außer den Sätzen ist optional, fehlende Werte bleiben offen. Abgebrochene Einheiten behalten ihre erledigten Sätze und heißen „teilweise“.
- **Wochenplan**: vier Wochen im Voraus, Krafteinheiten Mi und Fr 16 Uhr, Ausdauer optional am Sonntag mit offener Zeit. Die Zeiten sind in den Einstellungen änderbar.
- **Verlauf**: alle Einheiten mit Details, je Übung eine Kurve des schlechtesten Satzes, und alle automatischen Anpassungen mit „Rückgängig“.
- **Ausdauer**: 32 Minuten (5 Min. Einlaufen, 4 × 4 Min. Slow Jogging mit 2 Min. Gehen dazwischen, 5 Min. Auslaufen). Alternativen: zügiges Gehen oder lockeres Rudern. Die Anzeige zeigt die verstrichene Zeit bis zum nächsten Wechsel.
- **Export und Import**: JSON-Datei mit allen Daten, Import ersetzt die Daten nach Bestätigung.
- **Spontan trainieren**: Startet sofort eine A- oder B-Einheit und speichert die Startzeit.
- **Einheit nachtragen**: Datum, Startzeit und Einheit angeben, danach erfasst du Sätze und Zeiten wie sonst.
- **Abweichend trainieren**: Beim Start kannst du zwischen A und B wählen. Der Plan folgt danach der tatsächlich abgeschlossenen Einheit.
- **Technikprobe**: Neue Kettlebell-Übungen starten ohne Gewicht, bis du Griff und Bewegung bestätigt hast.
- **Plan neu berechnen**: Zeigt, welche Ziele, Gewichte oder Reihenfolgen sich geändert haben und warum.
- **Hinweis Dienstag**: Krafttraining am Dienstag, Montag oder Donnerstag löst einen Hinweis in den Einstellungen aus.
- **Statusangaben** haben immer Symbol und Text: ✓ abgeschlossen, ◐ teilweise, ✕ abgebrochen, ● offen, ○ geplant.
- **Schrift und Farben**: DM Sans (von Google Fonts, ohne Internet fällt die Systemschrift zurück), Creme, Petrol, Salbei und Terrakotta.

## Einrichten und auf dem Handy nutzen

Die App braucht eine **https-Adresse** (oder `localhost` zum Testen). Die Dateien sind rein statisch, es gibt keinen Server mit Datenbank.

**Kostenlos veröffentlichen (Beispiel GitHub Pages):**
1. Im GitHub-Repository: Settings → Pages → Branch wählen, Ordner `/ (root)`. Die App ist dann unter `https://<dein-nutzername>.github.io/3d-druck-cockpit/heimtraining/` erreichbar, sobald der Branch veröffentlicht ist.
2. Die Adresse im Handy-Browser öffnen.

**Auf dem iPhone:** In Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.
**Auf Android:** In Chrome öffnen → Menü → „Zum Startbildschirm hinzufügen“ oder „App installieren“.

**Lokal ausprobieren:** `cd heimtraining && python3 -m http.server 8000`, dann `http://localhost:8000` im Browser öffnen.

## Tägliche Nutzung

1. Tab **Heute** öffnen. Die nächste Einheit steht oben, eine offene Einheit mit „Fortsetzen“.
2. **Training starten**, Befinden antippen, bei Bedarf Knie oder linke Hand markieren.
3. Gewicht und Wiederholungen prüfen oder ändern, dann **Satz erledigt**.
4. Am Ende der Übung kann eine kurze Frage kommen: Wie viele saubere Wiederholungen wären noch möglich? Das steuert die Anpassung. Bei neuen Übungen wird nicht gefragt.
5. **Training abschließen**. Danach zeigt die App, was automatisch angepasst wurde, mit „Rückgängig“.
6. Wenn du unterbrechen musst: „Später fortsetzen“ (Pfeil oben links). Später wieder auf **Heute → Fortsetzen**.

## Anpassungsregeln

Jede Übung wird nur anhand des eigenen Verlaufs angepasst. Die Gesamtanstrengung einer Einheit ändert nichts.

| Regel | Was passiert |
|---|---|
| R1 Grundlage | Der schlechteste abgeschlossene Satz einer Übung zählt. Übersprungene Sätze zählen nicht. |
| R2 Unter dem Bereich | Liegt der schlechteste Satz unter dem Bereichsminimum, ist das Ziel fürs nächste Mal eine Wiederholung mehr (bis zum Minimum). Automatisch, mit Grund, rückgängig machbar. |
| R3 Reserve | Reserve 4 oder mehr, gute Technik, kein Schmerz, im Bereich: Ziel +1 Wiederholung (bei 5 oder mehr: +2), höchstens bis zum Bereichsende. Automatisch, mit Grund, rückgängig machbar. |
| R4 Oberes Ende | Bereichsende erreicht, Reserve 3 oder weniger, gute Technik, kein Schmerz: Die App schlägt die nächste Stufe vor (z. B. Schulterdrücken auf je 2,5 kg). Du bestätigst. Erst dann ändert sich das Gewicht, und nur bei dieser Übung. |
| R5 Schmerz oder unsichere Technik | Keine Steigerung. Die App bietet eine leichtere Variante an. |
| R6 Neue Übung | Die erste Messung ist nur Ausgangspunkt, es gibt noch keine Änderung und keine Reserve-Frage. Fehlende Angaben ändern nichts. |
| R7 Trennung | Jede Übung hat ihren eigenen Verlauf. Grundübungen bleiben vergleichbar, Varianten bringen Abwechslung. |

Der Plan richtet A und B nach der letzten **abgeschlossenen** oder begonnenen Krafteinheit aus. Wenn du heute B statt A machst, werden die künftigen Termine neu abgewechselt. Abgeschlossene Einheiten bleiben unverändert.

Beispiel aus deinen Daten: Kreuzheben stand am 18.11. bei 2 × 8 mit 8 kg. Der Plan will 2 × 10–12. Die Vorlage setzt das Ziel auf 10. Wird der Satz wieder unter 10 gemacht, wird das Ziel auf 9 gesetzt, dann auf 10 gehoben. Im Verlauf unter „Übungen“ siehst du, wann welche Wiederholungszahl erreicht wurde.

Die Reihenfolge A/B richtet sich nach der zuletzt **abgeschlossenen** Krafteinheit. Eine begonnene, aber offene Einheit zählt für die Planung der Folgetage, damit A und B nicht doppelt kommen.

## Daten

- Alles liegt im Speicher dieses Browsers (localStorage). Nichts wird an einen Server geschickt, außer beim Kalenderabgleich.
- **Bitte regelmäßig exportieren** (Einstellungen → Daten exportieren). Auf dem iPhone können Browserdaten von Websites, die längere Zeit nicht genutzt wurden, gelöscht werden. Ein Export ist dann dein Backup.
- Beim ersten Start sind deine bisherigen Einheiten (12.11. bis 21.11.) als Startdaten eingetragen. „Auf Startdaten zurücksetzen“ löscht alles lokal und lädt sie neu.

## Google-Kalender einrichten (optional)

Ohne Einrichtung funktioniert die App vollständig. Nur die Kalenderfunktionen bleiben aus.

**Berechtigungen:** Die App fordert nur diese Scopes an (Stand der Google-Dokumentation: [Calendar API – Autorisierung](https://developers.google.com/workspace/calendar/api/auth)):
- `calendar.app.created`: Nur Kalender und Termine, die diese App anlegt. Deine übrigen Kalender werden nicht gelesen.
- `calendar.freebusy`: Nur Frei-/Belegt-Zeiten, nur wenn du „Frei-/Belegt-Zeiten prüfen“ einschaltest. Keine Termintitel.

**Schritte in der Google Cloud Console** (einmalig, kostenlos):
1. Auf console.cloud.google.com ein Projekt anlegen, z. B. „Trainingszeit“.
2. „APIs & Dienste“ → „Bibliothek“ → **Google Calendar API** aktivieren.
3. „OAuth-Zustimmungsbildschirm“ einrichten: Nutzertyp „Extern“, App-Name frei wählbar. Im Status „Testing“ dein eigenes Google-Konto als Testnutzer eintragen. Damit funktioniert es ohne Google-Prüfung.
4. „Anmeldedaten“ → „Anmeldedaten erstellen“ → **OAuth-Client-ID** → Anwendungstyp „Webanwendung“.
5. Unter „Autorisierte JavaScript-Quellen“ die Adresse eintragen, unter der du die App öffnest, z. B. `https://<dein-nutzername>.github.io` (nur der Ursprung, ohne Pfad) oder `http://localhost:8000` zum Testen.
6. Die Client-ID (endet auf `.apps.googleusercontent.com`) in `heimtraining/config.js` eintragen:
   ```js
   window.HT_CONFIG = { googleClientId: 'DEINE-ID.apps.googleusercontent.com' };
   ```
7. Die Datei veröffentlichen. In den Einstellungen „Mit Google verbinden“ tippen.

**So synchronisiert die App:**
- Es entsteht ein Kalender „Heimtraining“ (Europe/Berlin). Eingetragen werden Titel, Zeit und Status: z. B. „Krafttraining A“, nach dem Abschluss „✓ Krafttraining A“ mit deiner tatsächlichen Zeit.
- Beschwerden, Gewichte und Wiederholungen bleiben in der App.
- **Vorschau vor dem Eintragen**: Die App zeigt, was angelegt, geändert oder entfernt wird. Erst „Jetzt eintragen“ sendet etwas.
- Jeder Termin hat eine feste ID, die aus der Einheit abgeleitet wird. Verschieben oder Abschließen **aktualisiert denselben Termin**. Erneutes Synchronisieren legt keine Doppel an.
- Ausgelassene Einheiten entfernen ihren Termin.
- Schlägt etwas fehl, bleibt das Protokoll lokal gespeichert, und die Kachel „Google Kalender“ zeigt, was noch aussteht.
- Die Verbindung wird beim Öffnen der App still erneuert, wenn du sie einmal bestätigt hast. Scheitert das, musst du einmal neu verbinden. Das Zugangs-Token wird nicht gespeichert.
- Termine für bereits vorhandene Kalendereinträge im Hauptkalender können nicht zugeordnet werden, weil die App dort nichts lesen darf. Spontan begonnene Einheiten bekommen einen Termin nur, wenn du das beim Abschluss ausdrücklich ankreuzt.

## Was getestet wurde

**Automatisch geprüft (Node und Browser, siehe `tests/`):**
- `node --test tests/logic.test.js`: 26 Prüfungen der Logik. Dazu gehören Startdaten, Plan (Mi/Fr, A/B-Wechsel), Satzsteuerung, Übung wechseln ohne Änderung anderer Übungen, Abschluss mit fehlenden Werten, alle Anpassungsregeln inkl. Rückgängig, Kalenderereignisse mit stabiler ID, Import/Export und Zeitzone.
- `tests/e2e-flows.js`: 7 Ablaufprüfungen. Abweichende Einheit (A geplant, B gemacht) verschiebt die Reihenfolge, spontan, nachtragen, Plan neu berechnen.
- `tests/e2e.js` (Browser, Handy-Breite 390 px): Heute, Wochenplan, Verlauf, Satz-Ansicht, Neuladen mitten im Training, Satz überspringen, Abschluss, Export, Import, keine Laufzeitfehler.
- `tests/e2e-calendar.js`: 16 Prüfungen der Kalender-Synchronisation gegen eine **gefälschte** Google-API im Test. Geprüft werden Kalender anlegen, Termin anlegen, Verschieben mit gleicher ID, Abschluss mit ✓ und Ist-Zeit, Ausfallen lassen mit Löschung, Wiederholung ohne Duplikat und das Verhalten bei Fehlern.

**Nicht getestet:** Ein echter Abgleich mit einem echten Google-Konto. Dafür fehlen Zugangsdaten. Bitte einmal nach der Einrichtung prüfen: Kalender „Heimtraining“ entsteht, ein Testtermin wird verschoben und abgeschlossen. Erst dann gilt der Google-Teil als geprüft.

**Ebenfalls nicht enthalten:** Fotos oder Videos der Übungen. Ich habe keine verlässlichen Bild- oder Videoquellen, deshalb gibt es ein Feld „Eigener Video- oder Foto-Link“ bei jeder Übung (über „Technik ansehen“).

## Laufende Kosten

- **App-Hosting:** kostenlos bei GitHub Pages oder ähnlichen statischen Hostern. Eine eigene Domain ist optional und kostet nur, wenn du eine willst.
- **Google Calendar API:** für deinen Einsatz ohne Kosten. Die Preise und Kontingente stehen in der Google Cloud Console. Bitte dort einmal prüfen, falls sich etwas ändert.
- **KI-Dienste:** keine. Die Anpassung läuft nach den oben genannten Regeln ohne externen Dienst.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html`, `styles.css` | Oberfläche |
| `app.js` | Ansichten, Satz-Bildschirm, Dialoge |
| `logic.js` | Plan, Satzsteuerung, Anpassung, Kalenderereignisse, Import/Export (ohne DOM) |
| `data.js` | Übungskatalog, Vorlagen A/B, Startdaten |
| `calendar.js` | Google-Anbindung (Anmeldung, Termine, Frei-/Belegt) |
| `config.js` | Google-Client-ID |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline-Nutzung und Home-Bildschirm-Symbol |
| `tests/` | Logik-Tests und Browser-Prüfungen |
