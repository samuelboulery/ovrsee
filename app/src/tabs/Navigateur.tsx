import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'

import { ticketAction, type Snapshot } from '../data'
import { t } from '../i18n'
import { s } from '../style'
import { pasteToClaude } from '../useTerminal'
import { Divider, useResizable } from '../useResizable'

/**
 * Ce que l'onglet utilise d'une balise `<webview>`.
 *
 * Déclaré à la main plutôt qu'importé d'`electron` : le rendu n'a pas de
 * dépendance sur les types d'Electron, et cette liste dit exactement quelle
 * surface de l'invité l'onglet touche.
 */
interface Webview extends HTMLElement {
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
const CANCEL_PICK = "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"

/** Ce qu'un clic sur un élément de la page rapporte. */
interface Picked {
  selector: string
  text: string
  html: string
  route: string
}

/** Une ligne de console retenue. */
interface Log {
  level: string
  message: string
  source: string
}

/** Au-delà, la liste ne sert plus à rien et grossit sans fin. */
const MAX_LOGS = 30

/**
 * `allowpopups` en chaîne, pas en booléen.
 *
 * Les types React le déclarent booléen, mais React ne connaît pas l'attribut
 * et refuse d'écrire un booléen dans un attribut inconnu : il l'omet et se
 * plaint dans la console. Sans lui, `window.open` de l'application inspectée
 * est bloqué net au lieu d'être repris par le processus principal, qui ouvre
 * le vrai navigateur.
 */
const ALLOW_POPUPS = { allowpopups: 'true' } as unknown as { allowpopups?: boolean }

const URL_KEY = (root: string) => `navigateur.url:${root}`

/** Où les DevTools se rangent. */
type Dock = 'bottom' | 'side'

const DOCK_KEY = 'navigateur.devtools.dock'

const DOCKS: Array<[Dock, string]> = [
  ['bottom', 'bottom'],
  ['side', 'side'],
]

/**
 * Thème de l'interface, pour que les DevTools s'y accordent.
 *
 * L'ovrsee n'est aujourd'hui que sombre — d'où le repli. Le jour où il pose
 * un `data-theme` sur la racine, les DevTools suivront sans qu'on y revienne.
 */
const appTheme = (): 'dark' | 'light' =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

/**
 * URL de départ pour un projet.
 *
 * Ce que l'utilisateur a tapé la dernière fois d'abord, sinon le `baseUrl` que
 * le projet déclare déjà pour le crawl. Rien à ressaisir dans le cas courant.
 */
function startUrl(snapshot: Snapshot): string {
  const stored = localStorage.getItem(URL_KEY(snapshot.root))
  return stored || snapshot.config?.baseUrl || 'http://localhost:3000'
}

/** `localhost:5180` → `http://localhost:5180`. Une barre d'adresse tolère les deux. */
function normalize(raw: string): string {
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
function pickElement(): Promise<Picked | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
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

/** Le panneau des DevTools : replié, en bas, ou sur le côté. */
function devtoolsStyle(open: boolean, dock: Dock, size: number): string {
  if (!open) return 'flex: none; width: 0; height: 0; overflow: hidden;'
  if (dock === 'side') {
    return `width: ${size}px; flex: none; border-left: 1px solid var(--color-divider); background: #ffffff;`
  }
  return `height: ${size}px; flex: none; border-top: 1px solid var(--color-divider); background: #ffffff;`
}

/** Le bloc envoyé à Claude — assez précis pour qu'il retrouve le code. */
const describe = (picked: Picked): string =>
  [
    `Élément sélectionné dans l'aperçu (route ${picked.route}) :`,
    `sélecteur : ${picked.selector}`,
    `texte     : « ${picked.text} »`,
    `html      : ${picked.html}`,
  ].join('\n')

/** Le titre proposé par défaut — le texte de l'élément d'abord, sa route sinon. */
const titreDepuis = (picked: Picked): string =>
  picked.text ? picked.text.slice(0, 80) : `Élément de ${picked.route}`

/** Le corps du ticket : même contexte que `describe()`, en markdown plutôt qu'en texte pour Claude. */
const corpsDepuis = (picked: Picked): string =>
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

/**
 * Onglet Navigateur — l'application en cours de développement, dans l'ovrsee.
 *
 * L'ovrsee ne lance pas le serveur : il s'y branche. La commande se tape dans
 * un shell du panneau du bas, par l'utilisateur ou par Claude. Ce qu'on gagne
 * ici, c'est la boucle courte : cliquer l'élément qui cloche et que Claude en
 * reçoive le sélecteur, le texte et le HTML sans un copier-coller.
 */
export function Navigateur({ snapshot, visible }: { snapshot: Snapshot; visible: boolean }) {
  const view = useRef<Webview | null>(null)
  const [url, setUrl] = useState(() => startUrl(snapshot))
  // `src` n'est posé qu'une fois, puis toute navigation passe par `loadURL` :
  // relier `src` à l'état ferait naviguer deux fois pour un seul clic.
  const initial = useRef(url)
  // `loadURL` jette tant que l'invité n'a pas émis `dom-ready`. Ce qui est
  // demandé avant attend ici.
  const ready = useRef(false)
  const pending = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [logsOpen, setLogsOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [ticketing, setTicketing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Les DevTools sont une vue native posée au-dessus du DOM par le processus
  // principal. Ce `<div>` ne fait que réserver — et mesurer — leur place.
  const slot = useRef<HTMLDivElement | null>(null)
  const [devtools, setDevtools] = useState(false)
  const [dock, setDock] = useState<Dock>(() =>
    localStorage.getItem(DOCK_KEY) === 'side' ? 'side' : 'bottom',
  )

  // Deux tailles distinctes, conservées séparément : une hauteur de 320 px et
  // une largeur de 460 px ne se remplacent pas l'une l'autre.
  const paneHeight = useResizable({
    key: 'navigateur.devtools',
    initial: 320,
    min: 120,
    max: () => window.innerHeight * 0.75,
    axis: 'y',
    invert: true,
  })
  const paneWidth = useResizable({
    key: 'navigateur.devtools.side',
    initial: 460,
    min: 260,
    max: () => window.innerWidth * 0.7,
    axis: 'x',
    invert: true,
  })
  const pane = dock === 'side' ? paneWidth : paneHeight

  const moveDock = (next: Dock) => {
    setDock(next)
    localStorage.setItem(DOCK_KEY, next)
  }

  const say = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 2500)
  }

  const load = useCallback((next: string) => {
    setUrl(next)
    setFailure(null)
    if (ready.current) view.current?.loadURL(next).catch(() => {})
    else pending.current = next
  }, [])

  const go = useCallback(
    (raw: string) => {
      const next = normalize(raw)
      localStorage.setItem(URL_KEY(snapshot.root), next)
      load(next)
    },
    [snapshot.root, load],
  )

  // Changer de projet change ce qu'on regarde. L'onglet, lui, reste monté :
  // le démonter rechargerait l'application inspectée à chaque va-et-vient.
  useEffect(() => {
    setLogs([])
    load(startUrl(snapshot))
    // `snapshot.root` seul : le reste du snapshot change à chaque relecture de
    // `ovrsee/`, et rechargerait la page inspectée pour rien.
  }, [snapshot.root])

  useEffect(() => {
    const element = view.current
    if (!element) return

    const start = () => setLoading(true)
    const stop = () => setLoading(false)

    /** L'invité accepte `loadURL` à partir d'ici, pas avant. */
    const attached = () => {
      ready.current = true
      const wanted = pending.current
      pending.current = null
      // Recharger ce que `src` charge déjà avorterait la navigation en cours.
      if (wanted && wanted !== initial.current && wanted !== element.getURL()) {
        element.loadURL(wanted).catch(() => {})
      }
    }

    /** Une navigation repart d'une console vide : les erreurs d'avant ne disent plus rien. */
    const navigated = () => {
      setLogs([])
      setFailure(null)
      setUrl(element.getURL())
    }

    const failed = (event: Event) => {
      const detail = event as Event & { errorCode?: number; errorDescription?: string; isMainFrame?: boolean }
      // Les sous-ressources échouent tout le temps (favicon…) : seul l'échec
      // du cadre principal vaut un message.
      if (detail.isMainFrame === false) return
      // -3 : navigation abandonnée par la page elle-même, pas une panne.
      if (detail.errorCode === -3) return
      setFailure(detail.errorDescription || t('navigateur.loading_failed'))
      setLoading(false)
    }

    const logged = (event: Event) => {
      const detail = event as Event & { level?: string | number; message?: string; sourceId?: string; line?: number }
      const level = String(detail.level ?? '')
      // Electron a rendu `level` numérique avant de le rendre nommé ; les deux
      // formes cohabitent selon la version.
      if (!['error', 'warning', '2', '3'].includes(level)) return
      setLogs(before =>
        [
          ...before,
          {
            level: level === '3' || level === 'error' ? 'error' : 'warning',
            message: detail.message ?? '',
            source: `${detail.sourceId ?? ''}${detail.line ? `:${detail.line}` : ''}`,
          },
        ].slice(-MAX_LOGS),
      )
    }

    element.addEventListener('dom-ready', attached)
    element.addEventListener('did-start-loading', start)
    element.addEventListener('did-stop-loading', stop)
    element.addEventListener('did-navigate', navigated)
    element.addEventListener('did-navigate-in-page', navigated)
    element.addEventListener('did-fail-load', failed)
    element.addEventListener('console-message', logged)

    return () => {
      element.removeEventListener('dom-ready', attached)
      element.removeEventListener('did-start-loading', start)
      element.removeEventListener('did-stop-loading', stop)
      element.removeEventListener('did-navigate', navigated)
      element.removeEventListener('did-navigate-in-page', navigated)
      element.removeEventListener('did-fail-load', failed)
      element.removeEventListener('console-message', logged)
    }
  }, [])

  /** Envoie à Claude, ou copie s'il n'y a pas de session — comme le panneau terminal. */
  const send = async (label: string, text: string) => {
    if (pasteToClaude(text)) return say(t('navigateur.sent_to_claude', { label }))
    try {
      await navigator.clipboard.writeText(text)
      say(t('navigateur.copied', { label }))
    } catch {
      say(t('navigateur.copy_failed'))
    }
  }

  /**
   * Arme la sélection, ou la désarme si elle l'est déjà.
   *
   * Un bouton qui arme sans pouvoir désarmer piège : le clic suivant part dans
   * la page qu'on ne voulait pas inspecter. Le second clic annule, comme
   * `Échap` dans la page.
   */
  const select = async () => {
    const element = view.current
    if (!element) return

    if (picking) {
      await element.executeJavaScript(CANCEL_PICK).catch(() => {})
      return
    }

    setPicking(true)
    try {
      const result = (await element.executeJavaScript(`(${pickElement})()`)) as Picked | null
      if (result) setPicked(result)
    } catch (err) {
      say(t('navigateur.selection_failed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setPicking(false)
    }
  }

  const envoyerAClaude = async () => {
    if (!picked) return
    await send('Élément', describe(picked))
    setPicked(null)
  }

  const creerTicket = async () => {
    if (!picked) return
    setTicketing(true)
    try {
      await ticketAction('create', snapshot.root, {
        titre: titreDepuis(picked),
        tags: ['navigateur'],
        corps: corpsDepuis(picked),
      })
      say(t('navigateur.ticket_created'))
      setPicked(null)
    } catch (err) {
      say(t('navigateur.ticket_failed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setTicketing(false)
    }
  }

  /**
   * Renvoie au processus principal la place que l'emplacement occupe.
   *
   * Appelée à l'ouverture, puis à chaque fois que cette place change : la vue
   * native ne suit pas la mise en page. Une taille nulle — onglet quitté,
   * panneau replié — escamote le panneau sans le fermer.
   */
  const placeDevtools = useCallback(async () => {
    const element = view.current
    const box = slot.current
    if (!element || !box) return

    const rect = box.getBoundingClientRect()
    try {
      const ok = await window.ovrsee?.preview.devtools(
        element.getWebContentsId(),
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        appTheme(),
      )
      if (ok === false) {
        setDevtools(false)
        say(t('navigateur.devtools_unavailable'))
      }
    } catch (err) {
      setDevtools(false)
      say(t('navigateur.devtools_unavailable_error', { error: err instanceof Error ? err.message : String(err) }))
    }
  }, [])

  const toggleDevtools = () => {
    if (devtools) {
      setDevtools(false)
      window.ovrsee?.preview.devtoolsClose()
      return
    }
    // L'ouverture attend le rendu suivant : la place n'existe qu'une fois le
    // panneau déplié, et c'est elle qu'on envoie.
    setDevtools(true)
  }

  // La vue native n'a aucun moyen de savoir que la mise en page a bougé.
  // `visible` couvre le changement d'onglet — l'observateur ne verrait rien,
  // le composant restant monté sous un parent masqué.
  useLayoutEffect(() => {
    if (!devtools) return

    // Onglet quitté : l'emplacement mesure 0×0 puisque son parent est masqué,
    // et c'est exactement ce qui escamote la vue. Rien de spécial à dire.
    placeDevtools()
    if (!visible) return

    const box = slot.current
    if (!box) return

    const observer = new ResizeObserver(() => placeDevtools())
    observer.observe(box)
    window.addEventListener('resize', placeDevtools)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', placeDevtools)
    }
  }, [devtools, visible, dock, pane.size, placeDevtools])

  const errors = logs.filter(l => l.level === 'error').length
  const currentRoute = (() => {
    try {
      return new URL(url).pathname
    } catch {
      return null
    }
  })()

  // `<webview>` est une balise d'Electron. Dans un navigateur elle ne rend
  // rien : l'onglet affichait un grand rectangle blanc surmonté d'une barre
  // d'URL et de boutons qui n'agissaient sur rien. Le panneau terminal dit déjà
  // la vérité dans la même situation ; celui-ci la disait pas.
  //
  // Conséquence en cascade : le crawl tourne dans un navigateur, donc il
  // photographiait ce blanc. La vignette de `/navigateur` dans l'onglet Produit
  // affirmait à chaque commit que la page était vide.
  if (!window.ovrsee?.preview) return <HorsApplication />

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>
      <div
        style={s(
          'height: 40px; flex: none; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-bottom: 1px solid var(--color-divider);',
        )}
      >
        <NavButton label="←" title={t('navigateur.previous')} onClick={() => view.current?.goBack()} />
        <NavButton label="→" title={t('navigateur.next')} onClick={() => view.current?.goForward()} />
        <NavButton
          label={loading ? '×' : '⟳'}
          title={loading ? t('navigateur.stop') : t('navigateur.reload')}
          onClick={() => (loading ? view.current?.stop() : view.current?.reload())}
        />

        <form
          onSubmit={event => {
            event.preventDefault()
            go(url)
          }}
          style={s('flex: 1; display: flex; min-width: 0;')}
        >
          <input
            value={url}
            onChange={event => setUrl(event.target.value)}
            spellCheck={false}
            style={s(
              'flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 11.5px; padding: 5px 9px; border-radius: 6px; border: 1px solid var(--color-neutral-800); background: var(--color-surface); color: var(--color-text);',
            )}
          />
        </form>

        <button
          type="button"
          onClick={select}
          className={picking ? 'btn btn-primary' : 'btn btn-secondary'}
          style={s('font-size: 11.5px; padding: 5px 10px;')}
          title={picking ? t('navigateur.pick_element') : t('navigateur.pick_element_inactive')}
        >
          {picking ? t('navigateur.cancel_selection') : t('navigateur.select_element')}
        </button>
        <button
          type="button"
          onClick={toggleDevtools}
          className={devtools ? 'btn btn-primary' : 'btn btn-ghost'}
          style={s('font-size: 11.5px; padding: 5px 10px;')}
        >
          DevTools
        </button>

        {/* Le choix ne se pose que quand ils sont ouverts. */}
        {devtools && (
          <div style={s('display: flex; gap: 2px;')}>
            {DOCKS.map(([id, label]) => {
              const displayLabel = id === 'bottom' ? t('pref.terminal_bottom') : t('pref.terminal_side')
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => moveDock(id)}
                  title={t('navigateur.dock_position', { position: displayLabel.toLowerCase() })}
                  style={s(
                    'cursor: pointer; font-family: var(--font-body); font-size: 10.5px; letter-spacing: .06em; padding: 4px 9px; border-radius: 5px; border: 1px solid ' +
                      (dock === id
                        ? 'var(--color-accent-600); background: var(--color-accent-900); color: var(--color-accent-200);'
                        : 'var(--color-neutral-800); background: transparent; color: var(--color-neutral-500);'),
                  )}
                >
                  {displayLabel}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* La colonne aperçu+DevTools+journal à gauche, le panneau de
          l'élément sélectionné à droite — persistant, maquette 2c, plutôt
          qu'une barre qui n'apparaissait qu'un élément choisi. */}
      <div style={s('flex: 1; display: flex; min-height: 0; min-width: 0;')}>
      <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>

      {/* Aperçu et DevTools partagent cette zone : en colonne quand ils sont
          en bas, en ligne quand ils sont sur le côté. */}
      <div
        style={s(
          dock === 'side'
            ? 'flex: 1; display: flex; min-height: 0; min-width: 0;'
            : 'flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0;',
        )}
      >
      <div
        style={s('flex: 1; position: relative; min-height: 0; min-width: 0; background: #ffffff;')}
      >
        <webview
          ref={element => {
            view.current = element as Webview | null
          }}
          src={initial.current}
          // Session à part : les cookies de l'application inspectée ne se
          // mélangent pas à ceux de l'ovrsee, et survivent à un changement
          // d'onglet.
          partition="persist:navigateur"
          {...ALLOW_POPUPS}
          style={s('position: absolute; inset: 0; width: 100%; height: 100%;')}
        />

        {failure && (
          <div
            style={s(
              'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: var(--color-bg); padding: 24px; text-align: center;',
            )}
          >
            <div style={s('font-size: 13px; color: var(--color-text);')}>{failure}</div>
            <div style={s('font-size: 12px; color: var(--color-neutral-600); max-width: 460px; line-height: 1.6;')}>
              {t('navigateur.no_server')}
              {snapshot.config?.dev ? (
                <>
                  {' '}et lancez{' '}
                  <span style={s('font-family: var(--font-mono); color: var(--color-accent);')}>
                    {snapshot.config.dev}
                  </span>
                </>
              ) : null}
              .
            </div>
          </div>
        )}
      </div>

      {devtools && <Divider axis={dock === 'side' ? 'x' : 'y'} resizable={pane} />}

      {/* La place réservée aux DevTools. Elle reste vide : ce qui s'y affiche
          est une vue native, posée par-dessus, dont le processus principal
          règle les coordonnées d'après ce rectangle. */}
      <div ref={slot} style={s(devtoolsStyle(devtools, dock, pane.size))} />
      </div>

      {logs.length > 0 && (
        <div
          style={s(
            'flex: none; border-top: 1px solid var(--color-divider); background: var(--color-surface); font-size: 11.5px;',
          )}
        >
          <div style={s('display: flex; align-items: center; gap: 10px; padding: 6px 12px;')}>
            <button
              type="button"
              onClick={() => setLogsOpen(open => !open)}
              className="btn btn-ghost"
              style={s('font-size: 11px; padding: 3px 8px;')}
            >
              {logsOpen ? '▾' : '▸'} {t('navigateur.console_title', { errors, warnings: logs.length - errors })}
            </button>
            <div
              style={s(
                'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); color: var(--color-neutral-600);',
              )}
            >
              {logs.at(-1)?.message}
            </div>
            <button
              type="button"
              onClick={() => {
                const logsText = logs.map(l => '[' + l.level + '] ' + l.message + (l.source ? ' (' + l.source + ')' : '')).join('\n')
                const output = t('navigateur.console_preview') + '\n' + logsText
                return send('Console', output)
              }}
              className="btn btn-secondary"
              style={s('font-size: 11px; padding: 3px 9px;')}
            >
              {t('navigateur.send_to_claude')}
            </button>
          </div>
          {logsOpen && (
            <div style={s('max-height: 168px; overflow: auto; padding: 0 12px 8px; font-family: var(--font-mono);')}>
              {logs.map((log, i) => (
                <div
                  key={i}
                  style={s(
                    'padding: 2px 0; line-height: 1.5; color: ' +
                      (log.level === 'error' ? 'var(--color-accent);' : 'var(--color-neutral-500);'),
                  )}
                >
                  {log.message}
                  {log.source && (
                    <span style={s('color: var(--color-neutral-700);')}> ({log.source})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {notice && (
        <div
          style={s(
            'flex: none; padding: 6px 12px; border-top: 1px solid var(--color-divider); font-size: 11.5px; color: var(--color-neutral-500);',
          )}
        >
          {notice}
        </div>
      )}
      </div>

      <ElementPanel
        picked={picked}
        routes={snapshot.pages?.pages?.map(page => page.route) ?? []}
        currentRoute={currentRoute}
        onSend={envoyerAClaude}
        onTicket={creerTicket}
        ticketing={ticketing}
        onClose={() => setPicked(null)}
      />
      </div>
    </div>
  )
}

/**
 * Panneau de l'élément sélectionné — maquette 2c, colonne fixe à droite.
 *
 * Remplace la barre du bas qui n'apparaissait qu'une fois un élément choisi :
 * la maquette le pose en permanence, avec un état vide tant que rien n'est
 * sélectionné.
 */
function ElementPanel({
  picked,
  routes,
  currentRoute,
  onSend,
  onTicket,
  ticketing,
  onClose,
}: {
  picked: Picked | null
  routes: string[]
  currentRoute: string | null
  onSend: () => void
  onTicket: () => void
  ticketing: boolean
  onClose: () => void
}) {
  return (
    <div
      style={s(
        'width: 340px; flex: none; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); display: flex; flex-direction: column; overflow-y: auto;',
      )}
    >
      <div style={s('height: 38px; flex: none; display: flex; align-items: center; padding: 0 14px; border-bottom: 1px solid var(--color-divider);')}>
        <div style={s('font-size: 12px; font-weight: 500; flex: 1;')}>{t('navigateur.selected_element')}</div>
        {picked && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('navigateur.dismiss_selection')}
            style={s('background: transparent; border: 0; cursor: pointer; color: var(--color-neutral-600); display: flex; padding: 0;')}
          >
            <X size={14} weight="regular" aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={s('padding: 14px; display: flex; flex-direction: column; gap: 14px;')}>
        {picked ? (
          <>
            <PanelField label={t('navigateur.selector_label')}>
              <div
                style={s(
                  'font-family: var(--font-mono); font-size: 11px; color: var(--color-accent); background: var(--color-surface-control); border: 1px solid var(--color-divider); border-radius: var(--radius-md); padding: 9px 10px; line-height: 1.6; word-break: break-all;',
                )}
              >
                {picked.selector}
              </div>
            </PanelField>
            <PanelField label={t('navigateur.text_label')}>
              <div style={s('font-size: 12.5px; color: var(--color-neutral-400); line-height: 1.6;')}>{picked.text || '—'}</div>
            </PanelField>
            <PanelField label={t('navigateur.route_label')}>
              <div style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral-500);')}>{picked.route}</div>
            </PanelField>

            <div style={s('height: 1px; background: var(--color-divider);')} />

            <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
              <button type="button" onClick={onSend} className="btn btn-primary" style={s('justify-content: center; font-size: 12px;')}>
                {t('navigateur.paste_in_claude')}
              </button>
              <button
                type="button"
                onClick={onTicket}
                disabled={ticketing}
                className="btn btn-secondary"
                style={s('justify-content: center; font-size: 12px;')}
              >
                {ticketing ? t('navigateur.ticket_creating') : t('navigateur.open_ticket_from_element')}
              </button>
            </div>
          </>
        ) : (
          <div style={s('font-size: 12px; color: var(--color-neutral-600); line-height: 1.6;')}>
            {t('navigateur.no_element_selected')}
          </div>
        )}

        {routes.length > 0 && (
          <>
            <div style={s('height: 1px; background: var(--color-divider);')} />
            <PanelField label={t('navigateur.known_routes')}>
              <div style={s('display: flex; flex-wrap: wrap; gap: 5px;')}>
                {routes.map(route => (
                  <span
                    key={route}
                    className={route === currentRoute ? 'tag tag-accent' : 'tag tag-outline'}
                    style={s('font-size: 11px;')}
                  >
                    {route}
                  </span>
                ))}
              </div>
            </PanelField>
          </>
        )}
      </div>
    </div>
  )
}

function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
      <div style={s('font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);')}>
        {label}
      </div>
      {children}
    </div>
  )
}

function NavButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={s(
        'cursor: pointer; border: 1px solid var(--color-neutral-800); background: transparent; color: var(--color-neutral-500); border-radius: 6px; width: 26px; height: 26px; font-size: 12px; line-height: 1; flex: none;',
      )}
    >
      {label}
    </button>
  )
}

/**
 * Ce que l'onglet montre hors de l'application empaquetée.
 *
 * Même franchise que le panneau terminal : pas de barre d'URL inerte, pas de
 * bouton qui ne fait rien. On dit pourquoi, et où le trouver.
 */
function HorsApplication() {
  return (
    <div
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center;',
      )}
    >
      <div style={s('font-size: 13px; color: var(--color-text);')}>
        {t('navigateur.not_packaged_title')}
      </div>
      <div
        style={s(
          'font-size: 11.5px; color: var(--color-neutral-600); max-width: 56ch; line-height: 1.6;',
        )}
      >
        {t('navigateur.not_packaged_desc')}{' '}
        <span style={s('font-family: var(--font-mono); color: var(--color-accent);')}>
          pnpm electron
        </span>{' '}
        {t('navigateur.not_packaged_help')}
      </div>
    </div>
  )
}
