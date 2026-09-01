import { useEffect, useState } from 'react'

/**
 * Le thème de l'application : ce que le CSS ne peut pas porter, et la
 * résolution du réglage.
 *
 * `_ds/ovrsee/styles.css` EST le thème sombre, et son bloc
 * `:root[data-theme='light']` est le clair (T-0227) : les quatre-vingt-dix
 * jetons vivent là-bas, pas ici. Ce module ne déclare que ce qu'une feuille de
 * style ne peut pas atteindre — la palette du canvas xterm, qui est un objet
 * JavaScript — et la fonction qui décide lequel des deux thèmes s'applique.
 *
 * Une version antérieure recopiait les jetons du design system pour les
 * « thématiser », et l'accent changeait de teinte au passage : l'apparence par
 * défaut de l'application changeait sans que personne l'ait demandé. Le thème
 * clair a ensuite été retiré (T-0075, puis T-0200) faute de maquette. Il en a
 * une depuis T-0226, et il est revenu en T-0227.
 */

/** Le réglage tel qu'il est enregistré. `system` suit le poste. */
export type ThemePref = 'light' | 'dark' | 'system'

/** Le thème réellement appliqué — ce que porte `data-theme`. */
export type ThemeMode = 'light' | 'dark'

/**
 * Palette sombre du terminal.
 *
 * Les dix couleurs ANSI du bas n'étaient pas définies : xterm retombait sur
 * ses défauts internes, calibrés pour un fond noir. Fixées ici pour ne plus en
 * dépendre.
 */
export const darkTheme = {
  // Fonds principaux (statusbar, panneaux terminal) — niveau "rails et
  // panneaux" du système Ovrsee (T-0045).
  bgPrimary: '#0b0c0e',
  bgLightbox: '#08090a', // Fond lightbox
  xtermBg: '#0b0c0e',
  xtermFg: '#e1e6ea',
  xtermCursor: '#7d76f0',
  xtermSelection: '#4c46b4',
  xtermBlack: '#1d242a',
  xtermBrightBlack: '#495969',
  xtermWhite: '#e1e6ea',
  xtermBrightWhite: '#ffffff',
  xtermMagenta: '#7d76f0',
  xtermBrightMagenta: '#857ef1',
  xtermRed: '#e5677a',
  xtermBrightRed: '#f08a99',
  xtermGreen: '#7fc97f',
  xtermBrightGreen: '#a3dba3',
  xtermYellow: '#e0c46f',
  xtermBrightYellow: '#f0d98f',
  xtermBlue: '#7fa6d9',
  xtermBrightBlue: '#a3c2e8',
  xtermCyan: '#7fc9c9',
  xtermBrightCyan: '#a3dbdb',
}

/**
 * Palette claire du terminal (T-0229, maquette T-0226).
 *
 * Elle n'inverse pas la sombre : les vingt valeurs sont choisies pour un fond
 * clair, et toutes tiennent 4,5:1 dessus. Le renversement notable est celui
 * des « bright » — sur du blanc, plus vif veut dire plus SOMBRE, pas plus
 * clair — et celui de `white`/`black`, qui sont des couleurs qu'un programme
 * demande, pas des synonymes du fond et de l'encre.
 */
const lightTheme: typeof darkTheme = {
  bgPrimary: '#f4f5f7',
  bgLightbox: '#ffffff',
  xtermBg: '#f7f8fa',
  xtermFg: '#24272e',
  xtermCursor: '#4b44c7',
  xtermSelection: '#d9d7f7',
  xtermBlack: '#24272e',
  xtermBrightBlack: '#6b7280',
  xtermWhite: '#4a525c',
  xtermBrightWhite: '#24272e',
  xtermMagenta: '#4b44c7',
  xtermBrightMagenta: '#3a349c',
  xtermRed: '#b3283f',
  xtermBrightRed: '#8e1f32',
  xtermGreen: '#1a7f4b',
  xtermBrightGreen: '#146239',
  xtermYellow: '#8a6300',
  xtermBrightYellow: '#6d4e00',
  xtermBlue: '#1f5fbf',
  xtermBrightBlue: '#184b96',
  xtermCyan: '#0f718a',
  xtermBrightCyan: '#0b586c',
}

/**
 * Le thème à appliquer, pour un réglage et un poste donnés.
 *
 * Pure et sans DOM : c'est l'appelant qui interroge `matchMedia`. Une valeur
 * inconnue ou absente vaut `system`, le défaut de `hooks/settings.js` — un
 * profil abîmé ne doit pas laisser l'interface sans thème du tout.
 */
export function resolveTheme(pref: string | undefined, prefereClair: boolean): ThemeMode {
  if (pref === 'light' || pref === 'dark') return pref
  return prefereClair ? 'light' : 'dark'
}

/** La requête média que `system` consulte. */
const REQUETE_CLAIR = '(prefers-color-scheme: light)'

/**
 * Ce qui part au processus principal : le RÉGLAGE, pas le thème résolu.
 *
 * `app:theme` (`electron/main.js`) en fait un `nativeTheme.themeSource`, et un
 * `themeSource` forcé surcharge `prefers-color-scheme` dans tous les rendus.
 * Envoyer la valeur résolue de « système » figeait donc la requête média sur ce
 * que le rendu venait d'y écrire : `watchSystemTheme` n'était plus jamais
 * réveillé, et basculer l'apparence du poste ne faisait plus rien (T-0242).
 *
 * C'est le principal qui a le dernier mot sur « système » — lui seul voit le
 * poste sans passer par une requête média qu'il surcharge lui-même. Une valeur
 * inconnue vaut `system`, comme dans `resolveTheme`.
 */
export function themeSourcePour(pref: string | undefined): ThemePref {
  return pref === 'light' || pref === 'dark' ? pref : 'system'
}

/**
 * Applique un réglage à l'élément racine, et rend le thème retenu.
 *
 * `data-theme` porte toujours la valeur RÉSOLUE, jamais « système » : une
 * seule règle CSS suffit alors. Ce qui part à Electron, à l'inverse, est le
 * réglage tel quel — voir `themeSourcePour`.
 *
 * Rien n'est mis en cache côté rendu : le disque est la seule source, via
 * `/api/settings`. Le fond d'avant le premier paint est peint autrement — par
 * `backgroundColor` côté Electron, par une media query dans `index.html` côté
 * navigateur. Un script inline y ferait mieux, mais la CSP du protocole
 * `ovrsee://` le bloque, et seulement là.
 */
export function applyTheme(pref: string | undefined): ThemeMode {
  const mode = resolveTheme(pref, window.matchMedia(REQUETE_CLAIR).matches)
  document.documentElement.dataset.theme = mode
  window.ovrsee?.app?.setTheme?.(themeSourcePour(pref))
  return mode
}

/**
 * Suit le thème du poste tant que le réglage vaut « système ».
 *
 * Rend la fonction de désabonnement. Sur un autre réglage, il n'y a rien à
 * suivre : le choix explicite prime, et l'abonnement serait du bruit.
 */
function watchSystemTheme(pref: string | undefined, onChange: (mode: ThemeMode) => void): () => void {
  if (pref !== 'system' && pref !== undefined) return () => {}

  const media = window.matchMedia(REQUETE_CLAIR)
  const reagir = (event: MediaQueryListEvent) => onChange(event.matches ? 'light' : 'dark')
  media.addEventListener('change', reagir)
  return () => media.removeEventListener('change', reagir)
}

/**
 * Applique le réglage et suit le poste tant qu'il vaut « système ».
 *
 * Rend le thème résolu, pour ce qui ne lit pas le CSS — le canvas xterm. Les
 * deux racines de rendu s'en servent : l'application (`App.tsx`) et le popover
 * de la barre de menu (`MenuBarPanel.tsx`), qui resterait sombre sans ça.
 */
export function useThemeMode(pref: string | undefined): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() =>
    resolveTheme(pref, typeof window !== 'undefined' && window.matchMedia(REQUETE_CLAIR).matches),
  )

  useEffect(() => {
    setMode(applyTheme(pref))
    return watchSystemTheme(pref, suivant => {
      document.documentElement.dataset.theme = suivant
      // Le réglage n'a pas changé, `themeSource` non plus : ce rappel sert à
      // faire repeindre le `backgroundColor` de la fenêtre, que le principal
      // recalcule sur le poste à chaque `app:theme`.
      window.ovrsee?.app?.setTheme?.(themeSourcePour(pref))
      setMode(suivant)
    })
  }, [pref])

  return mode
}

/**
 * Injecte les jetons `--theme-*` au démarrage.
 *
 * Il n'en reste qu'un : les dix `--theme-xterm-*` étaient injectés sans aucun
 * consommateur — le thème du terminal passe par l'objet rendu ci-dessous, pas
 * par le CSS — et `--theme-bg-primary` n'était cité nulle part (T-0230).
 * Appelé une seule fois dans `main.tsx`.
 */
export function initializeTheme(): void {
  const style = document.createElement('style')
  style.id = 'ovrsee-theme-vars'
  style.textContent = `
    :root { --theme-bg-lightbox: ${darkTheme.bgLightbox}; }
    :root[data-theme='light'] { --theme-bg-lightbox: ${lightTheme.bgLightbox}; }
  `
  document.head.appendChild(style)
}

/** La palette xterm d'un thème donné — les vingt couleurs, toujours. */
export function getTerminalTheme(mode: ThemeMode) {
  const palette = mode === 'light' ? lightTheme : darkTheme

  return {
    background: palette.xtermBg,
    foreground: palette.xtermFg,
    cursor: palette.xtermCursor,
    selectionBackground: palette.xtermSelection,
    black: palette.xtermBlack,
    brightBlack: palette.xtermBrightBlack,
    white: palette.xtermWhite,
    brightWhite: palette.xtermBrightWhite,
    magenta: palette.xtermMagenta,
    brightMagenta: palette.xtermBrightMagenta,
    red: palette.xtermRed,
    brightRed: palette.xtermBrightRed,
    green: palette.xtermGreen,
    brightGreen: palette.xtermBrightGreen,
    yellow: palette.xtermYellow,
    brightYellow: palette.xtermBrightYellow,
    blue: palette.xtermBlue,
    brightBlue: palette.xtermBrightBlue,
    cyan: palette.xtermCyan,
    brightCyan: palette.xtermBrightCyan,
  }
}

/**
 * Repose le thème sur chaque terminal vivant, sans en recréer aucun.
 *
 * Le pty vit dans le processus principal : il ignore les options du rendu, et
 * l'historique déjà affiché est réaffiché par xterm avec la nouvelle palette.
 * Recréer le terminal, à l'inverse, fermerait la session (`useTerminal.ts`).
 *
 * Volontairement hors de `useTerminal` et typée au minimum : `app/src` est
 * compilé puis exécuté par `node --test`, sans DOM ni canvas — un test ne peut
 * pas instancier un vrai xterm.
 */
export function appliquerThemeTerminal(
  terminaux: Iterable<{ options: { theme?: Partial<ReturnType<typeof getTerminalTheme>> } }>,
  mode: ThemeMode,
): void {
  // Type structurel plutôt que l'`ITheme` d'xterm : `useTerminal.ts` reste le
  // seul module qui importe xterm, y compris pour ses types (CLAUDE.md), et un
  // test doit pouvoir appeler ceci avec un faux objet.
  const theme = getTerminalTheme(mode)
  for (const terminal of terminaux) terminal.options.theme = theme
}
