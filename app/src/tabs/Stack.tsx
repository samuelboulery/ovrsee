import { stackFrom, type Snapshot } from '../data'
import { s } from '../style'

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
  const rows = stackFrom(snapshot.packageJson, snapshot.whys)
  const tracees = rows.filter(row => row.why).length

  return (
    <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
      <h2
        style={s(
          'font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;',
        )}
      >
        Stack
      </h2>
      <div style={s('font-size: 12px; color: var(--color-neutral-600); margin-bottom: 20px;')}>
        Ce qui est utilisé, et pourquoi. Une raison est un commentaire{' '}
        <span style={s('font-family: ui-monospace, monospace;')}>WHY:</span> posé juste au-dessus de
        l'import du paquet — rien d'autre n'est lu, pour qu'aucune ligne ne dise du faux.
        {rows.length > 0 && ` ${tracees} sur ${rows.length} en ont une.`}
      </div>
      {rows.length === 0 ? (
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          Aucune dépendance déclarée dans package.json.
        </div>
      ) : (
        <div style={s('display: flex; flex-direction: column; gap: 10px; max-width: 780px;')}>
          {rows.map(row => (
            <div
              key={row.name}
              style={s(
                'display: grid; grid-template-columns: 190px 1fr; gap: 18px; align-items: start; border: 1px solid var(--color-neutral-800); border-radius: 8px; padding: 13px 15px; background: var(--color-surface);',
              )}
            >
              <div>
                <div style={s('font-size: 13.5px; font-weight: 500;')}>{row.name}</div>
                <div
                  style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 3px;')}
                >
                  {row.version}
                </div>
              </div>
              <div
                style={s(
                  `font-size: 12.5px; line-height: 1.55; text-wrap: pretty; color: ${
                    row.why ? 'var(--color-neutral-400)' : 'var(--color-neutral-600)'
                  };`,
                )}
              >
                {row.why ?? (
                  <>
                    Aucune raison écrite. Un commentaire{' '}
                    <span style={s('font-family: ui-monospace, monospace;')}>
                      WHY: …
                    </span>{' '}
                    au-dessus de son import apparaîtra ici.
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
