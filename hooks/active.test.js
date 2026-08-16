import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  allActive,
  activePlans,
  assainirSession,
  clearActive,
  readActive,
  sessionId,
  withLock,
  writeActive,
} from './active.js'

/** Un dossier `ovrsee/` jetable. */
const ovrsee = () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'ovrsee-active-')), 'ovrsee')
  mkdirSync(dir, { recursive: true })
  return dir
}

const PLAN_A = '2026-08-16-plan-a.md'
const PLAN_B = '2026-08-16-plan-b.md'

/** Vieillit un fichier pour éprouver la péremption. */
const vieillirDe = (path, ms) => {
  const at = new Date(Date.now() - ms)
  utimesSync(path, at, at)
}

const JOUR_MS = 24 * 60 * 60 * 1000

// --- assainirSession ------------------------------------------------------

test('assainirSession réduit un identifiant à un nom de fichier sûr', () => {
  assert.equal(assainirSession('165ae20a-3958-4CF6'), '165ae20a-3958-4cf6')
  assert.equal(assainirSession('../../etc/passwd'), 'etc-passwd')
  assert.equal(assainirSession('..'), null)
  assert.equal(assainirSession(''), null)
  assert.equal(assainirSession(null), null)
})

test('sessionId retombe sur la variable d’environnement', () => {
  const avant = process.env.CLAUDE_CODE_SESSION_ID
  process.env.CLAUDE_CODE_SESSION_ID = 'depuis-l-env'
  try {
    assert.equal(sessionId({ session_id: 'depuis-le-payload' }), 'depuis-le-payload')
    assert.equal(sessionId({}), 'depuis-l-env')
    assert.equal(sessionId(null), 'depuis-l-env')

    delete process.env.CLAUDE_CODE_SESSION_ID
    assert.equal(sessionId({}), null)
  } finally {
    if (avant === undefined) delete process.env.CLAUDE_CODE_SESSION_ID
    else process.env.CLAUDE_CODE_SESSION_ID = avant
  }
})

// --- isolation entre sessions --------------------------------------------

test('deux sessions gardent chacune leur plan', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { plan: PLAN_A })
  writeActive(dir, 'session-b', { plan: PLAN_B })

  assert.equal(readActive(dir, 'session-a').plan, PLAN_A)
  assert.equal(readActive(dir, 'session-b').plan, PLAN_B)
})

test('une session sans état ne lit jamais celui d’une autre', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { plan: PLAN_A })

  assert.equal(readActive(dir, 'session-b').plan, null)
})

test('une session sans état retombe sur le seau partagé', () => {
  const dir = ovrsee()

  writeActive(dir, null, { plan: PLAN_A }) // le CLI, sans identifiant

  assert.equal(readActive(dir, 'session-neuve').plan, PLAN_A)
})

test('écrire ne recopie jamais chez soi l’état du seau partagé', () => {
  const dir = ovrsee()

  writeActive(dir, null, { plan: PLAN_A, ticket: 'T-0001' })
  writeActive(dir, 'session-a', { ticket: 'T-0002' })

  // La session n'hérite pas du plan partagé : elle n'a écrit qu'un ticket.
  assert.deepEqual(readActive(dir, 'session-a'), { plan: null, ticket: 'T-0002' })
})

test('un patch partiel garde les champs qu’il ne cite pas', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { plan: PLAN_A, ticket: 'T-0007' })
  writeActive(dir, 'session-a', { ticket: 'T-0008' })

  assert.deepEqual(readActive(dir, 'session-a'), { plan: PLAN_A, ticket: 'T-0008' })
})

// --- clearActive ----------------------------------------------------------

test('clearActive retire un champ, puis l’entrée quand elle est vide', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { plan: PLAN_A, ticket: 'T-0007' })
  clearActive(dir, 'session-a', 'ticket')
  assert.deepEqual(readActive(dir, 'session-a'), { plan: PLAN_A, ticket: null })

  clearActive(dir, 'session-a', 'plan')
  assert.equal(existsSync(join(dir, '.active', 'session-a.json')), false)
})

test('clearActive ne retire un champ que s’il porte la valeur attendue', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { ticket: 'T-0007' })
  clearActive(dir, 'session-a', 'ticket', 'T-0009')
  assert.equal(readActive(dir, 'session-a').ticket, 'T-0007')

  clearActive(dir, 'session-a', 'ticket', 'T-0007')
  assert.equal(readActive(dir, 'session-a').ticket, null)
})

test('clearActive sans champ retire toute l’entrée, et pas celle des autres', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { plan: PLAN_A })
  writeActive(dir, 'session-b', { plan: PLAN_B })

  clearActive(dir, 'session-a')

  assert.equal(readActive(dir, 'session-a').plan, null)
  assert.equal(readActive(dir, 'session-b').plan, PLAN_B)
})

// --- allActive / activePlans ---------------------------------------------

test('allActive et activePlans voient toutes les sessions', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-a', { plan: PLAN_A })
  writeActive(dir, 'session-b', { plan: PLAN_B })
  writeActive(dir, 'session-c', { plan: PLAN_A }) // deux sessions, un même plan

  assert.equal(allActive(dir).length, 3)
  assert.deepEqual(activePlans(dir).sort(), [PLAN_A, PLAN_B])
})

test('activePlans rend une liste vide sur un dépôt sans état', () => {
  assert.deepEqual(activePlans(ovrsee()), [])
})

// --- péremption -----------------------------------------------------------

test('une entrée non touchée depuis plus d’un jour est oubliée', () => {
  const dir = ovrsee()

  writeActive(dir, 'session-morte', { plan: PLAN_A })
  vieillirDe(join(dir, '.active', 'session-morte.json'), JOUR_MS + 60_000)

  assert.equal(readActive(dir, 'session-morte').plan, null)
  assert.deepEqual(allActive(dir), [])
  assert.equal(existsSync(join(dir, '.active', 'session-morte.json')), false)
})

// --- validation -----------------------------------------------------------

test('une entrée corrompue ou hostile est lue comme vide', () => {
  const dir = ovrsee()
  mkdirSync(join(dir, '.active'), { recursive: true })

  writeFileSync(join(dir, '.active', 'cassee.json'), 'ceci n’est pas du JSON', 'utf8')
  assert.deepEqual(readActive(dir, 'cassee'), { plan: null, ticket: null })

  writeFileSync(
    join(dir, '.active', 'hostile.json'),
    JSON.stringify({ plan: '../../../etc/passwd', ticket: 'pas-un-id' }),
    'utf8',
  )
  assert.deepEqual(readActive(dir, 'hostile'), { plan: null, ticket: null })
})

test('un identifiant de session hostile ne sort pas de .active/', () => {
  const dir = ovrsee()

  writeActive(dir, '../../evade', { plan: PLAN_A })

  assert.equal(existsSync(join(dir, '.active', 'evade.json')), true)
  assert.equal(readActive(dir, '../../evade').plan, PLAN_A)
})

// --- migration ------------------------------------------------------------

test('les anciens pointeurs migrent vers le seau partagé, une fois', () => {
  const dir = ovrsee()

  writeFileSync(join(dir, '.active-plan'), PLAN_A + '\n', 'utf8')
  writeFileSync(join(dir, '.active-ticket'), 'T-0042\n', 'utf8')

  assert.deepEqual(readActive(dir, 'session-neuve'), { plan: PLAN_A, ticket: 'T-0042' })
  assert.equal(existsSync(join(dir, '.active-plan')), false)
  assert.equal(existsSync(join(dir, '.active-ticket')), false)

  const migre = JSON.parse(readFileSync(join(dir, '.active', 'unknown.json'), 'utf8'))
  assert.deepEqual(migre, { plan: PLAN_A, ticket: 'T-0042' })
})

test('la migration ne piétine pas un seau partagé déjà écrit', () => {
  const dir = ovrsee()

  writeActive(dir, null, { plan: PLAN_B })
  writeFileSync(join(dir, '.active-plan'), PLAN_A + '\n', 'utf8')

  assert.equal(readActive(dir, null).plan, PLAN_B)
})

// --- withLock -------------------------------------------------------------

test('withLock rend la valeur de sa fonction et libère le verrou', () => {
  const dir = ovrsee()

  assert.equal(
    withLock(dir, () => 42),
    42,
  )
  assert.equal(existsSync(join(dir, '.active', '.lock')), false)
})

test('withLock libère le verrou même quand la fonction lève', () => {
  const dir = ovrsee()

  assert.throws(() =>
    withLock(dir, () => {
      throw new Error('boum')
    }),
  )
  assert.equal(existsSync(join(dir, '.active', '.lock')), false)
})

test('withLock brise un verrou abandonné plutôt que d’attendre en vain', () => {
  const dir = ovrsee()
  const verrou = join(dir, '.active', '.lock')
  mkdirSync(verrou, { recursive: true })
  vieillirDe(verrou, 60_000) // abandonné par un processus mort

  const debut = Date.now()
  assert.equal(
    withLock(dir, () => 'passé'),
    'passé',
  )
  assert.ok(Date.now() - debut < 5_000, 'ne doit pas avoir attendu la limite')
})

test('withLock sérialise deux allocations : deux identifiants distincts', () => {
  const dir = ovrsee()
  const vus = []

  // Le motif de nextTicketId : lire l'état, en déduire le suivant, l'écrire.
  const allouer = () =>
    withLock(dir, () => {
      const suivant = vus.length + 1
      vus.push(suivant)
      return suivant
    })

  assert.equal(allouer(), 1)
  assert.equal(allouer(), 2)
  assert.deepEqual(vus, [1, 2])
})
