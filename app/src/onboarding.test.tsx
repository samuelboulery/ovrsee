import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { SettingsType } from './data'
import {
  appliquerReponses,
  apercuReponses,
  bootstrapPourNiveau,
  profilSuggere,
  reponsesInitiales,
  terminalPourUsage,
  type Reponses,
} from './profilage'
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
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468 },
    bootstrap: ['/project-setup'],
    packageManager: 'pnpm',
    sourceGraphe: 'auto',
    customActions: [],
    onboardingVu: false,
    claude: { niveau: 'intermediaire', usage: 'terminal' },
    ...patch,
  }) as unknown as SettingsType

const reponses = (patch: Partial<Reponses> = {}): Reponses => ({
  niveau: 'intermediaire',
  usage: 'terminal',
  profil: 'complet',
  bootstrap: true,
  ...patch,
})

/* — profilSuggere — */

test('profilSuggere : les quatre combinaisons tombent sur quatre templates', () => {
  assert.equal(profilSuggere('debutant', 'terminal'), 'complet')
  assert.equal(profilSuggere('intermediaire', 'ide'), 'complet')
  assert.equal(profilSuggere('avance', 'terminal'), 'dev')
  assert.equal(profilSuggere('expert', 'ide'), 'dev')
  assert.equal(profilSuggere('debutant', 'desktop'), 'sobre')
  assert.equal(profilSuggere('expert', 'autre'), 'revue')
})

test('profilSuggere : chaque question compte, aucune n’est décorative', () => {
  // Changer le niveau à usage constant change la suggestion…
  assert.notEqual(
    profilSuggere('debutant', 'terminal'),
    profilSuggere('expert', 'terminal'),
  )
  // …et changer l'usage à niveau constant aussi.
  assert.notEqual(
    profilSuggere('expert', 'terminal'),
    profilSuggere('expert', 'desktop'),
  )
})

/* — terminalPourUsage — */

test('terminalPourUsage : l’usage décide de la place du terminal', () => {
  assert.deepEqual(terminalPourUsage('terminal'), { visible: true, disposition: 'side' })
  assert.deepEqual(terminalPourUsage('ide'), { visible: true, disposition: 'bottom' })
  assert.deepEqual(terminalPourUsage('desktop'), { visible: false })
  assert.deepEqual(terminalPourUsage('autre'), { visible: false })
})

test('terminalPourUsage : sans terminal, aucune disposition n’est imposée', () => {
  // Masqué, la disposition ne se voit nulle part : l'écraser effacerait le
  // réglage de quelqu'un qui rouvrira le terminal plus tard.
  assert.equal('disposition' in terminalPourUsage('desktop'), false)
})

/* — bootstrapPourNiveau — */

test('bootstrapPourNiveau : proposé à qui découvre, tu à qui sait', () => {
  assert.equal(bootstrapPourNiveau('debutant'), true)
  assert.equal(bootstrapPourNiveau('intermediaire'), true)
  assert.equal(bootstrapPourNiveau('avance'), false)
  assert.equal(bootstrapPourNiveau('expert'), false)
})

/* — appliquerReponses — */

test('appliquerReponses : le template range les onglets, l’usage place le terminal', () => {
  const result = appliquerReponses(settings(), reponses({ usage: 'terminal', profil: 'dev' }))

  assert.deepEqual(result.onglets.actifs, ['apercu', 'tableau', 'stack', 'historique'])
  assert.equal(result.terminal.visible, true)
  assert.equal(result.terminal.disposition, 'side')
})

test('appliquerReponses : l’usage l’emporte sur la disposition du template', () => {
  // Le template `dev` pose le terminal à droite ; en usage `ide` il descend.
  const result = appliquerReponses(settings(), reponses({ usage: 'ide', profil: 'dev' }))
  assert.equal(result.terminal.disposition, 'bottom')
})

test('appliquerReponses : sans terminal, il est masqué quel que soit le template', () => {
  const result = appliquerReponses(settings(), reponses({ usage: 'desktop', profil: 'complet' }))
  assert.equal(result.terminal.visible, false)
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
    reponses({ usage: 'terminal' }),
  )
  assert.equal(result.terminal.hauteur, 300)
  assert.equal(result.terminal.largeur, 500)
})

test('appliquerReponses : le bootstrap suit la case, pas le niveau', () => {
  assert.deepEqual(appliquerReponses(settings(), reponses({ bootstrap: false })).bootstrap, [])
  assert.deepEqual(
    appliquerReponses(settings(), reponses({ niveau: 'expert', bootstrap: true })).bootstrap,
    ['/project-setup'],
  )
})

test('appliquerReponses : langue, thème et densité restent intacts', () => {
  const avant = settings({ langue: 'en', theme: 'light' })
  const result = appliquerReponses(avant, reponses({ profil: 'sobre' }))
  assert.equal(result.langue, 'en')
  assert.equal(result.theme, 'light')
  assert.deepEqual(result.densiteActivite, avant.densiteActivite)
})

test('appliquerReponses : marque la présentation comme vue et garde les réponses', () => {
  const result = appliquerReponses(settings(), reponses({ niveau: 'expert', usage: 'desktop' }))
  assert.equal(result.onboardingVu, true)
  assert.deepEqual(result.claude, { niveau: 'expert', usage: 'desktop' })
})

test('appliquerReponses : un profil inconnu retombe sur la suggestion', () => {
  const result = appliquerReponses(
    settings(),
    reponses({ niveau: 'expert', usage: 'terminal', profil: 'inexistant' }),
  )
  assert.deepEqual(result.onglets.actifs, ['apercu', 'tableau', 'stack', 'historique'])
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

test('reponsesInitiales : reprend ce que les préférences savent déjà', () => {
  const result = reponsesInitiales(settings({ claude: { niveau: 'expert', usage: 'ide' } }))
  assert.equal(result.niveau, 'expert')
  assert.equal(result.usage, 'ide')
  assert.equal(result.profil, 'dev')
  assert.equal(result.bootstrap, false)
})

test('reponsesInitiales : des réponses absentes ou abîmées donnent le milieu', () => {
  for (const claude of [undefined, null, { niveau: 'gourou', usage: 'fax' }]) {
    const result = reponsesInitiales(settings({ claude }))
    assert.equal(result.niveau, 'intermediaire')
    assert.equal(result.usage, 'terminal')
  }
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
  const abime = { onglets: undefined, terminal: undefined, claude: undefined } as unknown as SettingsType
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
