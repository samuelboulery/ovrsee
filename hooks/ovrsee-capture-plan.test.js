import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { planFrom, planPathFromTranscript } from './ovrsee-capture-plan.js'

/**
 * Un faux dossier de plans, branché à la place de `~/.claude/plans`.
 *
 * Les cas ci-dessous écrivent de vrais fichiers de plan : sans cette
 * substitution, ils pollueraient le dossier de plans de la machine, et le
 * repli « le fichier le plus récent » y attraperait un plan réel.
 */
const planDirJetable = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-plans-'))
  process.env.OVRSEE_PLAN_DIR = dir
  return dir
}

/** Un plan écrit dans le dossier, daté pour que « le plus récent » soit décidable. */
const ecrirePlan = (dir, nom, corps, ageMs = 0) => {
  const path = join(dir, nom)
  writeFileSync(path, corps, 'utf8')
  if (ageMs) {
    const at = new Date(Date.now() - ageMs)
    utimesSync(path, at, at)
  }
  return path
}

/** Un transcript JSONL citant un chemin, comme Claude Code en écrit un. */
const ecrireTranscript = (chemins, nom = 'transcript.jsonl') => {
  const dir = mkdtempSync(join(tmpdir(), 'ovrsee-transcript-'))
  const path = join(dir, nom)
  const lignes = chemins.map(c => JSON.stringify({ type: 'user', text: `plan: ${c}` }))
  writeFileSync(path, lignes.join('\n') + '\n', 'utf8')
  return path
}

// --- planPathFromTranscript ----------------------------------------------

test('planPathFromTranscript retient le chemin de plan cité par le transcript', () => {
  const dir = planDirJetable()
  const plan = ecrirePlan(dir, 'mon-plan.md', '# Mon plan\n')

  const transcript = ecrireTranscript([plan])
  assert.equal(planPathFromTranscript(transcript), plan)
})

test('planPathFromTranscript retient la dernière citation, pas la première', () => {
  const dir = planDirJetable()
  const premier = ecrirePlan(dir, 'premier.md', '# Premier\n')
  const second = ecrirePlan(dir, 'second.md', '# Second\n')

  const transcript = ecrireTranscript([premier, second])
  assert.equal(planPathFromTranscript(transcript), second)
})

test('planPathFromTranscript ignore un markdown hors du dossier des plans', () => {
  planDirJetable()

  const transcript = ecrireTranscript(['/Users/quelquun/secrets/notes.md'])
  assert.equal(planPathFromTranscript(transcript), null)
})

test('planPathFromTranscript refuse un chemin qui ressort par ..', () => {
  const dir = planDirJetable()

  const transcript = ecrireTranscript([`${dir}/../../etc/passwd.md`])
  assert.equal(planPathFromTranscript(transcript), null)
})

test('planPathFromTranscript rend null sans transcript, ou sur un fichier absent', () => {
  planDirJetable()

  assert.equal(planPathFromTranscript(undefined), null)
  assert.equal(planPathFromTranscript(''), null)
  assert.equal(planPathFromTranscript('/nexiste/pas.jsonl'), null)
})

// --- planFrom -------------------------------------------------------------

test('planFrom préfère le plan du transcript au fichier le plus récent', () => {
  const dir = planDirJetable()
  // Le plan de la session, écrit il y a une minute…
  const mien = ecrirePlan(dir, 'le-mien.md', '# Le mien\n', 60_000)
  // …et celui d'une session voisine, écrit à l'instant.
  ecrirePlan(dir, 'celui-dun-autre.md', "# Celui d'un autre\n")

  const payload = { tool_input: {}, transcript_path: ecrireTranscript([mien]) }
  assert.equal(planFrom(payload), '# Le mien\n')
})

test('planFrom honore encore le plan passé en clair dans le payload', () => {
  planDirJetable()

  assert.equal(planFrom({ tool_input: { plan: '# En clair\n' } }), '# En clair\n')
})

test('planFrom honore planFilePath avant le transcript', () => {
  const dir = planDirJetable()
  const nomme = ecrirePlan(dir, 'nomme.md', '# Nommé\n')
  const autre = ecrirePlan(dir, 'autre.md', '# Autre\n')

  const payload = {
    tool_input: { planFilePath: nomme },
    transcript_path: ecrireTranscript([autre]),
  }
  assert.equal(planFrom(payload), '# Nommé\n')
})

test('planFrom avertit quand il en est réduit à deviner', () => {
  const dir = planDirJetable()
  ecrirePlan(dir, 'devine.md', '# Deviné\n')

  const avertissements = []
  const texte = planFrom({ tool_input: {} }, Date.now(), m => avertissements.push(m))

  assert.equal(texte, '# Deviné\n')
  assert.equal(avertissements.length, 1)
  assert.match(avertissements[0], /transcript/)
})

test('planFrom n’avertit pas quand le transcript a tranché', () => {
  const dir = planDirJetable()
  const mien = ecrirePlan(dir, 'net.md', '# Net\n')

  const avertissements = []
  planFrom({ tool_input: {}, transcript_path: ecrireTranscript([mien]) }, Date.now(), m =>
    avertissements.push(m),
  )

  assert.deepEqual(avertissements, [])
})

test('planFrom rend null quand le dossier des plans est vide', () => {
  planDirJetable()

  assert.equal(planFrom({ tool_input: {} }), null)
})
