import assert from 'node:assert/strict'
import test from 'node:test'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

import {
  aNotifier,
  contenuNotification,
  dernierePhrase,
  detailPour,
  formatDuree,
  genrePour,
  lireTour,
  pidVivant,
  projetEquipe,
  sequence,
  validerInbox,
  voiePour,
} from './ovrsee-notify.js'

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))

test('notify : une fin de tour signale « stop »', () => {
  assert.equal(genrePour({ hook_event_name: 'Stop' }), 'stop')
})

test('notify : une fin de tour avec du travail de fond en vol reste « busy »', () => {
  const tache = { id: 'a1', type: 'workflow', status: 'running', description: 'revue' }
  assert.equal(genrePour({ hook_event_name: 'Stop', background_tasks: [tache] }), 'busy')
  // Liste vide, ou absente (Claude Code d'avant ce champ) : la session a fini.
  assert.equal(genrePour({ hook_event_name: 'Stop', background_tasks: [] }), 'stop')
  assert.equal(genrePour({ hook_event_name: 'Stop', background_tasks: 'n/a' }), 'stop')
  // Et le « busy » d'une fin de tour ne renomme pas l'onglet : pas de détail.
  assert.equal(detailPour({ hook_event_name: 'Stop', background_tasks: [tache] }), null)
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

const tmp = () => mkdtempSync(join(tmpdir(), 'ovrsee-notify-'))

test('notify : la voie suit OVRSEE_TERMINAL, puis le pid de la barre de menus, puis osascript', () => {
  const dir = tmp()
  const vivant = join(dir, 'vivant.pid')
  const mort = join(dir, 'mort.pid')
  writeFileSync(vivant, String(process.pid))
  // Un pid au-delà de tout ce que le noyau attribue : jamais vivant.
  writeFileSync(mort, '2147483646')

  assert.equal(voiePour({ OVRSEE_TERMINAL: '1' }, vivant, 'darwin'), 'osc')
  assert.equal(voiePour({}, vivant, 'darwin'), 'inbox')
  assert.equal(voiePour({}, mort, 'darwin'), 'osascript')
  assert.equal(voiePour({}, join(dir, 'absent.pid'), 'darwin'), 'osascript')
  // Hors macOS, pas de filet osascript : rien plutôt qu'une erreur.
  assert.equal(voiePour({}, mort, 'linux'), null)
})

test('notify : un fichier pid illisible ne passe pas pour vivant', () => {
  const dir = tmp()
  for (const contenu of ['', 'abc', '-4', '0']) {
    const f = join(dir, `p${contenu}.pid`)
    writeFileSync(f, contenu)
    assert.equal(pidVivant(f), false, contenu)
  }
})

test('notify : une question notifie toujours, une fin de tour au-delà du seuil seulement', () => {
  const reglages = { finDeTourApresMin: 2 }
  assert.equal(aNotifier('question', 1000, reglages), true)
  assert.equal(aNotifier('stop', 119_000, reglages), false)
  assert.equal(aNotifier('stop', 120_000, reglages), true)
  // Durée inconnue : une notification de trop plutôt qu'un tour long muet.
  assert.equal(aNotifier('stop', null, reglages), true)
  assert.equal(aNotifier('stop', 0, { finDeTourApresMin: 0 }), true)
  assert.equal(aNotifier('busy', 999_999, reglages), false)
})

test('notify : le tour se lit à la fin du transcript — dernière vraie demande, dernier texte', () => {
  const f = join(tmp(), 't.jsonl')
  const lignes = [
    { type: 'user', timestamp: '2026-10-27T10:00:00.000Z', message: { content: 'ancienne demande' } },
    { type: 'user', timestamp: '2026-10-27T10:05:00.000Z', message: { content: 'nouvelle demande' } },
    { type: 'assistant', timestamp: '2026-10-27T10:05:10.000Z', message: { content: [{ type: 'text', text: 'Je regarde.' }] } },
    // Un résultat d'outil est une ligne `user`, pas une demande.
    { type: 'user', timestamp: '2026-10-27T10:06:00.000Z', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'assistant', timestamp: '2026-10-27T10:08:00.000Z', message: { content: [{ type: 'tool_use' }] } },
    { type: 'assistant', timestamp: '2026-10-27T10:09:00.000Z', message: { content: [{ type: 'text', text: 'Fini. Tout passe.' }] } },
  ]
  writeFileSync(f, lignes.map(l => JSON.stringify(l)).join('\n') + '\n{coupé')
  const tour = lireTour(f)
  assert.equal(tour.debut, Date.parse('2026-10-27T10:05:00.000Z'))
  assert.equal(tour.dernier, 'Fini. Tout passe.')
  assert.deepEqual(lireTour(join(tmp(), 'absent.jsonl')), { debut: null, dernier: null })
  assert.deepEqual(lireTour(undefined), { debut: null, dernier: null })
})

test('notify : la dernière phrase, sans markdown ni bloc de code', () => {
  assert.equal(dernierePhrase('Premier point.\n\n**Tout est vert.** Dis-moi si tu veux la PR.'), 'Dis-moi si tu veux la PR.')
  assert.equal(dernierePhrase('Voici :\n```js\nconst a = 1.\n```'), 'Voici :')
  assert.equal(dernierePhrase('Voir [le ticket](https://x.y).'), 'Voir le ticket.')
  assert.equal(dernierePhrase('   '), null)
  assert.equal(dernierePhrase(42), null)
  assert.equal(dernierePhrase('x'.repeat(300)).length, 120)
})

test('notify : durée et contenu affichés', () => {
  assert.equal(formatDuree(42_000), '42 s')
  assert.equal(formatDuree(192_000), '3 min 12')
  assert.equal(formatDuree(3_900_000), '1 h 05')
  assert.deepEqual(
    contenuNotification({ genre: 'stop', projet: 'site', texte: 'Tout passe.', dureeMs: 192_000 }, 'fr'),
    { title: 'site', subtitle: 'Session terminée', body: 'Tout passe. · 3 min 12' },
  )
  assert.equal(
    contenuNotification({ genre: 'question', projet: 'site', texte: null, dureeMs: null }, 'fr').body,
    'Claude attend une réponse',
  )
})

test('notify : la charge riche voyage en JSON, coupée à la même longueur', () => {
  const encode = sequence('stop', { texte: 'y'.repeat(500), duree: 1234 }).match(/;stop;([A-Za-z0-9+/=]+)/)[1]
  assert.deepEqual(JSON.parse(Buffer.from(encode, 'base64').toString('utf8')), { texte: 'y'.repeat(120), duree: 1234 })
})

test('notify : un fichier inbox malformé est refusé, pas deviné', () => {
  const bon = { genre: 'stop', projet: 'site', texte: 'Fini.', dureeMs: 1, terminal: 'com.googlecode.iterm2' }
  assert.deepEqual(validerInbox(JSON.stringify(bon)), bon)
  assert.equal(validerInbox(JSON.stringify({ ...bon, terminal: 'x; rm -rf /' })).terminal, null)
  for (const mauvais of [
    '{coupé',
    '[]',
    'null',
    JSON.stringify({ ...bon, genre: 'busy' }),
    JSON.stringify({ ...bon, projet: 3 }),
    JSON.stringify({ ...bon, texte: 'x'.repeat(501) }),
    JSON.stringify({ ...bon, dureeMs: -1 }),
    JSON.stringify({ ...bon, dureeMs: '1' }),
    'x'.repeat(9000),
  ]) {
    assert.equal(validerInbox(mauvais), null, mauvais.slice(0, 40))
  }
})

test('notify : le fichier déposé dans l’inbox se relit tel quel par le principal', async () => {
  const { ecrireInbox } = await import('./ovrsee-notify.js')
  const { readdirSync, readFileSync, statSync } = await import('node:fs')
  const dossier = join(tmp(), 'inbox')
  const n = { genre: 'question', projet: 'site', texte: 'besoin de Bash', dureeMs: null, terminal: null }
  ecrireInbox(n, dossier)
  const [nom] = readdirSync(dossier)
  assert.match(nom, /^[0-9a-f-]{36}\.json$/)
  assert.deepEqual(validerInbox(readFileSync(join(dossier, nom), 'utf8')), n)
  assert.equal(statSync(join(dossier, nom)).mode & 0o777, 0o600)
})
