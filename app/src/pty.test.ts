import assert from 'node:assert/strict'
import test from 'node:test'

import { cibleDeCommande, claude, pasteTo, submitTo, submitToClaude } from './pty'

/**
 * La séquence d'échappement est le genre de détail qui casse sans rien dire :
 * un `\r` mal placé part comme du texte au lieu de valider, et on ne le voit
 * qu'en regardant un vrai terminal.
 */

/** Branche une passerelle de terminal factice, et rend ce qui y a été écrit. */
function brancher() {
  const ecrits: Array<{ ptyId: string; text: string }> = []
  ;(globalThis as { window?: unknown }).window = {
    ovrsee: { terminal: { write: (ptyId: string, text: string) => ecrits.push({ ptyId, text }) } },
  }
  return ecrits
}

const debrancher = () => {
  delete (globalThis as { window?: unknown }).window
}

test('submitTo : le retour chariot est hors du collage encadré', () => {
  const ecrits = brancher()

  assert.equal(submitTo('pty-1', 'bonjour'), true)
  assert.equal(ecrits.length, 1, 'une seule écriture — rien ne peut s’intercaler')
  assert.equal(ecrits[0].text, '\x1b[200~bonjour\x1b[201~\r')

  debrancher()
})

test('submitTo : le multiligne reste littéral, une seule validation à la fin', () => {
  const ecrits = brancher()

  submitTo('pty-1', 'ligne un\nligne deux')

  // Le saut de ligne interne est dans le collage : il ne valide pas.
  assert.equal(ecrits[0].text, '\x1b[200~ligne un\nligne deux\x1b[201~\r')
  assert.equal(ecrits[0].text.split('\r').length - 1, 1, 'un seul \\r, et il est final')

  debrancher()
})

test('pasteTo : ne valide pas — la différence avec submitTo tient à ça', () => {
  const ecrits = brancher()

  pasteTo('pty-1', 'bonjour')

  assert.equal(ecrits[0].text, '\x1b[200~bonjour\x1b[201~')
  assert.doesNotMatch(ecrits[0].text, /\r/)

  debrancher()
})

test('submitToClaude : vise la session Claude du projet courant', () => {
  const ecrits = brancher()
  claude.id = 'pty-claude'

  assert.equal(submitToClaude('salut'), true)
  assert.equal(ecrits[0].ptyId, 'pty-claude')

  claude.id = null
  debrancher()
})

test('submitToClaude : sans session, rend false et n’écrit rien', () => {
  const ecrits = brancher()
  claude.id = null

  assert.equal(submitToClaude('salut'), false)
  assert.equal(ecrits.length, 0)

  debrancher()
})

test('submitTo : sans passerelle — le cas navigateur — rend false', () => {
  // Un vrai navigateur a bien un `window` ; c'est `window.ovrsee` qui manque,
  // la passerelle n'étant posée que par le preload d'Electron.
  ;(globalThis as { window?: unknown }).window = {}

  assert.equal(submitTo('pty-1', 'salut'), false)

  debrancher()
})

// --- cibleDeCommande : où part une commande cliquée ---

const PTYS = { '/p#claude': 'pty-1', '/p#shell-1': 'pty-2' }

test('cibleDeCommande : l\'onglet sous les yeux, pas la session Claude', () => {
  // Issue #49 : un raccourci cliqué depuis un shell nu partait chez `claude`.
  const ou = cibleDeCommande({
    mode: 'command',
    actif: '/p#shell-1',
    claudeKey: '/p#claude',
    ptyIds: PTYS,
    occupees: new Set(),
  })

  assert.deepEqual(ou, { cible: '/p#shell-1' })
})

test('cibleDeCommande : un onglet actif sans pty retombe sur Claude', () => {
  // Le cas du tout premier rendu, avant que `pty:open` ait répondu.
  const ou = cibleDeCommande({
    mode: 'command',
    actif: '/p#shell-2',
    claudeKey: '/p#claude',
    ptyIds: PTYS,
    occupees: new Set(),
  })

  assert.deepEqual(ou, { cible: '/p#claude' })
})

test('cibleDeCommande : une commande immédiate sur une session occupée ouvre un terminal', () => {
  const ou = cibleDeCommande({
    mode: 'command',
    actif: '/p#shell-1',
    claudeKey: '/p#claude',
    ptyIds: PTYS,
    occupees: new Set(['/p#shell-1']),
  })

  assert.deepEqual(ou, { neuf: true })
})

test('cibleDeCommande : ce qui se colle sans valider ignore l\'occupation', () => {
  // C'est du texte à relire, pas une commande : il va là où on regarde.
  const ou = cibleDeCommande({
    mode: 'context',
    actif: '/p#shell-1',
    claudeKey: '/p#claude',
    ptyIds: PTYS,
    occupees: new Set(['/p#shell-1']),
  })

  assert.deepEqual(ou, { cible: '/p#shell-1' })
})

test('cibleDeCommande : sans aucun pty, rien — l\'appelant copie', () => {
  // Le cas du navigateur : pas de passerelle, donc pas de session.
  assert.equal(
    cibleDeCommande({ mode: 'command', actif: null, claudeKey: '/p#claude', ptyIds: {}, occupees: new Set() }),
    null,
  )
})
