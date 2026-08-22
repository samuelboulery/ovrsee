import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { SettingsType } from './data'
import { appliquerReponses, apercuReponses, reponsesInitiales, type Reponses } from './profilage'
import { Onboarding } from './Onboarding'
import { Logo, SchemaBoucle } from './OnboardingArt'

/**
 * La présentation de premier lancement.
 *
 * Deux moyens, comme dans `prefs.test.tsx` : la logique est pure et se teste
 * directement ; les écrans se vérifient par un rendu sans DOM, assez pour
 * attraper une exception. Ce qui compte le plus ici est qu'aucune réponse ne
 * soit décorative — chaque test de mapping est la preuve qu'une question a un
 * effet.
 */

const ORDRE = ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']

const settings = (patch: Record<string, unknown> = {}): SettingsType =>
  ({
    langue: 'fr',
    theme: 'auto',
    densiteActivite: { granularite: 'semaine', fenetre: '3mois' },
    onglets: { actifs: [...ORDRE], ordre: [...ORDRE] },
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468, disabled: false },
    bootstrap: ['/project-setup'],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [],
    onboardingVu: false,
    ...patch,
  }) as unknown as SettingsType

const reponses = (patch: Partial<Reponses> = {}): Reponses => ({
  profil: 'complet',
  vuesActives: null,
  bootstrap: true,
  ...patch,
})

/* — appliquerReponses — */

test('appliquerReponses : le template range les onglets et place le terminal', () => {
  const result = appliquerReponses(settings(), reponses({ profil: 'dev' }))

  assert.deepEqual(result.onglets.actifs, ['apercu', 'tableau', 'stack', 'historique'])
  assert.equal(result.terminal.visible, true)
  assert.equal(result.terminal.disposition, 'side')
})

test('appliquerReponses : un template sans terminal le masque et le désactive', () => {
  const result = appliquerReponses(settings(), reponses({ profil: 'sobre' }))
  assert.equal(result.terminal.visible, false)
  assert.equal(result.terminal.disabled, true)
})

test('appliquerReponses : `ordre` garde ses sept identifiants', () => {
  // Sinon `validateSettings` rejette le tableau sans rien dire et le rangement
  // retombe à l'usine — le piège documenté dans PreferencesProfils.tsx.
  const result = appliquerReponses(settings(), reponses({ profil: 'sobre' }))
  assert.equal(new Set(result.onglets.ordre).size, ORDRE.length)
  assert.deepEqual([...result.onglets.ordre].sort(), [...ORDRE].sort())
})

test('appliquerReponses : les tailles du terminal ne bougent pas', () => {
  const result = appliquerReponses(
    settings({ terminal: { visible: true, disposition: 'bottom', hauteur: 300, largeur: 500 } }),
    reponses(),
  )
  assert.equal(result.terminal.hauteur, 300)
  assert.equal(result.terminal.largeur, 500)
})

test('appliquerReponses : le bootstrap suit la case', () => {
  assert.deepEqual(appliquerReponses(settings(), reponses({ bootstrap: false })).bootstrap, [])
  assert.deepEqual(
    appliquerReponses(settings(), reponses({ bootstrap: true })).bootstrap,
    ['/project-setup'],
  )
})

test('appliquerReponses : langue et densité restent intactes', () => {
  const avant = settings({ langue: 'en' })
  const result = appliquerReponses(avant, reponses({ profil: 'sobre' }))
  assert.equal(result.langue, 'en')
  assert.deepEqual(result.densiteActivite, avant.densiteActivite)
})

test('appliquerReponses : marque la présentation comme vue', () => {
  const result = appliquerReponses(settings(), reponses())
  assert.equal(result.onboardingVu, true)
})

test('appliquerReponses : un profil inconnu retombe sur le premier de la liste', () => {
  const result = appliquerReponses(settings(), reponses({ profil: 'inexistant' }))
  assert.deepEqual(result.onglets.actifs, ORDRE)
})

test('appliquerReponses : la grille de vues (vuesActives) l’emporte sur le template', () => {
  const result = appliquerReponses(
    settings(),
    reponses({ profil: 'sobre', vuesActives: ['apercu', 'stack'] }),
  )
  assert.deepEqual(result.onglets.actifs, ['apercu', 'stack'])
})

test('appliquerReponses : sans vuesActives, le template décide seul', () => {
  const result = appliquerReponses(settings(), reponses({ profil: 'sobre', vuesActives: null }))
  assert.deepEqual(result.onglets.actifs, ['apercu', 'tableau', 'historique'])
})

test('appliquerReponses : ne mute pas les préférences reçues', () => {
  const avant = settings()
  const copie = structuredClone(avant)
  appliquerReponses(avant, reponses({ profil: 'sobre' }))
  assert.deepEqual(avant, copie)
})

test('apercuReponses : montre le résultat sans clore la présentation', () => {
  assert.equal(apercuReponses(settings(), reponses()).onboardingVu, false)
})

/* — reponsesInitiales — */

test('reponsesInitiales : reprend le profil courant s’il en matche un', () => {
  // Onglets et terminal du fixture `settings()` matchent le template `complet`.
  const result = reponsesInitiales(settings())
  assert.equal(result.profil, 'complet')
  assert.equal(result.bootstrap, true)
})

test('reponsesInitiales : sans profil courant reconnu, retombe sur le premier de la liste', () => {
  const result = reponsesInitiales(settings({ onglets: { actifs: ['apercu'], ordre: [...ORDRE] } }))
  assert.equal(result.profil, 'complet')
})

/* — rendu — */

test('les trois écrans rendent sans lever', () => {
  for (const etape of [0, 1, 2]) {
    const html = renderToStaticMarkup(
      <Onboarding
        settings={settings()}
        etapeInitiale={etape}
        onFini={() => {}}
      />,
    )
    assert.ok(html.length > 0, `l'écran ${etape} rend quelque chose`)
  }
})

test('les écrans rendent aussi sur des préférences dégradées', () => {
  // Le fichier de préférences vient d'un disque qu'on ne contrôle pas ; un
  // rendu qui lève emporterait la fenêtre entière au tout premier lancement.
  const abime = { onglets: undefined, terminal: undefined } as unknown as SettingsType
  for (const etape of [0, 1, 2]) {
    // Un rendu qui lève fait échouer le test de lui-même : pas besoin
    // d'`assert.doesNotThrow`, que la déclaration de `node:test` n'expose pas.
    const html = renderToStaticMarkup(
      <Onboarding settings={abime} etapeInitiale={etape} onFini={() => {}} />,
    )
    assert.ok(html.length > 0)
  }
})

test('les visuels rendent du SVG, sans image binaire', () => {
  assert.match(renderToStaticMarkup(<Logo size={48} />), /^<svg/)
  assert.match(renderToStaticMarkup(<SchemaBoucle />), /^<svg/)
})
