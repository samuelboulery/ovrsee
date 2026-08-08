import { useState } from 'react'

import {
  CARD_H,
  COL_STEP,
  CARD_W,
  frDate,
  frDateShort,
  humanAge,
  lastScan,
  layoutGraph,
  pageName,
  plansForPage,
  ROW_STEP,
  shotRatio,
  scanFailed,
  shotDate,
  shotUrl,
  type Page,
  type Placed,
  type Snapshot,
} from '../data'
import { Lightbox } from '../Lightbox'
import { s, useHover } from '../style'
import { Divider, useResizable } from '../useResizable'
import { useMeasure } from '../useMeasure'
import type { Layout } from '../Terminal'

/** Onglet Produit — maquette l. 85-274. */
export function Produit({ snapshot, layout }: { snapshot: Snapshot; layout: Layout }) {
  const pages = snapshot.pages?.pages ?? []
  const redirects = snapshot.pages?.redirects ?? {}
  const orphans = snapshot.pages?.orphanShots ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)

  // Tirer vers la gauche agrandit le rail, qui est à droite.
  const rail = useResizable({
    key: 'produit.rail',
    initial: 330,
    min: 260,
    max: 560,
    axis: 'x',
    invert: true,
  })

  // La zone du graphe est mesurée : le nombre de cartes par rangée suit la
  // place réelle, qui change avec la fenêtre, la barre latérale et la
  // disposition du terminal.
  const area = useMeasure<HTMLDivElement>()
  const scale = layout === 'side' ? 0.82 : 1
  const maxPerRow = area.width > 0 ? Math.max(1, Math.floor(area.width / scale / COL_STEP)) : 4

  const { placed, width, height } = layoutGraph(pages, maxPerRow)
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
      <div ref={area.ref} style={s('flex: 1; padding: 20px 22px; overflow: auto; min-width: 0;')}>
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
        <>
          <Divider axis="x" resizable={rail} />
          <DetailPanel
            page={current}
            pages={pages}
            snapshot={snapshot}
            side={side}
            width={rail.size}
            onClose={() => setPanel(false)}
          />
        </>
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
        mène à
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
 * Arêtes orthogonales en L, dans le sens vertical.
 *
 * **Une arête = une descente d'un niveau.** Seul un lien vers la profondeur
 * immédiatement suivante est tracé : il sort du bas de la carte et entre par le
 * haut de la suivante.
 *
 * Tout le reste est écarté, et c'est le fond du problème que cette règle
 * corrige. Une barre de navigation met sur chaque page un lien vers toutes les
 * autres : les cinq pages du cockpit produisent vingt liens, dont seize entre
 * frères de même niveau. Tracés, ils donnaient à `/stack` l'air de découler de
 * `/donnees`. Un lien frère ne dit rien de la structure — il dit qu'il y a un
 * menu. Un lien qui remonte non plus : toute page ramène à l'accueil.
 *
 * Ce qui est perdu : on ne voit plus qu'une page en atteint une autre
 * latéralement. Ce qui est gagné : ce qui reste à l'écran est vrai. Un enfant
 * atteint depuis deux parents garde bien ses deux arêtes — on ne réduit pas à
 * l'arbre du parcours.
 */
function Edges({ placed, width, height }: { placed: Placed[]; width: number; height: number }) {
  const byRoute = new Map(placed.map(item => [item.page.route, item]))
  const forward: string[] = []

  for (const from of placed) {
    for (const link of from.page.links) {
      const to = byRoute.get(link)
      if (!to || to.depth !== from.depth + 1) continue

      const x2 = to.x + CARD_W / 2
      const y2 = to.y

      if (to.y - from.y === ROW_STEP) {
        // Rangée immédiatement dessous : bas du centre → haut du centre, avec
        // un décrochement horizontal à mi-hauteur.
        const x1 = from.x + CARD_W / 2
        const y1 = from.y + CARD_H
        forward.push(`M ${x1} ${y1} V ${y1 + (y2 - y1) / 2} H ${x2} V ${y2}`)
        continue
      }

      // Une profondeur trop large pour la fenêtre est repliée en sous-rangées
      // (`layoutGraph`) : la cible est alors deux rangées plus bas, et un trait
      // droit passerait derrière les cartes intercalées. Il en ressortirait
      // juste au-dessus de la cible — exactement l'image d'une page qui
      // découlerait de sa voisine, que ce composant existe pour ne plus
      // produire. Le détour passe donc à l'écart de toutes les cartes.
      const x1 = from.x + CARD_W
      const y1 = from.y + CARD_H / 2
      const lane = width + 18
      const gutter = y2 - (ROW_STEP - CARD_H) / 2
      forward.push(`M ${x1} ${y1} H ${lane} V ${gutter} H ${x2} V ${y2}`)
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
      </defs>
      <g fill="none" stroke="#796cbf" strokeWidth="1.25" markerEnd="url(#na)">
        {forward.map((d, i) => (
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

  // Hauteur fixe : les arêtes s'ancrent sur CARD_H, une carte qui grandit avec
  // son titre les décrocherait.
  const base = `position: absolute; left: ${x}px; top: ${y}px; width: ${CARD_W}px; height: ${CARD_H}px; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; padding: 11px 13px; border-radius: 8px; background: var(--color-surface); border: 1px solid var(--color-neutral-800); cursor: pointer;`

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
        // `aspect-ratio` au rapport réel de la prise : sans lui, la vignette
        // ne montrait qu'une bande du haut de l'écran, identique d'une page à
        // l'autre.
        <img
          src={shotUrl(snapshot.root, page.shot)}
          alt=""
          style={s(
            `width: 100%; aspect-ratio: ${shotRatio(page)}; object-fit: cover; object-position: top; border-radius: 5px; border: 1px solid var(--color-neutral-800); margin-top: 9px; display: block;`,
          )}
        />
      ) : (
        <div
          style={s(
            `width: 100%; aspect-ratio: ${shotRatio(page)}; border-radius: 5px; border: 1px dashed var(--color-neutral-700); margin-top: 9px; display: flex; align-items: center; justify-content: center; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent-300);`,
          )}
        >
          scan échoué
        </div>
      )}

      <div style={s('flex: 1;')} />

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
  width,
  onClose,
}: {
  page: Page
  pages: Page[]
  snapshot: Snapshot
  side: boolean
  width: number
  onClose: () => void
}) {
  const shots = snapshot.shots[page.slug] ?? []
  const plans = plansForPage(snapshot.plans, page)

  // Index de la capture agrandie, ou null. Toutes les captures sont
  // atteignables depuis la visionneuse, pas seulement les cinq du rail.
  const [zoom, setZoom] = useState<number | null>(null)

  return (
    <div
      style={s(
        side
          ? `position: absolute; top: 0; right: 0; bottom: 0; width: ${width}px; border-left: 1px solid var(--color-divider); background: #13141f; padding: 20px; overflow: auto; box-shadow: -22px 0 44px rgba(0,0,0,0.55); z-index: 5;`
          : `width: ${width}px; flex: none; border-left: 1px solid var(--color-divider); background: #13141f; padding: 20px; overflow: auto;`,
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
          title="Agrandir"
          onClick={() => setZoom(0)}
          style={s(
            `margin-top: 14px; border-radius: 8px; border: 1px solid var(--color-neutral-800); width: 100%; aspect-ratio: ${shotRatio(page)}; object-fit: cover; object-position: top; display: block; cursor: zoom-in;`,
          )}
        />
      ) : (
        <div
          style={s(
            `margin-top: 14px; border-radius: 8px; border: 1px dashed var(--color-neutral-700); width: 100%; aspect-ratio: ${shotRatio(page)}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--color-neutral-500);`,
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
          <>
            {/* Le rail reste étroit : quatre miniatures. La visionneuse, elle,
                donne accès à toute la série. */}
            <div style={s('display: flex; gap: 8px;')}>
              {shots.slice(1, 5).map((file, i) => (
                <div key={file} style={s('flex: 1;')}>
                  <img
                    src={shotUrl(snapshot.root, `shots/${page.slug}/${file}`)}
                    alt=""
                    title="Agrandir"
                    onClick={() => setZoom(i + 1)}
                    style={s(
                      'height: 44px; width: 100%; object-fit: cover; object-position: top; border-radius: 5px; border: 1px solid var(--color-neutral-800); display: block; cursor: zoom-in;',
                    )}
                  />
                  <div style={s('font-size: 9.5px; color: var(--color-neutral-600); margin-top: 4px;')}>
                    {frDate(shotDate(file))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setZoom(0)}
              className="btn btn-ghost"
              style={s('font-size: 11px; padding: 4px 9px; margin-top: 9px;')}
            >
              Voir les {shots.length} captures en grand
            </button>
          </>
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

      {zoom !== null && (
        <Lightbox
          root={snapshot.root}
          slug={page.slug}
          files={shots}
          index={zoom}
          onIndex={setZoom}
          onClose={() => setZoom(null)}
          label={`${pageName(page, pages)} · ${page.route}`}
        />
      )}
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
