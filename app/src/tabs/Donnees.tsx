import { useState } from 'react'
import { Database } from '@phosphor-icons/react'

import { frDate, tablesFrom, type GraphifyGraph, type Integration, type SchemaTable, type Snapshot } from '../data'
import { t } from '../i18n'
import { s } from '../style'
import type { IntegrationsBridge } from '../useTerminal'

/**
 * Lu directement sur `window`, sans importer `useTerminal.ts` : ce module
 * charge `@xterm/xterm` (et sa feuille de style), absent du rendu serveur des
 * tests (`render.test.tsx`). Seul le *type* du pont est importé — effacé à la
 * compilation.
 */
const bridge = (): IntegrationsBridge | null => {
  if (typeof window === 'undefined') return null
  return window.ovrsee?.integrations ?? null
}

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

/** La commande qui produit une source de graphe, identique à celle de la palette ⌘K. */
const COMMANDE_GRAPHIFY = '/graphify . --obsidian --obsidian-dir ovrsee/obsidian/graphe'

/**
 * L'état vide, avec pictogramme — aucune ligne à montrer n'est pas une
 * absence de mise en page (maquette 2g).
 */
function EtatVide({ titre, detail, source }: { titre: string; detail: string; source: Source }) {
  const [copie, setCopie] = useState(false)

  return (
    <div style={s('display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 20px; gap: 14px;')}>
      <Database size={40} weight="regular" color="var(--color-text-quaternary)" aria-hidden="true" />
      <div style={s('font-family: var(--font-heading); font-weight: 600; font-size: 15px; color: var(--color-text);')}>
        {titre}
      </div>
      <div style={s('max-width: 46ch; font-size: 12.5px; line-height: 1.5; color: var(--color-neutral-500);')}>
        {detail}
      </div>
      {source === null && (
        <div style={s('display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 6px;')}>
          <code
            style={s(
              'font-family: var(--font-mono); font-size: 11.5px; color: var(--color-accent-500); background: var(--color-surface-control); border: 1px solid var(--color-divider); border-radius: var(--radius-md); padding: 8px 12px;',
            )}
          >
            {COMMANDE_GRAPHIFY}
          </code>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard
                ?.writeText(COMMANDE_GRAPHIFY)
                .then(() => {
                  setCopie(true)
                  setTimeout(() => setCopie(false), 1500)
                })
                .catch(() => setCopie(false))
            }}
          >
            {copie ? t('apercu.copied') : t('donnees.copy_command')}
          </button>
        </div>
      )}
    </div>
  )
}

function confStyle(conf: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS' | 'LIVE'): string {
  const styles = {
    EXTRACTED: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-accent); border: 1px solid var(--color-accent-700);',
    INFERRED: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-300); border: 1px solid var(--color-neutral-700);',
    AMBIGUOUS: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-400); border: 1px dashed var(--color-neutral-600);',
    // Vérifiée en direct sur la base elle-même, pas déduite du code : le
    // second accent du design system (`--color-accent-2-*`) la distingue des
    // trois confiances ci-dessus, qui restent des lectures de Graphify.
    LIVE: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-accent-2); border: 1px solid var(--color-accent-2-700);',
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
  root,
  integrations = [],
}: {
  graph: GraphifyGraph | null
  source: Source
  sourceRequested?: string
  sourceMissing?: boolean
  sourceDate?: string | null
  vaultDeclared?: boolean
  config?: { obsidianVault?: string } | null
  root?: string
  integrations?: Integration[]
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

  // Une seule intégration Supabase suffit à activer le bouton : le schéma
  // n'a pas de sens pour plusieurs bases à la fois, et v1 ne cherche pas à
  // les distinguer.
  const supabase = integrations.find(integ => integ.provider === 'supabase' && integ.hasToken)
  const ovrsee = bridge()
  const [liveTables, setLiveTables] = useState<string[] | null>(null)
  const [liveOnly, setLiveOnly] = useState<string[]>([])
  const [liveSchema, setLiveSchema] = useState<SchemaTable[] | null>(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveErreur, setLiveErreur] = useState<string | null>(null)

  const verifierSchema = () => {
    if (!ovrsee || !root || !supabase) return
    setLiveBusy(true)
    setLiveErreur(null)
    ovrsee
      .fetchSchema(root, supabase.id)
      .then(result => {
        if ('error' in result) {
          setLiveErreur(result.error)
          return
        }
        const noms = result.tables.map(table => table.name)
        const connues = new Set(tables.map(table => table.name))
        setLiveTables(noms)
        setLiveOnly(noms.filter(nom => !connues.has(nom)))
        setLiveSchema(result.tables)
      })
      .finally(() => setLiveBusy(false))
  }

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
        <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
          {t('donnees.title')}
        </h2>
        {provenance && (
          <span
            className="tag"
            style={s('font-size: 10.5px; color: #a49dfa; background: #14132a; border: 1px solid #2a2660;')}
          >
            {provenance.badge}
            {sourceDate && ` — ${sourceDate}`}
          </span>
        )}
        {supabase && (
          <button
            type="button"
            className="btn btn-secondary"
            style={s('font-size: 11.5px; padding: 3px 9px; margin-left: auto;')}
            disabled={!ovrsee || liveBusy}
            title={ovrsee ? undefined : t('deploiements.electron_only')}
            onClick={verifierSchema}
          >
            {liveBusy ? t('donnees.live_checking') : t('donnees.live_check')}
          </button>
        )}
      </div>

      {sourceMissing && <SourceAlert sourceRequested={sourceRequested} config={config} />}

      {liveErreur && (
        <div
          style={s(
            'margin-bottom: 16px; font-size: 12px; color: var(--color-accent); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;',
          )}
        >
          {liveErreur}
        </div>
      )}

      {tables.length === 0 ? (
        <div>
          <EtatVide titre={rien.titre} detail={rien.detail} source={source} />
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
                  <td style={s('font-family: var(--font-mono);')}>{table.name}</td>
                  <td style={s('color: var(--color-neutral-500);')}>{table.cols}</td>
                  <td style={s('color: var(--color-neutral-400);')}>{table.used}</td>
                  <td>
                    {/* Une table confirmée en direct l'emporte sur la confiance
                        déduite du code : la base elle-même est la vérité. */}
                    {liveTables?.includes(table.name) ? (
                      <span style={s(confStyle('LIVE'))}>{t('donnees.live_badge')}</span>
                    ) : /* `declared` posé — même à null — signe une ligne du coffre.
                        Elle n'a pas de confiance à afficher : elle a une date, ou
                        l'aveu qu'elle n'en a pas. */
                    table.declared === undefined ? (
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

          {liveOnly.length > 0 && (
            <div
              style={s(
                'margin-top: 16px; font-size: 11.5px; color: var(--color-neutral-500); padding-left: 10px; border-left: 1px solid var(--color-neutral-700);',
              )}
            >
              {t('donnees.live_only', { tables: liveOnly.join(', ') })}
            </div>
          )}
        </div>
      )}

      {liveSchema && liveSchema.length > 0 && <LiveSchema tables={liveSchema} />}
    </div>
  )
}

/**
 * Le schéma tel que la base le voit, distincte de la table lue depuis
 * Graphify au-dessus : PK et FK n'existent nulle part dans le code source,
 * seulement dans la base — Graphify ne peut donc pas les fournir.
 */
function LiveSchema({ tables }: { tables: SchemaTable[] }) {
  return (
    <div style={s('margin-top: 28px;')}>
      <div style={s('display: flex; align-items: center; gap: 8px; margin-bottom: 12px;')}>
        <h3 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 14px; margin: 0;')}>
          {t('donnees.schema_title')}
        </h3>
        <span style={s(confStyle('LIVE'))}>{t('donnees.live_badge')}</span>
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 16px;')}>
        {tables.map(table => (
          <div key={table.name} style={s('border: 1px solid var(--color-divider); border-radius: 6px; overflow: hidden;')}>
            <div
              style={s(
                'font-family: var(--font-mono); font-size: 12.5px; padding: 7px 11px; background: var(--theme-bg-secondary); border-bottom: 1px solid var(--color-divider);',
              )}
            >
              {table.name}
            </div>
            <table className="table" style={s('width: 100%; font-size: 12px;')}>
              <thead>
                <tr>
                  <th>{t('donnees.schema_column')}</th>
                  <th>{t('donnees.schema_type')}</th>
                  <th>{t('donnees.schema_key')}</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map(column => (
                  <tr key={column.name}>
                    <td style={s('font-family: var(--font-mono);')}>{column.name}</td>
                    <td style={s('color: var(--color-neutral-500);')}>{column.type}</td>
                    <td>
                      {column.pk && (
                        <span
                          style={s(
                            'font-size: 10px; padding: 1px 6px; border-radius: 999px; color: var(--color-accent); border: 1px solid var(--color-accent-700); margin-right: 5px;',
                          )}
                        >
                          {t('donnees.schema_pk')}
                        </span>
                      )}
                      {column.fk && (
                        <span style={s('font-size: 11px; color: var(--color-neutral-500); font-family: var(--font-mono);')}>
                          → {column.fk}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
