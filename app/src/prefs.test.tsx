import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { SettingsType } from './data'
import {
  basculerOnglet,
  deplacerOnglet,
  SectionActions,
  SectionActivite,
  SectionAvance,
  SectionDemarrage,
  SectionGeneral,
  SectionOnglets,
  SectionTerminal,
} from './PreferencesPanel'
import { PreferencesPreview, ongletsVisibles } from './PreferencesPreview'

/**
 * L'écran des préférences.
 *
 * Deux choses à couvrir, et pas les mêmes moyens : les invariants sur les
 * onglets sont des fonctions pures, testées directement ; le reste est un
 * rendu, vérifié comme les onglets de `render.test.tsx` — sans DOM, juste
 * assez pour attraper une exception sur un réglage absent. Le fichier de
 * préférences vient d'un disque qu'on ne contrôle pas : chaque champ peut
 * manquer, et un rendu qui lève emporterait la fenêtre entière.
 */

const ORDRE = ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']

const settings = (patch: Record<string, unknown> = {}): SettingsType =>
  ({
    langue: 'fr',
    theme: 'auto',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [...ORDRE], ordre: [...ORDRE] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: ['/project-setup'],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [],
    ...patch,
  }) as unknown as SettingsType

/* — deplacerOnglet — */

test('deplacerOnglet : monte un onglet d’un cran', () => {
  assert.deepEqual(deplacerOnglet(['a', 'b', 'c'], 1, 0), ['b', 'a', 'c'])
})

test('deplacerOnglet : descend un onglet d’un cran', () => {
  assert.deepEqual(deplacerOnglet(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
})

test('deplacerOnglet : hors bornes, rend le tableau intact', () => {
  const ordre = ['a', 'b', 'c']
  // Le même objet, pas seulement le même contenu : l'appelant s'en sert pour
  // savoir qu'il n'y a rien à enregistrer.
  assert.equal(deplacerOnglet(ordre, 0, -1), ordre)
  assert.equal(deplacerOnglet(ordre, 3, 0), ordre)
  assert.equal(deplacerOnglet(ordre, 1, 1), ordre)
})

test('deplacerOnglet : garde les sept identifiants', () => {
  // C'est l'invariant que `validateSettings` exige : un `ordre` incomplet est
  // rejeté en silence côté hooks, et l'utilisateur perd son rangement.
  const deplace = deplacerOnglet(ORDRE, 6, 0)
  assert.equal(deplace.length, ORDRE.length)
  assert.deepEqual([...deplace].sort(), [...ORDRE].sort())
})

/* — basculerOnglet — */

test('basculerOnglet : masque un onglet visible', () => {
  const suivant = basculerOnglet(settings(), 'produit')
  assert.equal(suivant.onglets.actifs.includes('produit'), false)
  assert.equal(suivant.onglets.actifs.length, 6)
})

test('basculerOnglet : remontre un onglet masqué, à sa place dans l’ordre', () => {
  const masque = settings({ onglets: { ordre: ORDRE, actifs: ['apercu', 'stack'] } })
  const suivant = basculerOnglet(masque, 'produit')
  // Rangé selon `ordre`, pas ajouté à la fin : sinon la barre d'onglets
  // suivrait l'ordre des clics.
  assert.deepEqual(suivant.onglets.actifs, ['apercu', 'produit', 'stack'])
})

test('basculerOnglet : refuse de masquer le dernier onglet visible', () => {
  const seul = settings({ onglets: { ordre: ORDRE, actifs: ['apercu'] } })
  assert.equal(basculerOnglet(seul, 'apercu'), seul)
})

test('basculerOnglet : ne casse pas sur des onglets absents', () => {
  const nu = settings({ onglets: undefined })
  const suivant = basculerOnglet(nu, 'apercu')
  assert.deepEqual(suivant.onglets.actifs, [])
})

/* — ongletsVisibles — */

test('ongletsVisibles : filtre par actifs et suit l’ordre', () => {
  const partiel = settings({
    onglets: { ordre: ['stack', 'apercu', 'produit'], actifs: ['produit', 'stack'] },
  })
  assert.deepEqual(ongletsVisibles(partiel), ['stack', 'produit'])
})

/* — rendu — */

const SECTIONS = [
  ['Général', SectionGeneral],
  ['Onglets', SectionOnglets],
  ['Terminal', SectionTerminal],
  ['Activité', SectionActivite],
  ['Actions', SectionActions],
  ['Démarrage', SectionDemarrage],
  ['Avancé', SectionAvance],
] as const

/** Les préférences telles qu'un fichier abîmé peut les rendre. */
const DEGRADES: Array<[string, SettingsType]> = [
  ['complètes', settings()],
  ['onglets absents', settings({ onglets: undefined })],
  ['ordre incomplet', settings({ onglets: { ordre: ['apercu'], actifs: ['apercu'] } })],
  ['terminal absent', settings({ terminal: undefined })],
  ['densité absente', settings({ densiteActivite: undefined })],
  ['bootstrap absent', settings({ bootstrap: undefined })],
  ['actions absentes', settings({ customActions: undefined })],
  ['actions présentes', settings({ customActions: [{ label: 'Test', text: 'pnpm test' }] })],
  ['champs de premier niveau absents', settings({ theme: undefined, langue: undefined, packageManager: undefined, sourceGraphe: undefined })],
]

for (const [nomSection, Section] of SECTIONS) {
  for (const [nomCas, valeurs] of DEGRADES) {
    test(`section ${nomSection} : rendu sur « ${nomCas} »`, () => {
      const html = renderToStaticMarkup(<Section settings={valeurs} onSettings={() => {}} />)
      assert(html.length > 0, 'rendu vide')
    })
  }
}

test('aperçu : les trois dispositions et le terminal masqué', () => {
  for (const disposition of ['bottom', 'side', 'full']) {
    const html = renderToStaticMarkup(
      <PreferencesPreview
        settings={settings({ terminal: { visible: true, disposition, hauteur: 1, largeur: 1 } })}
        highlight="terminal"
      />,
    )
    assert(html.includes('❯'), `terminal absent de l’aperçu en ${disposition}`)
  }

  const masque = renderToStaticMarkup(
    <PreferencesPreview
      settings={settings({ terminal: { visible: false, disposition: 'bottom', hauteur: 1, largeur: 1 } })}
    />,
  )
  assert.equal(masque.includes('❯'), false, 'terminal masqué mais dessiné')
})

test('aperçu : la barre d’onglets ne montre que les onglets visibles', () => {
  const html = renderToStaticMarkup(
    <PreferencesPreview
      settings={settings({ onglets: { ordre: ORDRE, actifs: ['apercu', 'stack'] } })}
      highlight="tabs"
    />,
  )
  assert(html.includes('Stack'), 'onglet visible absent')
  assert.equal(html.includes('Produit'), false, 'onglet masqué dessiné quand même')
})
