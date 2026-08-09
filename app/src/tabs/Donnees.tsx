import { tablesFrom, type GraphifyGraph } from '../data'
import { s } from '../style'

function confStyle(conf: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'): string {
  const styles = {
    EXTRACTED: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-accent-200); border: 1px solid var(--color-accent-700);',
    INFERRED: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-300); border: 1px solid var(--color-neutral-700);',
    AMBIGUOUS: 'font-size: 10.5px; padding: 2px 7px; border-radius: 999px; color: var(--color-neutral-400); border: 1px dashed var(--color-neutral-600);',
  }
  return styles[conf]
}

export function Donnees({ graph }: { graph: GraphifyGraph | null }) {
  const tables = tablesFrom(graph)

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
        <h2 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
          Tables
        </h2>
        <span className="tag tag-accent" style={s('font-size: 10.5px;')}>
          lu depuis Graphify
        </span>
      </div>

      {tables.length === 0 ? (
        <div>
          <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 18px;')}>
            Aucun schéma de base détecté par Graphify dans ce projet.
          </div>
          <div style={s('font-size: 11px;')}>
            Ce n'est pas une panne : ce projet n'a pas de base à cartographier.
          </div>
        </div>
      ) : (
        <div>
          <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 18px;')}>
            Introspection PostgreSQL, reconstruite à chaque commit. Le cockpit ne recalcule rien.
          </div>
          <table className="table" style={s('width: 100%; font-size: 12.5px;')}>
            <thead>
              <tr>
                <th>Table</th>
                <th>Colonnes</th>
                <th>Utilisée par</th>
                <th>Confiance</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.name}>
                  <td style={s('font-family: ui-monospace, monospace;')}>{t.name}</td>
                  <td style={s('color: var(--color-neutral-500);')}>{t.cols}</td>
                  <td style={s('color: var(--color-neutral-400);')}>{t.used}</td>
                  <td>
                    <span style={s(confStyle(t.conf))}>{t.conf}</span>
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
