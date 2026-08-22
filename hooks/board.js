/**
 * Les colonnes du tableau : `<repo>/ovrsee/board.json`.
 *
 * Domaine séparé de `tickets.js` : une colonne se lit et s'écrit sans jamais
 * toucher un ticket, et l'inverse n'est pas vrai — un ticket cite toujours une
 * colonne. La dépendance va donc dans un seul sens, `tickets.js` importe d'ici.
 *
 * L'identifiant d'une colonne ne change jamais après sa création : c'est lui
 * que les tickets citent. Renommer ne porte que sur le titre.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { slugify, writeFileNoFollow } from './plans.js'

/**
 * Le tableau par défaut, servi tant que le projet n'a pas de `board.json`.
 *
 * Six colonnes : un backlog qui accumule, deux étapes de préparation (une
 * intention brute n'est pas exécutable en l'état), puis l'avancement.
 */
export const DEFAULT_COLUMNS = [
  { id: 'backlog', titre: 'Backlog' },
  { id: 'a-specifier', titre: 'À spécifier' },
  { id: 'pret', titre: 'Prêt' },
  { id: 'en-cours', titre: 'En cours', wip: 3 },
  { id: 'revue', titre: 'Revue' },
  { id: 'fait', titre: 'Fait' },
]

/**
 * Les colonnes du projet, ou les colonnes par défaut.
 *
 * Un `board.json` douteux ne fait pas échouer la lecture : il est ignoré au
 * profit des défauts. Un tableau dont deux colonnes portent le même `id` est
 * pire qu'un tableau standard — les tickets s'y répartiraient au hasard.
 *
 * @param {string} ovrseeDir chemin de `<repo>/ovrsee`
 * @returns {Array<{id: string, titre: string, wip?: number}>}
 */
export function readBoard(ovrseeDir) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(ovrseeDir, 'board.json'), 'utf8'))
  } catch {
    return DEFAULT_COLUMNS
  }

  const colonnes = parsed?.colonnes
  if (!Array.isArray(colonnes) || colonnes.length === 0) return DEFAULT_COLUMNS

  const ids = new Set()
  for (const colonne of colonnes) {
    const id = colonne?.id
    if (typeof id !== 'string' || id.length === 0 || ids.has(id)) return DEFAULT_COLUMNS
    ids.add(id)
  }

  return colonnes
}

/**
 * Écrit les colonnes après les avoir validées.
 *
 * La validation est le miroir exact de ce que `readBoard` sait relire : un
 * board écrit ici et refusé à la relecture ferait disparaître le tableau au
 * profit des défauts, sans un mot. Mieux vaut refuser l'écriture et le dire.
 *
 * @param {Array<{id: string, titre: string, wip?: number}>} colonnes
 * @returns {Array} les colonnes écrites
 */
export function writeBoard(ovrseeDir, colonnes) {
  if (!Array.isArray(colonnes) || colonnes.length === 0) {
    throw new Error('un tableau sans colonne serait vide : au moins une colonne est requise')
  }

  const vus = new Set()
  const propres = colonnes.map(colonne => {
    const id = String(colonne?.id ?? '')
    if (!id) throw new Error('colonne sans identifiant')
    if (vus.has(id)) throw new Error(`l'identifiant ${id} apparaît deux fois`)
    vus.add(id)

    const titre = String(colonne?.titre ?? '').trim()
    if (!titre) throw new Error(`colonne ${id} sans titre`)

    const wip = colonne?.wip
    if (wip === undefined || wip === null) return { id, titre }
    if (!Number.isInteger(wip) || wip < 1) {
      throw new Error(`limite wip invalide pour ${id} : un entier positif ou rien`)
    }
    return { id, titre, wip }
  })

  writeFileNoFollow(join(ovrseeDir, 'board.json'), JSON.stringify({ colonnes: propres }, null, 2) + '\n')
  return propres
}

/**
 * Un identifiant de colonne, dérivé du titre et jamais repris.
 *
 * L'identifiant n'est pas modifiable après coup, et c'est délibéré : c'est lui
 * que les tickets citent. Le renommage porte sur le titre seul, ce qui rend la
 * classe entière des tickets orphelins impossible.
 */
const nouvelId = (titre, pris) => {
  const base = slugify(titre)
  if (!pris.has(base)) return base

  for (let n = 2; ; n += 1) {
    const candidat = `${base}-${n}`
    if (!pris.has(candidat)) return candidat
  }
}

/**
 * Ajoute une colonne.
 * @param {{titre: string, wip?: number|null, apres?: string}} champs `apres` est
 *   l'identifiant de la colonne après laquelle insérer ; à la fin par défaut.
 */
export function addColumn(ovrseeDir, { titre, wip = null, apres } = {}) {
  const colonnes = readBoard(ovrseeDir)
  const propre = String(titre ?? '').trim()
  if (!propre) throw new Error('titre vide')

  const ajoutee = { id: nouvelId(propre, new Set(colonnes.map(c => c.id))), titre: propre }
  if (wip !== null && wip !== undefined) ajoutee.wip = wip

  const at = colonnes.findIndex(c => c.id === apres)
  const suite = at === -1 ? [...colonnes, ajoutee] : colonnes.toSpliced(at + 1, 0, ajoutee)

  return writeBoard(ovrseeDir, suite)
}

/**
 * Renomme une colonne, ou change sa limite. L'identifiant ne bouge pas — donc
 * aucun ticket n'est touché.
 *
 * @param {{titre?: string, wip?: number|null}} champs `wip: null` retire la limite.
 */
export function renameColumn(ovrseeDir, id, champs = {}) {
  const colonnes = readBoard(ovrseeDir)
  if (!colonnes.some(c => c.id === id)) throw new Error(`colonne inconnue : ${id}`)

  return writeBoard(
    ovrseeDir,
    colonnes.map(colonne => {
      if (colonne.id !== id) return colonne

      const suivante = { ...colonne }
      if (champs.titre !== undefined) suivante.titre = champs.titre
      if (champs.wip !== undefined) {
        if (champs.wip === null) delete suivante.wip
        else suivante.wip = champs.wip
      }
      return suivante
    }),
  )
}

/**
 * Place une colonne à une position donnée.
 *
 * L'index vient d'un glisser-déposer : il est borné plutôt que refusé. Une
 * colonne lâchée après la dernière veut manifestement finir dernière, et
 * renvoyer une erreur pour un geste sans ambiguïté serait pénible.
 *
 * @param {number} index position visée dans le tableau final
 */
export function reorderColumn(ovrseeDir, id, index) {
  const colonnes = readBoard(ovrseeDir)
  const at = colonnes.findIndex(c => c.id === id)
  if (at === -1) throw new Error(`colonne inconnue : ${id}`)

  const cible = Math.min(Math.max(Math.trunc(Number(index) || 0), 0), colonnes.length - 1)
  if (cible === at) return colonnes

  const suite = [...colonnes]
  suite.splice(cible, 0, ...suite.splice(at, 1))
  return writeBoard(ovrseeDir, suite)
}

/**
 * La colonne qui vaut « terminé », s'il y en a une.
 *
 * C'est la dernière du tableau — mais seulement s'il y en a plusieurs : sur un
 * tableau à une colonne, la traiter comme terminale ferait disparaître tous les
 * tickets du compte de ce qui reste à faire.
 *
 * @returns {string|null}
 */
export function colonneFinale(colonnes) {
  return colonnes.length > 1 ? (colonnes.at(-1)?.id ?? null) : null
}
