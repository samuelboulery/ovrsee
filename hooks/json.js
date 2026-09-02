/**
 * Lire un fichier JSON dont l'absence, l'illisibilité et la corruption se valent.
 *
 * Sept endroits réécrivaient ce `try` / `JSON.parse` / `catch → défaut`, et le
 * contrat était déjà écrit plusieurs fois dans le dépôt : « un fichier corrompu
 * ou absent rend le défaut complet, jamais une exception ». Il vit ici, une fois.
 *
 * Ce module ne dépend que de `node:fs` — c'est ce qui permet à `hooks/`,
 * `crawl/` et `electron/` de l'importer sans traîner le reste derrière.
 */

import { readFileSync } from 'node:fs'

/**
 * Le contenu JSON du fichier, ou le défaut.
 *
 * Le défaut est **cloné** : un appelant qui mute ce qu'il reçoit ne doit pas
 * empoisonner l'appel suivant. C'est la raison du `structuredClone` de
 * `readSettings()`, et elle vaut ici pour les mêmes raisons.
 *
 * Ce qui n'entre pas dans ce moule reste dehors : lire du texte (`skills.js`),
 * ou avoir besoin du message d'erreur de `JSON.parse` (`install.js`, qui
 * restaure sa sauvegarde en le citant).
 *
 * @template T
 * @param {string} path chemin du fichier
 * @param {T} [defaut=null] ce que rend une lecture qui échoue
 * @returns {T} la valeur lue, ou une copie du défaut
 */
export function readJson(path, defaut = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return structuredClone(defaut)
  }
}
