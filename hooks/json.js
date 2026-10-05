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

import { readFileSync, realpathSync, statSync } from 'node:fs'
import { sep } from 'node:path'

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

/**
 * Un chemin est-il sous un dossier ?
 *
 * Le `sep` final n'est pas une coquetterie : `/a/b-secret` commence par `/a/b`,
 * et `join('/a/b', '../b-secret/x.png')` produit exactement ce chemin-là. Sans
 * le séparateur, la garde laisse passer le dossier voisin.
 */
export const inside = (base, file) => file.startsWith(base.endsWith(sep) ? base : base + sep)

/**
 * Le chemin réel de `file` s'il désigne un fichier ordinaire sous `base`, sinon null.
 *
 * Le contrôle de préfixe porte sur le texte du chemin ; un lien symbolique
 * versionné par le dépôt (`shots/x.png -> ~/.ssh/id_ed25519`, `README.md ->
 * ~/.aws/credentials`) le passe et mène dehors. On compare donc les chemins
 * réels. Et un dossier n'est pas un fichier : `createReadStream` levait EISDIR,
 * sans écouteur, et le dev server tombait sur un simple GET.
 */
export function fichierDuDepot(base, file) {
  try {
    const reel = realpathSync(file)
    if (!inside(realpathSync(base), reel) || !statSync(reel).isFile()) return null
    return reel
  } catch {
    return null // Absent, ou illisible : rien à servir.
  }
}


/**
 * `readJson`, mais jamais à travers un lien qui sort de `base` — la racine du
 * dépôt observé. `ovrsee/board.json` lié vers un fichier du poste en rendait
 * le contenu à l'interface et au MCP (T-0274).
 *
 * @param {string} base
 * @param {string} file chemin absolu sous `base`
 * @param {unknown} [defaut]
 */
export function readJsonDuDepot(base, file, defaut = null) {
  const reel = fichierDuDepot(base, file)
  return reel ? readJson(reel, defaut) : structuredClone(defaut)
}
