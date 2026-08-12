import { useState } from 'react'

import { stackFrom, type StackRow, type Snapshot } from '../data'
import { t } from '../i18n'
import { s } from '../style'

type Filtre = 'toutes' | 'production' | 'sans_raison'

/** Une dépendance : nom, version, et la raison si `WHY:` en donne une. */
function Carte({ row, colonneLarge }: { row: StackRow; colonneLarge: boolean }) {
  return (
    <div
      style={s(
        `display: grid; grid-template-columns: ${colonneLarge ? 190 : 170}px 1fr; gap: 18px; align-items: start; border: 1px solid var(--color-divider); border-radius: 9px; padding: 13px 15px; background: var(--color-surface-card);`,
      )}
    >
      <div>
        <div style={s('font-size: 13px; font-weight: 500;')}>{row.name}</div>
        <div style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral-600); margin-top: 3px;')}>
          {row.version}
        </div>
      </div>
      <div
        style={s(
          `font-size: 12px; line-height: 1.5; text-wrap: pretty; color: ${
            row.why ? 'var(--color-neutral-400)' : 'var(--color-neutral-600)'
          };`,
        )}
      >
        {row.why ?? t('stack.no_why')}
      </div>
    </div>
  )
}

/** Une colonne groupée (Production ou Développement), avec son décompte. */
function Colonne({ titre, rows }: { titre: string; rows: StackRow[] }) {
  if (rows.length === 0) return null

  return (
    <div style={s('flex: 1; min-width: 0;')}>
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 10px;',
        )}
      >
        {titre} · {rows.length}
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
        {rows.map(row => (
          <Carte key={row.name} row={row} colonneLarge={!row.dev} />
        ))}
      </div>
    </div>
  )
}

/**
 * Onglet Stack — les dépendances déclarées, et pourquoi.
 *
 * « Pourquoi » veut dire une seule chose : un commentaire `WHY:` posé au-dessus
 * de l'import du paquet. L'onglet annonçait déjà cette source ; il affichait en
 * réalité le dernier plan dont le corps contenait le nom du paquet, ce qui
 * transformait n'importe quelle mention en justification. Une ligne « aucune
 * raison écrite » est honnête ; une fausse raison ne l'est pas.
 */
export function Stack({ snapshot }: { snapshot: Snapshot }) {
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const rows = stackFrom(snapshot.packageJson, snapshot.whys)
  const tracees = rows.filter(row => row.why).length

  const filtrees = rows.filter(row => {
    if (filtre === 'production') return !row.dev
    if (filtre === 'sans_raison') return !row.why
    return true
  })

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <div style={s('display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px;')}>
        <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0;')}>
          Stack
        </h2>
        {rows.length > 0 && (
          <div className="seg" style={s('margin-left: auto; font-size: 12px;')}>
            {(
              [
                ['toutes', t('stack.filter_all')],
                ['production', t('stack.filter_production')],
                ['sans_raison', t('stack.filter_no_reason')],
              ] as const
            ).map(([valeur, label]) => (
              <label key={valeur} className="seg-opt">
                <input
                  type="radio"
                  name="stack-filtre"
                  checked={filtre === valeur}
                  onChange={() => setFiltre(valeur)}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 10px;')}>
        {t('stack.why_subtitle')}
      </div>

      {rows.length > 0 && (
        <div style={s('margin-bottom: 22px;')}>
          <div
            style={s(
              'height: 4px; border-radius: 999px; background: var(--color-surface-control); overflow: hidden;',
            )}
          >
            <div
              style={s(
                `height: 100%; border-radius: 999px; background: var(--color-accent); width: ${(tracees / rows.length) * 100}%;`,
              )}
            />
          </div>
          <div style={s('font-size: 11.5px; color: var(--color-neutral-500); margin-top: 6px;')}>
            {tracees} {t('stack.of_stack_prefix')} {rows.length} {t('stack.of_stack')}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          {t('stack.no_dependencies')}
        </div>
      ) : (
        <div style={s('display: flex; gap: 28px; flex-wrap: wrap;')}>
          <Colonne titre={t('stack.production')} rows={filtrees.filter(row => !row.dev)} />
          <Colonne titre={t('stack.development')} rows={filtrees.filter(row => row.dev)} />
        </div>
      )}
    </div>
  )
}
