import type { ReactElement } from 'react'

import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Garde, Panne, messageDe } from './Garde'
import type { Snapshot } from './data'
import { Apercu } from './tabs/Apercu'
import { Donnees } from './tabs/Donnees'
import { Historique } from './tabs/Historique'
import { Produit } from './tabs/Produit'
import { Stack } from './tabs/Stack'
import { Tableau } from './tabs/Tableau'

/**
 * Les onglets rendus sur des instantanés dégradés.
 *
 * C'est ce qui manquait le 9 août 2026 : un champ absent dans `pages.json`
 * vidait toute l'application, et aucun test ne pouvait le voir parce que rien
 * ne rendait jamais un onglet. Le rendu se fait côté serveur, sans DOM — assez
 * pour attraper une exception de rendu, ce que ce ticket vise.
 *
 * Les onglets Navigateur et Terminal ne sont pas ici : ils importent xterm et
 * une balise `<webview>`, qui n'existent ni l'un ni l'autre hors d'un
 * navigateur.
 */
const base = {
  root: '/tmp/projet',
  equipped: true,
  plans: [],
  pages: { pages: [], orphanShots: [] },
  scans: [],
  shots: {},
  board: [],
  tickets: [],
  timeline: [],
  graph: null,
  packageJson: null,
  config: null,
  readme: null,
} as unknown as Snapshot

const snapshot = (patch: Record<string, unknown> = {}): Snapshot =>
  ({ ...base, ...patch }) as unknown as Snapshot

/** Les instantanés dont chaque onglet doit se sortir sans lever. */
const DEGRADES: Array<[string, Snapshot]> = [
  ['tout vide', snapshot()],
  ['pages.json en tableau', snapshot({ pages: [] })],
  ['pages.json nul', snapshot({ pages: null })],
  ['pages.json sans tableau', snapshot({ pages: {} })],
  ['plans absents', snapshot({ plans: undefined })],
  ['scans absents', snapshot({ scans: undefined })],
  ['tickets et board absents', snapshot({ board: undefined, tickets: undefined })],
  ['captures absentes', snapshot({ shots: undefined })],
  ['readme absent', snapshot({ readme: undefined })],
]

const RENDUS: Array<[string, (snap: Snapshot) => ReactElement]> = [
  ['Aperçu', snap => <Apercu snapshot={snap} />],
  ['Produit', snap => <Produit snapshot={snap} layout="bottom" />],
  ['Historique', snap => <Historique plans={snap.plans ?? []} timeline={snap.timeline ?? []} />],
  [
    'Tableau',
    snap => (
      <Tableau
        root={snap.root}
        board={snap.board ?? []}
        tickets={snap.tickets ?? []}
        onChange={() => {}}
      />
    ),
  ],
  ['Données', snap => <Donnees graph={snap.graph} source={snap.graphSource} vaultDeclared={false} />],
  ['Stack', snap => <Stack snapshot={snap} />],
]

for (const [onglet, rendu] of RENDUS) {
  for (const [cas, snap] of DEGRADES) {
    test(`onglet ${onglet} — ${cas}`, () => {
      const html = renderToStaticMarkup(rendu(snap))
      assert.equal(typeof html, 'string')
    })
  }
}

// --- le garde-fou ---------------------------------------------------------

test('le panneau de panne nomme l’endroit et le message', () => {
  const html = renderToStaticMarkup(<Panne quoi="l’onglet Produit" message="pages.pages is not iterable" />)
  assert.match(html, /onglet Produit/)
  assert.match(html, /pages\.pages is not iterable/)
  assert.match(html, /role="alert"/)
})

test('le garde-fou laisse passer ce qui ne lève pas', () => {
  const html = renderToStaticMarkup(
    <Garde quoi="l’onglet Stack">
      <p>contenu</p>
    </Garde>,
  )
  assert.match(html, /contenu/)
})

test('getDerivedStateFromError retient l’erreur', () => {
  const boom = new Error('cassé')
  assert.equal(Garde.getDerivedStateFromError(boom).error, boom)
})

test('messageDe rend une chaîne quoi qu’on lui donne', () => {
  assert.equal(messageDe(new Error('cassé')), 'cassé')
  assert.equal(messageDe(new TypeError()), 'TypeError')
  assert.equal(messageDe('juste une chaîne'), 'juste une chaîne')
  assert.equal(messageDe(null), 'null')
})
