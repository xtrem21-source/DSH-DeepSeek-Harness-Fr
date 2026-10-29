// Assemble lib/client.js du pack de langue.
//
// Deux sources :
//   fr/<namespace>.json   les dictionnaires enregistres dans le service locale
//   fr/_correctifs.json   les libelles qu'aucun dictionnaire ne couvre
//
// Le second cas existe parce que certains paquets de l'editeur n'utilisent pas
// le service de traduction : le shell Workbenches choisit entre le chinois et
// l'anglais selon que la langue active commence par « en » ou non. En francais
// il retombe donc sur le chinois. Un observateur du DOM retablit ces libelles
// a partir d'une table chinois -> francais et anglais -> francais.
//
// Usage : node outils/assembler-fr.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('..', import.meta.url))
const dossierFr = join(racine, 'patch', 'plugins', 'dsh-fr-locale', 'fr')
const cible = join(racine, 'patch', 'plugins', 'dsh-fr-locale', 'lib', 'client.js')

const fichiers = (await readdir(dossierFr)).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()
const dictionnaires = {}
let total = 0
for (const fichier of fichiers) {
  const ns = fichier.replace(/\.json$/, '')
  const contenu = JSON.parse(await readFile(join(dossierFr, fichier), 'utf8'))
  dictionnaires[ns] = contenu
  total += Object.keys(contenu).length
}

const correctifs = JSON.parse(await readFile(join(dossierFr, '_correctifs.json'), 'utf8'))
const tableCorrectifs = { ...(correctifs.zh ?? {}), ...(correctifs.en ?? {}) }
const nbCorrectifs = Object.keys(tableCorrectifs).length
// Regles par motif : pour les libelles qui contiennent une partie variable
// (compteurs, noms de workbenches) et ne peuvent pas etre compares a l'identique.
const motifs = Array.isArray(correctifs.motifs) ? correctifs.motifs : []
const blocMotifs = motifs
  .map(m => `      [new RegExp(${JSON.stringify(m.cherche)}), ${JSON.stringify(m.remplace)}]`)
  .join(',\n')

// Cles contenant des ideogrammes, triees du plus long au plus court : servent a
// traduire un nom propre reste a l'interieur d'une phrase produite par un motif
// (ex. « Voir les details de <nom chinois> »).
const clesLongues = Object.keys(tableCorrectifs)
  .filter(k => /[\u4e00-\u9fff]/.test(k))
  .sort((a, b) => b.length - a.length)

const indent = (obj, pad) =>
  Object.entries(obj)
    .map(([cle, valeur]) => `${pad}${JSON.stringify(cle)}: ${JSON.stringify(valeur)}`)
    .join(',\n')

const bloc = Object.entries(dictionnaires)
  .map(([ns, dict]) => `    ${JSON.stringify(ns)}: {\n${indent(dict, '      ')}\n    }`)
  .join(',\n')

const source = `// Généré par outils/assembler-fr.mjs — ne pas modifier à la main.
// Pack de langue française : ${fichiers.length} namespaces (${total} chaînes),
// plus ${nbCorrectifs} libellés corrigés hors service de traduction.
window.__ModuleLoader__.load({
  id: "dsh-fr-locale",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

    const LANGUE = { id: "fr", label: "Français", fallback: "en" }

    const DICTIONNAIRES = {
${bloc}
    }

    // Libellés écrits en dur par le shell (chinois d'origine, plus quelques
    // chaînes anglaises de l'ossature). Clés et valeurs sont exactes.
    const CORRECTIFS = {
${indent(tableCorrectifs, '      ')}
    }

    // Libelles variables : compteurs, noms de workbenches, etc.
    const MOTIFS = [
${blocMotifs}
    ]

    const ATTRIBUTS = ["title", "aria-label", "placeholder", "alt"]

    // Traduit un texte exact ou par motif ; rend null quand rien ne correspond.
    const CLES_LONGUES = ${JSON.stringify(clesLongues)}
    const IDEOGRAMME = /[\u4e00-\u9fff]/

    const traduire = (texte) => {
      if (typeof texte !== "string") return null
      const cle = texte.trim()
      if (!cle) return null
      // Conserve les espaces de bordure du noeud d'origine.
      const debut = texte.indexOf(cle)
      const avant = texte.slice(0, debut)
      const apres = texte.slice(debut + cle.length)

      const exact = CORRECTIFS[cle]
      if (exact !== undefined && exact !== cle) return avant + exact + apres

      let resultat = null
      for (let i = 0; i < MOTIFS.length; i++) {
        const regle = MOTIFS[i]
        if (!regle[0].test(cle)) continue
        const remplace = cle.replace(regle[0], regle[1])
        if (remplace !== cle) {
          resultat = remplace
          break
        }
      }
      if (resultat === null) return null

      // Le motif peut laisser un nom propre chinois a l'interieur de la phrase.
      if (IDEOGRAMME.test(resultat)) {
        for (let i = 0; i < CLES_LONGUES.length; i++) {
          const k = CLES_LONGUES[i]
          if (resultat.indexOf(k) === -1) continue
          resultat = resultat.split(k).join(CORRECTIFS[k])
        }
      }
      return avant + resultat + apres
    }

    const inject = ["locale"]

    function apply(ctx) {
      ctx.effect(() => ctx.locale.addLanguage(LANGUE), "dsh-fr-locale: langue")
      for (const ns of Object.keys(DICTIONNAIRES)) {
        ctx.effect(() => ctx.locale.register(ns, LANGUE.id, DICTIONNAIRES[ns]), \`dsh-fr-locale: \${ns}\`)
      }

      // ---- correction des libellés hors service de traduction ----
      if (typeof document === "undefined" || typeof MutationObserver === "undefined") return

      const actif = () => {
        try {
          const service = ctx.locale
          const etat =
            typeof service.getSnapshot === "function"
              ? service.getSnapshot()
              : typeof service.snapshot === "function"
                ? service.snapshot()
                : service.snapshot
          return !!etat && etat.active === LANGUE.id
        } catch {
          return false
        }
      }

      let observateur = null
      let corrections = 0

      const traiterTexte = (noeud) => {
        const remplace = traduire(noeud.nodeValue)
        if (remplace !== null && remplace !== noeud.nodeValue) {
          noeud.nodeValue = remplace
          corrections++
        }
      }

      const traiterAttributs = (element) => {
        for (const nom of ATTRIBUTS) {
          const valeur = element.getAttribute(nom)
          if (!valeur) continue
          const remplace = traduire(valeur)
          if (remplace !== null) element.setAttribute(nom, remplace)
        }
      }

      const parcourir = (racine) => {
        if (racine.nodeType === 3) {
          traiterTexte(racine)
          return
        }
        if (racine.nodeType !== 1) return
        traiterAttributs(racine)
        const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
        let courant = marcheur.currentNode
        while (courant) {
          if (courant.nodeType === 3) traiterTexte(courant)
          else traiterAttributs(courant)
          courant = marcheur.nextNode()
        }
      }

      const surMutation = (mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") {
            traiterTexte(mutation.target)
            continue
          }
          for (const ajout of mutation.addedNodes) parcourir(ajout)
          if (mutation.type === "attributes" && mutation.target) traiterAttributs(mutation.target)
        }
      }

      const demarrer = () => {
        if (observateur || !actif()) return
        if (!document.body) return
        parcourir(document.body)
        observateur = new MutationObserver(surMutation)
        observateur.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ATTRIBUTS,
        })
      }

      const arreter = () => {
        if (!observateur) return
        observateur.disconnect()
        observateur = null
      }

      // La bascule de langue est immédiate : on suit le service locale.
      const rafraichir = () => {
        if (actif()) demarrer()
        else arreter()
        globalThis.__dshFr = {
          langue: (() => {
            try {
              const s = ctx.locale
              const etat = typeof s.getSnapshot === "function" ? s.getSnapshot() : s.snapshot
              return etat && etat.active
            } catch {
              return "?"
            }
          })(),
          actif: actif(),
          observateur: !!observateur,
          corrections,
          table: Object.keys(CORRECTIFS).length,
        }
      }

      ctx.effect(() => {
        rafraichir()
        const service = ctx.locale
        const arret = typeof service.subscribe === "function" ? service.subscribe(rafraichir) : () => {}
        // Le corps du document peut ne pas exister encore au chargement du module.
        const surPret = () => rafraichir()
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", surPret, { once: true })
        }
        const minuteur = setTimeout(rafraichir, 1500)
        return () => {
          clearTimeout(minuteur)
          document.removeEventListener("DOMContentLoaded", surPret)
          arret()
          arreter()
        }
      }, "dsh-fr-locale: correctifs")
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
`

await writeFile(cible, source, 'utf8')
console.log(`client.js généré : ${fichiers.length} namespaces, ${total} chaînes, ${nbCorrectifs} correctifs hors service`)
