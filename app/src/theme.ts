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
 * - Marque/UI (non thématisées) : #9184d9, #796cbf, #ffffff (webview), #000 (mask)
 */

/**
 * Palette sombre (défaut).
 */
export const darkTheme = {
  // Fonds principaux (statusbar, panneaux terminal)
  bgPrimary: '#101120',
  // Fonds secondaires (sidebars détails, modales)
  bgSecondary: '#13141f',
  // Fonds alternatifs
  bgTertiary: '#1b1d2b',
  bgQuaternary: '#171927',
  bgError: '#0a0b10', // Erreurs terminal
  bgAlerte: '#3a3a1a', // Encadré d'avertissement (source de graphe introuvable)
  bgLightbox: '#0b0c16', // Fond lightbox
  // xterm
  xtermBg: '#101120',
  xtermFg: '#c9cad3',
  xtermCursor: '#9184d9',
  xtermSelection: '#353b80',
  xtermBlack: '#161826',
  xtermBrightBlack: '#595d6c',
  xtermWhite: '#e9e9ed',
  xtermBrightWhite: '#ffffff',
  xtermMagenta: '#9184d9',
  xtermBrightMagenta: '#b3a9e6',
}

/**
 * Palette claire (mode light).
 * Basée sur les jetons du design system Nocturne.
 */
export const lightTheme = {
  bgPrimary: '#f2f2f3', // Fond principal clair
  bgSecondary: '#e8e8eb', // Fond secondaire
  bgTertiary: '#dcdce0',
  bgQuaternary: '#e0e0e3',
  bgError: '#fafafa',
  bgAlerte: '#fdf6dd',
  bgLightbox: '#ffffff',
  xtermBg: '#f2f2f3',
  xtermFg: '#2d2d30',
  xtermCursor: '#9184d9',
  xtermSelection: '#e5e0f0',
  xtermBlack: '#000000',
  xtermBrightBlack: '#666666',
  xtermWhite: '#e9e9ed',
  xtermBrightWhite: '#ffffff',
  xtermMagenta: '#9184d9',
  xtermBrightMagenta: '#b3a9e6',
}

/**
 * Constantes non thématisées (marque, webview, masques).
 */
export const unthemedColors = {
  brand: '#9184d9', // Marque Ovrsee (curseur xterm, bordures)
  brandAlt: '#796cbf', // Marque secondaire (SVG)
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
   * Le thème sombre ne redéfinit AUCUN jeton Nocturne.
   *
   * Une première version en recopiait les quatre-vingt-dix valeurs pour les
   * « thématiser » — et l'accent passait au passage du violet `#9184d9` au bleu,
   * le fond de `#161826` à `#16181f`. L'apparence par défaut de l'application
   * changeait sans que personne l'ait demandé.
   *
   * Nocturne EST le thème sombre : il est déjà chargé, il fait autorité. Ne
   * sont déclarés ici que les jetons `--theme-*`, ceux qui remplacent les
   * couleurs autrefois écrites en dur dans les composants.
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
   * Le thème clair, lui, doit bien renverser Nocturne — sinon un texte prévu
   * pour un fond sombre s'affiche en gris pâle sur blanc. La rampe neutre
   * s'inverse (le 100 le plus clair devient le plus sombre) ; l'accent garde
   * sa teinte et s'assombrit juste assez pour rester lisible sur du blanc.
   */
  const nocturneClair = {
    '--color-bg': '#f4f4f6',
    '--color-surface': '#ffffff',
    '--color-text': '#1a1b22',
    '--color-accent': '#5f52a8',
    '--color-accent-2': '#6b5fb0',
    '--color-divider': 'color-mix(in srgb, #1a1b22 14%, transparent)',
    '--color-neutral-100': '#1a1b22',
    '--color-neutral-200': '#2b2d36',
    '--color-neutral-300': '#3d3f4a',
    '--color-neutral-400': '#54566180',
    '--color-neutral-500': '#6b6d78',
    '--color-neutral-600': '#5c5e69',
    '--color-neutral-700': '#8a8c96',
    '--color-neutral-800': '#c9cad1',
    '--color-neutral-900': '#e6e7ec',
    '--color-accent-100': '#efedf9',
    '--color-accent-200': '#ddd9f2',
    '--color-accent-300': '#c4bce8',
    '--color-accent-400': '#a89ddb',
    '--color-accent-500': '#8b7ecd',
    '--color-accent-600': '#7264bd',
    '--color-accent-700': '#5f52a8',
    '--color-accent-800': '#4a3f88',
    '--color-accent-900': '#352d64',
    ...themeTokens(lightTheme),
  }

  const bloc = (tokens: Record<string, string>, indent: string): string =>
    Object.entries(tokens)
      .map(([key, val]) => `${indent}${key}: ${val};`)
      .join('\n')

  // `:root` ne porte que les jetons sombres ; Nocturne fournit le reste.
  // Le clair s'applique sur choix explicite, ou en `auto` quand le système le
  // demande — d'où le `:not([data-theme="dark"])`, qui laisse le choix primer.
  return `
    :root {
${bloc(themeTokens(darkTheme), '      ')}
    }

    :root[data-theme="light"] {
${bloc(nocturneClair, '      ')}
    }

    @media (prefers-color-scheme: light) {
      :root:not([data-theme="dark"]) {
${bloc(nocturneClair, '        ')}
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
  }
}
