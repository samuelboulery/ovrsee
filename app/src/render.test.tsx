import type { ReactElement } from 'react'

import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Garde, Panne, messageDe } from './Garde'
import { BandeauSignal, MenuBar, PEREMPTION_MS, ProjetCard, SessionCard } from './MenuBarPanel'
import type { MenuBarSession } from './menubar'
import type { Snapshot } from './data'
import { Apercu } from './tabs/Apercu'
import { Donnees } from './tabs/Donnees'
import { Historique } from './tabs/Historique'
import { Produit } from './tabs/Produit'
import { Stack } from './tabs/Stack'
import { Tableau } from './tabs/Tableau'
import { Detail } from './tabs/TableauDetail'
import { TableauEpics } from './tabs/TableauEpics'

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
  [
    'epic avec enfants',
    snapshot({
      board: [{ id: 'backlog', titre: 'Backlog' }, { id: 'fait', titre: 'Fait' }],
      tickets: [
        { id: 'T-1', file: 'T-0001-epic.md', titre: 'Epic', type: 'epic', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01', maj: '2026-08-01', plan: null, tags: [], corps: '' },
        { id: 'T-2', file: 'T-0002-enfant.md', titre: 'Enfant', epic: 'T-1', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01', maj: '2026-08-01', plan: null, tags: [], corps: '' },
        { id: 'T-3', file: 'T-0003-enfant2.md', titre: 'Enfant 2', epic: 'T-1', colonne: 'fait', priorite: 'moyenne', cree: '2026-08-01', maj: '2026-08-01', plan: null, tags: [], corps: '' },
      ],
    }),
  ],
  [
    'enfant orphelin',
    snapshot({
      board: [{ id: 'backlog', titre: 'Backlog' }, { id: 'fait', titre: 'Fait' }],
      tickets: [
        { id: 'T-1', file: 'T-0001-orphelin.md', titre: 'Orphelin', epic: 'T-999', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01', maj: '2026-08-01', plan: null, tags: [], corps: '' },
      ],
    }),
  ],
  [
    "boucle d'epics",
    snapshot({
      board: [{ id: 'backlog', titre: 'Backlog' }, { id: 'fait', titre: 'Fait' }],
      tickets: [
        { id: 'T-1', file: 'T-0001-epic1.md', titre: 'Epic 1', type: 'epic', epic: 'T-2', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01', maj: '2026-08-01', plan: null, tags: [], corps: '' },
        { id: 'T-2', file: 'T-0002-epic2.md', titre: 'Epic 2', type: 'epic', epic: 'T-1', colonne: 'backlog', priorite: 'haute', cree: '2026-08-01', maj: '2026-08-01', plan: null, tags: [], corps: '' },
      ],
    }),
  ],
]

/** De quoi rendre le panneau de détail sur un instantané qui n'a aucun ticket. */
const TICKET_NU = {
  id: 'T-0000',
  file: 'T-0000-rien.md',
  titre: 'Rien',
  colonne: 'backlog',
  priorite: 'moyenne',
  cree: '2026-08-01',
  maj: '2026-08-01',
  plan: null,
  tags: [],
  corps: '',
} as unknown as Snapshot['tickets'][number]

const RENDUS: Array<[string, (snap: Snapshot) => ReactElement]> = [
  [
    'Aperçu',
    snap => (
      <Apercu snapshot={snap} onOpenPreferences={() => {}} onReload={() => {}} onVoirTousLesPlans={() => {}} />
    ),
  ],
  [
    'Produit',
    snap => (
      <Produit
        snapshot={snap}
        layout="bottom"
        packageManager="pnpm"
        onOuvrirDansNavigateur={() => {}}
        onReload={() => {}}
      />
    ),
  ],
  [
    'Historique',
    snap => (
      <Historique
        projet="ovrsee"
        plans={snap.plans ?? []}
        activePlans={snap.activePlans}
        timeline={snap.timeline ?? []}
        ticketTimeline={snap.ticketTimeline ?? []}
        onOuvrirTicket={() => {}}
      />
    ),
  ],
  [
    'Tableau',
    snap => (
      <Tableau
        projet="ovrsee"
        root={snap.root}
        board={snap.board ?? []}
        tickets={snap.tickets ?? []}
        onChange={() => {}}
      />
    ),
  ],
  [
    'Tableau — vue Epics',
    snap => (
      <TableauEpics
        tickets={snap.tickets ?? []}
        board={snap.board ?? []}
        onOuvrir={() => {}}
        ouverte={null}
      />
    ),
  ],
  [
    'Tableau — panneau de détail',
    snap => (
      <Detail
        ticket={(snap.tickets ?? [])[0] ?? TICKET_NU}
        colonnes={snap.board ?? []}
        allTickets={snap.tickets ?? []}
        root={snap.root}
        onFermer={() => {}}
        onModifier={() => {}}
        onDeplacer={() => {}}
        onSupprimer={() => {}}
      />
    ),
  ],
  // Le graphe ne vient plus du snapshot (T-0134) : l'onglet le demande lui-même
  // au montage, et `useEffect` ne tourne pas sous `renderToStaticMarkup`. Ce
  // rendu-ci est donc celui de l'état « en cours de lecture ».
  ['Données', () => <Donnees projet="ovrsee" vaultDeclared={false} />],
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

// --- le popover de la barre de menu ---------------------------------------

const session = (
  attention: MenuBarSession['attention'] = { kind: 'question', detail: 'permission to use Bash', at: Date.now() },
  patch: Partial<MenuBarSession> = {},
): MenuBarSession => ({
  sessionKey: '/tmp/projet#claude',
  ptyId: 'pty-1',
  projet: '/tmp/projet',
  nom: 'projet',
  attention,
  ...patch,
})

test('barre de menu — une attente propose de décider', () => {
  const html = renderToStaticMarkup(
    <SessionCard session={session()} now={Date.now()} onAnswer={() => {}} />,
  )

  assert.match(html, /permission to use Bash/, 'le détail du hook est affiché')
  assert.doesNotMatch(html, /disabled/, 'les boutons de décision sont actifs')
})

test('barre de menu — une attente périmée grise ses boutons', () => {
  const now = Date.now()
  const vieille = { kind: 'question' as const, detail: null, at: now - PEREMPTION_MS - 1 }
  const html = renderToStaticMarkup(
    <SessionCard session={session(vieille)} now={now} onAnswer={() => {}} />,
  )

  // Deux `disabled` : Autoriser et Refuser. « Ouvrir la session » reste actif —
  // c'est le repli quand on ne peut plus décider d'ici.
  assert.equal(html.match(/disabled/g)?.length, 2)
})

test('barre de menu — un « c’est à toi » n’offre pas de décision', () => {
  const fini = { kind: 'stop' as const, detail: null, at: Date.now() }
  const html = renderToStaticMarkup(
    <SessionCard session={session(fini)} now={Date.now()} onAnswer={() => {}} />,
  )

  assert.doesNotMatch(html, /Autoriser|Allow/)
  assert.doesNotMatch(html, /Refuser|Deny/)
})

test('barre de menu — une session muette paraît, sans rien à décider', () => {
  // Le défaut qui a motivé T-0141 : elle n'apparaissait pas du tout.
  const html = renderToStaticMarkup(
    <SessionCard session={session(null)} now={Date.now()} onAnswer={() => {}} />,
  )

  assert.match(html, /projet/)
  assert.match(html, /En cours|Running/)
  assert.doesNotMatch(html, /Autoriser|Allow/)
})

test('barre de menu — le bloc projet dit où en est le dépôt', () => {
  const html = renderToStaticMarkup(
    <ProjetCard
      projet={{
        nom: 'ovrsee',
        projet: '/tmp/projet',
        planActif: 'Barre de menu macOS',
        ticketsRestants: 7,
        branche: 'main',
        fichiersModifies: 25,
        dernierScan: '2026-08-14',
      }}
    />,
  )

  assert.match(html, /Barre de menu macOS/)
  assert.match(html, /7/)
  assert.match(html, /main/)
  assert.match(html, /2026-08-14/)
})

test('barre de menu — le bandeau nomme la commande qui manque', () => {
  const html = renderToStaticMarkup(<BandeauSignal />)

  assert.match(html, /pnpm ovrsee:install/)
  assert.match(html, /role="alert"/)
})

test('barre de menu — le popover vide ne lève pas', () => {
  const html = renderToStaticMarkup(<MenuBar />)
  assert.match(html, /Aucune session|No open session/)
})
