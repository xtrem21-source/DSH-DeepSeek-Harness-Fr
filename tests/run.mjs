/**
 * Tests de bout en bout du moteur de patch.
 *
 * 1. Les packs livrés sont valides.
 * 2. Une archive d'origine est reconnue comme telle.
 * 3. Le patch produit une archive vérifiée, sans résidu.
 * 4. Une ancre cassée fait échouer le patch sans rien produire.
 * 5. Deux locales peuvent cohabiter dans la même archive.
 * 6. Un ancien patch français est reconnu et refusé.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import asar from '@electron/asar';
import { writeFixture } from './fixtures.mjs';
import { loadLocales, validatePack } from '../src/packs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const patchScript = path.join(repoRoot, 'src', 'patch.mjs');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`[ok] ${name}`);
  } else {
    failures++;
    console.log(`[KO] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function run(args) {
  return spawnSync(process.execPath, [patchScript, ...args], { encoding: 'utf8' });
}

function json(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-locale-'));
try {
  // 1. Packs
  const packs = loadLocales(path.join(repoRoot, 'locales'));
  for (const pack of packs) {
    const { errors } = validatePack(pack);
    check(`pack ${pack.code} valide`, errors.length === 0, errors.join(' | '));
  }
  const fr = packs.find((pack) => pack.code === 'fr');
  check('pack fr présent', Boolean(fr));
  check('fr : 2 155 chaînes web', fr && Object.keys(fr.web).length === 2155, String(fr && Object.keys(fr.web).length));
  check('fr : 165 clés shell', fr && Object.keys(fr.shell).length === 165, String(fr && Object.keys(fr.shell).length));

  // 2. Archive d'origine
  const src = path.join(tmp, 'app');
  writeFixture(src);
  const base = path.join(tmp, 'app.asar');
  await asar.createPackage(src, base);
  const original = run(['--status', base]);
  check('statut original', json(original)?.status === 'original', original.stdout.trim());

  // 3. Patch + vérification
  const out = path.join(tmp, 'patched.asar');
  const patched = run(['--app', base, '--out', out, '--default', 'fr']);
  const patchedJson = json(patched);
  check('patch réussit', patched.status === 0, (patched.stderr || patched.stdout).trim());
  check('vérification après patch', patchedJson?.verify?.ok === true, JSON.stringify(patchedJson?.verify));
  check('3 fichiers transformés', patchedJson?.transformed === 3, String(patchedJson?.transformed));
  check('aucun fichier .payload laissé', !fs.existsSync(`${out}.payload`));
  check('statut patché', json(run(['--status', out]))?.status === 'delta');
  check('vérification directe', run(['--verify', out, '--default', 'fr']).status === 0);

  // 4. Rupture : ancre cassée
  const brokenSrc = path.join(tmp, 'broken');
  writeFixture(brokenSrc, { breakAnchor: true });
  const broken = path.join(tmp, 'broken.asar');
  await asar.createPackage(brokenSrc, broken);
  const brokenOut = path.join(tmp, 'broken-patched.asar');
  const brokenRun = run(['--app', broken, '--out', brokenOut]);
  check('ancre cassée : échec', brokenRun.status === 1, String(brokenRun.status));
  check('ancre cassée : message explicite', /resolveText|ancres? introuvable/i.test(brokenRun.stderr), brokenRun.stderr.trim());
  check('ancre cassée : aucune sortie écrite', !fs.existsSync(brokenOut));

  // 5. Deux locales dans la même archive
  const localeDir = path.join(tmp, 'locales');
  fs.cpSync(path.join(repoRoot, 'locales', 'fr'), path.join(localeDir, 'fr'), { recursive: true });
  fs.mkdirSync(path.join(localeDir, 'es'), { recursive: true });
  fs.writeFileSync(path.join(localeDir, 'es', 'meta.json'), JSON.stringify({ code: 'es', label: 'Español', fallback: 'en', direction: 'ltr', effort: { High: 'Alto' } }), 'utf8');
  fs.writeFileSync(path.join(localeDir, 'es', 'web.json'), JSON.stringify({ 'Hello': 'Hola' }), 'utf8');
  fs.writeFileSync(path.join(localeDir, 'es', 'shell.json'), JSON.stringify({ greeting: 'Hola' }), 'utf8');
  const multiOut = path.join(tmp, 'multi.asar');
  const multi = run(['--app', base, '--out', multiOut, '--locale-dir', localeDir, '--locales', 'fr,es', '--default', 'es']);
  const multiJson = json(multi);
  check('multi-locale : patch réussit', multi.status === 0, (multi.stderr || multi.stdout).trim());
  check('multi-locale : vérification', multiJson?.verify?.ok === true, JSON.stringify(multiJson?.verify));
  check('multi-locale : deux packs listés', JSON.stringify(multiJson?.locales) === JSON.stringify(['fr', 'es']), JSON.stringify(multiJson?.locales));

  // 6. Ancien patch français
  const legacySrc = path.join(tmp, 'legacy');
  writeFixture(legacySrc, { legacy: true });
  const legacy = path.join(tmp, 'legacy.asar');
  await asar.createPackage(legacySrc, legacy);
  check('ancien patch reconnu', json(run(['--status', legacy]))?.status === 'legacy-fr');
  const legacyRun = run(['--app', legacy, '--out', path.join(tmp, 'legacy-patched.asar')]);
  check('ancien patch refusé', legacyRun.status === 1 && /__DSH_FR|ancien patch/i.test(legacyRun.stderr), legacyRun.stderr.trim());
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log('\nTous les tests passent.');
