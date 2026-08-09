import {
  frDate,
  humanAge,
  lastScan,
  plansOuverts,
  restant,
  stackFrom,
  type Snapshot,
} from '../data'
import { Markdown } from '../markdown'
import { s } from '../style'

/** « 0 ticket », « 1 ticket », « 2 tickets » — l'accord du français. */
const pluriel = (n: number, mot: string) => (n > 1 ? `${mot}s` : mot)

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
 */
export function Apercu({ snapshot }: { snapshot: Snapshot }) {
  const { packageJson, plans, readme, root } = snapshot

  const nom = packageJson?.name ?? root.split('/').filter(Boolean).at(-1) ?? root
  const pages = snapshot.pages?.pages ?? []
  const ouverts = plansOuverts(plans).length
  const deps = stackFrom(packageJson, plans).length
  const scan = lastScan(snapshot.scans)
  const tickets = restant(snapshot.tickets, snapshot.board)

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

  // La dernière activité vient de la frise, pas des plans : un commit hors plan
  // est du travail lui aussi, et le passer sous silence ferait paraître un
  // projet actif à l'abandon.
  const derniere = snapshot.timeline?.[0]?.date ?? null

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <div style={s('max-width: 820px;')}>
        <h1
          style={s(
            'font-family: var(--font-heading); font-weight: 500; font-size: 22px; margin: 0 0 4px;',
          )}
        >
          {nom}
        </h1>
        <div
          style={s(
            'font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-neutral-600);',
          )}
        >
          {root}
        </div>
        {packageJson?.description && (
          <div
            style={s(
              'font-size: 13px; color: var(--color-neutral-400); line-height: 1.6; margin-top: 10px; text-wrap: pretty;',
            )}
          >
            {packageJson.description}
          </div>
        )}

        <div
          style={s(
            'display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 0; padding: 14px 16px; border: 1px solid var(--color-neutral-800); border-radius: 8px; background: var(--color-surface);',
          )}
        >
          <Chiffre
            valeur={pages.length}
            unite={pluriel(pages.length, 'page')}
            legende={pluriel(pages.length, 'cartographiée')}
          />
          <Chiffre
            valeur={plans.length}
            unite={pluriel(plans.length, 'plan')}
            legende={ouverts > 0 ? `dont ${ouverts} ouvert${ouverts > 1 ? 's' : ''}` : 'tous clos'}
            accent={ouverts > 0}
          />
          <Chiffre valeur={tickets} unite={pluriel(tickets, 'ticket')} legende="à faire" />
          <Chiffre
            valeur={deps}
            unite={pluriel(deps, 'dépendance')}
            legende={pluriel(deps, 'déclarée')}
          />
          <Chiffre
            valeur={humanAge(derniere)}
            unite=""
            legende="dernière activité"
          />
          <Chiffre
            valeur={scan ? frDate(scan.date) : '—'}
            unite=""
            legende={scan ? (scan.ok ? 'dernier scan' : 'scan échoué') : 'aucun scan'}
            accent={scan?.ok === false}
          />
        </div>

        {scripts.length > 0 && (
          <div style={s('margin-top: 18px;')}>
            <Titre>Comment on le lance</Titre>
            <div style={s('display: flex; flex-wrap: wrap; gap: 6px;')}>
              {scripts.map(script => (
                // Du texte, pas un bouton. Le cockpit lit ; il n'exécute que le
                // terminal qu'on lui demande — un bouton qui lance `package`
                // depuis une vue de lecture serait un piège.
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
        )}

        <div style={s('margin-top: 24px;')}>
          <Titre>README.md</Titre>
          {readme ? (
            <Markdown text={readme} />
          ) : (
            <div style={s('font-size: 12.5px; color: var(--color-neutral-600);')}>
              Ce dépôt n'a pas de <code style={s('font-family: ui-monospace, monospace;')}>README.md</code> à sa
              racine. Le cockpit n'en fabrique pas : ce qu'il afficherait serait inventé.
            </div>
          )}
        </div>
      </div>
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
    <div style={s('min-width: 118px;')}>
      <div
        style={s(
          'font-size: 17px; font-weight: 500; ' +
            (accent ? 'color: var(--color-accent-200);' : 'color: var(--color-text);'),
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
