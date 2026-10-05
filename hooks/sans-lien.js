/**
 * Écrire sous `ovrsee/` sans jamais suivre un lien symbolique.
 *
 * git versionne les liens symboliques : un dépôt observé hostile les livre en
 * place dès le `git clone`, n'importe où sous `ovrsee/` — sur un fichier
 * (`pages/scans.jsonl -> ../../.git/hooks/post-commit`) comme sur un dossier
 * (`ovrsee -> ~`). Une écriture qui suit le lien sort du dépôt ; une
 * suppression qui le suit efface chez l'utilisateur. Un lien à ces endroits
 * n'a aucune raison légitime d'exister : on refuse, on ne répare pas.
 */

import { closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/**
 * Lève si `path`, ou l'un de ses dossiers jusqu'au `ovrsee/` du dépôt compris,
 * est un lien symbolique. Un composant absent n'est pas un lien.
 *
 * Le `ovrsee/` du dépôt est celui dont le parent porte un `.git` — repère que
 * le dépôt observé ne peut pas planter, git refusant de versionner `.git`. Un
 * simple nom ne suffit pas : la route `/ovrsee` donne `shots/ovrsee/`, et s'y
 * arrêter laissait `pages/` et `ovrsee/` sans contrôle.
 *
 * Au-dessus, c'est le chemin du dépôt sur le poste, que l'utilisateur choisit
 * — `/tmp` est lui-même un lien sous macOS. Hors d'un dépôt (`~/.claude/ovrsee`,
 * qu'un gestionnaire de dotfiles peut lier), seul le dossier immédiat est
 * vérifié, comme `writeFileNoFollow` l'a toujours fait.
 *
 * @param {string} path
 */
export function assurerSansLien(path) {
  const chemins = [path]
  let racine = false
  for (let d = dirname(path); d !== dirname(d); d = dirname(d)) {
    chemins.push(d)
    if (basename(d) === 'ovrsee' && existsSync(join(dirname(d), '.git'))) {
      racine = true
      break
    }
  }
  if (!racine) chemins.splice(2)

  for (const c of chemins) {
    let st
    try {
      st = lstatSync(c)
    } catch {
      continue
    }
    if (st.isSymbolicLink()) throw new Error(`refus d'écrire : ${c} est un lien symbolique`)
  }
}

/**
 * `appendFileSync` qui refuse un lien, sur la cible comme sur ses dossiers.
 *
 * `O_NOFOLLOW` ferme la course entre la vérification et l'ouverture là où le
 * système le connaît ; Windows ne l'a pas, et y créer un lien demande déjà un
 * privilège — la vérification préalable y suffit.
 *
 * @param {string} path
 * @param {string} content
 */
export function appendFileNoFollow(path, content) {
  assurerSansLien(path)
  mkdirSync(dirname(path), { recursive: true })
  assurerSansLien(path)

  const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0)
  let fd
  try {
    fd = openSync(path, flags, 0o644)
  } catch (err) {
    if (err?.code === 'ELOOP') throw new Error(`refus d'écrire : ${path} est un lien symbolique`)
    throw err
  }
  try {
    writeSync(fd, content)
  } finally {
    closeSync(fd)
  }
}
