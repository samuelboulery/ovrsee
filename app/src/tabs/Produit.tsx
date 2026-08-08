import { useState } from 'react'

import {
  ANCHOR_Y,
  CARD_W,
  frDate,
  frDateShort,
  humanAge,
  lastScan,
  layoutGraph,
  pageName,
  plansForPage,
  scanFailed,
  shotDate,
  shotUrl,
  type Page,
  type Placed,
  type Snapshot,
} from '../data'
import { s, useHover } from '../style'
import type { Layout } from '../Terminal'

/** Onglet Produit — maquette l. 85-274. */
export function Produit({ snapshot, layout }: { snapshot: Snapshot; layout: Layout }) {
  const pages = snapshot.pages?.pages ?? []
  const redirects = snapshot.pages?.redirects ?? {}
  const orphans = snapshot.pages?.orphanShots ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)

  const { placed, width, height } = layoutGraph(pages)
  const current = pages.find(p => p.route === selected) ?? pages[0] ?? null
  const linkCount = pages.reduce((total, page) => total + page.links.length, 0)
  const failed = scanFailed(snapshot.scans)

  const side = layout === 'side'

  if (pages.length === 0) {
    return (
      <div style={s('flex: 1; padding: 20px 22px; overflow: auto;')}>
        <h1 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0 0 4px;')}>
          Graphe de navigation
        </h1>
        <div style={s('font-size: 12px; color: var(--color-neutral-600);')}>
          Aucune page cartographiée. Le crawl tourne au commit — lancez-le une fois avec{' '}
          <span style={s('font-family: ui-monospace, monospace;')}>node crawl/index.js</span>.
        </div>
      </div>
    )
  }

  return (
    <div style={s('flex: 1; display: flex; min-width: 0; position: relative;')}>
      <div style={s('flex: 1; padding: 20px 22px; overflow: auto; min-width: 0;')}>
        <div style={s('display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px;')}>
          <h1 style={s('font-family: var(--font-heading); font-weight: 500; font-size: 19px; margin: 0;')}>
            Graphe de navigation
          </h1>
          <span style={s('font-size: 12px; color: var(--color-neutral-500);')}>
            {pages.length} page{pages.length > 1 ? 's' : ''} · {linkCount} lien
            {linkCount > 1 ? 's' : ''} · reconstruit au commit
          </span>
        </div>

        <Legend />

        {failed && (
          <div
            style={s(
              'display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 8px 11px; border-radius: 6px; background: var(--color-accent-900); border: 1px solid var(--color-accent-800); font-size: 12px; color: var(--color-accent-200);',
            )}
          >
            Dernier scan échoué le {frDate(lastScan(snapshot.scans)?.date)} — les captures ci-dessous
            sont plus anciennes que le dernier commit.
          </div>
        )}

        <div style={s(side ? `width: ${width * 0.82}px; height: ${height * 0.82}px;` : `width: ${width}px; height: ${height}px;`)}>
          <div
            style={s(
              side
                ? `position: relative; width: ${width}px; height: ${height}px; transform: scale(0.82); transform-origin: top left;`
                : `position: relative; width: ${width}px; height: ${height}px;`,
            )}
          >
            <Edges placed={placed} width={width} height={height} />
            {placed.map(item => (
              <PageCard
                key={item.page.route}
                item={item}
                pages={pages}
                snapshot={snapshot}
                isEntry={item.depth === 0}
                onPick={() =>
                  setSelected(prev => {
                    if (prev === item.page.route && panel) {
                      setPanel(false)
                      return prev
                    }
                    setPanel(true)
                    return item.page.route
                  })
                }
              />
            ))}
          </div>
        </div>

        {Object.keys(redirects).length > 0 && <Redirects redirects={redirects} />}
        {orphans.length > 0 && <Orphans slugs={orphans} />}
      </div>

      {panel && current ? (
        <DetailPanel
          page={current}
          pages={pages}
          snapshot={snapshot}
          side={side}
          onClose={() => setPanel(false)}
        />
      ) : (
        <div
          style={s(
            side
              ? 'position: absolute; top: 0; right: 0; bottom: 0; width: 42px; border-left: 1px solid var(--color-divider); background: #13141f; display: flex; justify-content: center; padding-top: 16px; z-index: 5;'
              : 'width: 42px; flex: none; border-left: 1px solid var(--color-divider); background: #13141f; display: flex; justify-content: center; padding-top: 16px;',
          )}
        >
          <button
            type="button"
            onClick={() => setPanel(true)}
            style={s(
              'background: transparent; border: 1px solid var(--color-neutral-800); border-radius: 6px; color: var(--color-neutral-400); cursor: pointer; font-family: var(--font-body); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; padding: 12px 5px; writing-mode: vertical-rl;',
            )}
          >
            Détail de la page
          </button>
        </div>
      )}
    </div>
  )
}

function Legend() {
  return (
    <div
      style={s(
        'display: flex; gap: 16px; margin: 8px 0 16px; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);',
      )}
    >
      <span style={s('display: flex; align-items: center; gap: 6px;')}>
        <span style={s('width: 20px; height: 1px; background: var(--color-accent); display: block;')} />
        lien direct
      </span>
      <span style={s('display: flex; align-items: center; gap: 6px;')}>
        <span style={s('width: 20px; height: 0; border-top: 1px dashed var(--color-neutral-600); display: block;')} />
        retour
      </span>
      <span style={s('display: flex; align-items: center; gap: 6px;')}>
        <span
          style={s(
            'width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 8px var(--color-accent); display: block;',
          )}
        />
        entrée de l'app
      </span>
    </div>
  )
}

/**
 * Arêtes orthogonales en L, comme les `<path>` dessinés à la main dans la
 * maquette (l. 109-121). Un lien qui revient vers une profondeur déjà
 * atteinte est un retour : trait pointillé gris.
 */
function Edges({ placed, width, height }: { placed: Placed[]; width: number; height: number }) {
  const byRoute = new Map(placed.map(item => [item.page.route, item]))
  const forward: string[] = []
  const back: string[] = []

  for (const from of placed) {
    for (const link of from.page.links) {
      const to = byRoute.get(link)
      if (!to || to.page.route === from.page.route) continue

      const x1 = from.x + CARD_W
      const y1 = from.y + ANCHOR_Y
      const x2 = to.x
      const y2 = to.y + ANCHOR_Y
      const mid = x1 + (x2 - x1) / 2

      const path =
        to.depth > from.depth
          ? `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`
          : `M ${x1} ${y1} H ${x1 + 12} V ${y2} H ${x2}`

      ;(to.depth > from.depth ? forward : back).push(path)
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={s('position: absolute; inset: 0; overflow: visible;')}
    >
      <defs>
        <marker id="na" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#796cbf" />
        </marker>
        <marker id="nab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#595d6c" />
        </marker>
      </defs>
      <g fill="none" stroke="#796cbf" strokeWidth="1.25" markerEnd="url(#na)">
        {forward.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="none" stroke="#595d6c" strokeWidth="1" strokeDasharray="4 4" markerEnd="url(#nab)">
        {back.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  )
}

/** Carte de page — maquette l. 124-208. La vignette est la vraie capture. */
function PageCard({
  item,
  pages,
  snapshot,
  isEntry,
  onPick,
}: {
  item: Placed
  pages: Page[]
  snapshot: Snapshot
  isEntry: boolean
  onPick: () => void
}) {
  const hover = useHover()
  const { page, x, y } = item
  const plans = plansForPage(snapshot.plans, page)
  const shots = snapshot.shots[page.slug] ?? []

  const base = `position: absolute; left: ${x}px; top: ${y}px; width: ${CARD_W}px; padding: 11px 13px; border-radius: 8px; background: var(--color-surface); border: 1px solid var(--color-neutral-800); cursor: pointer;`

  return (
    <div
      {...hover.props}
      onClick={onPick}
      style={s(hover.on ? base + ' border-color: var(--color-accent-600);' : base)}
    >
      <div style={s('display: flex; align-items: center; gap: 7px;')}>
        {isEntry && (
          <span
            style={s(
              'width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 8px var(--color-accent); display: block; flex: none;',
            )}
          />
        )}
        <span
          title={page.title}
          style={s(
            'font-size: 13.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;',
          )}
        >
          {pageName(page, pages)}
        </span>
      </div>
      <div style={s('font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--color-accent-300); margin-top: 3px;')}>
        {page.route}
      </div>

      {shots.length > 0 ? (
        <img
          src={shotUrl(snapshot.root, page.shot)}
          alt=""
          style={s(
            'height: 34px; width: 100%; object-fit: cover; object-position: top; border-radius: 5px; border: 1px solid var(--color-neutral-800); margin-top: 9px; display: block;',
          )}
        />
      ) : (
        <div
          style={s(
            'height: 34px; border-radius: 5px; border: 1px dashed var(--color-neutral-700); margin-top: 9px; display: flex; align-items: center; justify-content: center; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent-300);',
          )}
        >
          scan échoué
        </div>
      )}

      <div
        style={s(
          'display: flex; gap: 8px; margin-top: 9px; font-size: 10px; color: var(--color-neutral-600); white-space: nowrap;',
        )}
      >
        <span>{plans.length > 0 ? `${plans.length} plan${plans.length > 1 ? 's' : ''}` : 'aucun plan'}</span>
        <span style={s('flex: 1;')} />
        <span>{shots[0] ? frDateShort(shotDate(shots[0])) : '—'}</span>
      </div>
    </div>
  )
}

/** Rail de détail — maquette l. 213-266. */
function DetailPanel({
  page,
  pages,
  snapshot,
  side,
  onClose,
}: {
  page: Page
  pages: Page[]
  snapshot: Snapshot
  side: boolean
  onClose: () => void
}) {
  const shots = snapshot.shots[page.slug] ?? []
  const plans = plansForPage(snapshot.plans, page)

  return (
    <div
      style={s(
        side
          ? 'position: absolute; top: 0; right: 0; bottom: 0; width: 300px; border-left: 1px solid var(--color-divider); background: #13141f; padding: 20px; overflow: auto; box-shadow: -22px 0 44px rgba(0,0,0,0.55); z-index: 5;'
          : 'width: 330px; flex: none; border-left: 1px solid var(--color-divider); background: #13141f; padding: 20px; overflow: auto;',
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <div style={s('font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);')}>
          Page sélectionnée
        </div>
        <div style={s('flex: 1;')} />
        <button type="button" onClick={onClose} className="btn btn-ghost" style={s('font-size: 11px; padding: 3px 9px;')}>
          Fermer
        </button>
      </div>

      <div style={s('font-family: var(--font-heading); font-size: 17px; margin-top: 8px;')}>
        {pageName(page, pages)}
      </div>
      <div style={s('font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-accent-300); margin-top: 3px;')}>
        {page.route}
      </div>
      <div style={s('font-size: 12px; color: var(--color-neutral-400); margin-top: 9px; line-height: 1.5; text-wrap: pretty;')}>
        {page.excerpt?.trim() || 'Aucun texte lisible relevé sur cette page.'}
      </div>

      {shots[0] ? (
        <img
          src={shotUrl(snapshot.root, `shots/${page.slug}/${shots[0]}`)}
          alt=""
          style={s(
            'margin-top: 14px; border-radius: 8px; border: 1px solid var(--color-neutral-800); width: 100%; height: 176px; object-fit: cover; object-position: top; display: block;',
          )}
        />
      ) : (
        <div
          style={s(
            'margin-top: 14px; border-radius: 8px; border: 1px dashed var(--color-neutral-700); height: 176px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--color-neutral-500);',
          )}
        >
          aucune capture
        </div>
      )}

      <div style={s('display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-neutral-500); margin-top: 8px;')}>
        <span style={s('width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-500); display: block;')} />
        {shots[0]
          ? `capture du ${frDate(shotDate(shots[0]))} — ${humanAge(shotDate(shots[0]))}`
          : 'jamais photographiée'}
      </div>

      <Section title="Captures précédentes">
        {shots.length > 1 ? (
          <div style={s('display: flex; gap: 8px;')}>
            {shots.slice(1, 5).map(file => (
              <div key={file} style={s('flex: 1;')}>
                <img
                  src={shotUrl(snapshot.root, `shots/${page.slug}/${file}`)}
                  alt=""
                  style={s(
                    'height: 44px; width: 100%; object-fit: cover; object-position: top; border-radius: 5px; border: 1px solid var(--color-neutral-800); display: block;',
                  )}
                />
                <div style={s('font-size: 9.5px; color: var(--color-neutral-600); margin-top: 4px;')}>
                  {frDate(shotDate(file))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Une seule capture pour l'instant." />
        )}
      </Section>

      <Section title="Sort de cette page">
        {page.links.length > 0 ? (
          <div style={s('display: flex; flex-wrap: wrap; gap: 6px;')}>
            {page.links.map(link => (
              <span key={link} className="tag tag-outline" style={s('font-size: 11px;')}>
                {link}
              </span>
            ))}
          </div>
        ) : (
          <Empty text="Aucun lien sortant relevé." />
        )}
      </Section>

      <Section title="Plans clos ayant touché ses fichiers">
        {plans.length > 0 ? (
          <div style={s('display: flex; flex-direction: column; gap: 8px;')}>
            {plans.map(plan => (
              <div key={plan.file} style={s('border-left: 2px solid var(--color-accent-700); padding-left: 10px;')}>
                <div style={s('font-size: 12px;')}>{plan.title}</div>
                <div style={s('font-size: 10.5px; color: var(--color-neutral-600); margin-top: 2px;')}>
                  {frDate(plan.closed)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Aucun plan — cette page n'a pas bougé depuis sa création." />
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-top: 22px;',
        )}
      >
        {title}
      </div>
      <div style={s('margin-top: 10px;')}>{children}</div>
    </>
  )
}

const Empty = ({ text }: { text: string }) => (
  <div style={s('font-size: 11px; color: var(--color-neutral-600);')}>{text}</div>
)

/**
 * Captures qui ne correspondent à aucune page actuelle. Les taire les ferait
 * passer pour des écrans du produit auprès de qui ouvre le dossier.
 */
function Orphans({ slugs }: { slugs: string[] }) {
  return (
    <div style={s('margin-top: 22px;')}>
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 8px;',
        )}
      >
        Captures sans page correspondante
      </div>
      <div style={s('font-size: 11px; color: var(--color-neutral-600); line-height: 1.5; max-width: 62ch;')}>
        {slugs.join(', ')} — ces images viennent d'un scan antérieur. Soit la page a disparu de
        l'application, soit un scan plus ancien a mal nommé sa route. Le cockpit ne les supprime pas :
        il ne peut pas trancher, et effacer serait irréversible.
      </div>
    </div>
  )
}

/** Une route qui redirige existe et est protégée : c'est une information. */
function Redirects({ redirects }: { redirects: Record<string, string> }) {
  return (
    <div style={s('margin-top: 22px;')}>
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 10px;',
        )}
      >
        Routes protégées
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
        {Object.entries(redirects).map(([from, to]) => (
          <div key={from} style={s('font-family: ui-monospace, monospace; font-size: 11px; color: var(--color-neutral-500);')}>
            {from} <span style={s('color: var(--color-neutral-700);')}>→</span> {to}
          </div>
        ))}
      </div>
    </div>
  )
}
