/**
 * Chargement et validation des packs de langue.
 *
 * Un pack = un dossier `locales/<code>/` contenant :
 *   meta.json   { code, label, fallback, direction, effort }
 *   web.json    { "<chaîne anglaise>": "<traduction>" }
 *   shell.json  { "<clé du shell>": "<traduction>" }
 *
 * Aucune langue n'est privilégiée ici : le moteur ne connaît que des codes.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Chemins internes de l'archive, tels qu'écrits par DeepSeek Harness. */
export const PATH_LOCALE = 'dsh\\node_modules\\@deepseek-ai\\dsh-client-locale\\lib\\client.js';
export const PATH_MODEL = 'dsh\\node_modules\\@deepseek-ai\\dsh-client-ui-model-selection\\lib\\client.js';
export const PATH_MAIN = 'lib\\main.js';

/** Locales déjà fournies par l'application : un pack ne peut pas les remplacer. */
export const BUILT_IN = new Set(['en', 'zh']);

const CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

export function placeholderNames(text) {
  return [...text.matchAll(/\{[A-Za-z0-9_.-]+\}/g)].map((m) => m[0]).sort();
}

export function loadPack(dir) {
  const code = path.basename(dir);
  const meta = readJson(path.join(dir, 'meta.json'));
  return {
    code: typeof meta.code === 'string' ? meta.code : code,
    dir,
    label: meta.label,
    fallback: meta.fallback ?? 'en',
    direction: meta.direction ?? 'ltr',
    effort: meta.effort ?? {},
    web: readJson(path.join(dir, 'web.json')),
    shell: readJson(path.join(dir, 'shell.json'))
  };
}

/**
 * Charge les packs demandés, ou tous les packs du dossier `locales/`.
 * Le dossier `template/` est un gabarit : il n'est jamais chargé par défaut.
 */
export function loadLocales(localeDir, codes) {
  let names = codes;
  if (!names || names.length === 0) {
    names = fs
      .readdirSync(localeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'template')
      .map((entry) => entry.name)
      .sort();
  }
  if (names.length === 0) {
    throw new Error(`aucun pack de langue dans ${localeDir}`);
  }
  return names.map((name) => loadPack(path.join(localeDir, name)));
}

/**
 * Valide un pack. Retourne { errors, warnings } : les erreurs empêchent le patch,
 * les avertissements sont affichés sans bloquer.
 */
export function validatePack(pack) {
  const errors = [];
  const warnings = [];

  if (!CODE_PATTERN.test(pack.code || '')) {
    errors.push(`code de langue invalide : « ${pack.code} » (attendu : fr, pt-BR, zh-Hant…)`);
  }
  if (BUILT_IN.has(pack.code)) {
    errors.push(`le code « ${pack.code} » est fourni par l'application et ne peut pas être remplacé`);
  }
  if (typeof pack.label !== 'string' || pack.label.trim() === '') {
    errors.push('meta.label est vide : c\'est le nom affiché dans le sélecteur de langue');
  }
  if (pack.direction !== 'ltr' && pack.direction !== 'rtl') {
    errors.push(`meta.direction doit valoir « ltr » ou « rtl », reçu « ${pack.direction} »`);
  }
  for (const [name, table] of [['web', pack.web], ['shell', pack.shell]]) {
    if (table === null || typeof table !== 'object' || Array.isArray(table)) {
      errors.push(`${name}.json doit être un objet`);
      continue;
    }
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== 'string') {
        errors.push(`${name}.json : la valeur de « ${key} » n'est pas une chaîne`);
      } else if (name === 'web' && value === '' && key.trim() !== '') {
        // Une traduction vide en web afficherait une interface muette ; en shell,
        // une chaîne vide est légitime (suffixe autour du nom de l'application).
        warnings.push(`${name}.json : traduction vide pour « ${key} »`);
      }
    }
  }

  // Parité des {placeholders} : la clé web est le texte anglais d'origine.
  // Un placeholder perdu casse l'interface (« {count} » affiché tel quel).
  for (const [source, translated] of Object.entries(pack.web ?? {})) {
    if (typeof translated !== 'string') continue;
    const from = placeholderNames(source);
    const to = placeholderNames(translated);
    const missing = from.filter((name) => !to.includes(name));
    const extra = to.filter((name) => !from.includes(name));
    if (missing.length) {
      errors.push(`web : placeholders manquants dans « ${source} » → ${missing.join(', ')}`);
    }
    if (extra.length) {
      errors.push(`web : placeholders inventés dans « ${source} » → ${extra.join(', ')}`);
    }
  }

  if (Object.keys(pack.web ?? {}).length === 0) {
    warnings.push('web.json est vide');
  }
  if (Object.keys(pack.shell ?? {}).length === 0) {
    warnings.push('shell.json est vide');
  }
  return { errors, warnings };
}
