import { useEffect, useRef, useState } from 'react'
import { CaretDown, Code, DotsThree, FolderOpen } from '@phosphor-icons/react'

import {
  EMPTY_GIT_STATUS,
  frDate,
  humanAge,
  lastScan,
  plansOuverts,
  projectAction,
  restant,
  stackFrom,
  type GitStatus,
  type IntegrationProvider,
  type Snapshot,
} from '../data'
import { Branches } from './Branches'
import { Deploiements } from './Deploiements'
import { Environnements } from './Environnements'
import { Illisibles } from '../Illisibles'
import { Markdown, headings } from '../markdown'
import { Sante } from './Sante'
import { t } from '../i18n'
import { s } from '../style'
import { StatusBar } from '../StatusBar'
import { ViewBar } from '../ViewBar'
import type { Editeur } from '../useTerminal'

/** Crochets appelés par le gestionnaire de paquets, jamais tapés à la main. */
const LIFECYCLE = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepack',
  'postpack',
  'prepublish',
  'prepublishOnly',
  'postpublish',
])

/**
 * Le pont Electron, ou rien.
 *
 * `typeof window` et pas `window` directement : les onglets sont rendus côté
 * serveur par les tests (`render.test.tsx`), où l'objet n'existe pas. Une
 * lecture directe y lèverait, et le test qui vérifie qu'aucun onglet ne lève
 * échouerait sur sa propre garde.
 *
 * La présence ne suffit pas, la forme est vérifiée : `window.ovrsee` peut être
 * un élément du document plutôt que le pont, car un `id` dans la page devient un
 * global. Les ancres du markdown sont préfixées pour que ça n'arrive plus
 * (`slug()`), mais s'y fier serait faire dépendre le mode Electron du contenu
 * d'un README.
 */
const pont = () => {
  if (typeof window === 'undefined') return undefined
  const bridge = window.ovrsee
  return typeof bridge?.projects?.edit === 'function' ? bridge : undefined
}

const EDITEURS: Array<[Editeur, string]> = [
  ['vscode', 'VS Code'],
  ['cursor', 'Cursor'],
  ['zed', 'Zed'],
  ['windsurf', 'Windsurf'],
]

const BOUTON =
  'height: 27px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); font-size: 12px; color: var(--color-text-secondary);'

/**
 * Onglet Aperçu — la page d'arrivée.
 *
 * Les cinq autres onglets répondent à des questions qu'on ne se pose qu'en
 * sachant déjà de quoi le projet parle. Celui-ci répond à la première :
 * « c'est quoi, ce projet ? ». Sa réponse est le README du dépôt — le seul
 * endroit où quelqu'un l'a déjà écrite.
 *
 * Rien n'est résumé, rien n'est reformulé. Les chiffres du bandeau sont
 * dérivés du snapshot par les mêmes fonctions que les onglets qui les
 * affichent en détail : deux calculs séparés finiraient par se contredire, et
 * une page d'accueil qui contredit le reste est pire que pas de page d'accueil.
 *
 * @param onTerminal ouvre le panneau du terminal. Il vit dans l'état de `App` —
 *   ouvrir un pty depuis ici créerait une session que le panneau ignore.
 * @param onOpenPreferences ouvre la modale Préférences sur la section Projet,
 *   provider d'intégration présélectionné le cas échéant — utilisé par la
 *   carte Déploiements pour amener directement au bon formulaire.
 */
export function Apercu({
  snapshot,
  onTerminal,
  onOpenPreferences,
  onReload,
  onVoirTousLesPlans,
}: {
  snapshot: Snapshot
  onTerminal?: () => void
  onOpenPreferences: (opts?: { provider?: IntegrationProvider }) => void
  /** Relit `ovrsee/` — après avoir clos le plan actif, l'Aperçu ne le sait pas seul. */
  onReload: () => void
  onVoirTousLesPlans: () => void
}) {
  const { packageJson, readme, root } = snapshot
  const plans = snapshot.plans ?? []

  const nom = packageJson?.name ?? root.split('/').filter(Boolean).at(-1) ?? root
  const pages = snapshot.pages?.pages ?? []
  const ouverts = plansOuverts(plans).length
  const deps = stackFrom(packageJson, snapshot.whys).length
  const scan = lastScan(snapshot.scans)
  const tickets = restant(snapshot.tickets, snapshot.board)
  const planActif = plans.find(p => p.file === snapshot.activePlan) ?? null
  const plan = readme ? headings(readme) : []
  const hasEnvironments = (snapshot.config?.environments?.length ?? 0) > 0

  // Le panneau droit (Déploiements + README, maquette 2b) défile pour son
  // propre compte — c'est lui que `scrollVers` amène à un titre, pas la page.
  const panneauDroit = useRef<HTMLDivElement>(null)

  // L'état git est réévalué à chaque nouveau snapshot (changement de projet,
  // rechargement) mais mis à jour localement après un fetch — relire tout le
  // snapshot pour un champ qui change serait payer le reste du projet dessus.
  const [gitStatus, setGitStatus] = useState<GitStatus>(snapshot.gitStatus ?? EMPTY_GIT_STATUS)
  useEffect(() => {
    setGitStatus(snapshot.gitStatus ?? EMPTY_GIT_STATUS)
  }, [root, snapshot.gitStatus])
  const gitDirtyTotal = gitStatus.dirty.staged + gitStatus.dirty.unstaged + gitStatus.dirty.untracked

  // Le README est replié par défaut : c'est la réponse à « c'est quoi, ce
  // projet ? », pas quelque chose qu'on relit à chaque ouverture de l'onglet.
  const [readmeOpen, setReadmeOpen] = useState(false)
  const [ancreEnAttente, setAncreEnAttente] = useState<string | null>(null)

  /**
   * Amener un titre en haut du panneau droit, en ne bougeant que ce cadre.
   *
   * Laisser le navigateur suivre le `#` déplaçait la fenêtre entière : la barre
   * d'onglets et la latérale sortaient de l'écran, et l'application paraissait
   * cassée. Le `href` reste posé quand même — il rend le lien copiable et
   * ouvrable au clic du milieu, ce qu'un `onClick` seul ne donne pas.
   */
  const scrollVers = (id: string) => {
    const cible = document.getElementById(id)
    const cadre = panneauDroit.current
    if (!cible || !cadre) return
    cadre.scrollTop += cible.getBoundingClientRect().top - cadre.getBoundingClientRect().top - 14
  }

  // Un lien du sommaire peut viser un titre caché derrière le README replié :
  // l'ouvrir d'abord, défiler une fois le markdown monté.
  const aller = (id: string) => {
    if (!readmeOpen) {
      setReadmeOpen(true)
      setAncreEnAttente(id)
      return
    }
    scrollVers(id)
  }

  useEffect(() => {
    if (!readmeOpen || !ancreEnAttente) return
    scrollVers(ancreEnAttente)
    setAncreEnAttente(null)
  }, [readmeOpen, ancreEnAttente])

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; overflow: hidden;')}>
      <ViewBar projet={nom} vue={t('tabs.apercu')}>
        <Actions root={root} onTerminal={onTerminal} />
      </ViewBar>
      <div style={s('flex: none; padding: 22px 24px 18px; border-bottom: 1px solid var(--color-border-chrome);')}>
        <Illisibles entries={snapshot.illisibles ?? []} />

        <div
          style={s(
            'display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;',
          )}
        >
          <h2 style={s('font-size: 21px; font-weight: 600; letter-spacing: -.015em; margin: 0;')}>{nom}</h2>
          <div style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-text-discrete);')}>{root}</div>
        </div>

        {packageJson?.description && (
          <div style={s('font-size: 13px; color: var(--color-text-tertiary); line-height: 1.6; margin-top: 8px; max-width: 720px; text-wrap: pretty;')}>
            {packageJson.description}
          </div>
        )}

        <div style={s('display: flex; gap: 10px; margin-top: 18px;')}>
          <Chiffre
            valeur={pages.length}
            unite={pages.length > 1 ? t('apercu.pages') : t('apercu.page')}
            legende={pages.length > 1 ? t('apercu.mapped_plural') : t('apercu.mapped')}
          />
          <Chiffre
            valeur={plans.length}
            unite={plans.length > 1 ? t('apercu.plans') : t('apercu.plan')}
            legende={ouverts > 0 ? `${t('apercu.open_info')} ${ouverts} ${ouverts > 1 ? t('apercu.opens') : t('apercu.open')}` : t('apercu.closed')}
            accent={ouverts > 0}
          />
          <Chiffre valeur={tickets} unite={tickets > 1 ? t('apercu.tickets') : t('apercu.ticket')} legende={t('apercu.to_do')} />
          <Chiffre
            valeur={deps}
            unite={deps > 1 ? t('apercu.dependencies') : t('apercu.dependency')}
            legende={deps > 1 ? t('apercu.declared_plural') : t('apercu.declared')}
          />
          <Chiffre valeur={humanAge(derniere(snapshot))} unite="" legende={t('apercu.last_activity')} />
          <Chiffre
            valeur={scan ? frDate(scan.date) : '—'}
            unite=""
            legende={scan ? (scan.ok ? t('apercu.last_scan') : t('apercu.scan_failed')) : t('apercu.no_scan')}
            statut={scan ? (scan.ok ? 'succes' : 'echec') : undefined}
          />
        </div>
      </div>

      <div style={s('flex: 1; display: flex; min-height: 0;')}>
        <div style={s('flex: 1; min-width: 0; overflow-y: auto; padding: 18px 22px 32px;')}>
          <Sante
            snapshot={snapshot}
            gitStatus={gitStatus}
            onReload={onReload}
            onVoirTousLesPlans={onVoirTousLesPlans}
          />
          {hasEnvironments ? (
            <div style={s('display: flex; gap: 18px; align-items: flex-start;')}>
              <div style={s('flex: 1; min-width: 0;')}>
                <Branches root={root} gitStatus={gitStatus} onGitStatus={setGitStatus} />
              </div>
              <div style={s('flex: 1; min-width: 0;')}>
                <Environnements config={snapshot.config} gitStatus={gitStatus} />
              </div>
            </div>
          ) : (
            <Branches root={root} gitStatus={gitStatus} onGitStatus={setGitStatus} />
          )}

          <div style={s('margin-top: 18px;')}>
            <Lancement packageJson={packageJson} />
          </div>

          <div style={s('margin-top: 18px;')}>
            <Titre>{t('apercu.take_away')}</Titre>
            <Obsidian root={root} />
          </div>
        </div>

        {/* Panneau droit fixe, propre défilement — Déploiements puis README,
            maquette 2b. `Deploiements` et le sommaire du README y vivent
            ensemble : c'est la même question, « quoi de neuf, et de quoi ça
            parle ». */}
        <div
          ref={panneauDroit}
          style={s(
            'flex: none; width: 320px; overflow-y: auto; border-left: 1px solid var(--color-divider); padding: 18px 20px 32px;',
          )}
        >
          <Deploiements
            root={root}
            integrations={snapshot.integrations ?? []}
            onOpenPreferences={onOpenPreferences}
          />

          <div style={s('height: 1px; background: var(--color-border-chrome); margin: 18px 0;')} />

          <div
            style={s(
              'height: 38px; flex: none; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-border-chrome);',
            )}
          >
            <div style={s('font-size: 12px; font-weight: 500; color: var(--color-text);')}>README.md</div>
            <div style={s('flex: 1;')} />
            {readme && (
              <button
                type="button"
                onClick={() => setReadmeOpen(open => !open)}
                style={s('cursor: pointer; border: 0; background: transparent; font-size: 11.5px; color: var(--color-text-quaternary);')}
              >
                {readmeOpen ? t('apercu.hide_readme') : t('apercu.show_readme')}
              </button>
            )}
          </div>
          <div style={s('padding-top: 14px;')}>
            {!readme && (
              <div style={s('font-size: 12.5px; color: var(--color-neutral-600);')}>
                {t('apercu.no_readme')}
              </div>
            )}
            {plan.length > 0 && <Sommaire plan={plan} aller={aller} />}
            {readme && readmeOpen && <Markdown text={readme} root={root} />}
          </div>
        </div>
      </div>

      <StatusBar
        dot={!gitStatus.branch ? undefined : gitDirtyTotal === 0 ? 'ok' : 'warn'}
        left={[
          gitStatus.branch ?? t('sante.no_branch'),
          ...(scan?.commit ? [scan.commit.slice(0, 7)] : []),
          gitDirtyTotal === 0
            ? t('sante.tree_clean')
            : t(gitDirtyTotal > 1 ? 'sante.tree_dirty_plural' : 'sante.tree_dirty', { n: gitDirtyTotal }),
        ]}
        right={planActif ? [t('statusbar.active_plan', { title: planActif.title })] : []}
      />
    </div>
  )
}

/**
 * La dernière activité vient de la frise, pas des plans : un commit hors plan
 * est du travail lui aussi, et le passer sous silence ferait paraître un projet
 * actif à l'abandon.
 */
const derniere = (snapshot: Snapshot) => snapshot.timeline?.[0]?.date ?? null

/**
 * Ce qu'on peut faire d'un projet sans y toucher.
 *
 * Aucune de ces actions n'exécute quoi que ce soit du projet observé. Ouvrir
 * l'éditeur passe par un schéma d'URL — `vscode://file/…` —, du même ordre
 * qu'ouvrir un lien : c'est le système qui décide, pas l'ovrsee. La liste des
 * schémas et la vérification du chemin vivent dans le processus principal
 * (`electron/main.js`), jamais ici.
 *
 * En navigateur, `window.ovrsee` n'existe pas et il ne reste que la copie du
 * chemin — un bouton qui ne peut rien faire vaut mieux caché qu'inerte.
 */
/**
 * Actions de la barre de vue — maquette 2b. Puce éditeur (lance l'éditeur
 * courant, le caret change lequel), Finder, copier le chemin (⌘⇧C câblé
 * pour de vrai — un indice qui ne fait rien serait un mensonge d'interface,
 * même raison que ⇧⌘E sur Navigateur), et un menu ⋯ pour le reste.
 */
function Actions({ root, onTerminal }: { root: string; onTerminal?: () => void }) {
  const ovrsee = pont()
  const [copie, setCopie] = useState(false)
  const [editeur, setEditeur] = useState<Editeur>(() => {
    if (typeof localStorage === 'undefined') return 'vscode'
    const garde = localStorage.getItem('ovrsee.editor')
    return EDITEURS.some(([nom]) => nom === garde) ? (garde as Editeur) : 'vscode'
  })
  const [menuEditeur, setMenuEditeur] = useState(false)
  const [menuPlus, setMenuPlus] = useState(false)
  const refEditeur = useRef<HTMLDivElement>(null)
  const refPlus = useRef<HTMLDivElement>(null)

  const copier = () => {
    navigator.clipboard
      ?.writeText(root)
      .then(() => {
        setCopie(true)
        setTimeout(() => setCopie(false), 1500)
      })
      .catch(() => setCopie(false))
  }

  useEffect(() => {
    if (!menuEditeur && !menuPlus) return
    const onClickOutside = (event: MouseEvent) => {
      if (menuEditeur && refEditeur.current && !refEditeur.current.contains(event.target as Node)) setMenuEditeur(false)
      if (menuPlus && refPlus.current && !refPlus.current.contains(event.target as Node)) setMenuPlus(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuEditeur, menuPlus])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copier()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [root])

  if (!ovrsee) {
    // Navigateur : ni éditeur ni Finder n'ont de sens sans pont Electron.
    return (
      <button type="button" className="btn btn-secondary" style={s(BOUTON)} onClick={copier}>
        {copie ? t('apercu.copied') : t('apercu.copy_path')}
      </button>
    )
  }

  const nomEditeur = EDITEURS.find(([valeur]) => valeur === editeur)?.[1] ?? editeur

  return (
    <div style={s('display: flex; align-items: center; gap: 6px;')}>
      <div ref={refEditeur} style={s('position: relative;')}>
        <div
          style={s(
            'display: flex; align-items: center; height: 27px; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); overflow: hidden;',
          )}
        >
          <button
            type="button"
            onClick={() => ovrsee.projects.edit(root, editeur)}
            title={t('apercu.open_editor')}
            style={s(
              'cursor: pointer; display: flex; align-items: center; gap: 6px; height: 100%; padding: 0 8px 0 10px; border: 0; background: transparent; font-size: 12px; color: var(--color-text-secondary);',
            )}
          >
            <Code size={14} weight="regular" aria-hidden="true" color="var(--color-info)" />
            {nomEditeur}
          </button>
          <button
            type="button"
            onClick={() => setMenuEditeur(o => !o)}
            aria-label={t('apercu.editor')}
            aria-expanded={menuEditeur}
            style={s(
              'cursor: pointer; display: flex; align-items: center; height: 100%; padding: 0 8px; border: 0; border-left: 1px solid var(--color-border-control); background: transparent;',
            )}
          >
            <CaretDown size={10} weight="bold" aria-hidden="true" color="var(--color-text-discrete)" />
          </button>
        </div>
        {menuEditeur && (
          <div
            style={s(
              'position: absolute; top: 31px; right: 0; z-index: 20; min-width: 140px; padding: 4px; border-radius: 8px; border: 1px solid var(--color-border-card); background: var(--color-surface-elevated); box-shadow: 0 12px 28px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 2px;',
            )}
          >
            {EDITEURS.map(([valeur, nomOpt]) => (
              <button
                key={valeur}
                type="button"
                onClick={() => {
                  setEditeur(valeur)
                  // Une préférence d'affichage, pas un réglage du projet : elle
                  // n'a rien à faire dans `ovrsee.config.json`, que git suit.
                  localStorage.setItem('ovrsee.editor', valeur)
                  ovrsee.projects.edit(root, valeur)
                  setMenuEditeur(false)
                }}
                style={s(
                  `cursor: pointer; text-align: left; height: 27px; padding: 0 8px; border-radius: 6px; border: 0; font-size: 12px; background: ${valeur === editeur ? 'var(--color-surface-active)' : 'transparent'}; color: ${valeur === editeur ? 'var(--color-text)' : 'var(--color-text-secondary)'};`,
                )}
              >
                {nomOpt}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={s(BOUTON)}
        onClick={() => ovrsee.projects.reveal(root)}
      >
        <FolderOpen size={14} weight="regular" aria-hidden="true" color="var(--color-text-quaternary)" />
        {t('apercu.reveal')}
      </button>

      <button type="button" className="btn btn-secondary" style={s(BOUTON + ' gap: 8px;')} onClick={copier}>
        {copie ? t('apercu.copied') : t('apercu.copy_path')}
        <span className="kbd">⌘⇧C</span>
      </button>

      {onTerminal && (
        <div ref={refPlus} style={s('position: relative;')}>
          <button
            type="button"
            onClick={() => setMenuPlus(o => !o)}
            aria-label={t('apercu.more_actions')}
            aria-expanded={menuPlus}
            style={s(
              'cursor: pointer; width: 27px; height: 27px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid var(--color-border-control); background: var(--color-surface-control); color: var(--color-text-tertiary);',
            )}
          >
            <DotsThree size={16} weight="bold" aria-hidden="true" />
          </button>
          {menuPlus && (
            <div
              style={s(
                'position: absolute; top: 31px; right: 0; z-index: 20; min-width: 160px; padding: 4px; border-radius: 8px; border: 1px solid var(--color-border-card); background: var(--color-surface-elevated); box-shadow: 0 12px 28px rgba(0,0,0,.5);',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  onTerminal()
                  setMenuPlus(false)
                }}
                style={s(
                  'cursor: pointer; width: 100%; text-align: left; height: 27px; padding: 0 8px; border-radius: 6px; border: 0; background: transparent; font-size: 12px; color: var(--color-text-secondary);',
                )}
              >
                {t('apercu.terminal_shell')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Le plan du README, dans le panneau droit — maquette : « Ce qu'on y voit »,
 * toujours visible, indentation uniforme. Les titres de quatrième niveau en
 * sont exclus — un sommaire qui descend aussi bas cesse d'être un sommaire.
 */
function Sommaire({
  plan,
  aller,
}: {
  plan: Array<{ level: number; texte: string; id: string }>
  aller: (id: string) => void
}) {
  return (
    <nav aria-label={t('apercu.summary')} style={s('display: flex; flex-direction: column; gap: 6px;')}>
      <div style={s('font-size: 12.5px; color: var(--color-text-secondary);')}>{t('apercu.summary')}</div>
      {plan
        .filter(titre => titre.level <= 3)
        .map(titre => (
          <a
            key={titre.id}
            href={`#${titre.id}`}
            onClick={event => {
              event.preventDefault()
              aller(titre.id)
            }}
            style={s(
              'display: block; font-size: 12.5px; color: var(--color-text-quaternary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 12px;',
            )}
            title={titre.texte}
          >
            {titre.texte}
          </a>
        ))}
    </nav>
  )
}

/**
 * Les scripts du `package.json`, en texte.
 *
 * Du texte, pas des boutons. L'ovrsee lit ; il n'exécute que le terminal
 * qu'on lui demande — un bouton qui lance `package` depuis une vue de lecture
 * serait un piège.
 */
function Lancement({ packageJson }: { packageJson: Snapshot['packageJson'] }) {
  // Les scripts de cycle de vie sont retirés : `postinstall` n'est pas une
  // commande qu'on tape, le gestionnaire de paquets l'appelle. Le proposer ici
  // inviterait à lancer à la main ce qui tourne déjà tout seul.
  //
  // Le filtre ne peut pas être un simple préfixe `pre`/`post` : `preview` et
  // `postcss` sont des scripts qu'on lance vraiment. Un `preX` n'est un crochet
  // que s'il existe un `X`, et le reste vient de la liste npm.
  const tous = Object.keys(packageJson?.scripts ?? {})
  const scripts = tous.filter(
    name =>
      !LIFECYCLE.has(name) &&
      !(/^(pre|post)/.test(name) && tous.includes(name.replace(/^(pre|post)/, ''))),
  )

  if (scripts.length === 0) return null

  return (
    <div>
      <Titre>{t('apercu.how_to_launch')}</Titre>
      <div style={s('display: flex; flex-wrap: wrap; gap: 6px;')}>
        {scripts.map(script => (
          <span
            key={script}
            title={packageJson?.scripts?.[script]}
            style={s(
              'font-family: var(--font-mono); font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--color-border-card); color: var(--color-neutral-400); user-select: all;',
            )}
          >
            pnpm {script}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Export du coffre Obsidian.
 *
 * C'est un bouton, contrairement aux scripts du dessus qui restent du texte —
 * et la distinction tient : celui-ci lit `ovrsee/` et écrit dans `ovrsee/`,
 * exactement comme « Initialiser ». Il n'exécute rien du projet observé.
 *
 * Le graphe du code n'est pas de la partie : Graphify l'écrit lui-même dans le
 * sous-dossier `graphe/`, depuis le terminal, parce qu'il a besoin de Claude.
 */
function Obsidian({ root }: { root: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <div>
      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 8px;')}>
        {t('apercu.obsidian_export_desc')}
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setErreur(null)
          projectAction('export-obsidian', root)
            .then(result => setDone(result.done ?? []))
            .catch(err => setErreur(String(err.message ?? err)))
            .finally(() => setBusy(false))
        }}
      >
        {busy ? t('apercu.obsidian_exporting') : t('apercu.obsidian_export_btn')}
      </button>

      {erreur && (
        <div
          style={s(
            'margin-top: 8px; font-size: 12px; color: var(--color-accent); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;',
          )}
        >
          {erreur}
        </div>
      )}

      {done && (
        <div style={s('margin-top: 8px; font-size: 11px; color: var(--color-neutral-500);')}>
          {done.map(line => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={s(
        'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 10px;',
      )}
    >
      {children}
    </div>
  )
}

/**
 * Un chiffre et ce qu'il compte. Sans légende, un nombre seul ne dit rien.
 *
 * `accent` ne colore que la carte « plans » (maquette 2b) — un fond violet
 * générique réutilisé pour n'importe quel état (ex. scan en échec) brouille
 * le seul signal qu'on voulait vraiment faire ressortir.
 */
function Chiffre({
  valeur,
  unite,
  legende,
  accent = false,
  statut,
}: {
  valeur: number | string
  unite: string
  legende: string
  accent?: boolean
  /** Couleur sémantique de la légende seule (ex. rouge pour un scan en échec). */
  statut?: 'succes' | 'echec'
}) {
  const legendeColor =
    statut === 'succes' ? 'var(--color-ok)' : statut === 'echec' ? 'var(--color-err)' : accent ? 'var(--color-accent-2)' : 'var(--color-text-discrete)'

  return (
    <div
      style={s(
        `flex: 1; border-radius: 8px; padding: 12px 14px; ${
          accent ? 'border: 1px solid var(--color-plan-border); background: var(--color-plan-bg);' : 'border: 1px solid var(--color-border-card); background: var(--color-surface-card);'
        }`,
      )}
    >
      <div
        style={s(`font-size: 20px; font-weight: 600; letter-spacing: -.02em; color: ${accent ? 'var(--color-plan)' : 'var(--color-text)'};`)}
      >
        {valeur}
      </div>
      {unite && <div style={s('font-size: 12px; color: var(--color-text-tertiary); margin-top: 3px;')}>{unite}</div>}
      <div style={s(`font-family: var(--font-mono); font-size: 10.5px; margin-top: 2px; color: ${legendeColor};`)}>
        {legende}
      </div>
    </div>
  )
}
