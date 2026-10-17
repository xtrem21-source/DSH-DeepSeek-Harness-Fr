#!/usr/bin/env node
/**
 * Moteur de patch « delta » pour DeepSeek Harness.
 *
 * Il ajoute une ou plusieurs locales au catalogue de l'application sans retirer
 * `zh` ni `en`, et sans remplacer l'archive complète. Les traductions ne sont
 * appliquées que lorsque la locale active possède un pack.
 *
 * Usage :
 *   node src/patch.mjs --app <app.asar> --out <sortie> [options]
 *   node src/patch.mjs --verify <app.asar> [options]
 *   node src/patch.mjs --status <app.asar>
 *   node src/patch.mjs --list
 *
 * Options :
 *   --locales fr,es   packs à injecter (défaut : tous ceux de locales/)
 *   --locale-dir <dir> dossier des packs (défaut : <dépôt>/locales)
 *   --default fr      locale proposée au premier lancement (défaut : comportement d'origine)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import disk from '@electron/asar/lib/disk.js';
import integrity from '@electron/asar/lib/integrity.js';
import pickle from '@electron/asar/lib/pickle.js';
import { loadLocales, validatePack, PATH_LOCALE, PATH_MODEL, PATH_MAIN } from './packs.mjs';

const { readArchiveHeaderSync } = disk;
const { getFileIntegrity } = integrity;
const { Pickle } = pickle;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`argument inattendu : ${arg}`);
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function fail(message) {
  throw new Error(message);
}

function codesOf(packs) {
  return packs.map((pack) => pack.code);
}

function payloadOf(packs, field) {
  return Object.fromEntries(packs.map((pack) => [pack.code, pack[field]]));
}

// ---------------------------------------------------------------------------
// client.js — catalogue de locales, dictionnaires web, résolution des textes.
// ---------------------------------------------------------------------------
function patchLocale(src, packs, defaultCode) {
  if (src.includes('const __DSH_LOCALE_PACKS = Object.freeze(')) return src;
  const codes = codesOf(packs);

  if (!/const LOCALE_IDS = \[[^\]]*\];/.test(src)) fail('ancre LOCALE_IDS introuvable');
  src = src.replace(/const LOCALE_IDS = \[[^\]]*\];/, (match) => {
    const ids = [...match.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const code of codes) if (!ids.includes(code)) ids.push(code);
    return `const LOCALE_IDS = [${ids.map((id) => JSON.stringify(id)).join(', ')}];`;
  });

  const metaEntries = packs
    .map((pack) => `\t\t\t${JSON.stringify(pack.code)}: { label: ${JSON.stringify(pack.label)}, fallback: ${JSON.stringify(pack.fallback)} }`)
    .join(',\n');
  const enMeta = 'en: { label: "English" }';
  const enMetaMultiline = 'en: {\n\t\t\t\tlabel: "English"\n\t\t\t}';
  if (src.includes(enMeta)) {
    src = src.replace(enMeta, `${enMeta},\n${metaEntries}`);
  } else if (src.includes(enMetaMultiline)) {
    src = src.replace(enMetaMultiline, `${enMetaMultiline},\n${metaEntries}`);
  } else {
    fail('ancre BUILT_IN_LOCALE_METADATA introuvable');
  }

  if (defaultCode) {
    const needles = [
      'this.provisional = resolveInitialLocale(locales, bootstrap?.languages);',
      'this.provisional = resolveInitialLocale(locales, this.bootstrap?.languages);'
    ];
    let replaced = 0;
    for (const needle of needles) {
      if (!src.includes(needle)) continue;
      src = src.replaceAll(needle, `this.provisional = ${JSON.stringify(defaultCode)};`);
      replaced++;
    }
    // Selon la version de l'application, une seule des deux formes existe.
    if (replaced === 0) fail('ancre provisional introuvable');
  }

  const runtimeMarker = '\tvar LocaleRuntime = class {';
  if (!src.includes(runtimeMarker)) fail('ancre LocaleRuntime introuvable');
  const runtime = [
    '\t\t/** Packs injectés : la locale active choisit le sien, sinon le texte reste inchangé. */',
    `\t\tconst __DSH_LOCALE_PACKS = Object.freeze(${JSON.stringify(payloadOf(packs, 'web'))});`,
    '\t\tfunction __dshLocalize(text) {',
    '\t\t\tif (typeof text !== "string") return text;',
    '\t\t\tconst active = typeof globalThis !== "undefined" ? globalThis.__DSH_ACTIVE_LOCALE__ : null;',
    '\t\t\tif (!active) return text;',
    '\t\t\tconst primary = String(active).toLowerCase().split(/[-_]/)[0];',
    '\t\t\tif (!Object.prototype.hasOwnProperty.call(__DSH_LOCALE_PACKS, primary)) return text;',
    '\t\t\tconst pack = __DSH_LOCALE_PACKS[primary];',
    '\t\t\treturn Object.prototype.hasOwnProperty.call(pack, text) ? pack[text] : text;',
    '\t\t}',
    ''
  ].join('\n');
  src = src.replace(runtimeMarker, runtime + runtimeMarker);

  const resolveTextOld = `\t\t\tresolveText(text) {\n\t\t\t\tif (typeof text === "string") return text;\n\t\t\t\treturn this.fallbackChain(this.snapshot.active).reduceRight((resolved, locale) => text[localeKey(locale)] ?? resolved, text.en);\n\t\t\t}`;
  if (!src.includes(resolveTextOld)) fail('ancre resolveText introuvable');
  src = src.replace(
    resolveTextOld,
    `\t\t\tresolveText(text) {\n\t\t\t\tif (typeof text === "string") return __dshLocalize(text);\n\t\t\t\tconst resolved = this.fallbackChain(this.snapshot.active).reduceRight((resolved, locale) => text[localeKey(locale)] ?? resolved, text.en);\n\t\t\t\treturn __dshLocalize(resolved);\n\t\t\t}`
  );

  const translateOld = `\t\t\t\tconst template = this.lookup(ns, key, chain) ?? (ns !== "common" ? this.lookup("common", key, chain) : void 0) ?? key;`;
  if (!src.includes(translateOld)) fail('ancre translate introuvable');
  src = src.replace(
    translateOld,
    `\t\t\t\tconst raw = this.lookup(ns, key, chain) ?? (ns !== "common" ? this.lookup("common", key, chain) : void 0) ?? key;\n\t\t\t\tconst template = __dshLocalize(raw);`
  );

  const constructorSnapshot = `\t\t\t\tthis.snapshot = Object.freeze({\n\t\t\t\t\tactive: this.resolveActive(),\n\t\t\t\t\tlocales,\n\t\t\t\t\trevision: 0\n\t\t\t\t});`;
  if (!src.includes(constructorSnapshot)) fail('ancre snapshot constructeur introuvable');
  src = src.replace(
    constructorSnapshot,
    `${constructorSnapshot}\n\t\t\t\tif (typeof globalThis !== "undefined") globalThis.__DSH_ACTIVE_LOCALE__ = this.snapshot.active;`
  );

  const publishSnapshot = `\t\t\t\tthis.snapshot = Object.freeze({\n\t\t\t\t\tactive,\n\t\t\t\t\tlocales,\n\t\t\t\t\trevision: this.snapshot.revision + 1\n\t\t\t\t});`;
  if (!src.includes(publishSnapshot)) fail('ancre snapshot publish introuvable');
  src = src.replace(
    publishSnapshot,
    `${publishSnapshot}\n\t\t\t\tif (typeof globalThis !== "undefined") globalThis.__DSH_ACTIVE_LOCALE__ = active;`
  );

  return src;
}

// ---------------------------------------------------------------------------
// Sélecteur de modèle — libellés d'effort de chaque pack.
// ---------------------------------------------------------------------------
function patchModelSelection(src, packs) {
  if (src.includes('function __dshEffort(')) return src;
  const withEffort = packs.filter((pack) => Object.keys(pack.effort ?? {}).length > 0);
  if (withEffort.length === 0) return src;

  const region = '\t\t//#region';
  if (!src.includes(region)) fail('ancre //#region introuvable dans le sélecteur de modèle');
  const helper = [
    `\t\tconst __DSH_EFFORT_LABELS = Object.freeze(${JSON.stringify(payloadOf(withEffort, 'effort'))});`,
    '\t\tfunction __dshEffort(name) {',
    '\t\t\tif (typeof globalThis === "undefined") return name;',
    '\t\t\tconst active = globalThis.__DSH_ACTIVE_LOCALE__;',
    '\t\t\tif (!active) return name;',
    '\t\t\tconst primary = String(active).toLowerCase().split(/[-_]/)[0];',
    '\t\t\tconst table = Object.prototype.hasOwnProperty.call(__DSH_EFFORT_LABELS, primary) ? __DSH_EFFORT_LABELS[primary] : null;',
    '\t\t\treturn table && Object.prototype.hasOwnProperty.call(table, name) ? table[name] : name;',
    '\t\t}',
    ''
  ].join('\n');
  src = src.replace(region, helper + region);

  const labelExpr = 'reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort';
  if (!src.includes(labelExpr)) fail('ancre effortLabel introuvable');
  src = src.replace(labelExpr, `__dshEffort(${labelExpr})`);

  const choice = 'label: effort.name';
  if (!src.includes(choice)) fail('ancre label effort introuvable');
  src = src.replace(choice, 'label: __dshEffort(effort.name)');
  return src;
}

// ---------------------------------------------------------------------------
// main.js — dictionnaires du shell Electron et locale par défaut.
// ---------------------------------------------------------------------------
function patchMain(src, packs, defaultCode) {
  if (src.includes('const __dshShellPacks = ')) return src;
  const codes = codesOf(packs);

  const marker = '\n/** Resolve Electron\'s locale to one shipped Desktop dictionary. */';
  if (!src.includes(marker)) fail('ancre dictionnaires du shell introuvable');
  src = src.replace(marker, `\nconst __dshShellPacks = ${JSON.stringify(payloadOf(packs, 'shell'))};${marker}`);

  const resolveOld = `function resolveDesktopLocale(locale) {\n\treturn locale.toLowerCase().startsWith("zh") ? {\n\t\tid: "zh-CN",\n\t\tmessages: zh\n\t} : {\n\t\tid: "en",\n\t\tmessages: en\n\t};\n}`;
  if (!src.includes('messages: __dshShellPacks')) {
    if (!src.includes(resolveOld)) fail('ancre resolveDesktopLocale introuvable');
    src = src.replace(
      resolveOld,
      `function resolveDesktopLocale(locale) {\n\tconst primary = locale.toLowerCase().split(/[-_]/)[0];\n\tif (primary === "zh") return {\n\t\tid: "zh-CN",\n\t\tmessages: zh\n\t};\n\tif (Object.prototype.hasOwnProperty.call(__dshShellPacks, primary)) return {\n\t\tid: primary,\n\t\tmessages: __dshShellPacks[primary]\n\t};\n\treturn {\n\t\tid: "en",\n\t\tmessages: en\n\t};\n}`
    );
  }

  const selectedNeedle = 'if (selected === "zh" || selected === "en") return resolveDesktopLocale(selected);';
  const selectedReplacement = `if (selected === "zh" || selected === "en"${codes.map((code) => ` || selected === ${JSON.stringify(code)}`).join('')}) return resolveDesktopLocale(selected);`;
  if (!src.includes(selectedNeedle) && !src.includes(selectedReplacement)) {
    fail('ancre « selected » introuvable');
  }
  src = src.replace(selectedNeedle, selectedReplacement);

  const primaryNeedle = 'if (primary === "zh" || primary === "en") return resolveDesktopLocale(primary);';
  const primaryReplacement = `if (primary === "zh" || primary === "en"${codes.map((code) => ` || primary === ${JSON.stringify(code)}`).join('')}) return resolveDesktopLocale(primary);`;
  if (!src.includes(primaryNeedle) && !src.includes(primaryReplacement)) {
    fail('ancre « primary » introuvable');
  }
  src = src.replace(primaryNeedle, primaryReplacement);

  if (defaultCode) {
    const fallbackNeedle = 'return resolveDesktopLocale("en");';
    if (!src.includes(fallbackNeedle)) fail('ancre locale de repli du shell introuvable');
    src = src.replace(fallbackNeedle, `return resolveDesktopLocale(${JSON.stringify(defaultCode)});`);
  }
  return src;
}

// ---------------------------------------------------------------------------
// Archive : lecture de l'en-tête, remplacement des seuls fichiers ciblés.
// ---------------------------------------------------------------------------
function readArchiveFile(appPath, rel) {
  const fsys = disk.readFilesystemSync(appPath);
  return disk.readFileSync(fsys, rel, fsys.getFile(rel)).toString('utf8');
}

function archiveStatus(appPath, codes = []) {
  let locale;
  try {
    locale = readArchiveFile(appPath, PATH_LOCALE);
  } catch {
    return 'unknown';
  }
  const ids = (locale.match(/const LOCALE_IDS = \[([^\]]*)\];/) || [])[1] || '';
  const hasZh = ids.includes('"zh"');
  const hasEn = ids.includes('"en"');
  const hasPacks = locale.includes('const __DSH_LOCALE_PACKS = Object.freeze(');
  const hasLegacy = locale.includes('const __DSH_FR = Object.freeze(');
  if (hasPacks && hasZh && hasEn && codes.every((code) => ids.includes(JSON.stringify(code)))) return 'delta';
  if (hasPacks) return 'delta-other';
  if (hasLegacy) return 'legacy-fr';
  if (hasZh && hasEn) return 'original';
  return 'unknown';
}

async function patchArchive(appPath, outPath, packs, defaultCode) {
  const status = archiveStatus(appPath, codesOf(packs));
  if (status === 'legacy-fr') {
    fail('cette archive porte l’ancien patch français (marqueur __DSH_FR) ; restaurez d’abord l’archive d’origine');
  }
  if (status === 'delta') {
    return { already: true, status, transformed: 0, size: fs.statSync(appPath).size };
  }
  if (status === 'delta-other') {
    fail('cette archive est déjà patchée avec un autre jeu de locales ; restaurez l’archive d’origine pour changer la liste');
  }

  const original = fs.readFileSync(appPath);
  const { header, headerSize } = readArchiveHeaderSync(appPath);
  const dataOffset = 8 + headerSize;
  const newHeader = JSON.parse(JSON.stringify(header));
  const transforms = new Map([
    [PATH_LOCALE, (src) => patchLocale(src, packs, defaultCode)],
    [PATH_MODEL, (src) => patchModelSelection(src, packs)],
    [PATH_MAIN, (src) => patchMain(src, packs, defaultCode)]
  ]);

  const payloadPath = `${outPath}.payload`;
  const fd = fs.openSync(payloadPath, 'w');
  let offset = 0;
  let transformed = 0;

  async function walk(node, prefix) {
    if (!node.files) return;
    for (const [name, child] of Object.entries(node.files)) {
      const rel = prefix ? `${prefix}\\${name}` : name;
      if (child.files) {
        await walk(child, rel);
        continue;
      }
      if (child.link !== undefined || child.unpacked) continue;
      const start = dataOffset + Number(child.offset);
      let content = original.subarray(start, start + child.size);
      if (transforms.has(rel)) {
        const before = content.toString('utf8');
        const after = transforms.get(rel)(before);
        if (after === before) fail(`fichier non transformé : ${rel}`);
        content = Buffer.from(after, 'utf8');
        child.integrity = await getFileIntegrity(Readable.from([content]));
        transformed++;
      }
      child.offset = String(offset);
      child.size = content.length;
      fs.writeSync(fd, content);
      offset += content.length;
    }
  }

  try {
    await walk(newHeader, '');
  } finally {
    fs.closeSync(fd);
  }
  if (transformed !== transforms.size) {
    fail(`${transforms.size} fichiers attendus, ${transformed} transformés`);
  }

  const headerPickle = Pickle.createEmpty();
  headerPickle.writeString(JSON.stringify(newHeader));
  const headerBuf = headerPickle.toBuffer();
  const sizePickle = Pickle.createEmpty();
  sizePickle.writeUInt32(headerBuf.length);
  const sizeBuf = sizePickle.toBuffer();

  const final = fs.openSync(outPath, 'w');
  fs.writeSync(final, sizeBuf);
  fs.writeSync(final, headerBuf);
  fs.writeSync(final, fs.readFileSync(payloadPath));
  fs.closeSync(final);
  fs.unlinkSync(payloadPath);
  return { transformed, size: fs.statSync(outPath).size };
}

function verifyArchive(appPath, packs, defaultCode) {
  const read = (rel) => readArchiveFile(appPath, rel);
  const locale = read(PATH_LOCALE);
  const model = read(PATH_MODEL);
  const main = read(PATH_MAIN);
  const ids = (locale.match(/const LOCALE_IDS = \[([^\]]*)\];/) || [])[1] || '';

  const checks = {
    catalogueComplet: codesOf(packs).every((code) => ids.includes(JSON.stringify(code))),
    packsInjectes: locale.includes('const __DSH_LOCALE_PACKS = Object.freeze('),
    helperLocalisation: locale.includes('function __dshLocalize('),
    anglaisConserve: locale.includes('en: { label: "English" }') || /en:\s*\{\s*label:\s*"English"/.test(locale),
    chinoisConserve: locale.includes('label: "中文"'),
    effortsInjectes: packs.every((pack) => !Object.keys(pack.effort ?? {}).length) || model.includes('const __DSH_EFFORT_LABELS = Object.freeze('),
    helperEffort: packs.every((pack) => !Object.keys(pack.effort ?? {}).length) || model.includes('function __dshEffort('),
    shellPacks: main.includes('const __dshShellPacks = '),
    shellAnglais: main.includes('const en = {') && main.includes('messages: en'),
    shellChinois: main.includes('const zh = {') && main.includes('messages: zh')
  };
  if (defaultCode) {
    checks.localeParDefaut =
      main.includes(`resolveDesktopLocale(${JSON.stringify(defaultCode)})`) &&
      locale.includes(`this.provisional = ${JSON.stringify(defaultCode)};`);
  }
  return { ok: Object.values(checks).every(Boolean), checks };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));

function resolvePacks() {
  const localeDir = args['locale-dir'] ? path.resolve(args['locale-dir']) : path.join(repoRoot, 'locales');
  const codes = args.locales ? String(args.locales).split(',').map((code) => code.trim()).filter(Boolean) : null;
  return loadLocales(localeDir, codes);
}

try {
  if (args.list) {
    const packs = resolvePacks();
    const report = packs.map((pack) => {
      const { errors, warnings } = validatePack(pack);
      return {
        code: pack.code,
        label: pack.label,
        fallback: pack.fallback,
        direction: pack.direction,
        web: Object.keys(pack.web).length,
        shell: Object.keys(pack.shell).length,
        effort: Object.keys(pack.effort).length,
        errors,
        warnings
      };
    });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.some((entry) => entry.errors.length) ? 1 : 0);
  }

  if (args.status) {
    const packs = resolvePacks();
    const status = archiveStatus(args.status, codesOf(packs));
    console.log(JSON.stringify({ status, locales: codesOf(packs) }, null, 2));
    process.exit(status === 'unknown' ? 2 : 0);
  }

  if (args.verify) {
    const packs = resolvePacks();
    const result = verifyArchive(args.verify, packs, args.default);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  if (!args.app || !args.out) fail('usage : --app <app.asar> --out <sortie>');
  if (path.resolve(args.app) === path.resolve(args.out)) {
    fail('--out doit désigner un autre fichier que --app : le patch s’écrit dans une copie, puis remplace l’archive');
  }
  const packs = resolvePacks();
  for (const pack of packs) {
    const { errors } = validatePack(pack);
    if (errors.length) fail(`pack « ${pack.code} » invalide :\n- ${errors.join('\n- ')}`);
  }
  if (args.default && !codesOf(packs).includes(String(args.default))) {
    fail(`--default ${args.default} ne correspond à aucun pack chargé (${codesOf(packs).join(', ')})`);
  }
  const result = await patchArchive(args.app, args.out, packs, args.default);
  const check = result.already ? verifyArchive(args.app, packs, args.default) : verifyArchive(args.out, packs, args.default);
  console.log(JSON.stringify({ ...result, locales: codesOf(packs), verify: check }, null, 2));
  process.exit(check.ok ? 0 : 1);
} catch (error) {
  console.error(`ÉCHEC DU PATCH : ${error.message}`);
  process.exit(1);
}
