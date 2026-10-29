// Extrait le catalogue du marche des workbenches pour preparer une traduction
// francaise des champs affiches (nom + description).
//
// Le catalogue porte name (zh), nameEn, et description = { zh, en? }. En
// francais, le paquet retombe sur le chinois : on construit donc la table
// chinois -> francais qui sera injectee dans le pack de langue.
import { readFile, writeFile } from 'node:fs/promises'

const source = process.argv[2]
const sortie = process.argv[3]
if (!source || !sortie) {
  console.error('usage: node extraire-catalogue.mjs <workbench-catalog-cache.json> <sortie.json>')
  process.exit(2)
}

const brut = JSON.parse(await readFile(source, 'utf8'))
const catalogue = brut.catalog ?? brut
const entrees = catalogue.workbenches ?? []

const utiles = entrees.map((e) => ({
  id: e.id,
  nom_zh: e.name,
  nom_en: e.nameEn ?? null,
  desc_zh: e.description?.zh ?? null,
  desc_en: e.description?.en ?? null,
  categorie: e.category ?? null,
}))

const categories = Object.entries(catalogue.categories ?? {}).map(([cle, v]) => ({
  cle,
  libelle_zh: v?.zh ?? null,
  libelle_en: v?.en ?? null,
}))

await writeFile(sortie, JSON.stringify({ workbenches: utiles, categories }, null, 1), 'utf8')
console.log(`workbenches : ${utiles.length}`)
console.log(`categories : ${categories.length}`)
const sansEn = utiles.filter((u) => !u.desc_en).length
console.log(`sans description anglaise : ${sansEn}`)
