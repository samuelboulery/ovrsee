/**
 * Ce que l'onglet Navigateur sait d'une balise `<webview>` : sa surface, la
 * normalisation d'une URL tapée, la sélection d'un élément dans l'invité, et la
 * géométrie du panneau devtools.
 *
 * Sorti de `Navigateur.tsx` (T-0206). Aucune de ces fonctions ne rend de JSX.
 */

import { type Snapshot } from '../data'

/**
 * Ce que l'onglet utilise d'une balise `<webview>`.
 *
 * Déclaré à la main plutôt qu'importé d'`electron` : le rendu n'a pas de
 * dépendance sur les types d'Electron, et cette liste dit exactement quelle
 * surface de l'invité l'onglet touche.
 */
export interface Webview extends HTMLElement {
  src: string
  getURL(): string
  getWebContentsId(): number
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  loadURL(url: string): Promise<void>
  executeJavaScript(code: string): Promise<unknown>
}

/**
 * Ce qui annule une sélection en cours, depuis l'hôte.
 *
 * Le sélecteur écoute déjà `Escape` dans la page ; lui envoyer la touche évite
 * de lui faire poser un objet global dans une page qui ne nous appartient pas.
 */
export const CANCEL_PICK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"

/** Ce qu'un clic sur un élément de la page rapporte. */
export interface Picked {
  selector: string
  text: string
  html: string
  route: string
}

/** Une ligne de console retenue. */
export interface Log {
  level: string
  message: string
  source: string
}

/** Au-delà, la liste ne sert plus à rien et grossit sans fin. */
export const MAX_LOGS = 30

/**
 * `allowpopups` en chaîne, pas en booléen.
 *
 * Les types React le déclarent booléen, mais React ne connaît pas l'attribut
 * et refuse d'écrire un booléen dans un attribut inconnu : il l'omet et se
 * plaint dans la console. Sans lui, `window.open` de l'application inspectée
 * est bloqué net au lieu d'être repris par le processus principal, qui ouvre
 * le vrai navigateur.
 */
export const ALLOW_POPUPS = { allowpopups: 'true' } as unknown as { allowpopups?: boolean }

export const URL_KEY = (root: string) => `navigateur.url:${root}`

/** Où les DevTools se rangent. */
export type Dock = 'bottom' | 'side'

export const DOCK_KEY = 'navigateur.devtools.dock'

export const DOCKS: Array<[Dock, string]> = [
  ['bottom', 'bottom'],
  ['side', 'side'],
]

/**
 * Thème de l'interface, pour que les DevTools s'y accordent.
 *
 * L'ovrsee n'est aujourd'hui que sombre — d'où le repli. Le jour où il pose
 * un `data-theme` sur la racine, les DevTools suivront sans qu'on y revienne.
 */
export const appTheme = (): 'dark' | 'light' =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

/**
 * URL de départ pour un projet.
 *
 * Ce que l'utilisateur a tapé la dernière fois d'abord, sinon le `baseUrl` que
 * le projet déclare déjà pour le crawl. Rien à ressaisir dans le cas courant.
 */
export function startUrl(snapshot: Snapshot): string {
  const stored = localStorage.getItem(URL_KEY(snapshot.root))
  return stored || snapshot.config?.baseUrl || 'http://localhost:3000'
}

/** `localhost:5180` → `http://localhost:5180`. Une barre d'adresse tolère les deux. */
export function normalize(raw: string): string {
  const trimmed = raw.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

/**
 * Sélecteur d'élément, exécuté **dans la page inspectée**.
 *
 * Stringifiée puis passée à `executeJavaScript`, qui attend la promesse rendue
 * et en renvoie la valeur. C'est ce qui évite un script de preload pour
 * l'invité, une entrée dans `will-attach-webview` pour l'épingler, et un canal
 * `ipc-message` — trois pièces pour un aller-retour.
 *
 * Elle doit donc rester **autonome** : rien de ce module n'existe là-bas.
 */
export function pickElement(): Promise<Picked | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid var(--color-accent);' +
      'background:rgba(125,118,240,.18);border-radius:2px;transition:all .05s;'
    document.body.appendChild(overlay)

    let target: Element | null = null

    const selectorFor = (node: Element): string => {
      const parts: string[] = []
      let current: Element | null = node

      while (current && current !== document.body && parts.length < 4) {
        if (current.id) {
          parts.unshift(`#${current.id}`)
          break
        }
        const tag = current.tagName.toLowerCase()
        const classes = Array.from(current.classList).slice(0, 2)
        let part = tag + classes.map(c => `.${c}`).join('')

        const parent: Element | null = current.parentElement
        if (parent) {
          const twins = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
          if (twins.length > 1) part += `:nth-of-type(${twins.indexOf(current) + 1})`
        }
        parts.unshift(part)
        current = parent
      }
      return parts.join(' > ')
    }

    const stop = (result: Picked | null) => {
      overlay.remove()
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('click', take, true)
      document.removeEventListener('keydown', key, true)
      resolve(result)
    }

    const move = (event: MouseEvent) => {
      const node = event.target as Element | null
      if (!node || node === overlay) return
      target = node
      const box = node.getBoundingClientRect()
      overlay.style.top = `${box.top}px`
      overlay.style.left = `${box.left}px`
      overlay.style.width = `${box.width}px`
      overlay.style.height = `${box.height}px`
    }

    const take = (event: MouseEvent) => {
      // La page ne doit pas réagir au clic de sélection : on l'inspecte, on ne
      // s'en sert pas.
      event.preventDefault()
      event.stopPropagation()
      const node = target
      if (!node) return stop(null)

      const html = node.outerHTML
      stop({
        selector: selectorFor(node),
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
        html: html.length > 600 ? `${html.slice(0, 600)}…` : html,
        route: location.pathname + location.search,
      })
    }

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop(null)
    }

    document.addEventListener('mousemove', move, true)
    document.addEventListener('click', take, true)
    document.addEventListener('keydown', key, true)
  })
}

/** Le panneau des DevTools : replié, en bas, ou sur le côté. */
export function devtoolsStyle(open: boolean, dock: Dock, size: number): string {
  if (!open) return 'flex: none; width: 0; height: 0; overflow: hidden;'
  if (dock === 'side') {
    return `width: ${size}px; flex: none; border-left: 1px solid var(--color-divider); background: #ffffff;`
  }
  return `height: ${size}px; flex: none; border-top: 1px solid var(--color-divider); background: #ffffff;`
}

/** Le bloc envoyé à Claude — assez précis pour qu'il retrouve le code. */
export const describe = (picked: Picked): string =>
  [
    `Élément sélectionné dans l'aperçu (route ${picked.route}) :`,
    `sélecteur : ${picked.selector}`,
    `texte     : « ${picked.text} »`,
    `html      : ${picked.html}`,
  ].join('\n')

/** Le corps du ticket : même contexte que `describe()`, en markdown plutôt qu'en texte pour Claude. */
export const corpsDepuis = (picked: Picked): string =>
  [
    '## Contexte',
    '',
    `Élément sélectionné dans l'aperçu, route \`${picked.route}\`.`,
    '',
    `Sélecteur : \`${picked.selector}\``,
    '',
    `Texte : « ${picked.text} »`,
    '',
    '```html',
    picked.html,
    '```',
  ].join('\n')
