import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { SidebarSimple } from '@phosphor-icons/react'

import { t, setCurrentLanguage } from './i18n'
import {
  estAbandon,
  fetchProjects,
  fetchSettings,
  fetchSnapshot,
  fetchTableau,
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
import { Donnees, oublierGraphe } from './tabs/Donnees'
import { Stack } from './tabs/Stack'
import type { Layout, TerminalActions } from './Terminal'

/**
 * Le panneau terminal en morceau séparé — T-0133.
 *
 * xterm et sa feuille de style pèsent 488 ko, le tiers du bundle, pour une
 * fonction que beaucoup de sessions n'ouvrent jamais. Le `lazy()` seul ne
 * suffisait pas : `pasteToClaude` vivait dans le même module que xterm et trois
 * composants du chargement initial l'importaient. Il est passé dans `pty.ts`.
 *
 * Pas de `fallback` visible : le panneau apparaît quand son morceau arrive, et
 * un squelette d'un dixième de seconde vaudrait moins que rien du tout.
 */
const Terminal = lazy(() => import('./Terminal').then(m => ({ default: m.Terminal })))
import { Divider, useResizable } from './useResizable'
import { activeTabsInOrder, type TabId } from './views'
import { labelOf, projectFromUrl, pushUrl, routeFromUrl, tabForPath, ticketFromUrl } from './route'
import { Message, ProjectSwitcher, ScanBadge, Sidebar, openProject } from './Shell'



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
      })
      .catch(err => setError(String(err.message ?? err)))
  }, [])

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
   * L'accent du projet ouvert (T-0215, issue #48).
   *
   * `--color-accent` est le seul jeton de marque de l'interface : poser
   * l'identifiant de teinte sur `<html>` fait suivre la rampe entière et les 75
   * usages qui la citent, en une passe de style et sans rechargement. Les blocs
   * `[data-accent='…']` vivent dans `_ds/ovrsee/styles.css`.
   *
   * Le violet — et tout identifiant qu'on ne connaît pas — retire l'attribut :
   * un projet sans accent affiche le `:root` d'origine, pas une copie.
   */
  const accentCourant = projects.find(p => p.path === current)?.accent

  useEffect(() => {
    if (accentCourant && accentCourant !== 'violet') {
      document.documentElement.dataset.accent = accentCourant
    } else {
      delete document.documentElement.dataset.accent
    }
  }, [accentCourant])

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

  /** Incrémenté par `reload`. Seul l'onglet Données l'écoute — voir plus bas. */
  const [relectures, setRelectures] = useState(0)

  const reload = () => {
    if (!current) return
    // Le graphe ne vient plus du snapshot (T-0134) et l'onglet Données le garde
    // entre deux ouvertures (T-0208) : un rechargement explicite doit le jeter,
    // sinon un graphe régénéré par un commit resterait affiché périmé. Le
    // compteur fait relire l'onglet déjà monté ; l'oubli fait relire le suivant.
    oublierGraphe(current)
    setRelectures(n => n + 1)
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
              largeur d'icônes ne se règle pas à la souris — mais sa largeur nette
              (1px, marges négatives comprises) reste réservée par un espaceur
              inerte, sans quoi le contenu sautait de 1px au basculement (issue #50). */}
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
          {sidebarOuverte ? (
            <Divider axis="x" resizable={sidebar} />
          ) : (
            <div style={s('flex: none; width: 1px;')} />
          )}

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
                          onReload={reload}
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
                          relectures={relectures}
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

              {/* Le `Suspense` attrape l'attente, pas le rejet : un morceau qui
                  ne charge pas — périmé après un rebuild, illisible sur
                  `ovrsee://` — remontait jusqu'à la racine et vidait l'écran. Le
                  même garde-fou que les onglets, avec son indice à lui : ce
                  n'est pas un fichier d'`ovrsee/` qui a échoué. */}
              {terminal && !settings?.terminal?.disabled && (
                <Garde quoi={t('garde.terminal')} indice={t('garde.terminal_hint')}>
                  <Suspense fallback={null}>
                    <Terminal
                      tab={tab}
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
                      onOpenPreferences={() => {
                        setPreferencesInitial({ section: 'projet' })
                        setPreferencesOuvertes(true)
                      }}
                      actions={terminalActions}
                    />
                  </Suspense>
                </Garde>
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
          accent={accentCourant}
          onAccent={accent => {
            if (!current) return
            // La liste rendue par le serveur porte déjà la couleur : c'est elle
            // qui repeint, via `accentCourant`. Rien à réécrire ici.
            projectAction('accent', current, { accent })
              .then(resultat => applyProjects(resultat.projects))
              .catch(err => setError(String(err.message ?? err)))
          }}
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
