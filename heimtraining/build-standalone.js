// Erzeugt trainingszeit.html: eine einzelne Datei mit allem darin (Styles und Skripte eingebettet).
// Start: node build-standalone.js   (keine Abhängigkeiten, kein Internet nötig)
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf-8');

// Schriften als Daten einbetten, damit die eine Datei ohne weitere Dateien auskommt
function embedFonts(css) {
  return css.replace(/url\((fonts\/[^)]+)\)/g, (m, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')})`);
}

let html = read('index.html');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>\n?/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${embedFonts(read('styles.css'))}\n</style>`);
for (const f of ['data.js', 'logic.js', 'app.js']) {
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) throw new Error('Skript fehlt im HTML: ' + f);
  html = html.replace(tag, () => `<script>\n${read(f)}\n</script>`);
}
if (/<\/script>/i.test(read('data.js') + read('logic.js') + read('app.js') + read('styles.css')) &&
    (read('app.js').match(/<\/script>/gi) || []).length) throw new Error('</script> in Quelldatei');
fs.writeFileSync(path.join(dir, 'trainingszeit.html'), html, 'utf-8');
console.log('geschrieben: trainingszeit.html', html.length, 'Zeichen');
