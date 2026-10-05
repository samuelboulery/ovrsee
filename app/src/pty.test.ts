import assert from 'node:assert/strict'
import test from 'node:test'

import { cibleDeCommande, claude, nettoyerCollage, pasteTo, pasteToClaude, submitTo } from './pty'

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

test('pasteTo : un seul collage encadré, jamais validé', () => {
  const ecrits = brancher()

  assert.equal(pasteTo('pty-1', 'ligne un\nligne deux'), true)
  assert.equal(ecrits.length, 1, 'une seule écriture — rien ne peut s’intercaler')
  // Le saut de ligne interne est dans le collage : il ne valide pas, et rien
  // ne valide après. L'Entrée reste à l'humain.
  assert.equal(ecrits[0].text, '\x1b[200~ligne un\nligne deux\x1b[201~')
  assert.doesNotMatch(ecrits[0].text, /\r/)

  debrancher()
})

test('submitTo : le retour chariot est hors du collage encadré, et seul', () => {
  const ecrits = brancher()

  submitTo('pty-1', 'ligne un\nligne deux')
  assert.equal(ecrits[0].text, '\x1b[200~ligne un\nligne deux\x1b[201~\r')

  debrancher()
})

test('pasteToClaude : vise la session Claude du projet courant', () => {
  const ecrits = brancher()
  claude.id = 'pty-claude'

  assert.equal(pasteToClaude('salut'), true)
  assert.equal(ecrits[0].ptyId, 'pty-claude')

  claude.id = null
  debrancher()
})

test('pasteToClaude : sans session, rend false et n’écrit rien', () => {
  const ecrits = brancher()
  claude.id = null

  assert.equal(pasteToClaude('salut'), false)
  assert.equal(ecrits.length, 0)

  debrancher()
})

test('pasteTo : sans passerelle — le cas navigateur — rend false', () => {
  // Un vrai navigateur a bien un `window` ; c'est `window.ovrsee` qui manque,
  // la passerelle n'étant posée que par le preload d'Electron.
  ;(globalThis as { window?: unknown }).window = {}

  assert.equal(pasteTo('pty-1', 'salut'), false)

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

test('un texte venu de la page observée ne ferme pas le collage encadré (T-0273)', () => {
  // La console et le sélecteur d'élément de l'onglet Navigateur finissent ici.
  // Un `\x1b[201~` y fermait le collage, et la suite partait comme des touches.
  const ecrits = brancher()
  const hostile = 'a\x1b[201~rm -rf ~\r\x9b201~\x07\x7fb\tc\nd'
  pasteTo('pty-1', hostile)
  for (const { text } of ecrits) {
    const dedans = text.slice('\x1b[200~'.length, text.lastIndexOf('\x1b[201~'))
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(dedans, /[\x00-\x08\x0b-\x1f\x7f-\x9f]/, JSON.stringify(dedans))
    assert.match(dedans, /b\tc\nd$/, 'tabulation et saut de ligne restent')
  }
  debrancher()
})

test('le collage retire aussi les caractères invisibles (T-0273)', () => {
  // Une consigne cachée dans un texte que l'utilisateur croit relire.
  const ecrits = brancher()
  pasteTo('pty-1', 'a\u200bb\u202ec\u2028d\u2066e\ufefff\u{e0049}g')
  assert.equal(ecrits[0].text, '\x1b[200~abcdefg\x1b[201~')
  assert.equal(nettoyerCollage('é ü 日本 😀'), 'é ü 日本 😀')
  debrancher()
})
