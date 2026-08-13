import assert from 'node:assert/strict'
import test from 'node:test'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { genrePour, projetEquipe, sequence } from './ovrsee-notify.js'

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))

test('notify : une fin de tour signale « stop »', () => {
  assert.equal(genrePour({ hook_event_name: 'Stop' }), 'stop')
})

test('notify : seules les notifications qui attendent une réponse signalent', () => {
  const attendues = ['permission_prompt', 'idle_prompt', 'agent_needs_input']
  for (const notification_type of attendues) {
    assert.equal(
      genrePour({ hook_event_name: 'Notification', notification_type }),
      'question',
      `${notification_type} devrait signaler`,
    )
  }

  // Ces types-là décrivent un événement déjà résolu : les signaler ferait
  // sonner l'ovrsee pour rien.
  const ignorees = ['auth_success', 'elicitation_complete', 'elicitation_response', 'agent_completed']
  for (const notification_type of ignorees) {
    assert.equal(
      genrePour({ hook_event_name: 'Notification', notification_type }),
      null,
      `${notification_type} ne devrait rien signaler`,
    )
  }
})

test('notify : une charge utile inattendue ne signale rien plutôt que de deviner', () => {
  for (const payload of [null, undefined, 'Stop', 42, {}, { hook_event_name: 'PreToolUse' }]) {
    assert.equal(genrePour(payload), null)
  }
})

test('notify : seul un projet équipé reçoit le signal', () => {
  // Les hooks sont enregistrés dans `~/.claude/settings.json`, donc ils
  // tournent partout : sans cette garde, l'ovrsee écrirait dans le terminal de
  // n'importe quel projet.
  assert.equal(projetEquipe(RACINE), true, 'le dépôt ovrsee est équipé')
  assert.equal(projetEquipe(join(RACINE, 'hooks')), true, 'un sous-dossier aussi')
  assert.equal(projetEquipe('/'), false, 'la racine du disque ne l’est pas')
})

test('notify : la séquence est celle que `app/src/attention.ts` sait lire', () => {
  const ESC = String.fromCharCode(27)
  const BEL = String.fromCharCode(7)

  // L'émetteur et le parseur vivent dans deux langages : seule cette égalité
  // les tient accordés.
  assert.equal(sequence('stop'), `${ESC}]777;ovrsee;stop${BEL}`)
  assert.equal(sequence('question'), `${ESC}]777;ovrsee;question${BEL}`)
})
