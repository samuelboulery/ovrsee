/**
 * La coque de la fenêtre : barre latérale, sélecteur de projet, rail des vues,
 * et les deux petits blocs qui bordent le contenu (badge de scan, message).
 *
 * Sorti d'`App.tsx` (T-0206). Tout ce qui est ici prend son état en props —
 * c'est ce qui rendait la découpe possible sans faire circuler l'état de la
 * fenêtre : `App()` lui-même n'a pas bougé.
 */

import { useEffect, useRef, useState } from 'react'
import {
  CaretDown,
  DotsSixVertical,
  GearSix,
  MagnifyingGlass,
} from '@phosphor-icons/react'

import { t } from './i18n'
import {
  fetchSnapshot,
  fetchUsername,
  frDate,
  humanAge,
  isUnequipped,
  lastScan,
  projectAction,
  restant,
  type Project,
  type SettingsType,
  type Snapshot,
} from './data'
import { DIT_ATTENTION, Etat } from './EtatSession'
import { agregerEtat, type EtatSession, type MenuBarSession } from './menubar'
import { s } from './style'
import { TAB_ICONS, activeTabsInOrder, type TabId } from './views'


/**
 * Ouvrir un projet : sélecteur du système, puis enregistrement.
 *
 * Hors du composant parce que deux gestes y mènent — le bouton « + » de la
 * barre latérale et le ⌘O du menu natif. Deux copies divergeraient.
 *
 * Sans passerelle (dans un navigateur), il n'y a pas de sélecteur : la fonction
 * ne fait rien plutôt que d'échouer, et le bouton n'est de toute façon pas
 * affiché.
 */
export async function openProject(
  onProjects: (list: Project[], select?: string | null) => void,
  onError: (message: string) => void,
) {
  const picker = window.ovrsee?.projects
  if (!picker) return
  try {
    const path = await picker.pick()
    if (!path) return // sélecteur annulé : rien à dire
    const { projects: list } = await projectAction('add', path)
    onProjects(list, path)
  } catch (err) {
    onError(String((err as Error).message ?? err))
  }
}

/**
 * Date du dernier scan. Un scan échoué se dit — sans quoi la capture
 * précédente passerait pour fraîche.
 */
export function ScanBadge({ scan }: { scan: ReturnType<typeof lastScan> }) {
  if (!scan) {
    return (
      <div style={s('font-size: 11.5px; color: var(--color-text-quaternary);')}>
        {t('scan.none')}
      </div>
    )
  }
  return (
    <div
      style={s(
        'display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-family: var(--font-mono); color: var(--color-text-quaternary);',
      )}
    >
      <span
        style={s(
          scan.ok
            ? 'width: 5px; height: 5px; border-radius: 50%; background: var(--color-ok); display: block;'
            : 'width: 5px; height: 5px; border-radius: 50%; background: var(--color-err); display: block;',
        )}
      />
      {scan.ok ? t('scan.last') : t('scan.failed')} · {frDate(scan.date)} · {scan.commit}
    </div>
  )
}

export function Message({ text }: { text: string }) {
  return (
    // `role="status"` : c'est ici, et nulle part ailleurs, qu'une région vivante
    // a sa place. `<main>` en portait une qui couvrait tout l'onglet, et les
    // deux polls la faisaient parler toutes les quatre secondes.
    <div
      role="status"
      style={s(
        'flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--color-neutral-500);',
      )}
    >
      {text}
    </div>
  )
}

/** Largeur fixe du rail replié — pictos 17px centrés (maquette 2a/2k). */
const RAIL_COLLAPSED_WIDTH = 56

/**
 * Barre latérale — maquette l. 45-71, rail des vues intégré (T-0047, maquette
 * 1b/2b : Projets puis Vues dans une seule colonne).
 *
 * Repliée (`collapsed`), elle ne montre que la recherche et les 7 pictos de
 * vue, sans projets ni activité — c'est la lecture « rail replié » de la
 * maquette 2k. Mêmes contrôles qu'ouverte, en icône seule : pas de logo ni
 * d'autre picto qui n'existerait pas côté ouvert (issue #50).
 */
export function Sidebar({
  collapsed,
  settings,
  width,
  tab,
  onTabPick,
  onOpenPreferences,
  onOpenPreferencesInterface,
  onOpenPalette,
  ticketsRestant,
}: {
  collapsed: boolean
  settings: SettingsType | null
  width: number
  tab: TabId
  onTabPick: (id: TabId, path: string) => void
  /** La modale vit dans `App` : le menu natif l'ouvre par le même chemin. */
  onOpenPreferences: () => void
  /** Ouvre les Préférences directement sur la section Interface — depuis la
      ligne « Réordonner, masquer… » de la liste de vues. */
  onOpenPreferencesInterface: () => void
  onOpenPalette: () => void
  /** Seul décompte affiché en sidebar aujourd'hui : le Tableau (maquette 2b). */
  ticketsRestant: number
}) {
  const views = activeTabsInOrder(settings)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    fetchUsername()
      .then(r => setUsername(r.username))
      .catch(() => {})
  }, [])

  if (collapsed) {
    return (
      <aside
        aria-label={t('sidebar.projects')}
        style={s(
          `width: ${RAIL_COLLAPSED_WIDTH}px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--color-surface); border-right: 1px solid var(--color-border-chrome); padding: 10px 0;`,
        )}
      >
        <button
          type="button"
          title={`${t('palette.placeholder')} (⌘K)`}
          onClick={onOpenPalette}
          style={s(
            'width: 36px; height: 36px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: transparent; border: none; color: var(--color-text-quaternary); cursor: pointer;',
          )}
        >
          <MagnifyingGlass size={16} aria-hidden="true" />
        </button>
        {views.map(([id, cle, path]) => (
          <RailLink key={id} id={id} label={t(cle)} path={path} active={tab === id} onTabPick={onTabPick} compact />
        ))}
        <div style={s('flex: 1;')} />
        <button
          type="button"
          title={`${t('sidebar.preferences')} (⌘,)`}
          onClick={onOpenPreferences}
          style={s(
            'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: transparent; border: none; color: var(--color-text-quaternary); cursor: pointer;',
          )}
        >
          <GearSix size={16} weight="regular" aria-hidden="true" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      aria-label={t('sidebar.projects')}
      style={s(
        `width: ${width}px; flex: none; display: flex; flex-direction: column; background: var(--color-surface-panel); border-right: 1px solid var(--color-border-chrome); padding: 10px 0;`,
      )}
    >
      <div style={s('padding: 0 10px 10px;')}>
        <button
          type="button"
          onClick={onOpenPalette}
          style={s(
            'width: 100%; height: 30px; display: flex; align-items: center; gap: 8px; padding: 0 9px; border-radius: 6px; border: 1px solid var(--color-border-card); background: var(--color-surface-control); color: var(--color-text-quaternary); font-size: 12px; cursor: pointer; text-align: left;',
          )}
        >
          <MagnifyingGlass size={14} aria-hidden="true" />
          <span style={s('flex: 1;')}>{t('palette.placeholder')}</span>
          <span
            style={s(
              "box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; height: 17px; min-width: 17px; padding: 0 5px; border-radius: 4px; background: var(--color-border-chrome); font-family: -apple-system, 'SF Pro Text', system-ui, sans-serif; font-size: 10.5px; line-height: 1; color: var(--color-text-tertiary);",
            )}
          >
            ⌘K
          </span>
        </button>
      </div>

      <div
        style={s(
          'padding: 8px 8px 5px 10px; display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-text-faint);',
        )}
      >
        {t('sidebar.views')}
        <span>{views.length}</span>
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 2px; padding: 0 10px;')}>
        {views.map(([id, cle, path], index) => (
          <RailLink
            key={id}
            id={id}
            label={t(cle)}
            path={path}
            active={tab === id}
            onTabPick={onTabPick}
            shortcut={index + 1}
            count={id === 'tableau' ? ticketsRestant : undefined}
          />
        ))}
        <button
          type="button"
          onClick={onOpenPreferencesInterface}
          title={t('sidebar.reorder_views')}
          style={s(
            'height: 31px; padding: 0 8px; display: flex; align-items: center; gap: 10px; border-radius: 6px; border: 0; background: transparent; cursor: pointer; text-align: left; color: var(--color-text-faint); font-size: 12.5px;',
          )}
        >
          <DotsSixVertical size={15} aria-hidden="true" color="var(--color-text-ghost)" />
          {t('sidebar.reorder_views')}
        </button>
      </div>

      <div style={s('flex: 1;')} />

      {/* Une seule porte vers la configuration. Les skills et la lecture de
          `~/.claude/` avaient chacun leur bouton et leur modale ; ils sont
          maintenant deux sections des préférences, parce que c'est la même
          question — comment l'ovrsee est réglé. Le nom d'utilisateur système
          (lecture seule, jamais un secret) donne à ce bouton la même
          affordance « c'est vous, ici » que la maquette. */}
      <div style={s('padding: 10px 10px 0; border-top: 1px solid var(--color-border-chrome);')}>
        <button
          type="button"
          onClick={onOpenPreferences}
          title={`${t('sidebar.preferences')} (⌘,)`}
          style={s(
            'width: 100%; height: 32px; display: flex; align-items: center; gap: 9px; padding: 0 8px; border-radius: 6px; border: 0; background: transparent; cursor: pointer; text-align: left;',
          )}
        >
          <span
            style={s(
              'width: 20px; height: 20px; flex: none; border-radius: 6px; background: var(--color-border-control); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--color-text-tertiary);',
            )}
          >
            {username ? username[0].toUpperCase() : '?'}
          </span>
          <span
            style={s(
              'flex: 1; font-size: 12.5px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
            )}
          >
            {username ?? '…'}
          </span>
          <GearSix size={15} weight="regular" aria-hidden="true" color="var(--color-text-quaternary)" />
        </button>
      </div>
    </aside>
  )
}

/**
 * Bascule de projet — bouton badge dans la barre de titre, menu déroulant en
 * dessous. Remplace l'ancienne section « PROJETS » de la sidebar, qui
 * occupait une colonne entière pour une bascule qu'on ne fait pas souvent.
 *
 * Réutilise `ProjectRow` tel quel (pastille, badge de tickets restants,
 * suppression avec confirmation en deux temps) — seul son conteneur change,
 * d'une liste fixe de sidebar à un popover ancré au bouton.
 */
export function ProjectSwitcher({
  projects,
  current,
  snapshot,
  sessions,
  onPick,
  onProjects,
  onError,
}: {
  projects: Project[]
  current: string | null
  /** L'instantané du projet affiché, pour que sa pastille suive le tableau sans re-fetch. */
  snapshot: Snapshot | null
  /**
   * Les sessions Claude vivantes, tous projets confondus — la même liste que
   * la barre de menu reçoit (`composer()`), passée par `App`. Vide quand le
   * panneau terminal est replié : il n'écoute alors aucun pty.
   */
  sessions: readonly MenuBarSession[]
  onPick: (path: string) => void
  onProjects: (list: Project[], select?: string | null) => void
  onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = projects.find(p => p.path === current) ?? null
  const picker = window.ovrsee?.projects
  // L'état condensé de l'issue #47 : une question l'emporte sur du travail en
  // cours, qui l'emporte sur le repos. `null` quand aucune session ne tourne —
  // le bouton garde alors son carré d'accent, qui ne dit que « ce projet-ci ».
  const global = agregerEtat(sessions)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} style={s('position: relative; -webkit-app-region: no-drag;')}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={t('sidebar.switch_project')}
        style={s(
          'display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 9px; border-radius: 6px; border: 1px solid var(--color-border-card); background: var(--color-surface-control); cursor: pointer;',
        )}
      >
        {global ? (
          <Etat kind={global} actif dit={t(DIT_ATTENTION[global])} />
        ) : (
          <span style={s('width: 5px; height: 5px; border-radius: 2px; background: var(--color-accent); flex: none;')} />
        )}
        <span style={s('font-size: 12px; font-weight: 500; color: var(--color-text); white-space: nowrap;')}>
          {active?.name ?? '…'}
        </span>
        <CaretDown size={10} weight="bold" aria-hidden="true" color="var(--color-text-discrete)" />
      </button>

      {open && (
        <div
          style={s(
            'position: absolute; top: 30px; left: 0; width: 260px; z-index: 20; padding: 6px; border-radius: 8px; border: 1px solid var(--color-border-card); background: var(--color-surface-elevated); box-shadow: var(--shadow-menu); display: flex; flex-direction: column; gap: 2px;',
          )}
        >
          {/* Hauteur bornée et défilement interne : onze projets au registre
              donnaient un popover qui débordait de la fenêtre. Le bouton
              « Ouvrir un projet » reste hors de ce conteneur, donc visible
              sans avoir à défiler (T-0224). */}
          <div style={s('max-height: min(50vh, 320px); overflow-y: auto; display: flex; flex-direction: column; gap: 2px;')}>
          {projects.map((project, index) => (
            <ProjectRow
              key={project.path}
              project={project}
              active={project.path === current}
              snapshot={project.path === current ? snapshot : null}
              etat={agregerEtat(sessions.filter(session => session.projet === project.path))}
              raccourci={index < 9 ? index + 1 : undefined}
              onPick={path => {
                onPick(path)
                setOpen(false)
              }}
              onRemove={() => {
                projectAction('remove', project.path)
                  .then(result => onProjects(result.projects))
                  .catch(err => onError(String(err.message ?? err)))
              }}
            />
          ))}
          </div>
          {picker && (
            <button
              type="button"
              title={t('sidebar.open_project')}
              onClick={() => {
                setOpen(false)
                openProject(onProjects, onError)
              }}
              style={s(
                'margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--color-border-chrome); display: flex; align-items: center; gap: 8px; height: 28px; padding-left: 8px; border-radius: 6px; border: 0; background: transparent; color: var(--color-text-quaternary); font-size: 12.5px; cursor: pointer; text-align: left;',
              )}
            >
              +&nbsp;&nbsp;{t('sidebar.open_project')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Une ligne du rail des vues — icône Phosphor (plein à l'état actif, sinon
 * contour) plus libellé, ou icône seule en rail replié (`compact`).
 *
 * Un vrai `<a href>`, jamais un bouton : `crawl/index.js` découvre les
 * routes via `page.$$eval('a[href]')` (même contrainte que l'ancienne barre
 * d'onglets, voir `App.tsx` plus haut).
 *
 * L'état actif est une surface élevée, jamais un filet de couleur — maquette
 * 2a : « au repos, survol, actif — picto plein ». Pas de ligne d'accent
 * comme sur `ProjectRow`, volontairement : ce composant est celui que la
 * maquette encadre nommément sur ce point.
 */
function RailLink({
  id,
  label,
  path,
  active,
  compact,
  shortcut,
  count,
  onTabPick,
}: {
  id: TabId
  label: string
  path: string
  active: boolean
  compact?: boolean
  /** Numéro de raccourci ⌘N, affiché à droite de la ligne (maquette 2b). */
  shortcut?: number
  /** Pastille de compte à droite, quand la vue en a un (ex. Tableau). */
  count?: number
  onTabPick: (id: TabId, path: string) => void
}) {
  const [hover, setHover] = useState(false)
  const Icon = TAB_ICONS[id]

  return (
    <a
      href={path}
      title={compact ? label : undefined}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={event => {
        // Laisser passer cmd-clic, ctrl-clic et clic molette : ouvrir une vue
        // dans une nouvelle fenêtre reste possible.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onTabPick(id, path)
      }}
      style={s(
        (compact
          ? 'width: 34px; height: 32px; justify-content: center; border-radius: 8px;'
          : 'height: 31px; padding: 0 8px; gap: 10px; border-radius: 6px;') +
          ' display: flex; align-items: center; text-decoration: none; font-size: 12.5px; ' +
          (active
            ? 'background: var(--color-surface-active); font-weight: 500; color: var(--color-text);'
            : hover
              ? 'background: var(--color-surface-hover); color: var(--color-text-secondary);'
              : 'color: var(--color-text-secondary);'),
      )}
    >
      <Icon
        size={compact ? 17 : 16}
        weight={active ? 'fill' : 'regular'}
        aria-hidden="true"
        color={active ? 'var(--color-accent)' : 'var(--color-text-quaternary)'}
      />
      {!compact && (
        <>
          <span style={s('flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{label}</span>
          {typeof shortcut === 'number' && shortcut > 0 && shortcut <= 9 && (
            <span style={s('font-family: var(--font-mono); font-size: 10px; color: var(--color-text-faint); flex: none;')}>
              {shortcut}
            </span>
          )}
          {typeof count === 'number' && count > 0 && (
            <span
              style={s(
                'display: inline-flex; align-items: center; justify-content: center; height: 17px; min-width: 17px; padding: 0 5px; border-radius: 4px; background: var(--color-surface-segment); font-family: var(--font-mono); font-size: 10px; color: var(--color-text-tertiary); flex: none;',
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </a>
  )
}

function ProjectRow({
  project,
  active,
  snapshot,
  etat,
  raccourci,
  onPick,
  onRemove,
}: {
  project: Project
  active: boolean
  /** Instantané déjà chargé par l'application, pour le projet affiché. */
  snapshot: Snapshot | null
  /**
   * L'état de la session Claude de ce projet, ou `null` s'il n'en a aucune
   * d'ouverte dans cette instance. Les deux se distinguent à l'écran : un
   * projet sans session n'est pas un projet au repos (T-0217).
   */
  etat: EtatSession | null
  /** Numéro du raccourci ⇧⌘N, pour les neuf premiers projets. */
  raccourci?: number
  onPick: (path: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const [equipped, setEquipped] = useState(true)
  const [hover, setHover] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Chaque projet lit son propre compte de tickets restants : c'est ce que la
  // barre latérale annonce, et l'annoncer faux serait pire que de ne rien dire.
  //
  // Sauf le projet affiché : celui-là a déjà son instantané dans
  // l'application, et c'est lui qui bouge quand on déplace une carte. Le lire
  // ici une seconde fois figeait la pastille sur l'état du chargement — créer
  // un ticket puis le supprimer laissait « 1 à faire » du début à la fin.
  useEffect(() => {
    if (snapshot) return
    const abandon = new AbortController()
    fetchSnapshot(project.path, abandon.signal)
      .then(snap => {
        setOpen(restant(snap.tickets ?? [], snap.board ?? []))
        setEquipped(!isUnequipped(snap))
        const dates = (snap.plans ?? []).flatMap(p => (p.commits ?? []).map(c => c.date)).sort()
        setLast(dates.at(-1) ?? null)
      })
      .catch(() => setOpen(null))
    return () => abandon.abort()
  }, [project.path, snapshot])

  const vivant = snapshot
    ? {
        open: restant(snapshot.tickets ?? [], snapshot.board ?? []),
        equipped: !isUnequipped(snapshot),
        last:
          (snapshot.plans ?? [])
            .flatMap(p => (p.commits ?? []).map(c => c.date))
            .sort()
            .at(-1) ?? null,
      }
    : { open, equipped, last }

  const badge = !vivant.equipped
    ? t('project.to_initialize')
    : vivant.open === null
      ? '—'
      : vivant.open > 0
        ? t('project.to_do', { n: vivant.open })
        : t('project.up_to_date')

  return (
    <div
      onClick={() => onPick(project.path)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setConfirming(false)
      }}
      // Le bouton de retrait ne se montre qu'au survol : sans ces deux-là, il
      // restait `aria-hidden` et hors du parcours de tabulation tant que la
      // souris n'était pas passée — retirer un projet était donc impossible au
      // clavier seul. `onFocus`/`onBlur` remontent depuis le bouton (ils
      // bouillonnent, contrairement à `focus`), et rendent au clavier ce que la
      // souris avait déjà.
      onFocus={() => setHover(true)}
      onBlur={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setHover(false)
        setConfirming(false)
      }}
      style={s(
        'padding: 6px 8px; margin: 0 10px; border-radius: 6px; cursor: pointer; ' +
          (active ? 'background: var(--color-surface-active);' : ''),
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 9px;')}>
        {etat ? (
          <Etat kind={etat} actif={active} dit={t(DIT_ATTENTION[etat])} />
        ) : (
          <div style={s('width: 7px; flex: none; display: flex; align-items: center; justify-content: center;')}>
            <div
              style={s(
                `width: 7px; height: 7px; border-radius: 2px; background: ${active ? 'var(--color-accent)' : 'var(--color-text-ghost)'};`,
              )}
            />
          </div>
        )}
        <div
          style={s(
            `flex: 1; min-width: 0; font-size: 12.5px; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${active ? 'font-weight: 500; color: var(--color-text);' : 'color: var(--color-text-tertiary);'}`,
          )}
          title={project.path}
        >
          {project.name}
        </div>

        {!confirming && typeof raccourci === 'number' && (
          <span
            aria-hidden="true"
            style={s('font-family: var(--font-mono); font-size: 10px; color: var(--color-text-faint); flex: none;')}
          >
            ⇧⌘{raccourci}
          </span>
        )}

        {!confirming && (
          <div
            title={
              vivant.equipped
                ? 'Tickets qui ne sont pas dans la colonne finale du tableau'
                : "Ce dossier n'a pas encore de ovrsee/"
            }
            style={s(
              'box-sizing: border-box; display: inline-flex; align-items: center; height: 17px; padding: 0 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 10px; line-height: 1; flex: none; ' +
                (vivant.open && vivant.equipped
                  ? 'color: var(--color-plan); border: 1px solid var(--color-plan-border); background: var(--color-plan-bg);'
                  : 'color: var(--color-text-tertiary); background: var(--color-surface-segment);'),
            )}
          >
            {badge}
          </div>
        )}

        {/* Confirmation en deux temps, sur place. Pas de `window.confirm` : un
            dialogue modal bloque la boucle d'événements de la fenêtre.

            Toujours monté, seulement masqué : monter le bouton au survol le
            faisait entrer dans le flux, comprimer le nom et pousser le badge —
            la ligne sautait sous la souris (issue #51). `visibility` réserve sa
            place sans le montrer. */}
        <button
          type="button"
          title={t('a11y.remove_from_list')}
          aria-hidden={!hover && !confirming}
          tabIndex={hover || confirming ? 0 : -1}
          onClick={event => {
            event.stopPropagation()
            if (confirming) onRemove()
            else setConfirming(true)
          }}
          className="btn btn-ghost"
          style={s(
            'font-size: 10px; line-height: 1; padding: 2px 6px; flex: none; ' +
              (hover || confirming ? 'visibility: visible; ' : 'visibility: hidden; ') +
              (confirming ? 'color: var(--color-accent);' : 'color: var(--color-neutral-500);'),
          )}
        >
          {confirming ? 'retirer ?' : '×'}
        </button>
      </div>
      <div
        title={t('a11y.last_plan')}
        style={s('font-size: 10.5px; font-family: var(--font-mono); color: var(--color-text-faint); margin-top: 3px; padding-left: 16px;')}
      >
        {humanAge(vivant.last)}
      </div>
    </div>
  )
}

