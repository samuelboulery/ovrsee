import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Cursor } from '@phosphor-icons/react'

import { type Snapshot } from '../data'
import { t } from '../i18n'
import { s } from '../style'
import { StatusBar } from '../StatusBar'
import { pasteToClaude } from '../pty'
import { Divider, useResizable } from '../useResizable'
import { CarteElement, HorsApplication, NavButton } from './NavigateurPanneaux'
import {
  ALLOW_POPUPS,
  CANCEL_PICK,
  DOCKS,
  DOCK_KEY,
  MAX_LOGS,
  URL_KEY,
  appTheme,
  corpsDepuis,
  describe,
  devtoolsStyle,
  normalize,
  pickElement,
  startUrl,
  type Dock,
  type Log,
  type Picked,
  type Webview,
} from './navigateur-webview'


/**
 * Onglet Navigateur — l'application en cours de développement, dans l'ovrsee.
 *
 * L'ovrsee ne lance pas le serveur : il s'y branche. La commande se tape dans
 * un shell du panneau du bas, par l'utilisateur ou par Claude. Ce qu'on gagne
 * ici, c'est la boucle courte : cliquer l'élément qui cloche et que Claude en
 * reçoive le sélecteur, le texte et le HTML sans un copier-coller.
 */
export function Navigateur({
  snapshot,
  visible,
  focusRoute,
  onFocusHandled,
  onCreerTicketDepuisElement,
}: {
  snapshot: Snapshot
  visible: boolean
  /** Route à charger depuis « Ouvrir dans le Navigateur » (Produit) — voir `App.tsx`. */
  focusRoute?: string | null
  onFocusHandled?: () => void
  /** Bascule sur Tableau et attache le contexte de l'élément au prochain ticket créé — voir `App.tsx`. */
  onCreerTicketDepuisElement: (corps: string, tags: string[]) => void
}) {
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
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const loadStarted = useRef<number | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [logsOpen, setLogsOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Picked | null>(null)
  // Ce qu'on a voulu dire de l'élément. Reparti de zéro à chaque sélection :
  // un commentaire qui survivrait au clic suivant parlerait d'autre chose.
  const [comment, setComment] = useState('')
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

  // « Ouvrir dans le Navigateur » (Produit) : la route est relative à
  // l'origine actuellement chargée, pas forcément à `baseUrl` — l'utilisateur
  // a pu naviguer ailleurs entre-temps.
  useEffect(() => {
    if (!focusRoute) return
    go(new URL(focusRoute, url || snapshot.config?.baseUrl || 'http://localhost:3000').href)
    onFocusHandled?.()
  }, [focusRoute])

  // Changer de projet change ce qu'on regarde. L'onglet, lui, reste monté :
  // le démonter rechargerait l'application inspectée à chaque va-et-vient.
  useEffect(() => {
    setLogs([])
    load(startUrl(snapshot))
    // `snapshot.root` seul : le reste du snapshot change à chaque relecture de
    // `ovrsee/`, et rechargerait la page inspectée pour rien.
  }, [snapshot.root])

  // ⇧⌘E bascule le sélecteur — annoncé par la barre d'état (maquette 2c).
  // Bindé seulement onglet visible : sinon un raccourci global s'active en
  // arrière-plan pendant qu'on tape ailleurs dans l'application.
  useEffect(() => {
    if (!visible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        setPicking(p => !p)
      }
      // Échap referme la carte, exactement comme sa croix. La saisie a le
      // focus à l'ouverture : sans ça, il faudrait viser la croix à la souris
      // pour abandonner un commentaire.
      if (event.key === 'Escape') fermerCarte()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  useEffect(() => {
    const element = view.current
    if (!element) return

    const start = () => {
      loadStarted.current = Date.now()
      setLoading(true)
    }
    const stop = () => {
      setLoading(false)
      if (loadStarted.current !== null) {
        setLoadMs(Date.now() - loadStarted.current)
        loadStarted.current = null
      }
    }

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
      setLoadMs(null)
      loadStarted.current = null
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
      if (result) {
        setComment('')
        setPicked(result)
      }
    } catch (err) {
      say(t('navigateur.selection_failed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setPicking(false)
    }
  }

  /**
   * Ferme la carte.
   *
   * Rien à annuler côté page : quand la carte paraît, `pickElement` a déjà
   * rendu sa valeur et retiré ses écouteurs. `CANCEL_PICK` ne sert qu'à
   * interrompre une sélection **en cours**, et c'est `select()` qui l'envoie.
   */
  const fermerCarte = () => {
    setPicked(null)
    setComment('')
  }

  const envoyerAClaude = async () => {
    if (!picked) return
    await send('Élément', describe(picked, comment))
    setPicked(null)
    setComment('')
  }

  const onTicketDepuisElement = () => {
    if (!picked) return
    onCreerTicketDepuisElement(corpsDepuis(picked, comment), ['navigateur'])
    setPicked(null)
    setComment('')
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
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
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
              'flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 11.5px; padding: 5px 9px; border-radius: 6px; border: 1px solid var(--color-border-card); background: var(--color-surface-control); color: var(--color-text);',
            )}
          />
        </form>

        <button
          type="button"
          onClick={select}
          style={s(
            'display: flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 5px 10px; border-radius: 6px; cursor: pointer; ' +
              (picking
                ? 'background: var(--color-surface-segment); border: 1px solid var(--color-border-selected); color: var(--color-text);'
                : 'background: transparent; border: 1px solid var(--color-border-control); color: var(--color-neutral-500);'),
          )}
          title={picking ? t('navigateur.pick_element') : t('navigateur.pick_element_inactive')}
        >
          <Cursor size={13} weight={picking ? 'fill' : 'regular'} color={picking ? 'var(--color-accent)' : undefined} aria-hidden="true" />
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
            {DOCKS.map(([id]) => {
              const displayLabel = id === 'bottom' ? t('pref.terminal_bottom') : t('pref.terminal_side')
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => moveDock(id)}
                  title={t('navigateur.dock_position', { position: displayLabel.toLowerCase() })}
                  style={s(
                    'cursor: pointer; font-family: var(--font-body); font-size: 10.5px; letter-spacing: .06em; padding: 4px 9px; border-radius: 6px; border: 1px solid ' +
                      (dock === id
                        ? 'var(--color-surface-segment); background: var(--color-surface-segment); color: var(--color-text);'
                        : 'var(--color-border-control); background: transparent; color: var(--color-text-tertiary);'),
                  )}
                >
                  {displayLabel}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Aperçu, DevTools et journal, sur toute la largeur — la colonne de
          droite a disparu avec le panneau de l'élément (T-0214), qui est
          devenu une carte flottante posée sur l'aperçu. */}
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
        style={s(
          `flex: 1; position: relative; min-height: 0; min-width: 0; background: ${
            url
              ? '#ffffff'
              : 'repeating-linear-gradient(135deg, var(--color-surface-card) 0 10px, var(--color-surface-panel) 10px 20px)'
          };`,
        )}
      >
        {!url && (
          <div
            style={s(
              'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11px; color: var(--color-text-faint);',
            )}
          >
            {t('navigateur.no_url')}
          </div>
        )}
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

        {/* Au-dessus de l'aperçu, pas à côté : ce qu'on regarde c'est le site. */}
        {picked && (
          <CarteElement
            picked={picked}
            comment={comment}
            onComment={setComment}
            onSend={envoyerAClaude}
            onTicket={onTicketDepuisElement}
            onClose={fermerCarte}
          />
        )}

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
            'flex: none; border-top: 1px solid var(--color-divider); background: var(--color-surface-panel); font-size: 11.5px;',
          )}
        >
          <div style={s('display: flex; align-items: center; gap: 10px; padding: 6px 12px;')}>
            <button
              type="button"
              onClick={() => setLogsOpen(open => !open)}
              className="btn btn-ghost"
              style={s('font-size: 11px; padding: 3px 8px;')}
            >
              {logsOpen ? '▾' : '▸'} {t('navigateur.console_label')} —{' '}
              {t(errors > 1 ? 'navigateur.console_errors_plural' : 'navigateur.console_errors', { n: errors })},{' '}
              {t(
                logs.length - errors > 1 ? 'navigateur.console_warnings_plural' : 'navigateur.console_warnings',
                { n: logs.length - errors },
              )}
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
                    'padding: 2px 0; line-height: 1.9; color: ' +
                      (log.level === 'error' ? 'var(--color-err);' : 'var(--color-warn);'),
                  )}
                >
                  <span aria-hidden="true">{log.level === 'error' ? '✕' : '▲'}</span>{' '}
                  <span style={s('color: var(--color-neutral-500);')}>{log.message}</span>
                  {log.source && (
                    <span style={s('color: var(--color-text-faint);')}> · {log.source}</span>
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

      {visible && (
      <StatusBar
        dot={failure ? 'err' : 'ok'}
        left={[
          failure ? `${host} — ${failure}` : t('statusbar.responds', { host }),
          ...(!failure && loadMs !== null ? [t('statusbar.loaded_in', { ms: loadMs })] : []),
        ]}
        right={[t('statusbar.selector_shortcut')]}
      />
      )}
    </div>
  )
}
