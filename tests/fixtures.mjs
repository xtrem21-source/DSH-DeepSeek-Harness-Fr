/**
 * Fabrique une archive de test minimale contenant les ancres exactes que le
 * patcheur recherche dans la vraie application. Aucun binaire n'est stocké :
 * tout est reconstruit à l'exécution, avec des tabulations explicites.
 */
import fs from 'node:fs';
import path from 'node:path';

const t = (n) => '\t'.repeat(n);

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

export function writeFixture(root, { legacy = false, breakAnchor = false } = {}) {
  const localeClient = [
    'const LOCALE_IDS = ["zh", "en"];',
    '',
    'const BUILT_IN_LOCALE_METADATA = {',
    `${t(1)}"zh": { label: "中文" },`,
    `${t(1)}en: { label: "English" }`,
    '};',
    '',
    `${t(1)}var LocaleRuntime = class {`,
    `${t(2)}constructor(locales, bootstrap) {`,
    `${t(3)}this.bootstrap = bootstrap;`,
    `${t(3)}this.provisional = resolveInitialLocale(locales, bootstrap?.languages);`,
    `${t(4)}this.snapshot = Object.freeze({`,
    `${t(5)}active: this.resolveActive(),`,
    `${t(5)}locales,`,
    `${t(5)}revision: 0`,
    `${t(4)}});`,
    `${t(2)}}`,
    `${t(2)}publish(active, locales) {`,
    `${t(4)}this.snapshot = Object.freeze({`,
    `${t(5)}active,`,
    `${t(5)}locales,`,
    `${t(5)}revision: this.snapshot.revision + 1`,
    `${t(4)}});`,
    `${t(2)}}`,
    `${t(3)}${breakAnchor ? 'resolveTextX' : 'resolveText'}(text) {`,
    `${t(4)}if (typeof text === "string") return text;`,
    `${t(4)}return this.fallbackChain(this.snapshot.active).reduceRight((resolved, locale) => text[localeKey(locale)] ?? resolved, text.en);`,
    `${t(3)}}`,
    `${t(3)}translate(ns, key, chain) {`,
    `${t(4)}const template = this.lookup(ns, key, chain) ?? (ns !== "common" ? this.lookup("common", key, chain) : void 0) ?? key;`,
    `${t(4)}return template;`,
    `${t(3)}}`,
    '};',
    legacy ? 'const __DSH_FR = Object.freeze({});' : '',
    ''
  ].join('\n');

  const modelSelection = [
    'function render(reasoning, effectiveEffort, effort) {',
    `${t(2)}//#region`,
    `${t(2)}const label = reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;`,
    `${t(2)}const option = { label: effort.name };`,
    `${t(2)}return { label, option };`,
    '}',
    ''
  ].join('\n');

  const main = [
    'const en = { greeting: "Hello" };',
    'const zh = { greeting: "你好" };',
    '',
    '/** Resolve Electron\'s locale to one shipped Desktop dictionary. */',
    'function resolveDesktopLocale(locale) {',
    `${t(1)}return locale.toLowerCase().startsWith("zh") ? {`,
    `${t(2)}id: "zh-CN",`,
    `${t(2)}messages: zh`,
    `${t(1)}} : {`,
    `${t(2)}id: "en",`,
    `${t(2)}messages: en`,
    `${t(1)}};`,
    '}',
    '',
    'function chooseLocale(selected, primary) {',
    `${t(1)}if (selected === "zh" || selected === "en") return resolveDesktopLocale(selected);`,
    `${t(1)}if (primary === "zh" || primary === "en") return resolveDesktopLocale(primary);`,
    `${t(1)}return resolveDesktopLocale("en");`,
    '}',
    ''
  ].join('\n');

  write(path.join(root, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-locale', 'lib', 'client.js'), localeClient);
  write(path.join(root, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-model-selection', 'lib', 'client.js'), modelSelection);
  write(path.join(root, 'lib', 'main.js'), main);
}
