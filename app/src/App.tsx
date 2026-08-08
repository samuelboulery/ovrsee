import { useEffect, useState } from 'react'

import {
  backlog,
  density,
  fetchProjects,
  fetchSnapshot,
  frDate,
  humanAge,
  isUnequipped,
  lastScan,
  projectAction,
  type Project,
  type Snapshot,
} from './data'
import { s } from './style'
import { Produit } from './tabs/Produit'
import { Historique } from './tabs/Historique'
import { Backlog } from './tabs/Backlog'
import { Donnees } from './tabs/Donnees'
import { Stack } from './tabs/Stack'
import { Terminal, type Layout } from './Terminal'
import { Divider, useResizable } from './useResizable'

/**
 * Chaque onglet a sa route.
 *
 * Ce n'est pas du confort : un crawler découvre les écrans en suivant les
 * `<a href>`. Tant que les onglets vivaient dans un état React, Cockpit
 * produisait une carte à une seule page de lui-même — exactement la limite
 * relevée sur `associa`. Produit reste sur `/` : pas de redirection, donc pas
 * de page fantôme, et la page d'entrée du graphe garde son sens.
 */
const TABS = [
  ['produit', 'Produit', '/'],
  ['historique', 'Historique', '/historique'],
  ['backlog', 'Backlog', '/backlog'],
  ['donnees', 'Données', '/donnees'],
  ['stack', 'Stack', '/stack'],
] as const

type TabId = (typeof TABS)[number][0]

const tabForPath = (pathname: string): TabId =>
  TABS.find(([, , path]) => path === pathname)?.[0] ?? 'produit'

/**
 * Le projet courant vit dans la requête, pas dans le chemin.
 *
 * `pathOf()` de crawl/routes.js ignore la requête : la carte n'est donc pas
 * multipliée par le nombre de projets. Effet secondaire utile — un
 * rechargement de page retrouve le projet sélectionné.
 */
const projectFromUrl = () => new URLSearchParams(window.location.search).get('p')

function pushUrl(path: string, project: string | null) {
  const query = project ? `?p=${encodeURIComponent(project)}` : ''
  window.history.pushState(null, '', path + query)
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<TabId>(() => tabForPath(window.location.pathname))
  const [layout, setLayout] = useState<Layout>('bottom')
  const [terminal, setTerminal] = useState(true)

  const sidebar = useResizable({
    key: 'sidebar',
    initial: 236,
    min: 180,
    max: 420,
    axis: 'x',
  })

  // Précédent/Suivant du navigateur : l'URL fait foi, l'état la suit.
  useEffect(() => {
    const onPop = () => {
      setTab(tabForPath(window.location.pathname))
      setCurrent(projectFromUrl())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    fetchProjects()
      .then(list => {
        setProjects(list)
        // Le projet demandé par l'URL l'emporte, s'il existe encore.
        const asked = projectFromUrl()
        const known = list.find(p => p.path === asked)?.path
        setCurrent(known ?? list[0]?.path ?? null)
      })
      .catch(err => setError(String(err.message ?? err)))
  }, [])

  useEffect(() => {
    if (!current) return
    setSnapshot(null)
    fetchSnapshot(current)
      .then(setSnapshot)
      .catch(err => setError(String(err.message ?? err)))

    // Le projet remonte en tête de la liste — mais au prochain chargement.
    // Réordonner sous le curseur au moment du clic ferait sauter la ligne
    // qu'on vient de viser.
    projectAction('touch', current).catch(() => {})
  }, [current])

  const reload = () => {
    if (!current) return
    fetchSnapshot(current)
      .then(setSnapshot)
      .catch(err => setError(String(err.message ?? err)))
  }

  /** Ajout, retrait : la liste vient du serveur, déjà triée. */
  const applyProjects = (list: Project[], select?: string | null) => {
    setProjects(list)
    const next = select ?? (list.some(p => p.path === current) ? current : (list[0]?.path ?? null))
    if (next !== current) {
      setCurrent(next)
      pushUrl(window.location.pathname, next)
    }
  }

  const plans = snapshot?.plans ?? []
  const scan = lastScan(snapshot?.scans ?? [])
  const contentVisible = !(layout === 'full' && terminal)
  const unequipped = snapshot ? isUnequipped(snapshot) : false

  return (
    // La maquette dessinait une fausse fenêtre — pastilles, ombre portée,
    // 1320×860 posés sur un fond dégradé — parce qu'elle montrait à quoi
    // l'application ressemblerait une fois empaquetée. La vraie fenêtre
    // existe maintenant : redessiner son chrome à l'intérieur ferait deux
    // barres de titre l'une dans l'autre. L'interface occupe donc toute la
    // fenêtre, et macOS fournit le chrome.
    <div
      style={s(
        'height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: var(--color-bg); font-family: var(--font-body); color: var(--color-text);',
      )}
    >
      {/* Bande de titre : elle remplace le chrome dessiné de la maquette
          (l. 29-41) et sert de zone de déplacement de la vraie fenêtre. Le
          retrait à gauche laisse la place aux pastilles du système. */}
      <div
        style={s(
          'height: 44px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 82px; background: #1b1d2b; border-bottom: 1px solid var(--color-divider); -webkit-app-region: drag;',
        )}
      >
        <div style={s('font-size: 12.5px; color: var(--color-neutral-400); letter-spacing: .02em;')}>
          Cockpit — {projects.find(p => p.path === current)?.name ?? '…'}
        </div>
        <div style={s('flex: 1;')} />
        <ScanBadge scan={scan} />
      </div>

      <div style={s('flex: 1; display: flex; flex-direction: column; min-height: 0;')}>

        <div style={s('flex: 1; display: flex; min-height: 0;')}>
          <Sidebar
            projects={projects}
            current={current}
            width={sidebar.size}
            onPick={path => {
              setCurrent(path)
              pushUrl(window.location.pathname, path)
            }}
            onProjects={applyProjects}
            onError={setError}
            density={density(plans)}
          />
          <Divider axis="x" resizable={sidebar} />

          <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0;')}>
            {/* Onglets — maquette l. 75-79 */}
            <div
              style={s(
                'height: 44px; flex: none; display: flex; align-items: stretch; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--color-divider); background: #171927;',
              )}
            >
              {TABS.map(([id, label, path]) => (
                // Un vrai lien, pas un bouton : c'est ce que lit
                // `page.$$eval('a[href]')` dans crawl/index.js. Le href doit
                // exister pour que l'onglet soit découvrable.
                <a
                  key={id}
                  href={path}
                  onClick={event => {
                    // Laisser passer cmd-clic, ctrl-clic et clic molette :
                    // ouvrir un onglet dans une nouvelle fenêtre reste possible.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                    event.preventDefault()
                    setTab(id)
                    setLayout(l => (l === 'full' ? 'bottom' : l))
                    pushUrl(path, current)
                  }}
                  style={s(
                    // `display: flex; align-items: center; text-decoration: none`
                    // rattrape la mise en forme par défaut d'un lien ; le reste
                    // est copié de la maquette l. 75-79.
                    'display: flex; align-items: center; text-decoration: none; background: transparent; border: 0; cursor: pointer; font-family: var(--font-body); font-size: 13px; padding: 0 14px; letter-spacing: .01em; ' +
                      (tab === id
                        ? 'color: var(--color-text); box-shadow: inset 0 -2px 0 var(--color-accent);'
                        : 'color: var(--color-neutral-500);'),
                  )}
                >
                  {label}
                </a>
              ))}
            </div>

            <div
              style={s(
                layout === 'side'
                  ? 'flex: 1; display: flex; min-height: 0; min-width: 0;'
                  : 'flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0;',
              )}
            >
              {contentVisible && (
                <div style={s('flex: 1; overflow: hidden; display: flex; min-height: 0; min-width: 0;')}>
                  {error && <Message text={`Lecture impossible : ${error}`} />}
                  {!error && !snapshot && <Message text="Lecture de cockpit/…" />}
                  {!error && snapshot && unequipped && (
                    <Unequipped root={snapshot.root} onDone={reload} onError={setError} />
                  )}
                  {!error && snapshot && !unequipped && (
                    <>
                      {tab === 'produit' && <Produit snapshot={snapshot} layout={layout} />}
                      {tab === 'historique' && (
                        <Historique plans={plans} timeline={snapshot.timeline ?? []} />
                      )}
                      {tab === 'backlog' && <Backlog plans={backlog(plans)} />}
                      {tab === 'donnees' && <Donnees graph={snapshot.graph} />}
                      {tab === 'stack' && <Stack snapshot={snapshot} />}
                    </>
                  )}
                </div>
              )}

              {terminal && (
                <Terminal
                  layout={layout}
                  onLayout={setLayout}
                  onToggle={() => setTerminal(false)}
                  onReload={reload}
                  snapshot={snapshot}
                />
              )}
            </div>

            {!terminal && (
              <div
                style={s(
                  'height: 32px; flex: none; border-top: 1px solid var(--color-divider); background: #101120; display: flex; align-items: center; gap: 10px; padding: 0 14px;',
                )}
              >
                <button
                  type="button"
                  onClick={() => setTerminal(true)}
                  className="btn btn-ghost"
                  style={s('font-size: 11px; padding: 3px 9px;')}
                >
                  Terminal · claude
                </button>
                <span style={s('font-size: 10.5px; color: var(--color-neutral-600);')}>
                  réduit — la session tourne toujours
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Date du dernier scan. Un scan échoué se dit — sans quoi la capture
 * précédente passerait pour fraîche.
 */
function ScanBadge({ scan }: { scan: ReturnType<typeof lastScan> }) {
  if (!scan) {
    return (
      <div style={s('font-size: 11.5px; color: var(--color-neutral-600);')}>
        aucun scan enregistré
      </div>
    )
  }
  return (
    <div
      style={s(
        'display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--color-neutral-500);',
      )}
    >
      <span
        style={s(
          scan.ok
            ? 'width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 8px var(--color-accent); display: block;'
            : 'width: 6px; height: 6px; border-radius: 50%; border: 1px solid var(--color-neutral-600); display: block;',
        )}
      />
      {scan.ok ? 'dernier scan' : 'scan échoué'} · {frDate(scan.date)} · commit {scan.commit}
    </div>
  )
}

function Message({ text }: { text: string }) {
  return (
    <div
      style={s(
        'flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--color-neutral-500);',
      )}
    >
      {text}
    </div>
  )
}

/**
 * Un projet qui n'a pas encore de `cockpit/`.
 *
 * Il apparaît quand même dans la liste : refuser un dossier parce qu'il n'est
 * pas encore équipé obligerait à équiper avant d'ouvrir, c'est-à-dire à savoir
 * d'avance ce que cette page est là pour montrer.
 */
function Unequipped({
  root,
  onDone,
  onError,
}: {
  root: string
  onDone: () => void
  onError: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[] | null>(null)

  return (
    <div
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center;',
      )}
    >
      <div style={s('font-size: 13px; color: var(--color-neutral-400);')}>
        Ce dossier n'a pas de <code>cockpit/</code> — aucun plan, aucun scan à lire.
      </div>
      <div style={s('font-size: 11.5px; color: var(--color-neutral-600); max-width: 52ch;')}>
        L'initialiser crée <code>cockpit/plans/</code> et pose le hook <code>post-commit</code> qui
        rattache les commits au plan actif.
      </div>

      {done ? (
        <div style={s('font-size: 11px; color: var(--color-neutral-500); text-align: left;')}>
          {done.map(line => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            projectAction('init', root)
              .then(result => {
                setDone(result.done ?? [])
                onDone()
              })
              .catch(err => onError(String(err.message ?? err)))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? 'Initialisation…' : 'Initialiser cockpit ici'}
        </button>
      )}
    </div>
  )
}

/** Barre latérale — maquette l. 45-71. */
function Sidebar({
  projects,
  current,
  width,
  onPick,
  onProjects,
  onError,
  density: bars,
}: {
  projects: Project[]
  current: string | null
  width: number
  onPick: (path: string) => void
  onProjects: (list: Project[], select?: string | null) => void
  onError: (message: string) => void
  density: number[]
}) {
  const max = Math.max(1, ...bars)

  // Le sélecteur de dossier n'existe que dans l'application empaquetée. Dans un
  // navigateur, le bouton est absent plutôt que présent et inerte — même
  // franchise que pour le terminal.
  const picker = window.cockpit?.projects

  return (
    <div
      style={s(
        `width: ${width}px; flex: none; display: flex; flex-direction: column; background: #13141f; border-right: 1px solid var(--color-divider); padding: 14px 0;`,
      )}
    >
      <div
        style={s(
          'padding: 0 14px 10px; display: flex; align-items: center; gap: 8px; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);',
        )}
      >
        Projets
        <div style={s('flex: 1;')} />
        {picker && (
          <button
            type="button"
            title="Ouvrir un projet"
            className="btn btn-ghost"
            onClick={async () => {
              try {
                const path = await picker.pick()
                if (!path) return // sélecteur annulé : rien à dire
                const { projects: list } = await projectAction('add', path)
                onProjects(list, path)
              } catch (err) {
                onError(String((err as Error).message ?? err))
              }
            }}
            style={s('font-size: 14px; line-height: 1; padding: 2px 7px;')}
          >
            +
          </button>
        )}
      </div>
      <div style={s('display: flex; flex-direction: column;')}>
        {projects.map(project => (
          <ProjectRow
            key={project.path}
            project={project}
            active={project.path === current}
            onPick={onPick}
            onRemove={() => {
              projectAction('remove', project.path)
                .then(result => onProjects(result.projects))
                .catch(err => onError(String(err.message ?? err)))
            }}
          />
        ))}
      </div>

      <div style={s('flex: 1;')} />

      <div
        style={s(
          'padding: 12px 14px 0; border-top: 1px solid var(--color-divider); margin-top: 12px;',
        )}
      >
        <div
          style={s(
            'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 8px;',
          )}
        >
          Densité d'activité
        </div>
        <div style={s('display: flex; gap: 3px; align-items: flex-end; height: 34px;')}>
          {bars.map((value, i) => {
            const height = value === 0 ? 3 : Math.max(4, Math.round((value / max) * 34))
            const color =
              value === 0
                ? 'var(--color-neutral-800)'
                : value / max > 0.6
                  ? 'var(--color-accent-500)'
                  : 'var(--color-accent-700)'
            return (
              <div
                key={i}
                title={`${value} commit(s)`}
                style={s(`flex: 1; height: ${height}px; border-radius: 1px; background: ${color};`)}
              />
            )
          })}
        </div>
        <div
          style={s(
            'display: flex; justify-content: space-between; font-size: 10px; color: var(--color-neutral-600); margin-top: 6px;',
          )}
        >
          <span>16 semaines</span>
          <span>aujourd'hui</span>
        </div>
      </div>
    </div>
  )
}

function ProjectRow({
  project,
  active,
  onPick,
  onRemove,
}: {
  project: Project
  active: boolean
  onPick: (path: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const [equipped, setEquipped] = useState(true)
  const [hover, setHover] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Chaque projet lit son propre compte de plans ouverts : c'est ce que la
  // barre latérale annonce, et l'annoncer faux serait pire que de ne rien dire.
  useEffect(() => {
    fetchSnapshot(project.path)
      .then(snap => {
        setOpen(backlog(snap.plans).length)
        setEquipped(!isUnequipped(snap))
        const dates = snap.plans.flatMap(p => p.commits.map(c => c.date)).sort()
        setLast(dates.at(-1) ?? null)
      })
      .catch(() => setOpen(null))
  }, [project.path])

  const badge = !equipped
    ? 'à initialiser'
    : open === null
      ? '—'
      : open > 0
        ? `${open} ouvert${open > 1 ? 's' : ''}`
        : 'à jour'

  return (
    <div
      onClick={() => onPick(project.path)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setConfirming(false)
      }}
      style={s(
        'padding: 9px 14px; cursor: pointer; ' +
          (active
            ? 'background: var(--color-accent-900); box-shadow: inset 2px 0 0 var(--color-accent); color: var(--color-text);'
            : 'color: var(--color-neutral-300);'),
      )}
    >
      <div style={s('display: flex; align-items: baseline; gap: 8px;')}>
        <div style={s('font-size: 13px; font-weight: 500;')} title={project.path}>
          {project.name}
        </div>
        <div style={s('flex: 1;')} />

        {!confirming && (
          <div
            title={
              equipped
                ? 'Plans approuvés qui ne sont pas encore clos'
                : "Ce dossier n'a pas encore de cockpit/"
            }
            style={s(
              'font-size: 10px; padding: 1px 6px; border-radius: 999px; ' +
                (open && equipped
                  ? 'color: var(--color-accent-200); border: 1px solid var(--color-accent-700);'
                  : 'color: var(--color-neutral-600); border: 1px solid var(--color-neutral-800);'),
            )}
          >
            {badge}
          </div>
        )}

        {/* Confirmation en deux temps, sur place. Pas de `window.confirm` : un
            dialogue modal bloque la boucle d'événements de la fenêtre. */}
        {(hover || confirming) && (
          <button
            type="button"
            title="Retirer de la liste — aucun fichier n'est supprimé"
            onClick={event => {
              event.stopPropagation()
              if (confirming) onRemove()
              else setConfirming(true)
            }}
            className="btn btn-ghost"
            style={s(
              'font-size: 10px; line-height: 1; padding: 2px 6px; ' +
                (confirming ? 'color: var(--color-accent-200);' : 'color: var(--color-neutral-500);'),
            )}
          >
            {confirming ? 'retirer ?' : '×'}
          </button>
        )}
      </div>
      <div
        title="Dernier commit rattaché à un plan"
        style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 3px;')}
      >
        {humanAge(last)}
      </div>
    </div>
  )
}
