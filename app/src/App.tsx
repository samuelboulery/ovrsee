import { useEffect, useState } from 'react'

import {
  density,
  estAbandon,
  fetchProjects,
  fetchSnapshot,
  frDate,
  humanAge,
  isUnequipped,
  lastScan,
  projectAction,
  restant,
  type Project,
  type Snapshot,
  type Tableau as TableauData,
} from './data'
import { Garde } from './Garde'
import { SkillsList, SkillsModal, useSkills } from './SkillsPanel'
import { s } from './style'
import { Apercu } from './tabs/Apercu'
import { Navigateur } from './tabs/Navigateur'
import { Produit } from './tabs/Produit'
import { Historique } from './tabs/Historique'
import { Tableau } from './tabs/Tableau'
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
 * relevée sur `associa`.
 *
 * Aperçu tient `/`, sans redirection : ouvrir un projet doit d'abord dire de
 * quoi il s'agit, et la page d'entrée du graphe est alors celle par où on entre
 * vraiment. Produit descend sur `/produit` — une vraie route de plus, pas une
 * page fantôme : la carte gagne un nœud, elle n'en perd aucun. Les captures
 * déjà prises de l'ancien `/` ont suivi dans `shots/produit/`, sans quoi vingt
 * images du graphe passeraient pour l'historique visuel d'Aperçu.
 */
const TABS = [
  ['apercu', 'Aperçu', '/'],
  ['navigateur', 'Navigateur', '/navigateur'],
  ['produit', 'Produit', '/produit'],
  ['historique', 'Historique', '/historique'],
  ['tableau', 'Tableau', '/tableau'],
  ['donnees', 'Données', '/donnees'],
  ['stack', 'Stack', '/stack'],
] as const

type TabId = (typeof TABS)[number][0]

const tabForPath = (pathname: string): TabId =>
  TABS.find(([, , path]) => path === pathname)?.[0] ?? 'apercu'

/** Le nom de l'onglet tel que l'utilisateur le lit — pour les messages. */
const labelOf = (id: TabId): string => TABS.find(([tab]) => tab === id)?.[1] ?? id

/**
 * Un élément défilant déborde-t-il ?
 *
 * Rendre la barre d'onglets défilante ne suffisait pas : sur macOS, la barre de
 * défilement ne s'affiche que pendant le geste, donc rien ne signalait qu'un
 * onglet était hors champ — c'est exactement le défaut qu'on corrige. Il faut
 * mesurer pour pouvoir le dire.
 */
function useDeborde() {
  const [deborde, setDeborde] = useState(false)
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) return
    const mesurer = () => setDeborde(element.scrollWidth > element.clientWidth + 1)
    mesurer()
    const observer = new ResizeObserver(mesurer)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { deborde, ref: setElement }
}

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
async function openProject(
  onProjects: (list: Project[], select?: string | null) => void,
  onError: (message: string) => void,
) {
  const picker = window.cockpit?.projects
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

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<TabId>(() => tabForPath(window.location.pathname))
  const [layout, setLayout] = useState<Layout>('bottom')
  const [terminal, setTerminal] = useState(true)

  const onglets = useDeborde()

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

  // Deux clics rapprochés lancent deux lectures. Sans abandon, la plus lente
  // écrase la plus récente et l'écran affiche les plans du projet précédent
  // sous le nom du suivant.
  useEffect(() => {
    if (!current) return
    const abandon = new AbortController()
    setSnapshot(null)
    setError(null)
    fetchSnapshot(current, abandon.signal)
      .then(setSnapshot)
      .catch(err => {
        if (estAbandon(err)) return
        setError(String(err.message ?? err))
      })

    // Le projet remonte en tête de la liste — mais au prochain chargement.
    // Réordonner sous le curseur au moment du clic ferait sauter la ligne
    // qu'on vient de viser.
    projectAction('touch', current).catch(() => {})

    return () => abandon.abort()
  }, [current])

  /**
   * Le tableau vit dans le snapshot, pas dans l'onglet.
   *
   * Chaque onglet est démonté quand on le quitte. Tant que les tickets vivaient
   * dans l'état de l'onglet Tableau, un déplacement était écrit sur le disque
   * mais perdu de l'affichage au premier changement d'onglet : au retour, la
   * carte était revenue dans sa colonne d'origine, celle du snapshot chargé à
   * l'ouverture du projet.
   */
  const setTableau = (tableau: TableauData) =>
    setSnapshot(avant => (avant ? { ...avant, ...tableau } : avant))

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

  /**
   * Le menu natif — voir `electron/menu.js`.
   *
   * Il n'envoie que des mots, et c'est ici qu'ils deviennent des gestes : les
   * mêmes que ceux des clics juste au-dessus. Absent dans un navigateur, où
   * `window.cockpit` n'existe pas.
   */
  useEffect(() => {
    const menu = window.cockpit?.menu
    if (!menu) return

    return menu.on(command => {
      if (command === 'project:open') return void openProject(applyProjects, setError)
      if (command === 'project:reload') return reload()
      if (command === 'project:reveal') {
        if (current) window.cockpit?.projects.reveal(current)
        return
      }
      if (command === 'terminal:toggle') return setTerminal(ouvert => !ouvert)

      const disposition = command.startsWith('terminal:layout:') && command.slice(16)
      if (disposition) {
        // Changer la disposition d'un terminal masqué ne montrerait rien.
        setTerminal(true)
        return setLayout(disposition as Layout)
      }

      const onglet = TABS.find(([id]) => command === `tab:${id}`)
      if (onglet) {
        setTab(onglet[0])
        // Même correction qu'au clic : plein écran est une vue du terminal, on
        // n'y reste pas en changeant d'onglet.
        setLayout(l => (l === 'full' ? 'bottom' : l))
        pushUrl(onglet[2], current)
      }
    })
  }, [current])

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
      <header
        style={s(
          'height: 44px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 82px; background: #1b1d2b; border-bottom: 1px solid var(--color-divider); -webkit-app-region: drag;',
        )}
      >
        {/* Le seul `h1` de l'écran : la fenêtre porte le nom du projet, et les
            titres des onglets sont des `h2` sous celui-là. */}
        <h1
          style={s(
            'margin: 0; font-size: 12.5px; font-weight: 400; color: var(--color-neutral-400); letter-spacing: .02em;',
          )}
        >
          Cockpit — {projects.find(p => p.path === current)?.name ?? '…'}
        </h1>
        <div style={s('flex: 1;')} />
        <ScanBadge scan={scan} />
      </header>

      <div style={s('flex: 1; display: flex; flex-direction: column; min-height: 0;')}>

        <div style={s('flex: 1; display: flex; min-height: 0;')}>
          <Sidebar
            projects={projects}
            current={current}
            snapshot={snapshot}
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
            {/* Onglets — maquette l. 75-79.
                `overflow-x: auto` et `flex: none` sur chaque lien : sous 800 px
                de large, la barre débordait sans barre de défilement et
                l'onglet Stack sortait de la fenêtre sans que rien ne le dise. */}
            <nav
              ref={onglets.ref}
              aria-label="Onglets du projet"
              style={s(
                'height: 44px; flex: none; display: flex; align-items: stretch; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--color-divider); background: #171927; overflow-x: auto; overflow-y: hidden; scrollbar-width: none;' +
                  // Le dégradé n'apparaît que quand il y a réellement quelque
                  // chose de coupé : posé en permanence, il estomperait le
                  // dernier onglet d'une barre qui tient tout entière.
                  (onglets.deborde
                    ? ' mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);'
                    : ''),
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
                    'display: flex; align-items: center; flex: none; white-space: nowrap; text-decoration: none; background: transparent; border: 0; cursor: pointer; font-family: var(--font-body); font-size: 13px; padding: 0 14px; letter-spacing: .01em; ' +
                      (tab === id
                        ? 'color: var(--color-text); box-shadow: inset 0 -2px 0 var(--color-accent);'
                        : 'color: var(--color-neutral-500);'),
                  )}
                >
                  {label}
                </a>
              ))}
            </nav>

            <div
              style={s(
                layout === 'side'
                  ? 'flex: 1; display: flex; min-height: 0; min-width: 0;'
                  : 'flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0;',
              )}
            >
              {contentVisible && (
                <main
                  aria-live="polite"
                  style={s('flex: 1; overflow: hidden; display: flex; min-height: 0; min-width: 0;')}
                >
                  {error && <Message text={`Lecture impossible : ${error}`} />}
                  {!error && !snapshot && <Message text="Lecture de cockpit/…" />}
                  {!error && snapshot && unequipped && (
                    <Unequipped root={snapshot.root} onDone={reload} onError={setError} />
                  )}
                  {!error && snapshot && !unequipped && (
                    // Le garde-fou est remonté à chaque changement d'onglet et
                    // de projet : une panne sur l'un ne doit pas condamner les
                    // autres, et revenir dessus doit réessayer.
                    <Garde key={`${tab}:${snapshot.root}`} quoi={`l'onglet ${labelOf(tab)}`}>
                      {tab === 'apercu' && <Apercu snapshot={snapshot} />}

                      {/* Le seul onglet qui reste monté quand on le quitte :
                          le démonter rechargerait l'application inspectée, et
                          on perdrait son état à chaque va-et-vient. */}
                      <div
                        style={s(
                          tab === 'navigateur'
                            ? 'flex: 1; display: flex; min-width: 0; min-height: 0;'
                            : 'display: none;',
                        )}
                      >
                        <Navigateur snapshot={snapshot} visible={tab === 'navigateur'} />
                      </div>

                      {tab === 'produit' && <Produit snapshot={snapshot} layout={layout} />}
                      {tab === 'historique' && (
                        <Historique
                          plans={plans}
                          timeline={snapshot.timeline ?? []}
                          illisibles={snapshot.illisibles ?? []}
                        />
                      )}
                      {tab === 'tableau' && (
                        <Tableau
                          root={snapshot.root}
                          board={snapshot.board ?? []}
                          tickets={snapshot.tickets ?? []}
                          illisibles={snapshot.illisibles ?? []}
                          onChange={setTableau}
                        />
                      )}
                      {tab === 'donnees' && <Donnees graph={snapshot.graph} />}
                      {tab === 'stack' && <Stack snapshot={snapshot} />}
                    </Garde>
                  )}
                </main>
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
  const { skills, choisis, setChoisis } = useSkills()

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

      {/* Les skills se choisissent avant d'initialiser, pas après : c'est le
          seul moment où l'on sait qu'un projet vient d'arriver, et un cockpit
          que Claude Code ne sait pas remplir reste un dossier vide. */}
      {!done && skills.length > 0 && (
        <div style={s('width: min(520px, 100%); margin-top: 4px;')}>
          <div
            style={s(
              'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 8px; text-align: left;',
            )}
          >
            Skills Claude Code
          </div>
          <SkillsList skills={skills} choisis={choisis} onChoisis={setChoisis} />
        </div>
      )}

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
            projectAction('init', root, { skills: choisis })
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
  snapshot,
  width,
  onPick,
  onProjects,
  onError,
  density: bars,
}: {
  projects: Project[]
  current: string | null
  /** L'instantané du projet affiché, pour que sa pastille suive le tableau. */
  snapshot: Snapshot | null
  width: number
  onPick: (path: string) => void
  onProjects: (list: Project[], select?: string | null) => void
  onError: (message: string) => void
  density: number[]
}) {
  const max = Math.max(1, ...bars)
  const [skillsOuverts, setSkillsOuverts] = useState(false)

  // Le sélecteur de dossier n'existe que dans l'application empaquetée. Dans un
  // navigateur, le bouton est absent plutôt que présent et inerte — même
  // franchise que pour le terminal.
  const picker = window.cockpit?.projects

  return (
    <aside
      aria-label="Projets"
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
            title="Ouvrir un projet (⌘O)"
            className="btn btn-ghost"
            onClick={() => openProject(onProjects, onError)}
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
            snapshot={project.path === current ? snapshot : null}
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

      {/* Les skills ne dépendent d'aucun projet — ils vivent dans `~/.claude/`.
          Le rappel est ici parce qu'une mise à jour du cockpit peut les rendre
          périmés longtemps après l'initialisation, quand l'écran qui les
          proposait n'apparaît plus. */}
      <div style={s('padding: 0 14px 12px;')}>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => setSkillsOuverts(true)}
          style={s('font-size: 11px;')}
        >
          Skills Claude Code
        </button>
      </div>
      {skillsOuverts && <SkillsModal onClose={() => setSkillsOuverts(false)} />}

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
    </aside>
  )
}

function ProjectRow({
  project,
  active,
  snapshot,
  onPick,
  onRemove,
}: {
  project: Project
  active: boolean
  /** Instantané déjà chargé par l'application, pour le projet affiché. */
  snapshot: Snapshot | null
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
    ? 'à initialiser'
    : vivant.open === null
      ? '—'
      : vivant.open > 0
        ? `${vivant.open} à faire`
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
              vivant.equipped
                ? 'Tickets qui ne sont pas dans la colonne finale du tableau'
                : "Ce dossier n'a pas encore de cockpit/"
            }
            style={s(
              'font-size: 10px; padding: 1px 6px; border-radius: 999px; ' +
                (vivant.open && vivant.equipped
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
        {humanAge(vivant.last)}
      </div>
    </div>
  )
}
