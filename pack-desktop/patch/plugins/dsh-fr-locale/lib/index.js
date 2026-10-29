// Moitie hote du pack de langue francaise.
//
// Le travail de traduction vit entierement cote navigateur (lib/client.js) :
// ce module ne monte aucun service, il ne sert qu'a rendre le paquet
// installable et visible du loader, qui exige une entree hote valide.
export const name = 'dsh-fr-locale'

export function apply() {
  // Aucun service hote : la langue est un service du client.
}
