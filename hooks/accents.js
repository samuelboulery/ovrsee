/**
 * La palette fermée des accents de projet (T-0215, issue #48).
 *
 * Ne porte que des identifiants : **aucune valeur hex ici**. Les couleurs
 * vivent dans `_ds/ovrsee/styles.css`, un bloc `[data-accent='…']` par teinte,
 * et l'interface ne fait que poser l'identifiant sur l'élément racine. C'est ce
 * qui garde `hooks/couleurs.test.js` vert sans nouvelle exemption, et ce qui
 * fait qu'ajouter une teinte est un geste de design system, pas de code.
 *
 * La liste est fermée parce qu'un accent choisi au hasard casse le contraste
 * sur le fond sombre — `hooks/accents.test.js` mesure celui de chaque teinte.
 */

/** Le violet en tête : c'est le défaut, celui du `:root` d'origine. */
export const ACCENTS = ['violet', 'ambre', 'vert', 'cyan', 'rose', 'orange']

/**
 * Le défaut ne s'écrit pas dans le registre : il s'y retire.
 * Un poste qui n'a rien personnalisé garde donc un registre identique.
 */
export const ACCENT_DEFAUT = 'violet'

/**
 * @param {unknown} valeur
 * @returns {string|null} l'accent s'il est admis, `null` sinon — jamais une
 * exception : la valeur vient d'un fichier qu'on ne contrôle pas.
 */
export const validerAccent = valeur =>
  typeof valeur === 'string' && ACCENTS.includes(valeur) ? valeur : null
