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
  bgSecondary: '#171920',
  // Fonds alternatifs — niveau "actif/élevé".
  bgTertiary: '#262832',
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

  const bloc = (tokens: Record<string, string>, indent: string): string =>
    Object.entries(tokens)
      .map(([key, val]) => `${indent}${key}: ${val};`)
      .join('\n')

  // Un seul thème pour l'instant : aucune maquette claire n'existe côté
  // Ovrsee App.dc.html (T-0075). `:root` porte les jetons sombres quel que
  // soit `data-theme` ; `_ds/ovrsee/styles.css` fournit le reste.
  return `
    :root {
${bloc(themeTokens(darkTheme), '      ')}
    }
  `
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
  const palette = darkTheme

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
