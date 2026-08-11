/**
 * Système de thème : jetons et injection de variables CSS.
 *
 * Les couleurs thématiques vivent ici. L'application applique un thème au démarrage
 * selon les préférences utilisateur, et écoute les changements d'attribut
 * `data-theme` sur l'élément racine.
 *
 * Catégories :
 * - Thématiques (sombre/clair) : bg primaire/secondaire, text
 * - xterm : couleurs du terminal
 * - Marque/UI (non thématisées) : #7d76f0, #8682cf, #ffffff (webview), #000 (mask)
 */

/**
 * Palette sombre (défaut).
 */
export const darkTheme = {
  // Fonds principaux (statusbar, panneaux terminal) — niveau "rails et
  // panneaux" du système Ovrsee (T-0045).
  bgPrimary: '#0b0c0e',
  // Fonds secondaires (sidebars détails, modales) — niveau "contrôles",
  // plus clair, pour lire comme élevé au-dessus du panneau.
  bgSecondary: '#101114',
  // Fonds alternatifs — niveau "actif/élevé".
  bgTertiary: '#1c1d24',
  bgQuaternary: '#0b0c0e',
  bgError: '#08090a', // Erreurs terminal
  bgAlerte: '#3a3a1a', // Encadré d'avertissement (source de graphe introuvable)
  bgLightbox: '#08090a', // Fond lightbox
  // xterm
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
  // Les 10 couleurs ANSI restantes n'étaient pas définies : xterm retombait
  // sur ses défauts internes, calibrés pour un fond noir. Fixées ici pour ne
  // plus en dépendre — proches des défauts xterm, non touchées par la refonte
  // T-0045 (couleurs ANSI sémantiques, indépendantes de la teinte de marque).
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
 * Palette claire (mode light).
 * Basée sur les jetons du design system Ovrsee (T-0045) — mêmes rampes que
 * le sombre, indices inversés (voir `ovrseeClair` plus bas).
 */
export const lightTheme = {
  bgPrimary: '#f3f5f7', // Fond principal clair
  bgSecondary: '#ffffff', // Fond secondaire, le plus élevé
  bgTertiary: '#e1e6ea',
  bgQuaternary: '#f3f5f7',
  bgError: '#fafafa',
  bgAlerte: '#fdf6dd',
  bgLightbox: '#ffffff',
  xtermBg: '#ffffff',
  xtermFg: '#1d242a',
  xtermCursor: '#3227e7',
  xtermSelection: '#d8d6fa',
  xtermBlack: '#000000',
  xtermBrightBlack: '#666666',
  xtermWhite: '#e9e9ed',
  xtermBrightWhite: '#ffffff',
  xtermMagenta: '#3227e7',
  xtermBrightMagenta: '#5e55ec',
  // Mêmes 10 couleurs, assombries pour rester lisibles sur le fond clair —
  // sans elles xterm retombait sur ses défauts calibrés pour un fond noir
  // (ex. le vert et le jaune par défaut sont quasi invisibles sur blanc).
  xtermRed: '#c41a16',
  xtermBrightRed: '#d93a35',
  xtermGreen: '#1a7f37',
  xtermBrightGreen: '#2c9a4a',
  xtermYellow: '#9a6700',
  xtermBrightYellow: '#b8821a',
  xtermBlue: '#1a4fd6',
  xtermBrightBlue: '#3a6ae8',
  xtermCyan: '#0e7490',
  xtermBrightCyan: '#1592b3',
}

/**
 * Constantes non thématisées (marque, webview, masques).
 */
export const unthemedColors = {
  brand: '#7d76f0', // Marque Ovrsee (curseur xterm, bordures)
  brandAlt: '#8682cf', // Marque secondaire (SVG)
  webviewBg: '#ffffff', // Fond webview Chromium
  maskBlack: '#000', // mask-image
} as const

/**
 * Injecte les variables CSS du thème au démarrage.
 * Appelé une seule fois dans main.tsx.
 *
 * Crée une balise <style> avec les jetons --theme-* et recalcule
 * au changement de `data-theme`.
 */
export function initializeTheme(): void {
  const style = document.createElement('style')
  style.id = 'ovrsee-theme-vars'
  // Inject CSS statique avec les sélecteurs et media queries
  style.textContent = getCSSVariables()
  document.head.appendChild(style)
}

/**
 * Applique un thème à l'élément racine.
 * @param theme 'light' | 'dark' | 'auto'
 */
export function applyTheme(theme: string): void {
  if (theme === 'auto') {
    // Retire l'attribut pour que la cascade CSS utilise prefers-color-scheme
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.dataset.theme = theme
  }
}

/**
 * Retourne la chaîne CSS avec les variables du thème donné.
 * @param theme 'light' | 'dark' | 'auto'
 */
function getCSSVariables(): string {
  /**
   * Le thème sombre ne redéfinit AUCUN jeton `--color-*` du système Ovrsee.
   *
   * Une première version en recopiait les quatre-vingt-dix valeurs pour les
   * « thématiser » — et l'accent changeait de teinte au passage, le fond
   * dérivait. L'apparence par défaut de l'application changeait sans que
   * personne l'ait demandé.
   *
   * `_ds/ovrsee/styles.css` EST le thème sombre : il est déjà chargé, il
   * fait autorité. Ne sont déclarés ici que les jetons `--theme-*`, ceux qui
   * remplacent les couleurs autrefois écrites en dur dans les composants.
   */
  const themeTokens = (palette: typeof darkTheme) => ({
    '--theme-bg-primary': palette.bgPrimary,
    '--theme-bg-secondary': palette.bgSecondary,
    '--theme-bg-tertiary': palette.bgTertiary,
    '--theme-bg-quaternary': palette.bgQuaternary,
    '--theme-bg-error': palette.bgError,
    '--theme-bg-alerte': palette.bgAlerte,
    '--theme-bg-lightbox': palette.bgLightbox,
    '--theme-xterm-bg': palette.xtermBg,
    '--theme-xterm-fg': palette.xtermFg,
    '--theme-xterm-cursor': palette.xtermCursor,
    '--theme-xterm-selection': palette.xtermSelection,
    '--theme-xterm-black': palette.xtermBlack,
    '--theme-xterm-bright-black': palette.xtermBrightBlack,
    '--theme-xterm-white': palette.xtermWhite,
    '--theme-xterm-bright-white': palette.xtermBrightWhite,
    '--theme-xterm-magenta': palette.xtermMagenta,
    '--theme-xterm-bright-magenta': palette.xtermBrightMagenta,
  })

  /**
   * Le thème clair doit bien renverser le système Ovrsee — sinon un texte
   * prévu pour un fond sombre s'affiche en gris pâle sur blanc. T-0039
   * (sidebar sélectionnée, onglet terminal actif, cartes PLAN de la frise)
   * venait précisément de là : la rampe neutre s'inversait bien, mais les
   * paliers 700-900 de la rampe accent gardaient des valeurs sombres dans
   * les deux thèmes — un fond `--color-accent-900` pensé pour se fondre
   * dans un `--color-bg` sombre restait un carré violet sur fond clair.
   *
   * Ici, les trois rampes (neutre, accent, accent-2) réutilisent exactement
   * les 9 couleurs de `_ds/ovrsee/styles.css`, juste réassignées en ordre
   * inverse (100 ↔ 900) — jamais une teinte recalculée à part, donc jamais
   * un palier oublié à mi-chemin.
   */
  const ovrseeClair = {
    '--color-bg': '#f3f5f7',
    '--color-surface': '#ffffff',
    '--color-surface-card': '#f3f5f7',
    '--color-surface-control': '#e1e6ea',
    '--color-surface-active': '#c9d1d9',
    '--color-text': '#1d242a',
    '--color-text-secondary': 'color-mix(in srgb, #1d242a 78%, transparent)',
    '--color-text-tertiary': 'color-mix(in srgb, #1d242a 60%, transparent)',
    '--color-text-quaternary': 'color-mix(in srgb, #1d242a 45%, transparent)',
    '--color-text-discrete': 'color-mix(in srgb, #1d242a 32%, transparent)',
    '--color-accent': '#3227e7',
    '--color-accent-2': '#4c46b4',
    '--color-divider': 'color-mix(in srgb, #1d242a 14%, transparent)',
    // Rampe neutre, indices inversés.
    '--color-neutral-100': '#1d242a',
    '--color-neutral-200': '#323d48',
    '--color-neutral-300': '#495969',
    '--color-neutral-400': '#63788d',
    '--color-neutral-500': '#8799ab',
    '--color-neutral-600': '#abb8c4',
    '--color-neutral-700': '#c9d1d9',
    '--color-neutral-800': '#e1e6ea',
    '--color-neutral-900': '#f3f5f7',
    // Rampe accent, indices inversés.
    '--color-accent-100': '#0e0a57',
    '--color-accent-200': '#160f8a',
    '--color-accent-300': '#1f15c1',
    '--color-accent-400': '#3227e7',
    '--color-accent-500': '#5e55ec',
    '--color-accent-600': '#857ef1',
    '--color-accent-700': '#b5b1f6',
    '--color-accent-800': '#d8d6fa',
    '--color-accent-900': '#eeedfd',
    // Rampe accent-2, indices inversés.
    '--color-accent-2-100': '#2a2663',
    '--color-accent-2-200': '#3b368c',
    '--color-accent-2-300': '#4c46b4',
    '--color-accent-2-400': '#6a65c3',
    '--color-accent-2-500': '#8682cf',
    '--color-accent-2-600': '#a39fda',
    '--color-accent-2-700': '#c3c1e7',
    '--color-accent-2-800': '#dfdef2',
    '--color-accent-2-900': '#f1f0f9',
    ...themeTokens(lightTheme),
  }

  const bloc = (tokens: Record<string, string>, indent: string): string =>
    Object.entries(tokens)
      .map(([key, val]) => `${indent}${key}: ${val};`)
      .join('\n')

  // `:root` ne porte que les jetons sombres ; `_ds/ovrsee/styles.css` fournit
  // le reste. Le clair s'applique sur choix explicite, ou en `auto` quand le
  // système le demande — d'où le `:not([data-theme="dark"])`, qui laisse le
  // choix primer.
  return `
    :root {
${bloc(themeTokens(darkTheme), '      ')}
    }

    :root[data-theme="light"] {
${bloc(ovrseeClair, '      ')}
    }

    @media (prefers-color-scheme: light) {
      :root:not([data-theme="dark"]) {
${bloc(ovrseeClair, '        ')}
      }
    }
  `
}

/**
 * Résout la palette effective selon le thème demandé.
 * En mode 'auto', suit prefers-color-scheme si data-theme n'est pas posé.
 */
function resolveTheme(theme: string): typeof darkTheme {
  if (theme === 'light') {
    return lightTheme
  }
  if (theme === 'dark') {
    return darkTheme
  }
  // 'auto' : suit prefers-color-scheme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? darkTheme : lightTheme
}

/**
 * Retourne la palette xterm pour le thème courant.
 * Appelée au démarrage et quand le thème change.
 */
export function getTerminalTheme(): {
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  black: string
  brightBlack: string
  white: string
  brightWhite: string
  magenta: string
  brightMagenta: string
  red: string
  brightRed: string
  green: string
  brightGreen: string
  yellow: string
  brightYellow: string
  blue: string
  brightBlue: string
  cyan: string
  brightCyan: string
} {
  const currentTheme = document.documentElement.dataset.theme || 'auto'
  const palette = resolveTheme(currentTheme)

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
