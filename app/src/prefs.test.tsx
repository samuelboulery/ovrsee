import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { SettingsType } from './data'
import {
  basculerOnglet,
  deplacerOnglet,
  SectionGeneral,
  SectionInterface,
} from './PreferencesPanel'
import { setCurrentLanguage } from './i18n'
import { PreferencesPreview, ongletsVisibles } from './PreferencesPreview'
import { appliquerProfil, PROFILS, profilCourant, SectionProfils } from './PreferencesProfils'
import { SectionProjet } from './PreferencesProjet'

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

/**
 * La langue, épinglée — sans quoi ces tests dépendent de la locale du poste.
 *
 * `t()` ne lit pas le `langue` des paramètres rendus : il lit l'état de module
 * de `i18n`, dont le repli est `navigator.language`. Ce global n'existait pas
 * dans Node ; depuis la 21 il existe et porte la locale du système. Les deux
 * tests qui attendent un libellé anglais passaient donc sur les runners de la
 * CI et échouaient sur un poste français, sur une assertion qui ne parlait pas
 * de langue.
 */
setCurrentLanguage('en')

const ORDRE = ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']

const settings = (patch: Record<string, unknown> = {}): SettingsType =>
  ({
    langue: 'fr',
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
  ['Profils', SectionProfils],
  ['Général', SectionGeneral],
  ['Interface', SectionInterface],
  ['Projet', SectionProjet],
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
  ['champs de premier niveau absents', settings({ langue: undefined, packageManager: undefined, sourceGraphe: undefined })],
]

for (const [nomSection, Section] of SECTIONS) {
  for (const [nomCas, valeurs] of DEGRADES) {
    test(`section ${nomSection} : rendu sur « ${nomCas} »`, () => {
      const html = renderToStaticMarkup(<Section settings={valeurs} onSettings={() => {}} />)
      assert(html.length > 0, 'rendu vide')
    })
  }
}

test('SectionProjet : les six pastilles d’accent, la choisie cochée', () => {
  const html = renderToStaticMarkup(
    <SectionProjet settings={settings()} onSettings={() => {}} root="/tmp/p" accent="cyan" onAccent={() => {}} />,
  )

  assert.equal((html.match(/role="radio"/g) ?? []).length, 6, 'six teintes attendues')
  assert(html.includes('data-accent="cyan"'), 'la pastille cyan ne porte pas son attribut')
  assert(html.includes('aria-checked="true"'), 'aucune pastille cochée')
})

test('SectionProjet : sans accent choisi, le violet est coché', () => {
  const html = renderToStaticMarkup(
    <SectionProjet settings={settings()} onSettings={() => {}} root="/tmp/p" onAccent={() => {}} />,
  )
  // Le violet est le premier bouton : sa pastille précède la première coche.
  assert(html.indexOf('aria-checked="true"') < html.indexOf('data-accent="ambre"'))
})

test('SectionProjet : un accent inconnu venu du disque retombe sur le violet', () => {
  const html = renderToStaticMarkup(
    <SectionProjet settings={settings()} onSettings={() => {}} root="/tmp/p" accent="mauve" onAccent={() => {}} />,
  )
  // Le violet ouvre la liste : sa coche précède la pastille suivante.
  assert(html.indexOf('aria-checked="true"') < html.indexOf('data-accent="ambre"'))
})

test('SectionProjet : sans projet ouvert, les pastilles sont inertes', () => {
  const html = renderToStaticMarkup(<SectionProjet settings={settings()} onSettings={() => {}} />)
  assert.equal((html.match(/disabled=""/g) ?? []).length >= 6, true, 'pastilles actives sans projet')
})

test('SectionInterface : terminal désactivé montre le bouton d’activation, pas le switch', () => {
  const desactive = settings({
    terminal: { visible: false, disposition: 'bottom', hauteur: 244, largeur: 468, disabled: true },
  })
  const html = renderToStaticMarkup(<SectionInterface settings={desactive} onSettings={() => {}} />)
  assert(html.includes('Enable terminal'), 'bouton d’activation absent')
  assert.equal(html.includes('Layout'), false, 'disposition affichée malgré la désactivation')
})

test('SectionInterface : terminal actif montre le switch, pas le bouton d’activation', () => {
  const html = renderToStaticMarkup(<SectionInterface settings={settings()} onSettings={() => {}} />)
  assert(html.includes('Show terminal'), 'switch absent')
  assert.equal(html.includes('Enable terminal'), false, 'bouton d’activation affiché sans raison')
})

test('aperçu : les trois dispositions et le terminal masqué', () => {
  for (const disposition of ['bottom', 'side', 'full']) {
    const html = renderToStaticMarkup(
      <PreferencesPreview
        settings={settings({ terminal: { visible: true, disposition, hauteur: 1, largeur: 1 } })}
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
    />,
  )
  assert(html.includes('Stack'), 'onglet visible absent')
  assert.equal(html.includes('Produit'), false, 'onglet masqué dessiné quand même')
})

/* — les templates — */

const profil = (id: string) => {
  const trouve = PROFILS.find(p => p.id === id)
  assert(trouve, `profil inconnu : ${id}`)
  return trouve
}

test('appliquerProfil : `ordre` garde toujours les sept identifiants', () => {
  // C'est l'invariant que `validateSettings` exige : un `ordre` incomplet est
  // rejeté en silence, et le rangement de l'utilisateur retombe à l'usine.
  const cas: SettingsType[] = [
    settings(),
    settings({ onglets: { ordre: ['apercu'], actifs: ['apercu'] } }),
    settings({ onglets: undefined }),
  ]
  for (const depart of cas) {
    for (const p of PROFILS) {
      const ordre = appliquerProfil(depart, p).onglets.ordre
      assert.deepEqual([...ordre].sort(), [...ORDRE].sort())
    }
  }
})

test('appliquerProfil : les onglets du template passent en tête, dans son ordre', () => {
  const suivant = appliquerProfil(settings(), profil('dev'))
  assert.deepEqual(suivant.onglets.actifs, ['apercu', 'tableau', 'stack', 'historique'])
  assert.deepEqual(suivant.onglets.ordre.slice(0, 4), suivant.onglets.actifs)
})

test('appliquerProfil : ne touche que les onglets et le terminal', () => {
  const avant = settings({
    langue: 'en',
    customActions: [{ label: 'Test', text: 'pnpm test' }],
    terminal: { visible: true, disposition: 'bottom', hauteur: 300, largeur: 500 },
  })
  const apres = appliquerProfil(avant, profil('sobre'))

  assert.equal(apres.langue, 'en')
  assert.deepEqual(apres.densiteActivite, avant.densiteActivite)
  assert.deepEqual(apres.customActions, avant.customActions)
  assert.equal(apres.packageManager, avant.packageManager)
  // Un template choisit une disposition, il ne redimensionne pas la fenêtre.
  assert.equal(apres.terminal.hauteur, 300)
  assert.equal(apres.terminal.largeur, 500)
  assert.equal(apres.terminal.visible, false)
  assert.equal(apres.terminal.disabled, true)
})

test('appliquerProfil : reprend `disabled` au template, même s’il avait été rouvert à la main', () => {
  const avant = settings({
    terminal: { visible: true, disposition: 'bottom', hauteur: 244, largeur: 468, disabled: false },
  })
  const apres = appliquerProfil(avant, profil('sobre'))
  assert.equal(apres.terminal.disabled, true)
})

test('profilCourant : reconnaît le réglage d’usine, et rien d’autre', () => {
  assert.equal(profilCourant(settings()), 'complet')
  assert.equal(profilCourant(appliquerProfil(settings(), profil('revue'))), 'revue')
  assert.equal(profilCourant(basculerOnglet(settings(), 'stack')), null)
})

test('profilCourant : terminal masqué, la disposition ne départage pas', () => {
  // Elle ne se voit nulle part : deux réglages qui n'en diffèrent que par là
  // sont le même écran.
  const sobre = appliquerProfil(settings(), profil('sobre'))
  const autre = { ...sobre, terminal: { ...sobre.terminal, disposition: 'full' } }
  assert.equal(profilCourant(autre), 'sobre')
})

test('profilCourant : un terminal réactivé à la main sort du template', () => {
  const sobre = appliquerProfil(settings(), profil('sobre'))
  const reactive = { ...sobre, terminal: { ...sobre.terminal, disabled: false } }
  assert.equal(profilCourant(reactive), null)
})
