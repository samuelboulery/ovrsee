/**
 * Les pages crawlées : leur forme, leur nom lisible, l'URL de leurs captures.
 */

export interface Page {
  route: string
  slug: string
  title: string
  sample: string
  excerpt: string
  links: string[]
  shot: string
  shotDate: string
  /** Taille du viewport au moment de la capture. Absent des scans antérieurs. */
  shotSize?: { width: number; height: number }
}

/**
 * Rapport d'affichage d'une capture, sous la forme attendue par `aspect-ratio`.
 *
 * Une capture affichée au mauvais rapport est soit déformée, soit rognée à
 * l'extrême — et une vignette rognée ne montre qu'une bande du haut de l'écran,
 * identique d'une page à l'autre. Le rapport vient donc de la taille
 * enregistrée à la prise ; 16/10 sert de repli pour les scans plus anciens,
 * qui ne portent pas encore l'information.
 */
export function shotRatio(page: Page): string {
  const { width, height } = page.shotSize ?? {}
  return width && height ? `${width} / ${height}` : '16 / 10'
}

/** `2026-07-18-d2f1a3.png` → `2026-07-18`. */
export const shotDate = (file: string): string => file.slice(0, 10)

/**
 * Nom lisible d'une page.
 *
 * Le titre du document ne sert que s'il distingue la page des autres. Dans une
 * application à page unique, `document.title` est souvent le même partout :
 * l'afficher sur les huit cartes du graphe remplirait l'écran sans rien
 * apprendre. On se rabat alors sur la route, qui, elle, distingue toujours.
 */
export function pageName(page: Page, pages: Page[]): string {
  const title = page.title?.trim()
  const distinctive = title && pages.filter(p => p.title?.trim() === title).length === 1
  if (distinctive) return title

  const segments = page.route.split('/').filter(Boolean)
  if (segments.length === 0) return 'Accueil'

  const last = segments.at(-1) as string
  const label = last.startsWith(':') ? (segments.at(-2) ?? last) : last
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ')
}

export const shotUrl = (root: string, file: string) =>
  `/api/shot?path=${encodeURIComponent(root)}&file=${encodeURIComponent(file)}`

/**
 * Une image ou une vidéo du dépôt, citée par un README.
 *
 * Chemin relatif à la racine, pas à `ovrsee/` — c'est toute la différence avec
 * `shotUrl`, et la raison pour laquelle le serveur n'accepte ici qu'une liste
 * blanche d'extensions.
 */
export const mediaUrl = (root: string, file: string) =>
  `/api/media?path=${encodeURIComponent(root)}&file=${encodeURIComponent(file)}`
