// Moitie hote du bouton micro.
//
// Tout le travail se fait dans le navigateur (lib/client.js) : le bouton, le
// panneau de reglages au clic droit et l'appel a l'API Gemini. Ce module ne
// monte aucun service ; il existe parce que le loader exige une entree hote
// valide pour exposer un module client.
//
// Ce paquet remplace le micro natif de l'editeur (bundle
// dsh-experimental-voice-input-bundle), qui n'offre ni clic droit ni saisie
// directe de la cle : les deux ensemble feraient deux boutons micro.
export const name = 'dsh-voice-input'

export function apply() {
  // Aucun service hote : la saisie vocale est entierement cote client.
}
