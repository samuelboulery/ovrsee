import { frDate, tablesFrom, type GraphifyGraph, type Snapshot } from '../data'
import { s } from '../style'

type Source = Snapshot['graphSource']

/**
 * D'où viennent les lignes. Le badge ne doit jamais nommer la mauvaise source,
 * ni laisser croire qu'une déclaration manuscrite a été lue dans le code.
 */
const PROVENANCE: Record<'graphify' | 'obsidian', { badge: string; intro: string }> = {
  graphify: {
    badge: 'lu depuis Graphify',
    intro: 'Introspection reconstruite à chaque commit. Le cockpit ne recalcule rien.',
  },
  obsidian: {
    badge: 'déclaré dans le coffre Obsidian',
    intro:
      'Ces lignes sont déclarées à la main dans les notes « type: table » du coffre : elles disent ce que leur auteur a écrit, pas ce que le code contient. La date de chacune est la seule chose qui permette d’en juger.',
  },
}

/**
 * Ce qu'on dit quand il n'y a aucune ligne.
 *
 * Trois situations distinctes, trois textes : une source lue qui ne contient
 * pas de schéma n'est pas une absence de source, et confondre les deux
 * laisserait chercher une panne là où il n'y en a pas.
 */
function vide(source: Source): { titre: string; detail: string } {
  if (source === 'obsidian') {
    return {
      titre: 'Aucune note « type: table » dans le coffre.',
      detail:
        'Une note devient une table quand son frontmatter porte `type: table`. Ses colonnes se déclarent dans `columns`, sa date de mise à jour dans `maj`, et les notes qui la citent en wikilink en deviennent les usages.',
    }
  }
  if (source === 'graphify') {
    return {
      titre: 'Aucun schéma de base détecté par Graphify dans ce projet.',
      detail: 'Ce n’est pas une panne : ce projet n’a pas de base à cartographier.',
    }
  }
  return {
    titre: 'Aucune source de graphe pour ce projet.',
    detail:
      'Lancer Graphify, ou désigner un coffre Obsidian avec le champ `obsidianVault` de `cockpit.config.json`.',
  }
}

/**
 * Alerte quand la source demandee manque.
 */
function SourceAlert({
  sourceRequested,
  config,
}: {
  sourceRequested?: string
  config: { obsidianVault?: string } | null
}) {
  if (!sourceRequested || sourceRequested === 'auto') return null

  if (sourceRequested === 'graphify') {
    return (
      <div
        style={s(
          'background: var(--theme-bg-alerte); border: 1px solid var(--color-warning-600); border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 12px; color: var(--color-warning-200);',
        )}
      >
        <div style={s('font-weight: 500; margin-bottom: 6px;')}>Graphify absent</div>
        <div style={s('color: var(--color-warning-300);')}>
          Le graphe n'a pas encore ete genere. Utilise le bouton du terminal integre pour
          creer le graphe a partir du code source.
        </div>
      </div>
    )
  }

  if (sourceRequested === 'obsidian') {
    if (!config?.obsidianVault) {
      return (
        <div
          style={s(
            'background: var(--theme-bg-alerte); border: 1px solid var(--color-warning-600); border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 12px; color: var(--color-warning-200);',
          )}
        >
          <div style={s('font-weight: 500; margin-bottom: 6px;')}>Coffre Obsidian non configure</div>
          <div style={s('color: var(--color-warning-300);')}>
            Ajoute le champ <code>obsidianVault</code> a <code>cockpit.config.json</code> pour designer le chemin du
            coffre.
          </div>
        </div>
      )
    }

    return (
      <div
        style={s(
          'background: var(--theme-bg-alerte); border: 1px solid var(--color-warning-600); border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 12px; color: var(--color-warning-200);',
        )}
      >
        <div style={s('font-weight: 500; margin-bottom: 6px;')}>Coffre Obsidian illisible</div>
        <div style={s('color: var(--color-warning-300);')}>
          Le chemin <code>{config.obsidianVault}</code> n'existe pas ou n'est pas accessible. Verifie l'existence du
          dossier et les permissions.
        </div>
      </div>
    )
  }

  return null
}

/** Une table sans date le dit. C'est une information, pas un trou d'affichage. */
const NON_DATE =
  'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-400); border: 1px dashed var(--color-neutral-600);'

/**
 * Un `obsidianVault` déclaré que Graphify supplante.
 *
 * Le cadrage écarte de reconstruire la vue base de données parce que Graphify
 * la fait mieux et à jour à chaque commit ; un coffre écrit à la main ne peut
 * donc pas primer sur lui. Reste à ne pas laisser le champ sans effet visible.
 */
function CoffreIgnore() {
  return (
    <div
      style={s(
        'font-size: 11px; color: var(--color-neutral-500); margin-bottom: 18px; padding-left: 10px; border-left: 1px solid var(--color-neutral-700);',
      )}
    >
      Un coffre Obsidian est déclaré dans <code>cockpit.config.json</code>, mais il n’est pas
      lu : Graphify a produit un graphe, et il vient du code plutôt que d’une saisie. Retirer
      <code> graphify-out/</code> pour lire le coffre à la place.
    </div>
  )
}

function confStyle(conf: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'): string {
  const styles = {
    EXTRACTED: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-accent-200); border: 1px solid var(--color-accent-700);',
    INFERRED: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-300); border: 1px solid var(--color-neutral-700);',
    AMBIGUOUS: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-400); border: 1px dashed var(--color-neutral-600);',
  }
  return styles[conf]
}

export function Donnees({
  graph,
  source,
  sourceRequested,
  sourceMissing,
  sourceDate,
  vaultDeclared = false,
  config = null,
}: {
  graph: GraphifyGraph | null
  source: Source
  sourceRequested?: string
  sourceMissing?: boolean
  sourceDate?: string | null
  vaultDeclared?: boolean
  config?: { obsidianVault?: string } | null
}) {
  const tables = tablesFrom(graph)
  const provenance = source ? PROVENANCE[source] : null
  const rien = vide(source)
  // Un champ de config sans effet visible se lit comme une panne. On dit
  // pourquoi il ne sert pas plutôt que de laisser chercher.
  const coffreIgnore = vaultDeclared && source === 'graphify'

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
        <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
          Tables
        </h2>
        {provenance && (
          <span className="tag tag-accent" style={s('font-size: 10.5px;')}>
            {provenance.badge}
            {sourceDate && ` — ${sourceDate}`}
          </span>
        )}
      </div>

      {sourceMissing && <SourceAlert sourceRequested={sourceRequested} config={config} />}

      {tables.length === 0 ? (
        <div>
          <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 18px;')}>
            {rien.titre}
          </div>
          <div style={s('font-size: 11px;')}>{rien.detail}</div>
          {coffreIgnore && <CoffreIgnore />}
        </div>
      ) : (
        <div>
          <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 18px;')}>
            {provenance?.intro}
          </div>
          {coffreIgnore && <CoffreIgnore />}
          <table className="table" style={s('width: 100%; font-size: 12.5px;')}>
            <thead>
              <tr>
                <th>Table</th>
                <th>Colonnes</th>
                <th>Utilisée par</th>
                <th>{source === 'obsidian' ? 'Déclaré' : 'Confiance'}</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.name}>
                  <td style={s('font-family: ui-monospace, monospace;')}>{t.name}</td>
                  <td style={s('color: var(--color-neutral-500);')}>{t.cols}</td>
                  <td style={s('color: var(--color-neutral-400);')}>{t.used}</td>
                  <td>
                    {/* `declared` posé — même à null — signe une ligne du coffre.
                        Elle n'a pas de confiance à afficher : elle a une date, ou
                        l'aveu qu'elle n'en a pas. */}
                    {t.declared === undefined ? (
                      <span style={s(confStyle(t.conf))}>{t.conf}</span>
                    ) : t.declared ? (
                      <span style={s('color: var(--color-neutral-400);')}>{frDate(t.declared)}</span>
                    ) : (
                      <span style={s(NON_DATE)}>non daté</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
