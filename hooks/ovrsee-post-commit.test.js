import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { crawlUtile, avancerTicketsDuPlan, plansPourCommit } from './ovrsee-post-commit.js'
import { createTicket, readTickets } from './tickets.js'
import { writeActive } from './active.js'

/**
 * Le crawl coûte le démarrage d'une application et d'un navigateur. Le
 * déclencher sur un commit qui ne range que les sorties du crawl précédent en
 * produit une nouvelle fournée, laquelle en produira une autre : l'arbre de
 * travail ne peut alors jamais redevenir propre.
 *
 * Ce fichier existe aussi pour une raison de forme : importer le hook ne doit
 * rien exécuter. S'il lançait encore son corps à l'import, ce test lancerait un
 * crawl à chaque `pnpm test`.
 */

test('un commit qui touche du code déclenche le crawl', () => {
  assert.equal(crawlUtile(['app/src/App.tsx']), true)
  assert.equal(crawlUtile(['README.md', 'hooks/plans.js']), true)
})

test('un commit sans fichier source ne déclenche rien', () => {
  // `changedFiles()` a déjà retiré `ovrsee/` et `graphify-out/` : une liste
  // vide veut dire « ce commit n'a touché que des sorties ».
  assert.equal(crawlUtile([]), false)
})

test('crawlUtile encaisse une liste absente', () => {
  assert.equal(crawlUtile(undefined), false)
  assert.equal(crawlUtile(null), false)
})

// --- avancerTicketsDuPlan ---------------------------------------------------

/** Un dossier `ovrsee/` jetable avec un board par défaut (colonnes standard). */
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'ovrsee-post-commit-'))
  const ovrseeDir = join(root, 'ovrsee')
  mkdirSync(join(ovrseeDir, 'tickets'), { recursive: true })
  return ovrseeDir
}

test('avancerTicketsDuPlan fait passer en colonne finale un ticket lié en revue', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'revue', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsDuPlan pousse aussi un ticket resté en cours (pas de colonne revue)', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'en-cours', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsDuPlan ne retouche jamais un ticket déjà en finale', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'fait', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'fait')
})

test('avancerTicketsDuPlan ignore les tickets d’un autre plan', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-autre.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsDuPlan ne fait rien sur un board à une seule colonne', () => {
  const ovrseeDir = fixture()
  writeFileSync(
    join(ovrseeDir, 'board.json'),
    JSON.stringify({ colonnes: [{ id: 'todo', titre: 'À faire' }] }),
    'utf8',
  )
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'todo', plan: '2026-08-10-x.md' })

  assert.doesNotThrow(() => avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md'))
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'todo')
})

// Le défaut que ces trois tests fixent : la fonction fermait TOUT ticket du
// plan qui n'était pas déjà en finale, y compris ceux que personne n'avait
// commencés. Sur un plan qui produit neuf tickets, le premier commit les
// soldait tous les neuf — le tableau se vidait tout seul, et l'utilisateur qui
// ne le remarquait pas perdait son reste-à-faire.
//
// Le commentaire de la fonction annonçait pourtant déjà la bonne règle : un
// commit clôt ce qui était en vol, « qu'il vienne de revue ou soit resté en
// cours ». Il manquait la vérification.

test('avancerTicketsDuPlan ne touche pas un ticket du plan resté en backlog', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'backlog', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'backlog')
})

test('avancerTicketsDuPlan ne touche pas un ticket du plan resté en prêt', () => {
  const ovrseeDir = fixture()
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'pret', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'pret')
})

test('un commit ne clôt que le ticket en vol, pas les autres du même plan', () => {
  const ovrseeDir = fixture()
  const plan = '2026-08-10-x.md'
  const enVol = createTicket(ovrseeDir, { titre: 'En vol', colonne: 'en-cours', plan })
  const prochain = createTicket(ovrseeDir, { titre: 'Prochain', colonne: 'pret', plan })
  const plusTard = createTicket(ovrseeDir, { titre: 'Plus tard', colonne: 'backlog', plan })

  avancerTicketsDuPlan(ovrseeDir, plan)

  const colonne = f => readTickets(ovrseeDir).find(t => t.file === f).meta.colonne
  assert.equal(colonne(enVol.file), 'fait')
  assert.equal(colonne(prochain.file), 'pret')
  assert.equal(colonne(plusTard.file), 'backlog')
})

test('sans colonne « en cours », le hook ne ferme rien plutôt que tout', () => {
  const ovrseeDir = fixture()
  writeFileSync(
    join(ovrseeDir, 'board.json'),
    JSON.stringify({ colonnes: [{ id: 'todo', titre: 'À faire' }, { id: 'done', titre: 'Fini' }] }),
    'utf8',
  )
  const { file } = createTicket(ovrseeDir, { titre: 'X', colonne: 'todo', plan: '2026-08-10-x.md' })

  avancerTicketsDuPlan(ovrseeDir, '2026-08-10-x.md')

  // Un board sans `en-cours` ne permet pas de distinguer un ticket en vol d'un
  // ticket jamais commencé. Ne rien fermer est le défaut sûr.
  assert.equal(readTickets(ovrseeDir).find(t => t.file === file).meta.colonne, 'todo')
})

// --- attribution ------------------------------------------------------------
//
// Fermer « tout ce qui est en vol » ne suffisait pas : `ovrsee-tool-edit` met
// en vol TOUS les tickets du plan dès la première édition, donc le premier
// commit les soldait encore tous. Le maillon manquant était l'attribution — à
// quel ticket ce commit correspond-il ?
//
// Le dépôt donne déjà la réponse : ses messages citent le ticket, « (T-0124) ».
// Quand la citation est là, elle tranche. Sinon on ne devine que si le plan n'a
// qu'un seul ticket ouvert ; au-delà, on ne touche à rien.

test('un commit qui cite un ticket ne ferme que celui-là', () => {
  const ovrseeDir = fixture()
  const plan = '2026-08-10-x.md'
  const cite = createTicket(ovrseeDir, { titre: 'Cité', colonne: 'en-cours', plan })
  const autre = createTicket(ovrseeDir, { titre: 'Autre', colonne: 'en-cours', plan })

  avancerTicketsDuPlan(ovrseeDir, plan, `feat: quelque chose (${cite.meta.id})`)

  const colonne = f => readTickets(ovrseeDir).find(t => t.file === f).meta.colonne
  assert.equal(colonne(cite.file), 'fait')
  assert.equal(colonne(autre.file), 'en-cours')
})

test('sans citation, un plan à plusieurs tickets ouverts ne ferme rien', () => {
  const ovrseeDir = fixture()
  const plan = '2026-08-10-x.md'
  const a = createTicket(ovrseeDir, { titre: 'A', colonne: 'en-cours', plan })
  const b = createTicket(ovrseeDir, { titre: 'B', colonne: 'en-cours', plan })

  avancerTicketsDuPlan(ovrseeDir, plan, 'fix: sans citation')

  const colonne = f => readTickets(ovrseeDir).find(t => t.file === f).meta.colonne
  assert.equal(colonne(a.file), 'en-cours')
  assert.equal(colonne(b.file), 'en-cours')
})

test('sans citation, un plan à un seul ticket ouvert le ferme', () => {
  const ovrseeDir = fixture()
  const plan = '2026-08-10-x.md'
  const seul = createTicket(ovrseeDir, { titre: 'Seul', colonne: 'en-cours', plan })
  createTicket(ovrseeDir, { titre: 'Déjà fait', colonne: 'fait', plan })

  avancerTicketsDuPlan(ovrseeDir, plan, 'fix: sans citation')

  assert.equal(readTickets(ovrseeDir).find(t => t.file === seul.file).meta.colonne, 'fait')
})

test('une citation ne ressuscite pas un ticket jamais commencé', () => {
  const ovrseeDir = fixture()
  const plan = '2026-08-10-x.md'
  const dormant = createTicket(ovrseeDir, { titre: 'Dormant', colonne: 'backlog', plan })

  avancerTicketsDuPlan(ovrseeDir, plan, `chore: rien à voir (${dormant.meta.id})`)

  // Citer un ticket dit « c'est de lui qu'il s'agit », pas « il est fini » : un
  // ticket jamais mis en vol reste où il est.
  assert.equal(readTickets(ovrseeDir).find(t => t.file === dormant.file).meta.colonne, 'backlog')
})

// --- plansPourCommit : quelles intentions ce commit réalise-t-il ? -----------

const PLAN_A = '2026-08-16-plan-a.md'
const PLAN_B = '2026-08-16-plan-b.md'

// La panne de T-0223 : un commit citant un ticket du plan A, fait pendant que
// la session travaille sous le plan B, réalise les deux. L'ancienne version
// s'arrêtait au premier étage qui répondait, et B repartait sans commit — donc
// inclosable, puisque `closeOpenPlans` date d'après le dernier commit.
test('plansPourCommit rend le plan du ticket cité ET celui de la session', () => {
  const ovrseeDir = fixture()
  const { meta } = createTicket(ovrseeDir, { titre: 'Sous A', colonne: 'en-cours', plan: PLAN_A })
  writeActive(ovrseeDir, 'session-b', { plan: PLAN_B })

  const trouves = plansPourCommit(
    ovrseeDir,
    `fix: quelque chose (${meta.id})`,
    'session-b',
    readTickets(ovrseeDir),
  )

  assert.deepEqual(trouves, [
    { file: PLAN_A, source: 'ticket' },
    { file: PLAN_B, source: 'session' },
  ])
})

test('plansPourCommit ne rend qu’une fois un plan que le ticket et la session désignent', () => {
  const ovrseeDir = fixture()
  const { meta } = createTicket(ovrseeDir, { titre: 'Sous A', colonne: 'en-cours', plan: PLAN_A })
  writeActive(ovrseeDir, 'session-a', { plan: PLAN_A })

  const trouves = plansPourCommit(
    ovrseeDir,
    `fix: quelque chose (${meta.id})`,
    'session-a',
    readTickets(ovrseeDir),
  )

  assert.deepEqual(trouves, [{ file: PLAN_A, source: 'ticket' }])
})

test('plansPourCommit suit la session quand le message ne cite rien', () => {
  const ovrseeDir = fixture()
  writeActive(ovrseeDir, 'session-a', { plan: PLAN_A })
  writeActive(ovrseeDir, 'session-b', { plan: PLAN_B })

  const trouves = plansPourCommit(ovrseeDir, 'fix: sans citation', 'session-b', readTickets(ovrseeDir))

  // La session ne rend que le sien : le plan d'à côté n'est pas réalisé par ce
  // commit, et l'union n'est pas une rafle.
  assert.deepEqual(trouves, [{ file: PLAN_B, source: 'session' }])
})

test('plansPourCommit retombe sur l’unique plan actif quand la session est inconnue', () => {
  const ovrseeDir = fixture()
  writeActive(ovrseeDir, 'session-a', { plan: PLAN_A })

  const trouves = plansPourCommit(ovrseeDir, 'fix: depuis un terminal', null, readTickets(ovrseeDir))

  assert.deepEqual(trouves, [{ file: PLAN_A, source: 'unique' }])
})

test('le repli sur l’unique plan actif reste un dernier recours, pas un ajout', () => {
  const ovrseeDir = fixture()
  const { meta } = createTicket(ovrseeDir, { titre: 'Sous A', colonne: 'en-cours', plan: PLAN_A })
  writeActive(ovrseeDir, 'session-b', { plan: PLAN_B })

  // Le ticket cité a répondu : l'unique plan actif n'a pas à s'y ajouter — ce
  // serait deviner par-dessus une réponse sûre.
  const trouves = plansPourCommit(
    ovrseeDir,
    `fix: quelque chose (${meta.id})`,
    null,
    readTickets(ovrseeDir),
  )

  assert.deepEqual(trouves, [{ file: PLAN_A, source: 'ticket' }])
})

test('plansPourCommit ne rattache rien quand deux plans sont actifs et que rien ne tranche', () => {
  const ovrseeDir = fixture()
  writeActive(ovrseeDir, 'session-a', { plan: PLAN_A })
  writeActive(ovrseeDir, 'session-b', { plan: PLAN_B })

  assert.deepEqual(plansPourCommit(ovrseeDir, 'fix: sans rien', null, readTickets(ovrseeDir)), [])
})

test('plansPourCommit ne rattache rien sans aucun plan actif', () => {
  const ovrseeDir = fixture()

  assert.deepEqual(plansPourCommit(ovrseeDir, 'fix: rien', 'session-a', readTickets(ovrseeDir)), [])
})

test('plansPourCommit ignore un ticket cité qui ne cite aucun plan', () => {
  const ovrseeDir = fixture()
  const { meta } = createTicket(ovrseeDir, { titre: 'Hors plan', colonne: 'en-cours' })
  writeActive(ovrseeDir, 'session-a', { plan: PLAN_A })

  const trouves = plansPourCommit(
    ovrseeDir,
    `fix: ad hoc (${meta.id})`,
    'session-a',
    readTickets(ovrseeDir),
  )

  // Le ticket ne mène à aucun plan : il n'ajoute rien, la session répond seule.
  assert.deepEqual(trouves, [{ file: PLAN_A, source: 'session' }])
})

test('un plan seulement deviné ne solde pas un ticket que personne n’a cité', () => {
  const ovrseeDir = fixture()
  const seul = createTicket(ovrseeDir, { titre: 'Seul en vol', colonne: 'en-cours', plan: PLAN_A })

  avancerTicketsDuPlan(ovrseeDir, PLAN_A, 'fix: sans citation', true)

  // Deviner le plan puis le ticket enchaînerait deux paris.
  assert.equal(readTickets(ovrseeDir).find(t => t.file === seul.file).meta.colonne, 'en-cours')
})
