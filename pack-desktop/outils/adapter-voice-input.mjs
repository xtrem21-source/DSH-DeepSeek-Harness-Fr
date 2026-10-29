// Adapte le voice-input.js de la methodologie open-cowork-micro a DSH Desktop.
//
// Le script d'origine vise un <textarea> dans un <form> avec un
// button[type=submit]. DSH Desktop n'en a aucun des trois : le champ de saisie
// est un [contenteditable="true"], il n'y a pas de <form>, et le bouton
// d'envoi est un button[type="button"] dont l'aria-label vaut
// « Envoyer le message » (ou « Send message »).
//
// Ce script ne modifie JAMAIS le fichier source : il le lit, applique des
// remplacements verifies (chaque motif doit etre trouve exactement une fois,
// sinon on s'arrete), et ecrit le module client du livrable.
//
// Usage : node outils/adapter-voice-input.mjs <voice-input.js source>
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) {
  console.error('usage: node outils/adapter-voice-input.mjs <voice-input.js source>')
  process.exit(2)
}

const racine = fileURLToPath(new URL('..', import.meta.url))
const cible = join(racine, 'patch', 'plugins', 'dsh-voice-input', 'lib', 'client.js')

let code = await readFile(source, 'utf8')
// Le fichier source est en CRLF : on normalise pour que les motifs multi-lignes
// correspondent, et on ecrit le module en LF.
code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
const journal = []

/** Remplacement verifie : le motif doit apparaitre exactement une fois. */
function remplacer(intitule, motif, remplacement) {
  const occurrences = code.split(motif).length - 1
  if (occurrences !== 1) {
    console.error(`[${intitule}] motif trouve ${occurrences} fois (attendu 1) — adaptation annulee.`)
    process.exit(1)
  }
  code = code.replace(motif, remplacement)
  journal.push(intitule)
}

// 1. Trouver le champ de saisie : contenteditable d'abord, textarea ensuite.
remplacer(
  'findInput : contenteditable en priorite',
  `  function findInput() {
    var all = [].slice.call(document.querySelectorAll('textarea'));`,
  `  function findInput() {
    // DSH Desktop : le champ du compositeur est un contenteditable, sans textarea.
    var editables = [].slice.call(document.querySelectorAll('[contenteditable="true"]')).filter(isVisible);
    if (editables.length) return editables[editables.length - 1];
    var all = [].slice.call(document.querySelectorAll('textarea'));`,
)

// 2. Trouver le bouton d'envoi : pas de <form> dans DSH, on passe par l'aria-label.
remplacer(
  "findSubmitButton : aria-label quand il n'y a pas de form",
  `  function findSubmitButton() {
    var area = findInput();
    if (!area) return null;
    var form = area.closest && area.closest('form');
    if (!form) return null;
    return form.querySelector('button[type="submit"]');
  }`,
  `  function findSubmitButton() {
    var area = findInput();
    if (!area) return null;
    // 1) cas d'origine : un <form> avec un bouton submit.
    var form = area.closest && area.closest('form');
    if (form) {
      var parForm = form.querySelector('button[type="submit"]');
      if (parForm) return parForm;
    }
    // 2) DSH Desktop : button[type=button] dont l'aria-label nomme l'envoi.
    //    On n'utilise PAS isVisible ici : il exclut les boutons disabled, or
    //    celui de DSH est desactive tant que le champ de saisie est vide, et
    //    il reste l'ancre a viser. On ne teste donc que la presence visuelle.
    var boutons = [].slice.call(document.querySelectorAll('button')).filter(function (b) {
      return !!b && b.offsetParent !== null;
    });
    var parLabel = boutons.filter(function (b) {
      var etiquette = (b.getAttribute('aria-label') || '') + ' ' + (b.title || '');
      return /envoyer( le)? message|send message|^\\s*send\\s*$/i.test(etiquette.trim());
    });
    if (parLabel.length) return parLabel[parLabel.length - 1];
    // 3) dernier recours : un bouton submit visible.
    var submits = boutons.filter(function (b) { return b.type === 'submit'; });
    return submits.length ? submits[submits.length - 1] : null;
  }`,
)

// 3. Insertion du texte : le setter de textarea ne s'applique pas a un contenteditable.
remplacer(
  'insertText : gestion du contenteditable',
  `  function insertText(text) {
    var el = findInput();
    if (!el) return false;
    var prev = el.value || '';
    var next = prev.trim() ? prev.replace(/\\s+$/, '') + ' ' + text : text;
    try {
      var proto = Object.getPrototypeOf(el);
      var desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(el, next); else el.value = next;
    } catch (e) {
      el.value = next;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try { el.focus(); } catch (e) {}
    return true;
  }`,
  `  function insertText(text) {
    var el = findInput();
    if (!el) return false;

    // Contenteditable (DSH Desktop) : execCommand passe par le chemin natif du
    // navigateur, donc React voit un vrai evenement "input" et garde l'editeur
    // et son etat interne synchronises. On place le curseur en fin de contenu.
    if (el.isContentEditable) {
      try { el.focus(); } catch (e) {}
      try {
        var portee = document.createRange();
        portee.selectNodeContents(el);
        portee.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(portee);
      } catch (e) { logWarn('insertText: selection de fin impossible', e); }
      var existant = (el.textContent || '').trim();
      var aInserer = existant ? ' ' + text : text;
      var fait = false;
      try { fait = document.execCommand('insertText', false, aInserer); } catch (e) { fait = false; }
      if (!fait) {
        // Repli : ecriture directe + evenement input (React lit le DOM).
        try {
          el.textContent = existant ? existant + ' ' + text : text;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: aInserer, inputType: 'insertText' }));
        } catch (e) { logErr('insertText: ecriture directe impossible', e); return false; }
      }
      return true;
    }

    // Textarea classique : setter natif puis evenement input.
    var prev = el.value || '';
    var next = prev.trim() ? prev.replace(/\\s+$/, '') + ' ' + text : text;
    try {
      var proto = Object.getPrototypeOf(el);
      var desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(el, next); else el.value = next;
    } catch (e) {
      el.value = next;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try { el.focus(); } catch (e) {}
    return true;
  }`,
)

// 4. Attente du DOM : accepter le contenteditable comme zone de saisie prete.
remplacer(
  'init : contenteditable accepte comme zone de saisie',
  `    var hasArea = !!document.querySelector('textarea');`,
  `    var hasArea = !!document.querySelector('textarea, [contenteditable="true"]');`,
)

// 5. Le panneau parle d'Open Cowork : dans DSH il n'y a aucune cle deja
//    configuree ailleurs, la cle est obligatoire.
remplacer(
  'panneau : consigne de cle adaptee a DSH',
  `      '<div class="ocv-hint">Laissez vide pour utiliser la clé Gemini déjà configurée dans Open Cowork.<br>' +`,
  `      '<div class="ocv-hint">Obligatoire : collez votre clé API Gemini. Elle est stockée uniquement sur cet ordinateur.<br>' +`,
)

const moduleClient = `// Genere par outils/adapter-voice-input.mjs depuis la methodologie
// open-cowork-micro (PATCH-VOIX/voice-input.js). Ne pas modifier a la main :
// corrigez le generateur ou le source, puis relancez-le.
//
// Adaptations apportees pour DSH Desktop (${journal.length}) :
${journal.map((n) => `//   - ${n}`).join('\n')}
window.__ModuleLoader__.load({
  id: 'dsh-voice-input',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const inject = []

    function apply() {
${code}
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
`

await writeFile(cible, moduleClient, 'utf8')
console.log(`module client ecrit : ${cible}`)
console.log(`adaptations appliquees : ${journal.length}`)
for (const n of journal) console.log(`  - ${n}`)
