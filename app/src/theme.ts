/**
 * Jetons de couleur de l'application et injection des variables CSS.
 *
 * Il n'y a qu'un thème (T-0075 : aucune maquette claire n'existe). Le
 * basculement — `applyTheme`, `data-theme`, `settings.theme` — a été retiré
 * en T-0200 : il promettait un réglage sans effet. Le remettre le jour où une
 * maquette claire existe est du travail neuf de toute façon.
 */

/**
 * Palette sombre — la seule.
 */
export const darkTheme = {
  // Fonds principaux (statusbar, panneaux terminal) — niveau "rails et
  // panneaux" du système Ovrsee (T-0045).
  bgPrimary: '#0b0c0e',
  bgLightbox: '#08090a', // Fond lightbox
  // `bgSecondary`, `bgTertiary`, `bgQuaternary`, `bgError` et `bgAlerte` ont
  // disparu (T-0121) : ils doublaient `--color-surface-*` et `--color-warn-bg`
  // du design system, et les composants divergeaient selon celui des deux
  // qu'ils citaient. Les surfaces se prennent dans `_ds/ovrsee/styles.css`.
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
 * Injecte les variables CSS `--theme-*` au démarrage.
 * Appelé une seule fois dans main.tsx.
 */
export function initializeTheme(): void {
  const style = document.createElement('style')
  style.id = 'ovrsee-theme-vars'
  // Inject CSS statique avec les sélecteurs et media queries
  style.textContent = getCSSVariables()
  document.head.appendChild(style)
}

/**
 * La chaîne CSS des jetons `--theme-*`.
 *
 * Le thème sombre ne redéfinit AUCUN jeton `--color-*` du système Ovrsee.
 *
 * Une première version en recopiait les quatre-vingt-dix valeurs pour les
 * « thématiser » — et l'accent changeait de teinte au passage, le fond
 * dérivait. L'apparence par défaut de l'application changeait sans que
 * personne l'ait demandé.
 *
 * `_ds/ovrsee/styles.css` EST le thème sombre : il est déjà chargé, il fait
 * autorité. Ne sont déclarés ici que les jetons qui remplacent les couleurs
 * autrefois écrites en dur dans les composants.
 */
function getCSSVariables(): string {
  const tokens: Record<string, string> = {
    '--theme-bg-primary': darkTheme.bgPrimary,
    '--theme-bg-lightbox': darkTheme.bgLightbox,
    '--theme-xterm-bg': darkTheme.xtermBg,
    '--theme-xterm-fg': darkTheme.xtermFg,
    '--theme-xterm-cursor': darkTheme.xtermCursor,
    '--theme-xterm-selection': darkTheme.xtermSelection,
    '--theme-xterm-black': darkTheme.xtermBlack,
    '--theme-xterm-bright-black': darkTheme.xtermBrightBlack,
    '--theme-xterm-white': darkTheme.xtermWhite,
    '--theme-xterm-bright-white': darkTheme.xtermBrightWhite,
    '--theme-xterm-magenta': darkTheme.xtermMagenta,
    '--theme-xterm-bright-magenta': darkTheme.xtermBrightMagenta,
  }

  const lignes = Object.entries(tokens)
    .map(([cle, valeur]) => `      ${cle}: ${valeur};`)
    .join('\n')

  return `
    :root {
${lignes}
    }
  `
}

/**
 * La palette xterm, dérivée de `darkTheme`.
 */
export function getTerminalTheme() {
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
