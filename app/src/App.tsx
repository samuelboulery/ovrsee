import { useEffect, useRef, useState } from 'react'
import {
  CaretDown,
  DotsSixVertical,
  GearSix,
  MagnifyingGlass,
  SidebarSimple,
} from '@phosphor-icons/react'

import { applyTheme } from './theme'
import { t, setCurrentLanguage } from './i18n'
import {
  estAbandon,
  fetchProjects,
  fetchSettings,
  fetchSnapshot,
  fetchTableau,
  fetchUsername,
  frDate,
  humanAge,
  isUnequipped,
  lastScan,
  projectAction,
  restant,
  updateSettings,
  projectDisplayName,
  type IntegrationProvider,
  type Project,
  type SettingsType,
  type Snapshot,
  type Tableau as TableauData,
} from './data'
import { CommandPalette } from './CommandPalette'
import { Garde } from './Garde'
import { Onboarding } from './Onboarding'
import { Logo } from './OnboardingArt'
import { PreferencesModal, type SectionId } from './PreferencesPanel'
import { Welcome } from './Welcome'
import { EquipmentPanel } from './EquipmentPanel'
import { s } from './style'
import { StatusBarSlotContext } from './StatusBar'
import { Apercu } from './tabs/Apercu'
import { Navigateur } from './tabs/Navigateur'
import { Produit } from './tabs/Produit'
import { Historique } from './tabs/Historique'
import { Tableau } from './tabs/Tableau'
import { Donnees } from './tabs/Donnees'
import { Stack } from './tabs/Stack'
import { Terminal, type Layout, type TerminalActions } from './Terminal'
import { Divider, useResizable } from './useResizable'
import { TABS, TAB_ICONS, activeTabsInOrder, type TabId } from './views'

const tabForPath = (pathname: string): TabId =>
  TABS.find(([, , path]) => path === pathname)?.[0] ?? 'apercu'

/**
 * Le nom de l'onglet tel que l'utilisateur le lit — pour les messages.
 *
 * Lu dans `TABS`, qui porte déjà la clé : une seconde table identifiant → clé
 * finissait par diverger de celle-ci.
 */
export const labelOf = (id: TabId): string =>
  t(TABS.find(([tab]) => tab === id)?.[1] ?? 'tabs.apercu')

/**
 * Le projet courant vit dans la requête, pas dans le chemin.
 *
 * `pathOf()` de crawl/routes.js ignore la requête : la carte n'est donc pas
 * multipliée par le nombre de projets. Effet secondaire utile — un
 * rechargement de page retrouve le projet sélectionné.
 */
const projectFromUrl = () => new URLSearchParams(window.location.search).get('p')

/** Ticket à ouvrir au montage de l'onglet Tableau — voir `onOuvrirTicket`. */
const ticketFromUrl = () => new URLSearchParams(window.location.search).get('ticket')

/** Route à charger au montage de l'onglet Navigateur — voir `onOuvrirDansNavigateur`. */
const routeFromUrl = () => new URLSearchParams(window.location.search).get('route')

function pushUrl(
  path: string,
  project: string | null,
  ticket: string | null = null,
  route: string | null = null,
) {
  const params = new URLSearchParams()
  if (project) params.set('p', project)
  if (ticket) params.set('ticket', ticket)
  if (route) params.set('route', route)
  const query = params.toString()
  window.history.pushState(null, '', path + (query ? `?${query}` : ''))
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

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [error, setError] = useState<string | null>(null)

  // L'écran des préférences s'ouvre d'ici et pas de la barre latérale : le
  // menu natif l'ouvre aussi, et son gestionnaire vit dans ce composant.
  const [preferencesOuvertes, setPreferencesOuvertes] = useState(false)

  /** Palette de commandes ⌘K (T-0048) — voir `CommandPalette.tsx`. */
  const [paletteOuverte, setPaletteOuverte] = useState(false)

  // La carte Déploiements de l'Aperçu ouvre directement sur la section Projet,
  // provider présélectionné — sans ça, le CTA amènerait sur « Profils » et
  // laisserait chercher.
  const [preferencesInitial, setPreferencesInitial] = useState<{
    section: SectionId
    provider?: IntegrationProvider
  } | null>(null)

  // Rejouer la présentation à la demande : sans cela elle serait perdue pour
  // qui a déjà des projets, c'est-à-dire pour tout le monde après le premier
  // jour. Elle ne se réaffiche jamais d'elle-même.
  const [revoirPresentation, setRevoirPresentation] = useState(false)

  const [tab, setTab] = useState<TabId>(() => tabForPath(window.location.pathname))
  // Ticket ouvert au clic depuis la frise Historique — voir `onOuvrirTicket`.
  const [focusTicket, setFocusTicket] = useState<string | null>(() => ticketFromUrl())
  // Contexte d'un élément du Navigateur, à joindre au prochain ticket créé
  // dans Tableau — voir `onCreerTicketDepuisElement`.
  const [contexteElement, setContexteElement] = useState<{ corps: string; tags: string[] } | null>(null)

  // Consommés une fois : `Tableau` lit `focusTicket`/`contexteElement` à son
  // montage (`useState` initial), donc les effacer ici après coup ne change
  // rien à ce montage-là — seulement à une prochaine visite de l'onglet, qui
  // ne doit pas rouvrir le même ticket ni rejoindre le même contexte.
  useEffect(() => {
    if (tab !== 'tableau') return
    if (focusTicket) setFocusTicket(null)
    if (contexteElement) setContexteElement(null)
  }, [tab])

  // Route à charger dans Navigateur depuis « Ouvrir dans le Navigateur »
  // (Produit) — contrairement à `focusTicket`, `Navigateur` reste monté en
  // permanence (`visible` bascule juste l'affichage) : un effet dans
  // `Navigateur` réagit donc à chaque changement, pas seulement au montage.
  const [focusRoute, setFocusRoute] = useState<string | null>(() => routeFromUrl())
  const [layout, setLayout] = useState<Layout>('bottom')
  const [terminal, setTerminal] = useState(true)
  // Ce que le panneau terminal sait faire, quand il est monté. Vide sinon —
  // c'est ce qui laisse ⌘W retomber sur la fermeture de fenêtre.
  const terminalActions = useRef<TerminalActions | null>(null)
  // Pied de page réel de `StatusBar` (T-0111) : sous le terminal, pas coincée
  // entre le contenu de l'onglet et lui — voir StatusBarSlotContext.
  const [statusBarSlot, setStatusBarSlot] = useState<HTMLDivElement | null>(null)
  const [terminalHeight, setTerminalHeight] = useState(244)
  const [terminalWidth, setTerminalWidth] = useState(468)

  const sidebar = useResizable({
    key: 'sidebar',
    initial: 236,
    min: 180,
    max: 420,
    axis: 'x',
  })

  // Rétractation de la barre latérale. Retenue d'une session à l'autre, comme
  // sa largeur — sur un petit écran, la rouvrir à chaque lancement est une
  // corvée. `localStorage` peut lever (mode privé) : la valeur par défaut est
  // « ouverte ».
  const [sidebarOuverte, setSidebarOuverte] = useState(() => {
    try {
      return localStorage.getItem('ovrsee.sidebar') !== 'ferme'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ovrsee.sidebar', sidebarOuverte ? 'ouvert' : 'ferme')
    } catch {
      /* Rien à faire : la préférence ne survivra pas à la session. */
    }
  }, [sidebarOuverte])

  // Précédent/Suivant du navigateur : l'URL fait foi, l'état la suit.
  useEffect(() => {
    const onPop = () => {
      setTab(tabForPath(window.location.pathname))
      setCurrent(projectFromUrl())
      setFocusTicket(ticketFromUrl())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Redirection si l'onglet courant devient inactif.
  // L'onglet Aperçu est toujours actif, donc on y redirige en dernier recours.
  useEffect(() => {
    const activeTabs = activeTabsInOrder(settings)
    if (activeTabs.length > 0 && !activeTabs.some(([id]) => id === tab)) {
      const target = activeTabs[0]
      setTab(target[0] as TabId)
      pushUrl(target[2], current)
    }
  }, [settings, tab, current])

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
    fetchSettings()
      .then(s => {
        setCurrentLanguage(s.langue)
        setSettings(s)
        setTerminalHeight(s.terminal.hauteur)
        setTerminalWidth(s.terminal.largeur)
        setLayout(s.terminal.disposition as Layout)
        setTerminal(s.terminal.visible && !s.terminal.disabled)
        applyTheme(s.theme)
      })
      .catch(err => setError(String(err.message ?? err)))
  }, [])

  // Applique le thème quand il change dans les paramètres
  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme)
    }
  }, [settings?.theme])

  /**
   * Persistance des tailles du terminal, après le geste et pas pendant.
   *
   * `useResizable` signale chaque image du glissement : écrire directement
   * ferait une requête par pixel parcouru. Le report de 300 ms les fond en une.
   *
   * La comparaison avec l'état enregistré n'est pas une optimisation : sans
   * elle, l'arrivée des préférences déclenche l'effet et réécrit au démarrage
   * ce qu'on vient tout juste de lire.
   */
  useEffect(() => {
    if (!settings) return
    const inchange =
      settings.terminal.hauteur === terminalHeight && settings.terminal.largeur === terminalWidth
    if (inchange) return

    const timer = setTimeout(() => {
      updateSettings({
        terminal: {
          ...settings.terminal,
          hauteur: terminalHeight,
          largeur: terminalWidth,
        },
      }).catch((err: unknown) => setError(String((err as Error).message ?? err)))
    }, 300)
    return () => clearTimeout(timer)
  }, [terminalHeight, terminalWidth, settings])

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

  /**
   * Un ticket écrit hors de l'app (skill, terminal) n'émet aucun événement —
   * seul un poll régulier le fait apparaître sans que l'utilisateur clique
   * sur reload. `board`/`tickets` seuls : les captures, l'historique et le
   * graphe n'ont aucune raison de bouger toutes les 4 secondes.
   */
  useEffect(() => {
    if (!current) return
    const timer = setInterval(() => {
      fetchTableau(current).then(setTableau).catch(() => {})
    }, 4000)
    return () => clearInterval(timer)
  }, [current])

  /**
   * Les autres onglets (Aperçu, Historique, Données…) reçoivent le snapshot
   * en prop et restent figés sur celui chargé à l'ouverture tant qu'on ne
   * clique pas sur reload. Un intervalle plus long que le poll tickets — pas
   * de raison de refaire tourner git log/graphify toutes les 4 secondes.
   */
  useEffect(() => {
    if (!current) return
    const timer = setInterval(() => {
      fetchSnapshot(current).then(setSnapshot).catch(() => {})
    }, 15000)
    return () => clearInterval(timer)
  }, [current])

  const reload = () => {
    if (!current) return
    fetchSnapshot(current)
      .then(setSnapshot)
      .catch(err => setError(String(err.message ?? err)))
  }

  /**
   * Aligner l'état de la fenêtre sur des préférences qu'on vient d'écrire.
   *
   * Le terminal a un état local, que le menu et le bouton basculent sans rien
   * écrire. Après une écriture, c'est le fichier qui fait foi — sinon appliquer
   * un profil sans terminal masque les onglets et laisse le terminal ouvert.
   * Les tailles, elles, ne se relisent pas : elles ont leur propre écriture
   * différée au redimensionnement.
   *
   * Partagé par l'écran des préférences et par la présentation, qui écrivent
   * le même fichier et doivent donc produire le même effet.
   */
  const appliquerReglages = (next: SettingsType) => {
    setSettings(next)
    setCurrentLanguage(next.langue)
    applyTheme(next.theme)
    setTerminal(next.terminal?.visible ?? true)
    setLayout((next.terminal?.disposition ?? 'bottom') as Layout)
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
   * `window.ovrsee` n'existe pas.
   */
  useEffect(() => {
    const menu = window.ovrsee?.menu
    if (!menu) return

    return menu.on(command => {
      if (command === 'preferences:open') return setPreferencesOuvertes(true)
      if (command === 'project:open') return void openProject(applyProjects, setError)
      if (command === 'project:reload') return reload()
      if (command === 'project:reveal') {
        if (current) window.ovrsee?.projects.reveal(current)
        return
      }
      if (command === 'sidebar:toggle') return setSidebarOuverte(ouverte => !ouverte)
      if (command === 'terminal:toggle') return setTerminal(ouvert => !ouvert)

      // ⌘W : fermer l'onglet quand on tape dans un terminal, la fenêtre sinon.
      // La décision est ici parce que `<Terminal>` est démonté quand le panneau
      // est replié — sa référence vide *est* la réponse.
      if (command === 'window:close') {
        const fermer = terminalActions.current?.focus() ? terminalActions.current.fermerActif : null
        if (fermer) return fermer()
        return void window.ovrsee?.app.close()
      }

      // ⌘D : un shell de plus. Panneau replié, le premier appui le déplie —
      // ouvrir un shell dans un composant pas encore monté demanderait un
      // aller-retour d'état pour un cas de bord.
      if (command === 'terminal:new') {
        if (!terminalActions.current) return setTerminal(true)
        return terminalActions.current.ouvrirShell()
      }

      const disposition = command.startsWith('terminal:layout:') && command.slice(16)
      if (disposition) {
        // Changer la disposition d'un terminal masqué ne montrerait rien.
        setTerminal(true)
        return setLayout(disposition as Layout)
      }

      const activeTabs = activeTabsInOrder(settings)
      const onglet = activeTabs.find(([id]) => command === `tab:${id}`)
      if (onglet) {
        setTab(onglet[0] as TabId)
        // Même correction qu'au clic : plein écran est une vue du terminal, on
        // n'y reste pas en changeant d'onglet.
        setLayout(l => (l === 'full' ? 'bottom' : l))
        pushUrl(onglet[2], current)
      }
    })
  }, [current, settings])

  // ⌘, hors Electron : dans un navigateur il n'y a pas de menu natif pour
  // porter le raccourci, et c'est le geste qu'on essaie en premier.
  //
  // ⌘K (T-0048) n'a jamais eu de porteur, ni menu natif ni navigateur : la
  // palette est neuve, ce raccourci global est sa seule entrée au clavier.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === ',') {
        setPreferencesOuvertes(true)
        event.preventDefault()
      } else if (event.key.toLowerCase() === 'k') {
        setPaletteOuverte(before => !before)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Changer de vue — rail (`Sidebar`) et palette ⌘K (`CommandPalette`) font
   * le même geste, une seule fois défini.
   */
  const onTabPick = (id: TabId, path: string) => {
    setTab(id)
    // Même correction qu'au clic d'onglet historique : plein écran est une
    // vue du terminal, on n'y reste pas en changeant de vue.
    setLayout(l => (l === 'full' ? 'bottom' : l))
    pushUrl(path, current)
  }

  /** Ouvrir un ticket dans Tableau — depuis la frise Historique ou la palette ⌘K. */
  const onOuvrirTicket = (file: string) => {
    setTab('tableau')
    setFocusTicket(file)
    pushUrl('/tableau', current, file)
  }

  /** Ouvrir une route dans Navigateur — depuis le panneau de détail de Produit. */
  const onOuvrirDansNavigateur = (route: string) => {
    setTab('navigateur')
    setLayout(l => (l === 'full' ? 'bottom' : l))
    setFocusRoute(route)
    pushUrl('/navigateur', current, null, route)
  }

  /** Ouvrir la création de ticket dans Tableau, contexte d'élément joint — depuis Navigateur. */
  const onCreerTicketDepuisElement = (corps: string, tags: string[]) => {
    setTab('tableau')
    setLayout(l => (l === 'full' ? 'bottom' : l))
    setContexteElement({ corps, tags })
    pushUrl('/tableau', current)
  }

  const plans = snapshot?.plans ?? []
  const scan = lastScan(snapshot?.scans ?? [])
  const contentVisible = !(layout === 'full' && terminal)
  const unequipped = snapshot ? isUnequipped(snapshot) : false

  /**
   * La présentation de premier lancement.
   *
   * Les deux conditions valent migration : quelqu'un qui a déjà des projets au
   * registre ne la reverra jamais, même si sa clé `onboardingVu` manque parce
   * que son fichier de préférences est plus vieux qu'elle. C'est aussi ce qui
   * évite d'écrire un code de migration pour une seule clé.
   */
  const presentationDue = Boolean(settings) && !settings?.onboardingVu && projects.length === 0
  const presentationOuverte = !error && (presentationDue || revoirPresentation)

  return (
    // La maquette dessinait une fausse fenêtre — pastilles, ombre portée,
    // 1320×860 posés sur un fond dégradé — parce qu'elle montrait à quoi
    // l'application ressemblerait une fois empaquetée. La vraie fenêtre
    // existe maintenant : redessiner son chrome à l'intérieur ferait deux
    // barres de titre l'une dans l'autre. L'interface occupe donc toute la
    // fenêtre, et macOS fournit le chrome.
    <StatusBarSlotContext.Provider value={statusBarSlot}>
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
          'height: 38px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 82px; background: var(--color-surface); border-bottom: 1px solid var(--color-border-chrome); -webkit-app-region: drag;',
        )}
      >
        {/* `-webkit-app-region: no-drag` : sans cela le bouton est avalé par la
            zone de déplacement de la fenêtre et le clic ne l'atteint jamais. */}
        <button
          type="button"
          aria-label={t('sidebar.toggle')}
          aria-expanded={sidebarOuverte}
          title={t('sidebar.toggle')}
          onClick={() => setSidebarOuverte(ouverte => !ouverte)}
          style={s(
            sidebarOuverte
              ? 'width: 24px; height: 24px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 0; background: transparent; color: var(--color-text-quaternary); cursor: pointer; -webkit-app-region: no-drag;'
              : 'width: 24px; height: 24px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 0; background: var(--color-surface-active); color: var(--color-text-secondary); cursor: pointer; -webkit-app-region: no-drag;',
          )}
        >
          <SidebarSimple size={14} weight="regular" aria-hidden="true" />
        </button>

        <ProjectSwitcher
          projects={projects}
          current={current}
          snapshot={snapshot}
          onPick={path => {
            setCurrent(path)
            pushUrl(window.location.pathname, path)
          }}
          onProjects={applyProjects}
          onError={setError}
        />
        <div style={s('flex: 1;')} />
        <ScanBadge scan={scan} />
      </header>

      <div style={s('flex: 1; display: flex; flex-direction: column; min-height: 0;')}>

        <div style={s('flex: 1; display: flex; min-height: 0;')}>
          {/* Le rail de navigation (T-0047) vit dans la barre latérale : repliée,
              elle passe en icône-seule plutôt que de disparaître — c'est ce qui
              garde les 7 vues à un clic sans réserver la largeur d'une barre
              ouverte. Le redimensionnement (Divider) ne vaut que déployée : une
              largeur d'icônes ne se règle pas à la souris. */}
          <Sidebar
            collapsed={!sidebarOuverte}
            settings={settings}
            width={sidebar.size}
            tab={tab}
            onTabPick={onTabPick}
            onOpenPreferences={() => setPreferencesOuvertes(true)}
            onOpenPreferencesInterface={() => {
              setPreferencesInitial({ section: 'interface' })
              setPreferencesOuvertes(true)
            }}
            onOpenPalette={() => setPaletteOuverte(true)}
            ticketsRestant={snapshot ? restant(snapshot.tickets ?? [], snapshot.board ?? []) : 0}
          />
          {sidebarOuverte && <Divider axis="x" resizable={sidebar} />}

          <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0;')}>
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
                  {error && <Message text={`${t('msg.read_error')}: ${error}`} />}
                  {!error && projects.length === 0 && (
                    <Welcome
                      onAjouterProjet={
                        window.ovrsee?.projects
                          ? () => void openProject(applyProjects, setError)
                          : undefined
                      }
                    />
                  )}
                  {!error && projects.length > 0 && !snapshot && <Message text={t('msg.loading')} />}
                  {!error && snapshot && unequipped && (
                    <EquipmentPanel root={snapshot.root} onDone={reload} onError={setError} />
                  )}
                  {!error && snapshot && !unequipped && (
                    // Le garde-fou est remonté à chaque changement d'onglet et
                    // de projet : une panne sur l'un ne doit pas condamner les
                    // autres, et revenir dessus doit réessayer.
                    <Garde key={`${tab}:${snapshot.root}`} quoi={t('garde.tab', { name: labelOf(tab) })}>
                      {tab === 'apercu' && (
                        // Le terminal a son état ici : l'Aperçu demande son
                        // ouverture, il ne lance pas de session lui-même —
                        // sinon le panneau en ignorerait l'existence.
                        <Apercu
                          snapshot={snapshot}
                          onTerminal={() => setTerminal(true)}
                          onOpenPreferences={opts => {
                            setPreferencesInitial({ section: 'projet', provider: opts?.provider })
                            setPreferencesOuvertes(true)
                          }}
                          onReload={reload}
                          onVoirTousLesPlans={() => onTabPick('historique', '/historique')}
                        />
                      )}

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
                        <Navigateur
                          snapshot={snapshot}
                          visible={tab === 'navigateur'}
                          focusRoute={focusRoute}
                          onFocusHandled={() => setFocusRoute(null)}
                          onCreerTicketDepuisElement={onCreerTicketDepuisElement}
                        />
                      </div>

                      {tab === 'produit' && (
                        <Produit
                          snapshot={snapshot}
                          layout={layout}
                          packageManager={settings?.packageManager ?? 'pnpm'}
                          onOuvrirDansNavigateur={onOuvrirDansNavigateur}
                        />
                      )}
                      {tab === 'historique' && (
                        <Historique
                          projet={projectDisplayName(snapshot)}
                          plans={plans}
                          activePlans={snapshot.activePlans}
                          timeline={snapshot.timeline ?? []}
                          ticketTimeline={snapshot.ticketTimeline ?? []}
                          scans={snapshot.scans ?? []}
                          illisibles={snapshot.illisibles ?? []}
                          onOuvrirTicket={onOuvrirTicket}
                        />
                      )}
                      {tab === 'tableau' && (
                        <Tableau
                          projet={projectDisplayName(snapshot)}
                          root={snapshot.root}
                          board={snapshot.board ?? []}
                          tickets={snapshot.tickets ?? []}
                          illisibles={snapshot.illisibles ?? []}
                          gitStatus={snapshot.gitStatus}
                          onChange={setTableau}
                          focusTicket={focusTicket}
                          contexteElement={contexteElement}
                        />
                      )}
                      {tab === 'donnees' && (
                        <Donnees
                          projet={projectDisplayName(snapshot)}
                          graph={snapshot.graph}
                          source={snapshot.graphSource}
                          sourceRequested={snapshot.sourceRequested}
                          sourceMissing={snapshot.sourceMissing}
                          sourceDate={snapshot.sourceDate}
                          vaultDeclared={Boolean(snapshot.config?.obsidianVault)}
                          config={snapshot.config}
                          root={snapshot.root}
                          integrations={snapshot.integrations ?? []}
                        />
                      )}
                      {tab === 'stack' && <Stack snapshot={snapshot} />}
                    </Garde>
                  )}
                </main>
              )}

              {terminal && !settings?.terminal?.disabled && (
                <Terminal
                  layout={layout}
                  onLayout={setLayout}
                  onToggle={() => setTerminal(false)}
                  onReload={reload}
                  snapshot={snapshot}
                  settings={settings}
                  terminalHeight={terminalHeight}
                  terminalWidth={terminalWidth}
                  onTerminalHeightChange={setTerminalHeight}
                  onTerminalWidthChange={setTerminalWidth}
                  onProjet={setCurrent}
                  actions={terminalActions}
                />
              )}
            </div>

            {/* Pas de pastille de réouverture si le terminal est désactivé :
                sinon rien n'empêche `setTerminal(true)` de rouvrir un panneau
                qu'on vient de dire ne jamais vouloir. */}
            {!terminal && !settings?.terminal?.disabled && (
              <div
                style={s(
                  'height: 32px; flex: none; border-top: 1px solid var(--color-border-chrome); background: var(--color-surface); display: flex; align-items: center; gap: 10px; padding: 0 14px;',
                )}
              >
                <button
                  type="button"
                  onClick={() => setTerminal(true)}
                  style={s('cursor: pointer; border: 0; background: transparent; font-size: 11px; color: var(--color-text-quaternary);')}
                >
                  Terminal · claude
                </button>
                <span style={s('font-size: 10.5px; color: var(--color-text-quaternary);')}>
                  réduit — la session tourne toujours
                </span>
              </div>
            )}

            {/* Cible du portail de `StatusBar` (T-0111) : toujours après le
                terminal, quel que soit l'onglet actif ou l'état du panneau. */}
            <div ref={setStatusBarSlot} style={s('flex: none;')} />
          </div>
        </div>
      </div>

      {/* Au-dessus des préférences : « Revoir la présentation » se clique
          depuis leur écran, et les deux ne doivent pas se disputer le dessus. */}
      {presentationOuverte && settings && (
        <Onboarding
          settings={settings}
          onFini={next => {
            setRevoirPresentation(false)
            appliquerReglages(next)
            updateSettings(next).catch(err => setError(String(err.message ?? err)))
          }}
          onAjouterProjet={
            window.ovrsee?.projects ? () => void openProject(applyProjects, setError) : undefined
          }
        />
      )}

      {/* Au niveau de la fenêtre, pas dans la barre latérale : une modale
          `position: fixed` posée dans un `<aside>` marchait par accident. */}
      {preferencesOuvertes && (
        <PreferencesModal
          onClose={() => {
            setPreferencesOuvertes(false)
            setPreferencesInitial(null)
          }}
          onSaved={appliquerReglages}
          onRevoirPresentation={() => {
            setPreferencesOuvertes(false)
            setPreferencesInitial(null)
            setRevoirPresentation(true)
          }}
          root={snapshot?.root}
          integrations={snapshot?.integrations}
          initialSection={preferencesInitial?.section}
          initialProvider={preferencesInitial?.provider}
        />
      )}

      {paletteOuverte && (
        <CommandPalette
          settings={settings}
          tickets={snapshot?.tickets ?? []}
          projects={projects}
          current={current}
          onClose={() => setPaletteOuverte(false)}
          onTabPick={onTabPick}
          onPick={path => {
            setCurrent(path)
            pushUrl(window.location.pathname, path)
          }}
          onOpenPreferences={() => setPreferencesOuvertes(true)}
          onOpenTicket={onOuvrirTicket}
        />
      )}
    </div>
    </StatusBarSlotContext.Provider>
  )
}

/**
 * Date du dernier scan. Un scan échoué se dit — sans quoi la capture
 * précédente passerait pour fraîche.
 */
function ScanBadge({ scan }: { scan: ReturnType<typeof lastScan> }) {
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

/** Largeur fixe du rail replié — logo + picto 17px centrés (maquette 2a/2k). */
const RAIL_COLLAPSED_WIDTH = 56

/**
 * Barre latérale — maquette l. 45-71, rail des vues intégré (T-0047, maquette
 * 1b/2b : Projets puis Vues dans une seule colonne).
 *
 * Repliée (`collapsed`), elle ne montre que les 7 pictos de vue, sans projets
 * ni activité — c'est la lecture « rail replié » de la maquette 2k. Les
 * Préférences restent joignables par ⌘, dans ce mode : pas besoin d'un
 * bouton en plus dans une colonne de 52px.
 */
function Sidebar({
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
        <div style={s('padding-bottom: 8px;')}>
          <Logo size={28} />
        </div>
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
function ProjectSwitcher({
  projects,
  current,
  snapshot,
  onPick,
  onProjects,
  onError,
}: {
  projects: Project[]
  current: string | null
  /** L'instantané du projet affiché, pour que sa pastille suive le tableau sans re-fetch. */
  snapshot: Snapshot | null
  onPick: (path: string) => void
  onProjects: (list: Project[], select?: string | null) => void
  onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = projects.find(p => p.path === current) ?? null
  const picker = window.ovrsee?.projects

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
        <span style={s('width: 5px; height: 5px; border-radius: 2px; background: var(--color-accent); flex: none;')} />
        <span style={s('font-size: 12px; font-weight: 500; color: var(--color-text); white-space: nowrap;')}>
          {active?.name ?? '…'}
        </span>
        <CaretDown size={10} weight="bold" aria-hidden="true" color="var(--color-text-discrete)" />
      </button>

      {open && (
        <div
          style={s(
            'position: absolute; top: 30px; left: 0; width: 260px; z-index: 20; padding: 6px; border-radius: 8px; border: 1px solid var(--color-border-card); background: var(--color-surface-elevated); box-shadow: 0 12px 28px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 2px;',
          )}
        >
          {projects.map(project => (
            <ProjectRow
              key={project.path}
              project={project}
              active={project.path === current}
              snapshot={project.path === current ? snapshot : null}
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
      style={s(
        'padding: 6px 8px; margin: 0 10px; border-radius: 6px; cursor: pointer; ' +
          (active ? 'background: var(--color-surface-active);' : ''),
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 9px;')}>
        <div style={s('width: 7px; flex: none; display: flex; align-items: center; justify-content: center;')}>
          <div
            style={s(
              `width: 7px; height: 7px; border-radius: 2px; background: ${active ? 'var(--color-accent)' : 'var(--color-text-ghost)'};`,
            )}
          />
        </div>
        <div
          style={s(
            `flex: 1; min-width: 0; font-size: 12.5px; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${active ? 'font-weight: 500; color: var(--color-text);' : 'color: var(--color-text-tertiary);'}`,
          )}
          title={project.path}
        >
          {project.name}
        </div>

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
                (confirming ? 'color: var(--color-accent);' : 'color: var(--color-neutral-500);'),
            )}
          >
            {confirming ? 'retirer ?' : '×'}
          </button>
        )}
      </div>
      <div
        title="Dernier commit rattaché à un plan"
        style={s('font-size: 10.5px; font-family: var(--font-mono); color: var(--color-text-faint); margin-top: 3px; padding-left: 16px;')}
      >
        {humanAge(vivant.last)}
      </div>
    </div>
  )
}
