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
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

import { parsePlan, readPlans, serializePlan, slugify, writeFileNoFollow } from './plans.js'
import { clearActive, readActive, withLock, writeActive } from './active.js'
import {
  DEFAULT_COLUMNS,
  addColumn,
  colonneFinale,
  readBoard,
  renameColumn,
  reorderColumn,
  writeBoard,
} from './board.js'

/**
 * Les colonnes vivent dans `board.js` — re-exportées ici parce que dix-huit
 * modules les importent depuis `tickets.js` depuis toujours, et que la découpe
 * ne vaut pas dix-huit imports réécrits.
 */
export {
  DEFAULT_COLUMNS,
  addColumn,
  colonneFinale,
  readBoard,
  renameColumn,
  reorderColumn,
  writeBoard,
}


/** De la plus urgente à la moins urgente. L'ordre du tableau est l'ordre du tri. */
/**
 * La colonne qui marque le travail commencé.
 *
 * Trois hooks s'en servent pour distinguer un ticket en vol d'un ticket que
 * personne n'a ouvert — `ovrsee-tool-edit` l'y met, `ovrsee-tool-stop` le
 * pousse plus loin, `ovrsee-post-commit` refuse de clore en deçà. Elle était
 * écrite en dur dans chacun, dont deux constantes locales identiques : trois
 * définitions d'une même chaîne finissent par diverger.
 */
export const EN_COURS = 'en-cours'

export const PRIORITES = ['haute', 'moyenne', 'basse']

const DEFAULT_PRIORITE = 'moyenne'

/**
 * Estimation en taille de t-shirt, de la plus petite à la plus grande.
 *
 * Un ordre de grandeur, pas un engagement : contrairement à `priorite`, ce
 * champ n'a pas de défaut et reste absent tant que personne n'a une idée de
 * la charge. Un ticket sans `charge` est un ticket valide.
 */
export const CHARGES = ['xs', 's', 'm', 'l', 'xl']

const today = (now = new Date()) => now.toISOString().slice(0, 10)


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

const requireCharge = charge => {
  if (!CHARGES.includes(charge)) {
    throw new Error(`charge inconnue : ${charge}`)
  }
  return charge
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
 * Sous verrou de bout en bout : `nextTicketId` rend le maximum lu plus un, donc
 * deux sessions qui créent un ticket au même instant produisaient deux fichiers
 * portant le même `T-XXXX`. Tout ce qui cite cet identifiant — un commit, un
 * plan, l'avancée automatique des tickets — devenait ambigu, en silence.
 *
 * @param {string} ovrseeDir
 * @param {{titre: string, colonne?: string, priorite?: string, charge?: string, tags?: string[], corps?: string, plan?: string|null, type?: string, epic?: string}} champs
 * @param {Date} [now]
 * @param {string|null} [session] la session appelante, pour le ticket actif
 * @returns {{file: string, meta: object, body: string}}
 */
export function createTicket(ovrseeDir, champs, now = new Date(), session = null) {
  return withLock(ovrseeDir, () => creerTicket(ovrseeDir, champs, now, session))
}

function creerTicket(ovrseeDir, champs, now, session) {
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

  // Valider et ajouter charge si présente
  if (champs?.charge !== undefined && champs.charge !== null) {
    meta.charge = requireCharge(champs.charge)
  }

  const body = String(champs?.corps ?? '').trim() + '\n'
  const file = ticketFileName(meta.id, titre)

  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  writeFileNoFollow(ticketPath(ovrseeDir, file), serializePlan(meta, body))

  // Un ticket créé sans plan, alors que cette session n'a aucun plan actif,
  // devient son ticket actif : seule façon hors-plan de satisfaire le gate sans
  // étape manuelle supplémentaire. Écrase silencieusement le ticket actif de la
  // session, comme `ovrsee-capture-plan.js` réécrit toujours son plan actif.
  //
  // « Aucun plan actif » se juge session par session : le plan d'une session
  // voisine ne doit pas empêcher celle-ci d'ouvrir un ticket ad hoc.
  if (
    meta.plan === null &&
    meta.colonne !== colonneFinale(colonnes) &&
    !readActive(ovrseeDir, session).plan
  ) {
    writeActive(ovrseeDir, session, { ticket: meta.id })
  }

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
  return withLock(ovrseeDir, () => {
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
  })
}

/**
 * Déplace un ticket d'une colonne à l'autre. Ne touche à rien d'autre — sauf
 * le ticket actif, dont ce déplacement est le seul chemin d'écriture commun
 * à tous les appelants (route UI, MCP, hooks) :
 *
 * - vers la colonne finale : efface le ticket actif s'il désignait celui-ci
 *   (travail terminé, peu importe si c'est un commit, un drag kanban, ou un
 *   appel MCP) ;
 * - vers `en-cours`, pour un ticket sans plan et sans plan actif dans cette
 *   session : pose le ticket actif — reprendre un ticket déjà ouvert (ex. issu
 *   d'un audit) n'oblige pas à en recréer un.
 *
 * @param {string|null} [session] la session appelante, pour le ticket actif
 */
export function moveTicket(ovrseeDir, file, colonne, now = new Date(), session = null) {
  requireFile(file)
  const colonnes = readBoard(ovrseeDir)
  requireColonne(colonnes, colonne)

  let planDuTicket
  const ok = rewrite(
    ovrseeDir,
    file,
    ticket => {
      planDuTicket = ticket.meta.plan
      return { meta: { ...ticket.meta, colonne }, body: ticket.body }
    },
    now,
  )
  if (!ok) return false

  const id = idFromFile(file)
  const finale = colonneFinale(colonnes)
  if (id && colonne === finale) {
    clearActiveTicket(ovrseeDir, id, session)
  } else if (
    id &&
    colonne === 'en-cours' &&
    (planDuTicket === null || planDuTicket === undefined) &&
    !readActive(ovrseeDir, session).plan
  ) {
    writeActive(ovrseeDir, session, { ticket: id })
  }

  return true
}

/**
 * Modifie le contenu d'un ticket : titre, priorité, tags, plan lié, corps, type, epic.
 *
 * Le fichier n'est jamais renommé quand le titre change : l'identifiant est la
 * clé, et renommer casserait toute référence déjà écrite ailleurs.
 *
 * @param {{titre?: string, priorite?: string, charge?: string|null, tags?: string[], plan?: string|null, corps?: string, type?: string|null, epic?: string|null}} patch
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

      // Gérer charge
      if (patch?.charge !== undefined && patch.charge !== null) {
        meta.charge = requireCharge(patch.charge)
      } else if (patch?.charge === null) {
        delete meta.charge
      }

      const body = patch?.corps === undefined ? ticket.body : String(patch.corps).trim() + '\n'
      return { meta, body }
    },
    now,
  )
}

/** @returns {boolean} vrai si un fichier a bien été retiré */
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

/** Le dossier des images de tickets, relatif à la racine du dépôt. */
const IMAGES_DIR = 'ovrsee/tickets/images'

/**
 * Plafond d'une image de ticket, en octets bruts.
 *
 * `CORPS_MAX` (server/api.js) plafonne le corps de requête à 1 Mo, et le base64
 * gonfle de 33 % : au-delà d'environ 750 ko l'envoi serait coupé côté serveur
 * sans qu'on sache dire pourquoi. Le client ré-encode bien en dessous — 1600 px
 * de côté en WebP q0.85 tient dans 100 à 300 ko pour une capture d'écran — donc
 * ce plafond n'est pas une gêne, c'est le refus qui reste lisible.
 */
const IMAGE_MAX_OCTETS = 700_000

const PREFIXE_WEBP = 'data:image/webp;base64,'

/**
 * Écrit une image collée dans un ticket, et rend son chemin depuis la racine.
 *
 * **Une image de ticket est une donnée du dépôt** (T-0219, issue #54) : elle vit
 * sous `ovrsee/tickets/`, donc elle suit le réglage `gitignorePlans` sans qu'un
 * bloc `.gitignore` de plus existe. Le chemin rendu est relatif à la racine du
 * dépôt, pas à `ovrsee/`, parce que c'est ce que `mediaUrl()` → `/api/media`
 * attend d'un `![](…)` — voir `app/src/pages.ts`.
 *
 * `dataUri` vient du rendu, donc du dehors : il est traité comme hostile.
 * Le client a beau ré-encoder en WebP par `<canvas>` avant l'envoi, rien ne
 * force un appelant à passer par lui. D'où la triple vérification ici — type
 * annoncé, octets magiques, taille — et le nom de fichier **généré par le
 * serveur** : l'appelant ne choisit jamais où sa donnée atterrit.
 *
 * @param {string} ovrseeDir
 * @param {string} ticketId identifiant du ticket propriétaire (`T-0042`)
 * @param {unknown} dataUri `data:image/webp;base64,…`
 * @returns {string} `ovrsee/tickets/images/T-0042-a1b2c3d4.webp`
 */
export function saveTicketImage(ovrseeDir, ticketId, dataUri) {
  // L'identifiant devient un morceau de nom de fichier : le valider est ce qui
  // rend une traversée de chemin impossible, avant même toute vérification de
  // contenu.
  if (!isSafeTicketId(ticketId)) {
    throw new Error(`identifiant de ticket invalide : ${ticketId}`)
  }
  if (typeof dataUri !== 'string' || !dataUri.startsWith(PREFIXE_WEBP)) {
    throw new Error('seule une image WebP en data-URI est acceptée')
  }

  // Avant de décoder, pas après : `CORPS_MAX` borne le corps de requête du dev
  // server, mais `fetchHandler` (Electron) lit le sien en entier avant d'appeler
  // ici. Sans cette borne, un data-URI de 500 Mo serait mis en mémoire pour être
  // rejeté ensuite. Le base64 gonfle de 4/3, d'où la marge.
  if (dataUri.length > IMAGE_MAX_OCTETS * 2) {
    throw new Error('image trop volumineuse')
  }

  // Node décode le base64 sans broncher, y compris du charabia : ce sont les
  // octets magiques plus bas qui font foi, jamais le type annoncé.
  const octets = Buffer.from(dataUri.slice(PREFIXE_WEBP.length), 'base64')

  if (octets.length > IMAGE_MAX_OCTETS) {
    throw new Error(`image trop volumineuse : ${octets.length} octets`)
  }
  // `RIFF` puis, quatre octets de taille plus loin, `WEBP`.
  const entete = octets.subarray(0, 4).toString('latin1')
  const format = octets.subarray(8, 12).toString('latin1')
  if (entete !== 'RIFF' || format !== 'WEBP') {
    throw new Error('ces octets ne sont pas une image WebP')
  }

  const nom = `${ticketId}-${randomBytes(4).toString('hex')}.webp`
  writeFileNoFollow(join(ovrseeDir, 'tickets', 'images', nom), octets)
  return `${IMAGES_DIR}/${nom}`
}

/**
 * Les images d'un ticket : celles dont le nom porte son identifiant.
 *
 * Le lien se fait par le nom du fichier, pas par les `![](…)` du corps. Deux
 * raisons : une image collée puis retirée du texte resterait sinon sur le
 * disque pour toujours, et un corps qui cite l'image d'un autre ticket — un
 * copier-coller suffit — ne doit pas pouvoir la faire supprimer.
 */
function imagesDuTicket(ovrseeDir, id) {
  const dir = join(ovrseeDir, 'tickets', 'images')
  const attendu = new RegExp(`^${id}-[0-9a-f]{8}\\.webp$`)
  try {
    return readdirSync(dir)
      .filter(nom => attendu.test(nom))
      .map(nom => join(dir, nom))
  } catch {
    return []
  }
}

export function deleteTicket(ovrseeDir, file) {
  const id = idFromFile(file)
  try {
    unlinkSync(ticketPath(ovrseeDir, file))
  } catch {
    return false
  }

  // Après la suppression du ticket, jamais avant : une image orpheline est un
  // désagrément, un ticket disparu dont les images restent l'est moins qu'un
  // ticket intact dont les images ont sauté.
  if (id) {
    for (const image of imagesDuTicket(ovrseeDir, id)) {
      try {
        unlinkSync(image)
      } catch {
        // Déjà partie, ou illisible : la suppression du ticket a réussi.
      }
    }
  }
  return true
}


/**
 * Un id de ticket est-il sûr à recoller à une comparaison ?
 *
 * Le ticket actif est la seule valeur relue du disque puis réinjectée dans une
 * comparaison d'id — même regex que la validation d'`epic` plus haut.
 */
export function isSafeTicketId(id) {
  return typeof id === 'string' && /^T-\d+$/.test(id)
}

/**
 * L'id du ticket actif d'une session, ou `null`.
 *
 * Absent, illisible ou mal formé retombent tous sur `null` — un état douteux ne
 * doit jamais faire planter un appelant, seulement se comporter comme s'il
 * n'existait pas.
 *
 * @param {string} ovrseeDir
 * @param {string|null} [session] omise : le seau partagé, comme avant les
 *   sessions.
 */
export function readActiveTicket(ovrseeDir, session = null) {
  const id = readActive(ovrseeDir, session).ticket
  return isSafeTicketId(id) ? id : null
}

/**
 * Retire le ticket actif d'une session.
 *
 * @param {string} ovrseeDir
 * @param {string|null} [ticketId] fourni : n'efface que si le pointeur désigne
 *   bien ce ticket (mirroring `clearActivePlan` de `plans.js`). Omis : efface
 *   sans condition — un plan qui démarre éclipse tout ticket actif ad hoc.
 * @param {string|null} [session]
 * @returns {boolean} vrai si un pointeur a été retiré
 */
export function clearActiveTicket(ovrseeDir, ticketId = null, session = null) {
  const vu = readActiveTicket(ovrseeDir, session)
  if (vu === null) return false
  if (ticketId !== null && vu !== ticketId) return false

  // Le ticket peut venir du seau de la session comme du seau partagé — c'est le
  // repli de `readActive`. On le retire là où il est vraiment, sinon la lecture
  // suivante le retrouverait ; le garde sur la valeur rend le second appel
  // inoffensif quand le seau partagé en désigne un autre.
  clearActive(ovrseeDir, session, 'ticket', vu)
  clearActive(ovrseeDir, null, 'ticket', vu)
  return true
}

/**
 * Avance en « revue » le ticket ad hoc actif, avant qu'un plan ne l'éclipse.
 *
 * Un ticket sans plan (`meta.plan === null`) qui satisfaisait le gate hors-plan
 * n'est plus suivi par aucun hook une fois le ticket actif effacé : ni
 * `avancerTicketsEnRevue` (`ovrsee-tool-stop.js`) ni `avancerTicketsDuPlan`
 * (`ovrsee-post-commit.js`) ne le voient jamais passer, puisque tous deux ne
 * suivent que les tickets dont `meta.plan` cite le plan actif. Sans ce geste,
 * un ticket ad hoc en cours au moment où un plan démarre resterait figé en
 * « en cours » indéfiniment — plus rien ne le fait avancer.
 *
 * À appeler avant `clearActiveTicket`, pendant que le pointeur désigne encore
 * le ticket à éclipser. Silencieux si le ticket actif n'est pas en
 * `en-cours`, cite déjà un plan, ou si le tableau n'a pas de colonne `revue`.
 *
 * @param {string} ovrseeDir
 * @param {string|null} [session]
 */
export function avancerTicketActifEclipse(ovrseeDir, session = null) {
  const id = readActiveTicket(ovrseeDir, session)
  if (!id) return

  const colonnes = readBoard(ovrseeDir)
  if (!colonnes.some(c => c.id === 'revue')) return

  const ticket = readTickets(ovrseeDir, colonnes).find(t => t.meta.id === id)
  if (!ticket || ticket.meta.plan !== null || ticket.meta.colonne !== 'en-cours') return

  try {
    moveTicket(ovrseeDir, ticket.file, 'revue', new Date(), session)
  } catch {
    // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer la capture.
  }
}

/** L'id porté par un nom de fichier de ticket (`T-0012-slug.md` → `T-0012`), ou `null`. */
const idFromFile = file => /^(T-\d+)-/.exec(file)?.[1] ?? null

/**
 * Avance vers la colonne finale les tickets dont le plan lié est déjà fermé.
 *
 * Rescanne tous les plans `status: "closed"` à chaque appel plutôt que de se
 * limiter à ceux qu'on vient de clore : un ticket resté en retard — parce
 * qu'un appelant a oublié d'avancer ses tickets à la fermeture, ou pour toute
 * autre raison — se rattrape au prochain appel, d'où qu'il vienne. Idempotent
 * comme ses cousines (`avancerTicketsDuPlan`, `avancerTicketsEnRevue`) : un
 * ticket déjà en colonne finale n'est jamais retouché.
 *
 * @param {string} ovrseeDir
 * @returns {string[]} fichiers de tickets avancés
 */
export function avancerTicketsClos(ovrseeDir) {
  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  if (!finale) return []

  const plansFermes = new Set(readPlans(ovrseeDir).filter(p => p.meta.status === 'closed').map(p => p.file))
  if (plansFermes.size === 0) return []

  // Même règle qu'au commit : on ne solde que ce qui était en vol. Un ticket
  // jamais commencé n'est pas « fait », et clore le plan ne le rend pas vrai —
  // il reste visible, et rattachable à un autre plan.
  const iEnCours = colonnes.findIndex(c => c.id === EN_COURS)
  if (iEnCours === -1) return []
  const rangDe = new Map(colonnes.map((c, i) => [c.id, i]))

  const avances = []
  for (const ticket of readTickets(ovrseeDir, colonnes)) {
    if (!plansFermes.has(ticket.meta.plan) || ticket.meta.colonne === finale) continue
    if ((rangDe.get(ticket.meta.colonne) ?? -1) < iEnCours) continue

    try {
      moveTicket(ovrseeDir, ticket.file, finale)
      avances.push(ticket.file)
    } catch {
      // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer l'appelant.
    }
  }
  return avances
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
