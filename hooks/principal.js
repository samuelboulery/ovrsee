/**
 * La garde d'entrée des hooks, en un appel.
 *
 * Douze fichiers finissaient sur la même ligne au caractère près — un hook
 * doit s'exécuter quand on l'appelle en ligne de commande, et se taire quand
 * un test l'importe. Chacun payait deux imports (`resolve`, `fileURLToPath`)
 * pour ce seul usage.
 *
 * `import.meta.main` ferait le travail nativement, mais il arrive en Node 24
 * et le projet déclare `node >= 22`.
 *
 * `resolve()` sur `process.argv[1]` n'est pas décoratif : un hook lancé par un
 * chemin relatif (`node hooks/ovrsee-notify.js`) ne se reconnaîtrait pas sans
 * lui. Et `fileURLToPath` plutôt qu'une comparaison de chaînes `file://…` :
 * une URL encode les espaces et les accents du chemin, pas le disque.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Le module dont on donne l'`import.meta.url` est-il le point d'entrée ?
 *
 * @param {string} moduleUrl `import.meta.url` du module appelant
 * @returns {boolean} vrai s'il a été lancé directement, faux s'il est importé
 */
export function estPrincipal(moduleUrl) {
  if (!process.argv[1]) return false
  return resolve(process.argv[1]) === fileURLToPath(moduleUrl)
}
