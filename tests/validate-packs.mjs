/**
 * Vérifie les packs livrés : schéma, codes, parité des {placeholders}.
 * Ne touche à aucune archive. Sortie 0 si tout est valide.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocales, validatePack } from '../src/packs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const packs = loadLocales(path.join(repoRoot, 'locales'));
let failed = false;

for (const pack of packs) {
  const { errors, warnings } = validatePack(pack);
  const web = Object.keys(pack.web).length;
  const shell = Object.keys(pack.shell).length;
  const effort = Object.keys(pack.effort).length;
  console.log(`${pack.code} — ${pack.label} : ${web} chaînes web, ${shell} clés shell, ${effort} libellés d'effort`);
  for (const warning of warnings) console.log(`  avertissement : ${warning}`);
  for (const error of errors) {
    failed = true;
    console.log(`  ERREUR : ${error}`);
  }
}

if (failed) {
  console.error('Packs invalides.');
  process.exit(1);
}
console.log('Packs valides.');
