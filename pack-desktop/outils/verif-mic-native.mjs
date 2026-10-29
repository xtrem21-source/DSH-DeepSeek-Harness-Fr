// Verifie si l'application gere deja la permission microphone nativement.
// Lit le blob lib/main.js de l'asar et teste la presence de la fonction
// installMicrophonePermissions (qui installe permission check + request).
// Sortie : 0 = permission native presente (pas besoin de patcher l'asar),
//          1 = absente (le patch asar historique serait requis).
// Usage : node outils/verif-mic-native.mjs <chemin app.asar>
import { open } from 'node:fs/promises'

const chemin = process.argv[2]
const CIBLE = 'lib/main.js'
if (!chemin) { console.error('usage: node outils/verif-mic-native.mjs <app.asar>'); process.exit(2) }

const fh = await open(chemin, 'r')
try {
  const entete = Buffer.alloc(16)
  await fh.read(entete, 0, 16, 0)
  const base = 8 + entete.readUInt32LE(4)
  const tailleJson = entete.readUInt32LE(12)
  const bufJson = Buffer.alloc(tailleJson)
  await fh.read(bufJson, 0, tailleJson, 16)
  const index = JSON.parse(bufJson.toString('utf8'))

  let noeud = index
  for (const part of CIBLE.split('/')) {
    if (!noeud.files || !noeud.files[part]) { console.error(`absent de l'archive : ${CIBLE}`); process.exit(1) }
    noeud = noeud.files[part]
  }
  const blob = Buffer.alloc(noeud.size)
  await fh.read(blob, 0, noeud.size, base + Number(noeud.offset))
  const txt = blob.toString('utf8')

  const aCheck = txt.includes('setPermissionCheckHandler')
  const aReq = txt.includes('setPermissionRequestHandler')
  const aInstall = txt.includes('installMicrophonePermissions')
  const native = aCheck && aReq && aInstall
  console.log(`permission check handler : ${aCheck}`)
  console.log(`permission request handler: ${aReq}`)
  console.log(`installMicrophonePermissions: ${aInstall}`)
  console.log(`permission micro NATIVE   : ${native}`)
  process.exit(native ? 0 : 1)
} finally { await fh.close() }