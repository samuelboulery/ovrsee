import { frDate, tablesFrom, type GraphifyGraph, type Snapshot } from '../data'
import { t } from '../i18n'
import { s } from '../style'

type Source = Snapshot['graphSource']

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
      titre: t('donnees.no_obsidian_note'),
      detail: t('donnees.obsidian_note_detail'),
    }
  }
  if (source === 'graphify') {
    return {
      titre: t('donnees.no_graphify_schema'),
      detail: t('donnees.no_graphify_detail'),
    }
  }
  return {
    titre: t('donnees.no_graph_source'),
    detail: t('donnees.no_graph_source_detail'),
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
        <div style={s('font-weight: 500; margin-bottom: 6px;')}>{t('donnees.graphify_missing_title')}</div>
        <div style={s('color: var(--color-warning-300);')}>
          {t('donnees.graphify_missing')}
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
          <div style={s('font-weight: 500; margin-bottom: 6px;')}>{t('donnees.obsidian_unconfigured_title')}</div>
          <div style={s('color: var(--color-warning-300);')}>
            {t('donnees.obsidian_unconfigured')}
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
        <div style={s('font-weight: 500; margin-bottom: 6px;')}>{t('donnees.obsidian_unreadable_title')}</div>
        <div style={s('color: var(--color-warning-300);')}>
          {t('donnees.obsidian_unreadable')} <code>{config.obsidianVault}</code>
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
      {t('donnees.vault_ignored')}
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
  const PROVENANCE: Record<'graphify' | 'obsidian', { badge: string; intro: string }> = {
    graphify: {
      badge: t('donnees.from_graphify'),
      intro: t('donnees.graphify_intro'),
    },
    obsidian: {
      badge: t('donnees.from_obsidian'),
      intro: t('donnees.obsidian_intro'),
    },
  }

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
          {t('donnees.title')}
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
                <th>{t('donnees.col_header')}</th>
                <th>{t('donnees.used_header')}</th>
                <th>{source === 'obsidian' ? t('donnees.declared_header') : t('donnees.confidence_header')}</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.name}>
                  <td style={s('font-family: ui-monospace, monospace;')}>{table.name}</td>
                  <td style={s('color: var(--color-neutral-500);')}>{table.cols}</td>
                  <td style={s('color: var(--color-neutral-400);')}>{table.used}</td>
                  <td>
                    {/* `declared` posé — même à null — signe une ligne du coffre.
                        Elle n'a pas de confiance à afficher : elle a une date, ou
                        l'aveu qu'elle n'en a pas. */}
                    {table.declared === undefined ? (
                      <span style={s(confStyle(table.conf))}>{table.conf}</span>
                    ) : table.declared ? (
                      <span style={s('color: var(--color-neutral-400);')}>{frDate(table.declared)}</span>
                    ) : (
                      <span style={s(NON_DATE)}>{t('donnees.no_date')}</span>
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
