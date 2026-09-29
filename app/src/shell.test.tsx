import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { SettingsType } from './data'
import { setPlateforme } from './raccourcis'
import { Sidebar } from './Shell'

/**
 * Issue #50 : repliée, la sidebar perdait la recherche et affichait un logo
 * absent côté ouvert. Rendu statique des deux états, sans DOM — assez pour
 * vérifier la présence/absence d'un contrôle sans monter une vraie fenêtre.
 */

// La plateforme, épinglée : les raccourcis affichés en dépendent, et la
// détection lit `navigator.platform` — un global que Node ≥ 21 définit avec
// l'OS de la machine. Sans ça, ces assertions passeraient sur un Mac et
// échoueraient sur un poste Windows. Même piège que la langue dans
// `prefs.test.tsx`.
setPlateforme('mac')

const ORDRE = ['apercu', 'navigateur', 'produit', 'historique', 'tableau', 'donnees', 'stack']

const settings = (): SettingsType =>
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
    onboardingVu: true,
  }) as unknown as SettingsType

const noop = () => {}

function renderSidebar(collapsed: boolean): string {
  return renderToStaticMarkup(
    <Sidebar
      collapsed={collapsed}
      settings={settings()}
      width={240}
      tab="apercu"
      onTabPick={noop}
      onOpenPreferences={noop}
      onOpenPreferencesInterface={noop}
      onOpenPalette={noop}
      ticketsRestant={0}
    />,
  )
}

test('la recherche reste accessible repliée (issue #50)', () => {
  assert.match(renderSidebar(false), /⌘K/)
  assert.match(renderSidebar(true), /⌘K/)
})

// Le même contrôle, écrit pour l'autre clavier : sous Windows, ⌘ ne désigne
// aucune touche.
test('hors macOS, la recherche annonce Ctrl+K', () => {
  setPlateforme('autre')
  try {
    assert.match(renderSidebar(false), /Ctrl\+K/)
    assert.match(renderSidebar(true), /Ctrl\+K/)
    assert.doesNotMatch(renderSidebar(false), /⌘/)
  } finally {
    setPlateforme('mac')
  }
})

test('aucune icône propre au rail replié sans équivalent ouvert (issue #50)', () => {
  // Le logo (`OnboardingArt.Logo`) a un viewBox distinctif ; il ne doit plus
  // apparaître dans la sidebar, ouverte ou repliée.
  assert.doesNotMatch(renderSidebar(true), /viewBox="0 0 1024 1024"/)
  assert.doesNotMatch(renderSidebar(false), /viewBox="0 0 1024 1024"/)
})
