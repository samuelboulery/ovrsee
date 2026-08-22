/**
 * Le garde-fou partagé entre la donnée du serveur et ce que l'interface suppose.
 */
/**
 * La frontière entre ce que le serveur a envoyé et ce que l'interface suppose.
 *
 * Les types disent qu'un instantané a des tableaux ; le disque, lui, ne promet
 * rien — un `pages.json` écrit par un crawl interrompu, un champ ajouté après
 * coup, un fichier édité à la main. Le 9 août 2026, un champ qui n'était pas
 * un tableau a vidé toute l'application.
 *
 * Chaque dérivation passe donc par ici plutôt que de se fier à sa signature.
 * Un tableau vide dit « rien à montrer », ce que chaque onglet sait déjà
 * afficher ; une exception dit « écran noir ».
 */
export const liste = <T,>(valeur: T[] | null | undefined): T[] => (Array.isArray(valeur) ? valeur : [])
