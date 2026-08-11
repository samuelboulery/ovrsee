import { useEffect, useRef, useState } from 'react'

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

const BOUTON = 'font-size: 12px; padding: 4px 9px;'

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
}: {
  snapshot: Snapshot
  onTerminal?: () => void
  onOpenPreferences: (opts?: { provider?: IntegrationProvider }) => void
}) {
  const { packageJson, readme, root } = snapshot
  const plans = snapshot.plans ?? []

  const nom = packageJson?.name ?? root.split('/').filter(Boolean).at(-1) ?? root
  const pages = snapshot.pages?.pages ?? []
  const ouverts = plansOuverts(plans).length
  const deps = stackFrom(packageJson, snapshot.whys).length
  const scan = lastScan(snapshot.scans)
  const tickets = restant(snapshot.tickets, snapshot.board)
  const plan = readme ? headings(readme) : []

  // La hauteur de l'en-tête sert deux fois : à poser le sommaire juste en
  // dessous, et à décaler les ancres pour qu'un titre visé ne se retrouve pas
  // caché derrière. Elle est mesurée plutôt que constante parce qu'un projet
  // sans description a un en-tête plus court.
  const entete = useRef<HTMLDivElement>(null)
  const boite = useRef<HTMLDivElement>(null)
  const [hauteur, setHauteur] = useState(96)
  useEffect(() => {
    setHauteur(entete.current?.offsetHeight ?? 96)
  }, [root, packageJson?.description])

  // L'état git est réévalué à chaque nouveau snapshot (changement de projet,
  // rechargement) mais mis à jour localement après un fetch — relire tout le
  // snapshot pour un champ qui change serait payer le reste du projet dessus.
  const [gitStatus, setGitStatus] = useState<GitStatus>(snapshot.gitStatus ?? EMPTY_GIT_STATUS)
  useEffect(() => {
    setGitStatus(snapshot.gitStatus ?? EMPTY_GIT_STATUS)
  }, [root, snapshot.gitStatus])

  // Le README est replié par défaut : c'est la réponse à « c'est quoi, ce
  // projet ? », pas quelque chose qu'on relit à chaque ouverture de l'onglet.
  const [readmeOpen, setReadmeOpen] = useState(false)
  const [ancreEnAttente, setAncreEnAttente] = useState<string | null>(null)

  /**
   * Amener un titre sous l'en-tête, en ne bougeant que ce cadre.
   *
   * Laisser le navigateur suivre le `#` déplaçait la fenêtre entière : la barre
   * d'onglets et la latérale sortaient de l'écran, et l'application paraissait
   * cassée. Le `href` reste posé quand même — il rend le lien copiable et
   * ouvrable au clic du milieu, ce qu'un `onClick` seul ne donne pas.
   */
  const scrollVers = (id: string) => {
    const cible = document.getElementById(id)
    const cadre = boite.current
    if (!cible || !cadre) return
    cadre.scrollTop +=
      cible.getBoundingClientRect().top - cadre.getBoundingClientRect().top - (hauteur + 14)
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
    <div ref={boite} style={s('flex: 1; display: flex; flex-direction: column; overflow: auto;')}>
      <div
        ref={entete}
        style={s(
          'position: sticky; top: 0; z-index: 2; padding: 18px 22px 12px; background: var(--color-bg); border-bottom: 1px solid var(--color-divider);',
        )}
      >
        <Illisibles entries={snapshot.illisibles ?? []} />

        <div
          style={s(
            'display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap;',
          )}
        >
          <div style={s('min-width: 0;')}>
            <h2
              style={s(
                'font-family: var(--font-heading); font-weight: 500; font-size: 22px; margin: 0 0 4px;',
              )}
            >
              {nom}
            </h2>
            <div
              style={s(
                'font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-neutral-600);',
              )}
            >
              {root}
            </div>
          </div>

          <Actions root={root} onTerminal={onTerminal} />
        </div>

        {packageJson?.description && (
          <div
            style={s(
              'font-size: 13px; color: var(--color-neutral-400); line-height: 1.6; margin-top: 10px; max-width: 820px; text-wrap: pretty;',
            )}
          >
            {packageJson.description}
          </div>
        )}

        <div style={s('display: flex; flex-wrap: wrap; gap: 10px 22px; margin-top: 14px;')}>
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
            accent={scan?.ok === false}
          />
        </div>
      </div>

      <div
        style={s(
          `display: flex; align-items: flex-start; gap: 28px; padding: 18px 22px 32px; --md-anchor: ${hauteur + 14}px;`,
        )}
      >
        <div style={s('flex: 1; min-width: 0; max-width: 820px;')}>
          <Sante snapshot={snapshot} gitStatus={gitStatus} />
          <Branches root={root} gitStatus={gitStatus} onGitStatus={setGitStatus} />
          <Environnements config={snapshot.config} gitStatus={gitStatus} />
          <Deploiements
            root={root}
            integrations={snapshot.integrations ?? []}
            onOpenPreferences={onOpenPreferences}
          />

          <div style={s('margin-top: 18px;')}>
            <Lancement packageJson={packageJson} />
          </div>

          <div style={s('margin-top: 18px;')}>
            <Titre>{t('apercu.take_away')}</Titre>
            <Obsidian root={root} />
          </div>

          <div style={s('margin-top: 24px;')}>
            <div style={s('display: flex; align-items: center; justify-content: space-between; gap: 12px;')}>
              <Titre>README.md</Titre>
              {readme && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={s(BOUTON)}
                  onClick={() => setReadmeOpen(open => !open)}
                >
                  {readmeOpen ? t('apercu.hide_readme') : t('apercu.show_readme')}
                </button>
              )}
            </div>
            {!readme && (
              <div style={s('font-size: 12.5px; color: var(--color-neutral-600);')}>
                {t('apercu.no_readme')}
              </div>
            )}
            {readme && readmeOpen && <Markdown text={readme} root={root} />}
          </div>
        </div>

        {plan.length >= 3 && <Sommaire plan={plan} top={hauteur + 14} aller={aller} />}
      </div>
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
function Actions({ root, onTerminal }: { root: string; onTerminal?: () => void }) {
  const ovrsee = pont()
  const [copie, setCopie] = useState(false)
  const [editeur, setEditeur] = useState<Editeur>(() => {
    if (typeof localStorage === 'undefined') return 'vscode'
    const garde = localStorage.getItem('ovrsee.editor')
    return EDITEURS.some(([nom]) => nom === garde) ? (garde as Editeur) : 'vscode'
  })

  return (
    <div style={s('display: flex; flex-wrap: wrap; align-items: center; gap: 6px;')}>
      {ovrsee && (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            style={s(BOUTON)}
            onClick={() => ovrsee.projects.edit(root, editeur)}
          >
            {t('apercu.open_editor')}
          </button>

          <select
            className="input"
            aria-label={t('apercu.editor')}
            value={editeur}
            onChange={event => {
              const choisi = event.target.value as Editeur
              setEditeur(choisi)
              // Une préférence d'affichage, pas un réglage du projet : elle n'a
              // rien à faire dans `ovrsee.config.json`, que git suit.
              localStorage.setItem('ovrsee.editor', choisi)
            }}
            style={s('font-size: 12px; padding: 3px 6px; min-height: 0; width: auto;')}
          >
            {EDITEURS.map(([valeur, nom]) => (
              <option key={valeur} value={valeur}>
                {nom}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            style={s(BOUTON)}
            onClick={() => ovrsee.projects.reveal(root)}
          >
            {t('apercu.reveal')}
          </button>

          {onTerminal && (
            <button type="button" className="btn btn-secondary" style={s(BOUTON)} onClick={onTerminal}>
              {t('apercu.terminal_shell')}
            </button>
          )}
        </>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        style={s(BOUTON)}
        onClick={() => {
          navigator.clipboard
            ?.writeText(root)
            .then(() => {
              setCopie(true)
              setTimeout(() => setCopie(false), 1500)
            })
            .catch(() => setCopie(false))
        }}
      >
        {copie ? t('apercu.copied') : t('apercu.copy_path')}
      </button>
    </div>
  )
}

/**
 * Le plan du README, à droite.
 *
 * Il ne paraît qu'à partir de trois titres : en dessous, une colonne entière
 * pour deux liens coûte plus de place qu'elle n'en fait gagner. Les titres de
 * quatrième niveau en sont exclus — un sommaire qui descend aussi bas cesse
 * d'être un sommaire.
 */
function Sommaire({
  plan,
  top,
  aller,
}: {
  plan: Array<{ level: number; texte: string; id: string }>
  top: number
  aller: (id: string) => void
}) {
  return (
    <nav
      aria-label={t('apercu.summary')}
      style={s(`position: sticky; top: ${top}px; width: 190px; flex: none;`)}
    >
      <Titre>{t('apercu.summary')}</Titre>
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
              'display: block; font-size: 11.5px; line-height: 1.5; margin: 4px 0; color: var(--color-neutral-500); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ' +
                (titre.level > 1 ? 'padding-left: 10px;' : ''),
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
              'font-family: ui-monospace, monospace; font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--color-neutral-800); color: var(--color-neutral-400); user-select: all;',
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

/** Un chiffre et ce qu'il compte. Sans légende, un nombre seul ne dit rien. */
function Chiffre({
  valeur,
  unite,
  legende,
  accent = false,
}: {
  valeur: number | string
  unite: string
  legende: string
  accent?: boolean
}) {
  return (
    <div>
      <div
        style={s(
          'font-size: 17px; font-weight: 500; ' +
            (accent ? 'color: var(--color-accent);' : 'color: var(--color-text);'),
        )}
      >
        {valeur}
        {unite && (
          <span style={s('font-size: 11.5px; color: var(--color-neutral-500); margin-left: 5px;')}>
            {unite}
          </span>
        )}
      </div>
      <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 2px;')}>
        {legende}
      </div>
    </div>
  )
}
