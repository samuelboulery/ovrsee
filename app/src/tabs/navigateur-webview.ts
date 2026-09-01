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
    // Couleur littérale, pas `var(--color-accent)` : ce style s'applique dans
    // la page inspectée, qui n'a pas le design system de l'ovrsee. La variable
    // n'y existant pas, la déclaration devenait invalide et la bordure ne se
    // voyait pas — seul le fond `rgba()` survivait.
    overlay.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #7d76f0;' +
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

/** Ce qu'une touche demande à l'onglet. */
export type ActionClavier = 'basculer' | 'annuler' | null

/**
 * La décision clavier, sortie du composant pour être testable.
 *
 * `⇧⌘E` bascule le sélecteur — armer *et* désarmer par le même geste, comme le
 * bouton. Le raccourci se contentait de retourner le booléen d'affichage sans
 * jamais armer quoi que ce soit dans la page : le bouton passait à « Annuler »
 * et plus rien ne répondait.
 *
 * `event.key` vaut « E » majuscule quand Maj est enfoncée — d'où le repli en
 * minuscules.
 */
export function actionClavier(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'shiftKey'>): ActionClavier {
  if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'e') return 'basculer'
  if (event.key === 'Escape') return 'annuler'
  return null
}

/** Le panneau des DevTools : replié, en bas, ou sur le côté. */
export function devtoolsStyle(open: boolean, dock: Dock, size: number): string {
  if (!open) return 'flex: none; width: 0; height: 0; overflow: hidden;'
  if (dock === 'side') {
    return `width: ${size}px; flex: none; border-left: 1px solid var(--color-divider); background: #ffffff;`
  }
  return `height: ${size}px; flex: none; border-top: 1px solid var(--color-divider); background: #ffffff;`
}

/**
 * Le commentaire, prêt à être mis en tête — ou rien.
 *
 * Un champ laissé vide est le cas courant : on clique souvent pour envoyer le
 * sélecteur, sans avoir rien à dire. Il ne doit alors pas laisser de ligne
 * blanche derrière lui, sans quoi la sortie d'avant T-0214 changerait pour
 * tout le monde.
 */
const enTete = (comment?: string): string[] => {
  const dit = comment?.trim()
  return dit ? [dit, ''] : []
}

/**
 * Le bloc envoyé à Claude — assez précis pour qu'il retrouve le code.
 *
 * Le commentaire passe **avant** le descriptif : c'est ce qu'on a voulu dire
 * qui compte, le sélecteur n'en est que la preuve.
 */
export const describe = (picked: Picked, comment?: string): string =>
  [
    ...enTete(comment),
    `Élément sélectionné dans l'aperçu (route ${picked.route}) :`,
    `sélecteur : ${picked.selector}`,
    `texte     : « ${picked.text} »`,
    `html      : ${picked.html}`,
  ].join('\n')

/** Le corps du ticket : même contexte que `describe()`, en markdown plutôt qu'en texte pour Claude. */
export const corpsDepuis = (picked: Picked, comment?: string): string =>
  [
    '## Contexte',
    '',
    ...enTete(comment),
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
