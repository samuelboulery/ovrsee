import type { Illisible } from './data'
import { s } from './style'

/**
 * Les fichiers de `ovrsee/` que la lecture n'a pas su ouvrir.
 *
 * Le crawl inscrit ses échecs — « scan échoué le X » plutôt que la capture
 * précédente présentée comme fraîche. La lecture, elle, avalait les siens : un
 * ticket au frontmatter cassé rendait un tableau vide, indistinguable d'un
 * projet sans tickets. C'est le même mensonge, du côté lecture.
 *
 * Le bandeau ne propose pas de réparer : l'ovrsee lit, il n'écrit pas dans
 * `ovrsee/plans/`. Il nomme le fichier, ce qui suffit à l'ouvrir.
 */
export function Illisibles({ entries, quoi }: { entries: Illisible[]; quoi?: string }) {
  const listés = quoi ? entries.filter(e => e.quoi === quoi) : entries
  if (listés.length === 0) return null

  return (
    <div
      role="status"
      style={s(
        'flex: none; margin-bottom: 14px; padding: 9px 12px; border-radius: 6px; border: 1px solid #3a3117; background: #1a1608;',
      )}
    >
      <div style={s('font-size: 11.5px; color: #e3b341; margin-bottom: 4px;')}>
        {listés.length === 1
          ? '1 fichier de ovrsee/ existe mais ne se lit pas.'
          : `${listés.length} fichiers de ovrsee/ existent mais ne se lisent pas.`}
      </div>
      {listés.map(entry => (
        <div
          key={entry.file}
          style={s('font-family: var(--font-mono); font-size: 11px; color: #e3b341;')}
        >
          ovrsee/{entry.file}
          {entry.lignes
            ? ` — ${entry.lignes} ligne${entry.lignes > 1 ? 's perdues' : ' perdue'}`
            : ''}
        </div>
      ))}
    </div>
  )
}
