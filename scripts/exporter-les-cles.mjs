/**
 * Crée le squelette d'un pack de langue à partir des clés du pack français.
 *
 *   node scripts/exporter-les-cles.mjs <code> [dossier de sortie]
 *
 * Écrit web.json (clés anglaises → vides) et shell.json (clés → vides).
 * meta.json n'est pas deviné : il doit être rempli à la main.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const [, , code, outDir] = process.argv;

if (!code || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code)) {
  console.error('usage : node scripts/exporter-les-cles.mjs <code> [dossier]');
  console.error('exemple : node scripts/exporter-les-cles.mjs es');
  process.exit(1);
}

const source = path.join(repoRoot, 'locales', 'fr');
const target = outDir ? path.resolve(outDir) : path.join(repoRoot, 'locales', code);
fs.mkdirSync(target, { recursive: true });

for (const file of ['web.json', 'shell.json']) {
  const table = JSON.parse(fs.readFileSync(path.join(source, file), 'utf8'));
  const skeleton = Object.fromEntries(Object.keys(table).sort().map((key) => [key, '']));
  fs.writeFileSync(path.join(target, file), `${JSON.stringify(skeleton, null, 2)}\n`, 'utf8');
  console.log(`${Object.keys(skeleton).length} clés → ${path.join(target, file)}`);
}

console.log(`\nRemplissez maintenant ${path.join(target, 'meta.json')} (code, label, fallback, direction, effort).`);
console.log('Un modèle est disponible dans locales/template/meta.json.');
