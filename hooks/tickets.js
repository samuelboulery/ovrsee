/**
 * Lecture et écriture des tickets de `/ovrsee/tickets/`.
 *
 * Les tickets sont la seule donnée *saisie* de l'ovrsee. Tout le reste — plans,
 * pages, scans — est capturé par un hook et ne s'édite pas. Un tableau kanban,
 * lui, n'a de sens que si on peut y poser une intention avant qu'elle existe
 * sous forme de plan, et la déplacer à la main.
 *
 * Deux écrivains concurrents : l'interface (route POST) et Claude (édition
 * directe des fichiers, ou CLI). D'où un fichier par ticket plutôt qu'un
 * `tickets.json` unique — deux écritures simultanées sur un même fichier
 * s'écrasent, et un changement de colonne doit donner un diff d'une ligne.
 *
 * Le frontmatter reste du JSON, comme celui des plans : `parsePlan` et
 * `serializePlan` sont réutilisés tels quels plutôt que redéfinis ici.
 */

import { mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { parsePlan, readPlans, serializePlan, slugify, writeFileNoFollow } from './plans.js'

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

/** De la plus urgente à la moins urgente. L'ordre du tableau est l'ordre du tri. */
export const PRIORITES = ['haute', 'moyenne', 'basse']

const DEFAULT_PRIORITE = 'moyenne'

const today = (now = new Date()) => now.toISOString().slice(0, 10)

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
 * Retire une colonne, après avoir relogé ses tickets.
 *
 * Les tickets sont déplacés d'abord, et réellement réécrits : un ticket dont la
 * colonne a disparu ne s'affiche qu'au repli, et son fichier continuerait de
 * citer une colonne qui n'existe plus. On ne laisse pas ce mensonge sur le
 * disque.
 *
 * @param {string} [vers] colonne d'accueil, obligatoire si la colonne n'est pas vide
 */
export function removeColumn(ovrseeDir, id, vers) {
  const colonnes = readBoard(ovrseeDir)
  if (!colonnes.some(c => c.id === id)) throw new Error(`colonne inconnue : ${id}`)
  if (colonnes.length === 1) throw new Error('impossible de retirer la dernière colonne')

  const dedans = readTickets(ovrseeDir, colonnes).filter(t => t.meta.colonne === id)
  if (dedans.length > 0) {
    if (!vers || vers === id || !colonnes.some(c => c.id === vers)) {
      throw new Error(`destination requise pour les ${dedans.length} ticket(s) de ${id}`)
    }
    for (const ticket of dedans) moveTicket(ovrseeDir, ticket.file, vers)
  }

  return writeBoard(ovrseeDir, colonnes.filter(c => c.id !== id))
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
 * Tous les tickets d'un projet, dans l'ordre des identifiants.
 *
 * Un ticket dont la colonne a disparu du `board.json` retombe dans la première
 * colonne — sinon il deviendrait invisible sans que rien ne le signale. Le
 * fichier n'est pas réécrit pour autant : c'est une lecture, et l'utilisateur
 * peut vouloir restaurer sa colonne.
 *
 * @param {string} ovrseeDir
 * @param {Array<{id: string}>} [colonnes]
 * @returns {Array<{file: string, meta: object, body: string}>}
 */
export function readTickets(ovrseeDir, colonnes = readBoard(ovrseeDir), illisibles = []) {
  let names
  try {
    names = readdirSync(join(ovrseeDir, 'tickets'))
  } catch {
    return []
  }

  const connues = new Set(colonnes.map(c => c.id))
  const repli = colonnes[0]?.id ?? DEFAULT_COLUMNS[0].id
  const tickets = []

  for (const name of names.sort()) {
    if (!name.endsWith('.md')) continue
    let raw
    try {
      raw = readFileSync(join(ovrseeDir, 'tickets', name), 'utf8')
    } catch {
      illisibles.push({ file: `tickets/${name}`, quoi: 'ticket' })
      continue
    }
    const ticket = parsePlan(raw)
    if (!ticket) {
      illisibles.push({ file: `tickets/${name}`, quoi: 'ticket' })
      process.stderr.write(`[ovrsee] ticket illisible, ignoré : ${name}\n`)
      continue
    }
    const colonne = connues.has(ticket.meta.colonne) ? ticket.meta.colonne : repli
    tickets.push({ file: name, meta: { ...ticket.meta, colonne }, body: ticket.body })
  }

  return tickets
}

/**
 * Le prochain identifiant libre.
 *
 * Le maximum plus un, jamais le nombre de tickets : supprimer un ticket ne doit
 * pas faire réapparaître son numéro sur un autre. Un identifiant réutilisé
 * rendrait faux tout ce qui le cite — un commit, un plan, une conversation.
 */
export function nextTicketId(tickets) {
  const max = tickets.reduce((haut, t) => {
    const found = /^T-(\d+)$/.exec(String(t?.meta?.id ?? ''))
    return found ? Math.max(haut, Number(found[1])) : haut
  }, 0)

  return `T-${String(max + 1).padStart(4, '0')}`
}

/** L'identifiant porte le tri du dossier ; le titre n'est là que pour l'œil. */
export function ticketFileName(id, titre) {
  return `${id}-${slugify(titre)}.md`
}

/**
 * Un nom de fichier de ticket est-il sûr à recoller à un chemin ?
 *
 * Sécurité : c'est la seule barrière entre une valeur venue du rendu — donc de
 * l'extérieur — et un chemin sur disque.
 */
export function isSafeTicketFileName(file) {
  return (
    typeof file === 'string' &&
    file.length > 0 &&
    file.endsWith('.md') &&
    !file.includes('/') &&
    !file.includes('\\') &&
    !file.includes('\0') &&
    !file.startsWith('.')
  )
}

const requireColonne = (colonnes, colonne) => {
  if (!colonnes.some(c => c.id === colonne)) {
    throw new Error(`colonne inconnue : ${colonne}`)
  }
  return colonne
}

const requirePriorite = priorite => {
  if (!PRIORITES.includes(priorite)) {
    throw new Error(`priorité inconnue : ${priorite}`)
  }
  return priorite
}

const requireFile = file => {
  if (!isSafeTicketFileName(file)) throw new Error(`nom de fichier refusé : ${file}`)
  return file
}

const ticketPath = (ovrseeDir, file) => join(ovrseeDir, 'tickets', requireFile(file))

/**
 * Crée un ticket et l'écrit.
 *
 * @param {string} ovrseeDir
 * @param {{titre: string, colonne?: string, priorite?: string, tags?: string[], corps?: string, plan?: string|null, type?: string, epic?: string}} champs
 * @param {Date} [now]
 * @returns {{file: string, meta: object, body: string}}
 */
export function createTicket(ovrseeDir, champs, now = new Date()) {
  const colonnes = readBoard(ovrseeDir)
  const titre = String(champs?.titre ?? '').trim()
  if (!titre) throw new Error('titre vide')

  const colonne = requireColonne(colonnes, champs?.colonne ?? colonnes[0].id)
  const priorite = requirePriorite(champs?.priorite ?? DEFAULT_PRIORITE)
  const date = today(now)

  const meta = {
    id: nextTicketId(readTickets(ovrseeDir, colonnes)),
    titre,
    colonne,
    priorite,
    tags: Array.isArray(champs?.tags) ? champs.tags.map(String) : [],
    cree: date,
    maj: date,
    plan: champs?.plan ?? null,
  }

  // Valider et ajouter type si présent
  if (champs?.type !== undefined && champs.type !== null) {
    if (champs.type !== 'epic') throw new Error('type doit valoir "epic" ou être absent')
    meta.type = champs.type
  }

  // Valider et ajouter epic si présent
  if (champs?.epic !== undefined && champs.epic !== null) {
    if (typeof champs.epic !== 'string' || !/^T-\d+$/.test(champs.epic)) {
      throw new Error('epic doit être un ID T-XXXX ou être absent')
    }
    meta.epic = champs.epic
  }

  const body = String(champs?.corps ?? '').trim() + '\n'
  const file = ticketFileName(meta.id, titre)

  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  writeFileNoFollow(ticketPath(ovrseeDir, file), serializePlan(meta, body))

  return { file, meta, body }
}

/**
 * Lit un ticket, transforme meta et corps, le réécrit.
 *
 * Seul chemin d'écriture d'un ticket existant : `maj` s'y met à jour une fois,
 * plutôt qu'à chaque appelant qui l'oublierait tôt ou tard.
 *
 * @returns {boolean} vrai si le fichier a été réécrit
 */
function rewrite(ovrseeDir, file, transform, now) {
  const path = ticketPath(ovrseeDir, file)

  let ticket
  try {
    ticket = parsePlan(readFileSync(path, 'utf8'))
  } catch {
    return false
  }
  if (!ticket) return false

  const next = transform(ticket)
  if (!next) return false

  writeFileNoFollow(path, serializePlan({ ...next.meta, maj: today(now) }, next.body))
  return true
}

/** Déplace un ticket d'une colonne à l'autre. Ne touche à rien d'autre. */
export function moveTicket(ovrseeDir, file, colonne, now = new Date()) {
  requireFile(file)
  requireColonne(readBoard(ovrseeDir), colonne)

  return rewrite(ovrseeDir, file, ticket => ({ meta: { ...ticket.meta, colonne }, body: ticket.body }), now)
}

/**
 * Modifie le contenu d'un ticket : titre, priorité, tags, plan lié, corps, type, epic.
 *
 * Le fichier n'est jamais renommé quand le titre change : l'identifiant est la
 * clé, et renommer casserait toute référence déjà écrite ailleurs.
 *
 * @param {{titre?: string, priorite?: string, tags?: string[], plan?: string|null, corps?: string, type?: string|null, epic?: string|null}} patch
 */
export function updateTicket(ovrseeDir, file, patch, now = new Date()) {
  requireFile(file)
  if (patch?.priorite !== undefined) requirePriorite(patch.priorite)

  return rewrite(
    ovrseeDir,
    file,
    ticket => {
      const meta = { ...ticket.meta }
      if (patch?.titre !== undefined) {
        const titre = String(patch.titre).trim()
        if (!titre) throw new Error('titre vide')
        meta.titre = titre
      }
      if (patch?.priorite !== undefined) meta.priorite = patch.priorite
      if (patch?.tags !== undefined) meta.tags = Array.isArray(patch.tags) ? patch.tags.map(String) : []
      if (patch?.plan !== undefined) meta.plan = patch.plan ?? null

      // Gérer type
      if (patch?.type !== undefined && patch.type !== null) {
        if (patch.type !== 'epic') throw new Error('type doit valoir "epic" ou être absent')
        meta.type = patch.type
      } else if (patch?.type === null) {
        delete meta.type
      }

      // Gérer epic
      if (patch?.epic !== undefined && patch.epic !== null) {
        if (typeof patch.epic !== 'string' || !/^T-\d+$/.test(patch.epic)) {
          throw new Error('epic doit être un ID T-XXXX ou être absent')
        }
        meta.epic = patch.epic
      } else if (patch?.epic === null) {
        delete meta.epic
      }

      const body = patch?.corps === undefined ? ticket.body : String(patch.corps).trim() + '\n'
      return { meta, body }
    },
    now,
  )
}

/** @returns {boolean} vrai si un fichier a bien été retiré */
export function deleteTicket(ovrseeDir, file) {
  try {
    unlinkSync(ticketPath(ovrseeDir, file))
    return true
  } catch {
    return false
  }
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

/**
 * Priorité d'abord, puis du plus récent au plus ancien.
 *
 * Pas de champ de rang : le réordonnancement manuel obligerait à réécrire
 * plusieurs fichiers à chaque glissement, pour une information que la priorité
 * porte déjà. Si le rang manque un jour, il s'ajoutera.
 *
 * Les epics et les tickets ordinaires se trient ensemble — les epics ne sont
 * pas exclus du tri, c'est voulu, et ils apparaissent au même rang que les
 * tickets ordinaires de même priorité.
 */
export function sortTickets(tickets) {
  const rang = t => {
    const at = PRIORITES.indexOf(t?.meta?.priorite)
    return at === -1 ? PRIORITES.indexOf(DEFAULT_PRIORITE) : at
  }

  return [...tickets].sort(
    (a, b) => rang(a) - rang(b) || String(b.meta?.cree ?? '').localeCompare(String(a.meta?.cree ?? '')),
  )
}

/**
 * Les enfants d'un epic, triés par priorité puis date.
 *
 * @param {Array<{meta: object}>} tickets
 * @param {string} epicId l'ID du ticket parent (ex. "T-0021")
 * @returns {Array<{meta: object}>}
 */
export function childrenOf(tickets, epicId) {
  return sortTickets(tickets.filter(t => t.meta?.epic === epicId))
}

/**
 * Les enfants pointant un epic inexistant.
 *
 * Un enfant dont l'epic a été supprimé reste un ticket ordinaire orphelin,
 * sans erreur bloquante. Aucune validation complexe — juste une tolérance.
 *
 * @param {Array<{meta: object}>} tickets
 * @param {Array<{id: string}>} colonnes (inutilisé pour l'instant, pour compatibilité)
 * @returns {Array<{meta: object}>}
 */
export function orphanChildren(tickets) {
  const epicIds = new Set(
    tickets
      .filter(t => t.meta?.type === 'epic')
      .map(t => t.meta?.id)
  )
  return tickets.filter(
    t => t.meta?.epic && !epicIds.has(t.meta.epic)
  )
}

/**
 * Reprend les plans ouverts sous forme de tickets.
 *
 * Migration exécutable plusieurs fois sans dommage : un plan déjà repris est
 * reconnu au champ `plan` d'un ticket existant. Le corps du plan n'est pas
 * recopié — il vit dans `ovrsee/plans/`, et deux copies divergeraient.
 *
 * @returns {Array<{file: string, meta: object}>} les tickets créés
 */
export function importOpenPlans(ovrseeDir, now = new Date()) {
  const colonnes = readBoard(ovrseeDir)
  const dejaRepris = new Set(readTickets(ovrseeDir, colonnes).map(t => t.meta.plan).filter(Boolean))
  const cree = []

  for (const plan of readPlans(ovrseeDir).slice().reverse()) {
    if (plan.meta.status !== 'open' || dejaRepris.has(plan.file)) continue

    // Un plan ouvert sans commit n'a jamais été commencé : c'est du backlog.
    // Avec des commits, le travail a eu lieu — il est en cours.
    const commits = plan.meta.commits ?? []
    const voulue = commits.length > 0 ? 'en-cours' : 'backlog'
    const colonne = colonnes.some(c => c.id === voulue) ? voulue : colonnes[0].id

    cree.push(
      createTicket(
        ovrseeDir,
        {
          titre: plan.meta.title ?? plan.file,
          colonne,
          plan: plan.file,
          corps: `Repris du plan \`${plan.file}\`, ouvert le ${plan.meta.opened ?? '?'}.`,
        },
        now,
      ),
    )
  }

  return cree
}
