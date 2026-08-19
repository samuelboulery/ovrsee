import assert from 'node:assert/strict'
import test from 'node:test'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { detailPour, genrePour, projetEquipe, sequence } from './ovrsee-notify.js'

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))

test('notify : une fin de tour signale « stop »', () => {
  assert.equal(genrePour({ hook_event_name: 'Stop' }), 'stop')
})

test('notify : seules les notifications qui attendent une réponse signalent', () => {
  const attendues = ['permission_prompt', 'agent_needs_input']
  for (const notification_type of attendues) {
    assert.equal(
      genrePour({ hook_event_name: 'Notification', notification_type }),
      'question',
      `${notification_type} devrait signaler`,
    )
  }

  // Ces types-là décrivent un événement déjà résolu : les signaler ferait
  // sonner l'ovrsee pour rien. `idle_prompt` les a rejoints : il arrive une
  // minute après un `Stop`, et changeait la coche « a rendu la main » en point
  // d'interrogation sans qu'aucune question ait été posée.
  const ignorees = [
    'auth_success',
    'elicitation_complete',
    'elicitation_response',
    'agent_completed',
    'idle_prompt',
  ]
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

test('notify : le détail voyage en base64 derrière le genre', () => {
  const ESC = String.fromCharCode(27)
  const BEL = String.fromCharCode(7)
  const message = 'Claude needs your permission to use Bash'
  const encode = Buffer.from(message, 'utf8').toString('base64')

  assert.equal(sequence('question', message), `${ESC}]777;ovrsee;question;${encode}${BEL}`)
})

test('notify : un détail trop long est coupé plutôt que porté entier', () => {
  // Une séquence OSC traverse le pty octet par octet : c'est un canal de
  // signal, pas de transfert.
  const encode = sequence('question', 'x'.repeat(500)).match(/;question;([^]+)/)[1]

  assert.equal(Buffer.from(encode, 'base64').toString('utf8'), 'x'.repeat(120))
})

test('notify : seule une Notification porte un détail', () => {
  assert.equal(
    detailPour({ hook_event_name: 'Notification', message: '  besoin de Bash  ' }),
    'besoin de Bash',
    'le message est relayé, débarrassé de ses blancs',
  )
  assert.equal(
    detailPour({ hook_event_name: 'Stop', message: 'ignoré' }),
    null,
    '`Stop` dit « c’est à toi » : il n’y a rien à préciser',
  )

  for (const payload of [null, undefined, {}, { hook_event_name: 'Notification' }]) {
    assert.equal(detailPour(payload), null)
  }
  assert.equal(
    detailPour({ hook_event_name: 'Notification', message: '   ' }),
    null,
    'un message vide ne vaut pas mieux que pas de message',
  )
})

test('notify : un départ de tour signale « busy » et porte la demande', () => {
  const payload = { hook_event_name: 'UserPromptSubmit', prompt: 'lance les tests' }

  assert.equal(genrePour(payload), 'busy')
  assert.equal(detailPour(payload), 'lance les tests')
})

test('notify : un départ de tour sans demande signale quand même', () => {
  // Le genre suffit à faire battre la pastille ; c'est le nom de l'onglet qui
  // manque, et l'interface garde alors celui qu'il portait.
  assert.equal(genrePour({ hook_event_name: 'UserPromptSubmit' }), 'busy')
  assert.equal(detailPour({ hook_event_name: 'UserPromptSubmit' }), null)
  assert.equal(detailPour({ hook_event_name: 'UserPromptSubmit', prompt: '   ' }), null)
})

test('notify : une conversation repartie de zéro demande la réinitialisation', () => {
  for (const source of ['clear', 'startup']) {
    assert.equal(genrePour({ hook_event_name: 'SessionStart', source }), 'reset', source)
  }
})

test('notify : reprendre une conversation ne réinitialise pas son onglet', () => {
  // `resume` et `compact` gardent la même conversation : son nom vaut toujours,
  // et l'effacer perdrait une information juste.
  for (const source of ['resume', 'compact', undefined]) {
    assert.equal(genrePour({ hook_event_name: 'SessionStart', source }), null, String(source))
  }
})
