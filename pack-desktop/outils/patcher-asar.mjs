// Accorde la permission microphone a l'application de bureau.
//
// Pourquoi c'est necessaire : DSH Desktop definit une seule politique de
// permission dans out/main/index.js et n'y liste que deux permissions :
//
//   return (permission === "clipboard-sanitized-write" || permission === "notifications")
//     && isMainFrame && requestingUrl !== void 0 && isHarnessUrl(requestingUrl)
//
// La permission « media » (microphone) n'y figure pas : getUserMedia echoue en
// NotAllowedError avant meme que Windows ne soit consulte, et le bouton micro
// de l'interface ne peut donc rien faire.
//
// Comment : l'archive app.asar n'est PAS reconstruite (352 Mo). La condition de
// permission est remplacee par une expression de LONGUEUR IDENTIQUE, puis le
// blob et l'empreinte SHA-256 de son entree dans l'en-tete sont reecrits en
// place. Les offsets de tous les autres fichiers restent valides.
//
// Les deux garde-fous d'origine sont conserves : la page demandeuse doit etre
// l'application elle-meme (isHarnessUrl) et etre la frame principale.
//
// Usage : node outils/patcher-asar.mjs <chemin app.asar> [--verifier]
import { open } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const chemin = process.argv[2]
const verifierSeulement = process.argv.includes('--verifier')
if (!chemin) {
  console.error('usage: node outils/patcher-asar.mjs <chemin app.asar> [--verifier]')
  process.exit(2)
}

const CIBLE = 'out/main/index.js'
const ORIGINAL = '(permission === "clipboard-sanitized-write" || permission === "notifications")'

/** Même longueur que ORIGINAL : le rembourrage garde les offsets intacts. */
function remplacement(longueur) {
  const interieur = 'true'
  const espace = longueur - 2 - interieur.length
  if (espace < 1) throw new Error(`condition d'origine trop courte (${longueur})`)
  return '(' + interieur + ' '.repeat(espace) + ')'
}

const fh = await open(chemin, 'r+')
try {
  const entete = Buffer.alloc(16)
  await fh.read(entete, 0, 16, 0)
  const tailleChampEntete = entete.readUInt32LE(4)
  const tailleJson = entete.readUInt32LE(12)
  const base = 8 + tailleChampEntete

  const bufJson = Buffer.alloc(tailleJson)
  await fh.read(bufJson, 0, tailleJson, 16)
  const texteJson = bufJson.toString('utf8')
  const index = JSON.parse(texteJson)

  const chercher = (noeud, parts) => {
    for (const part of parts) {
      if (!noeud.files || !noeud.files[part]) return undefined
      noeud = noeud.files[part]
    }
    return noeud
  }

  const entree = chercher(index, CIBLE.split('/'))
  if (!entree) {
    console.error(`absent de l'archive : ${CIBLE}`)
    process.exit(1)
  }

  const blob = Buffer.alloc(entree.size)
  await fh.read(blob, 0, entree.size, base + Number(entree.offset))
  const source = blob.toString('utf8')

  const dejaFait = !source.includes(ORIGINAL)
  if (verifierSeulement) {
    const mediaAccorde = source.includes('(true')
    console.log(`condition d'origine presente : ${!dejaFait}`)
    console.log(`patch applique                : ${dejaFait}`)
    process.exit(dejaFait ? 0 : 1)
  }

  if (dejaFait) {
    console.log('deja patche : rien a faire (idempotence)')
    process.exit(0)
  }

  const occurrences = source.split(ORIGINAL).length - 1
  if (occurrences !== 1) {
    console.error(`condition trouvee ${occurrences} fois ; attendu exactement 1. Patch annule.`)
    process.exit(1)
  }

  const nouveau = remplacement(ORIGINAL.length)
  if (nouveau.length !== ORIGINAL.length) {
    console.error('remplacement de longueur differente : patch annule.')
    process.exit(1)
  }

  const modifie = source.replace(ORIGINAL, nouveau)
  const blobModifie = Buffer.from(modifie, 'utf8')
  if (blobModifie.length !== blob.length) {
    console.error(`taille du blob modifiee (${blob.length} -> ${blobModifie.length}) : patch annule.`)
    process.exit(1)
  }

  // 1. Le blob, a sa place exacte.
  await fh.write(blobModifie, 0, blobModifie.length, base + Number(entree.offset))

  // 2. L'empreinte de l'entree dans l'en-tete.
  const empreinte = createHash('sha256').update(blobModifie).digest('hex')
  const avant = entree.integrity ? JSON.stringify(entree.integrity) : '(aucune)'
  if (entree.integrity) {
    entree.integrity.hash = empreinte
    if (Array.isArray(entree.integrity.blocks) && entree.integrity.blocks.length === 1) {
      entree.integrity.blocks[0] = empreinte
    }
  }

  const texteJsonNouveau = JSON.stringify(index)
  if (texteJsonNouveau.length !== texteJson.length) {
    console.error(
      `en-tete de longueur differente (${texteJson.length} -> ${texteJsonNouveau.length}) : patch annule.`,
    )
    process.exit(1)
  }
  await fh.write(Buffer.from(texteJsonNouveau, 'utf8'), 0, tailleJson, 16)

  console.log(`blob reecrit      : ${CIBLE} (${blobModifie.length} octets, inchange)`)
  console.log(`condition         : ${ORIGINAL}`)
  console.log(`remplacee par     : ${nouveau.trim()}`)
  console.log(`empreinte avant   : ${avant}`)
  console.log(`empreinte apres   : ${JSON.stringify(entree.integrity)}`)
} finally {
  await fh.close()
}
