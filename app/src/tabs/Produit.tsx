import { useEffect, useState } from 'react'
import { ArrowsOutSimple, Compass, GitDiff, Minus, Plus } from '@phosphor-icons/react'

import {
  CARD_H,
  CARD_W,
  composerCommande,
  frDate,
  frDateShort,
  humanAge,
  lastScan,
  layoutGraph,
  pageName,
  plansForPage,
  projectDisplayName,
  shotRatio,
  scanFailed,
  shotDate,
  shotUrl,
  type Page,
  type Placed,
  type Snapshot,
} from '../data'
import { Lightbox } from '../Lightbox'
import { t } from '../i18n'
import { s, useHover } from '../style'
import { Divider, useResizable } from '../useResizable'
import { usePanZoom } from '../usePanZoom'
import { StatusBar } from '../StatusBar'
import { ViewBar } from '../ViewBar'
import type { Layout } from '../Terminal'

/** Onglet Produit — maquette l. 85-274. */
export function Produit({
  snapshot,
  layout,
  packageManager,
  onOuvrirDansNavigateur,
}: {
  snapshot: Snapshot
  layout: Layout
  packageManager: string
  onOuvrirDansNavigateur: (route: string) => void
}) {
  const pages = snapshot.pages?.pages ?? []
  const redirects = snapshot.pages?.redirects ?? {}
  const orphans = snapshot.pages?.orphanShots ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const [compare, setCompare] = useState(false)

  // Tirer vers la gauche agrandit le rail, qui est à droite.
  const rail = useResizable({
    key: 'produit.rail',
    initial: 330,
    min: 260,
    max: 560,
    axis: 'x',
    invert: true,
  })

  // La disposition ne dépend plus de la place : une rangée par profondeur,
  // toujours. C'est le canevas qui s'ajuste.
  const canvas = usePanZoom()
  const { placed, width, height } = layoutGraph(pages)

  const current = pages.find(p => p.route === selected) ?? pages[0] ?? null
  const currentShots = current ? snapshot.shots[current.slug] ?? [] : []
  const linkCount = pages.reduce((total, page) => total + page.links.length, 0)
  const failed = scanFailed(snapshot.scans)
  const commit = lastScan(snapshot.scans)?.commit ?? null
  const scanDate = lastScan(snapshot.scans)?.date ?? null

  const side = layout === 'side'

  // Changer de projet rend la main à l'ajustement automatique : le graphe
  // suivant n'a aucune raison d'hériter du zoom choisi pour le précédent.
  useEffect(() => canvas.release(), [snapshot.root])

  // Recadrage tant que l'utilisateur n'a pas pris la main. Dépend de la taille
  // du viewport, donc suit la fenêtre, la barre latérale et la disposition du
  // terminal — ce que faisait l'ancien `scale(0.82)`, en mieux.
  useEffect(() => {
    if (canvas.untouched()) canvas.fit(width, height, false)
  }, [canvas.width, canvas.height, width, height])

  if (pages.length === 0) {
    return (
      <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>
        <ViewBar projet={projectDisplayName(snapshot)} vue={t('produit.title')} />
        <div style={s('flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px 22px; overflow: auto;')}>
          <div
            style={s(
              'display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; padding: 48px 20px; max-width: 46ch; border: 1px dashed #363841; border-radius: 9px;',
            )}
          >
            <div style={s('font-size: 12.5px; color: var(--color-neutral-500); line-height: 1.5;')}>
              {t('produit.no_pages')}
            </div>
            <CrawlButton packageManager={packageManager} />
          </div>
        </div>
        <StatusBar />
      </div>
    )
  }

  return (
    <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>
      <ViewBar
        projet={projectDisplayName(snapshot)}
        vue={t('produit.title')}
        meta={`${pages.length > 1 ? t('produit.pages_count_plural', { n: pages.length }) : t('produit.pages_count', { n: 1 })} · ${linkCount > 1 ? t('produit.links_count_plural', { n: linkCount }) : t('produit.links_count', { n: 1 })} · ${t('produit.rebuilt_at_commit')}${commit ? ` ${commit.slice(0, 7)}` : ''}`}
      >
        <button
          type="button"
          className="btn btn-ghost"
          disabled={currentShots.length < 2}
          onClick={() => setCompare(true)}
          style={s('font-size: 12px;')}
        >
          <GitDiff size={14} weight="regular" aria-hidden="true" />
          {t('produit.compare_dates')}
        </button>
        <CrawlButton packageManager={packageManager} />
      </ViewBar>
      <div style={s('flex: 1; display: flex; min-width: 0; min-height: 0; position: relative;')}>
        <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>
          <div style={s('flex: none; padding: 12px 22px 0;')}>
            <Legend />

          {failed && (
            <div
              style={s(
                'display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 8px 11px; border-radius: 6px; background: #1c0d10; border: 1px solid #3a1c22; font-size: 12px; color: #e5677a;',
              )}
            >
              {t('produit.last_scan_failed', { date: frDate(lastScan(snapshot.scans)?.date) })}
            </div>
          )}
        </div>

        {/* Le canevas. `overflow: hidden` et non `auto` : le déplacement passe
            par la transformation, pas par les barres de défilement — deux
            mécanismes de déplacement se battraient sur le même geste.

            En disposition « Côté », le rail de détail recouvre le canevas au
            lieu de le pousser. Un remplissage à droite retire cette bande de la
            largeur mesurée — sans quoi l'ajustement centrerait le graphe dans
            une place dont une partie est cachée, et la moitié droite passerait
            sous le rail. */}
        <div
          ref={canvas.ref}
          style={s(
            // `user-select: none` : sans lui, glisser le canevas surligne les
            // titres des cartes au passage.
            `flex: 1; position: relative; overflow: hidden; min-height: 0; touch-action: none; user-select: none; padding-right: ${side && panel ? rail.size : 0}px; background: #08090a radial-gradient(#16171c 1px, transparent 1px) 0 0 / 22px 22px; ` +
              (canvas.panning ? 'cursor: grabbing;' : 'cursor: grab;'),
          )}
        >
          <div
            style={s(
              `position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; transform: translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.zoom}); transform-origin: 0 0;`,
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
                isSelected={item.page.route === selected}
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

          <Controls
            zoom={canvas.zoom}
            onZoom={canvas.zoomBy}
            onReset={canvas.reset}
            onFit={() => canvas.fit(width, height)}
          />
        </div>

        <Footnotes redirects={redirects} orphans={orphans} />
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
            onOuvrirDansNavigateur={() => onOuvrirDansNavigateur(current.route)}
          />
        </>
      ) : (
        <div
          style={s(
            side
              ? 'position: absolute; top: 0; right: 0; bottom: 0; width: 42px; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); display: flex; justify-content: center; padding-top: 16px; z-index: 5;'
              : 'width: 42px; flex: none; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); display: flex; justify-content: center; padding-top: 16px;',
          )}
        >
          <button
            type="button"
            onClick={() => setPanel(true)}
            style={s(
              'background: transparent; border: 1px solid var(--color-neutral-800); border-radius: 6px; color: var(--color-neutral-400); cursor: pointer; font-family: var(--font-body); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; padding: 12px 5px; writing-mode: vertical-rl;',
            )}
          >
            {t('produit.page_detail')}
          </button>
        </div>
      )}

      {compare && current && currentShots.length > 1 && (
        <CompareModal
          root={snapshot.root}
          slug={current.slug}
          files={currentShots}
          label={`${pageName(current, pages)} · ${current.route}`}
          onClose={() => setCompare(false)}
        />
      )}
      </div>

      <StatusBar
        left={[
          ...(scanDate ? [t('statusbar.graph_rebuilt', { age: humanAge(scanDate) })] : []),
          pages.length > 1 ? t('produit.pages_count_plural', { n: pages.length }) : t('produit.pages_count', { n: 1 }),
          linkCount > 1 ? t('produit.links_count_plural', { n: linkCount }) : t('produit.links_count', { n: 1 }),
        ]}
        right={[t('statusbar.canvas_hint')]}
      />
    </div>
  )
}

/**
 * Bouton Crawler — maquette 2d, en-tête. Copie la commande plutôt que de la
 * coller dans le terminal : importer `pasteToClaude` chargerait `@xterm/xterm`
 * (et son CSS) dans un onglet couvert par `render.test.tsx`, comme trouvé sur
 * Données. Même geste que `donnees.copy_command`.
 */
function CrawlButton({ packageManager }: { packageManager: string }) {
  const [copie, setCopie] = useState(false)

  return (
    <button
      type="button"
      className="btn btn-primary"
      style={s('font-size: 12px;')}
      onClick={() => {
        navigator.clipboard
          ?.writeText(composerCommande('ovrsee:crawl', packageManager))
          .then(() => {
            setCopie(true)
            setTimeout(() => setCopie(false), 1500)
          })
          .catch(() => setCopie(false))
      }}
    >
      <Compass size={14} weight="fill" aria-hidden="true" />
      {copie ? t('produit.crawl_copied') : t('produit.crawl')}
    </button>
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
        {t('produit.leads_to')}
      </span>
      <span style={s('display: flex; align-items: center; gap: 6px;')}>
        <span
          style={s('width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); display: block;')}
        />
        {t('produit.entry_point')}
      </span>
    </div>
  )
}

/**
 * Commandes du canevas, en surimpression.
 *
 * Le zoom se fait au trackpad la plupart du temps ; ces boutons existent pour
 * la souris, et surtout pour que « ajuster » soit atteignable — un graphe perdu
 * hors cadre après un déplacement trop franc doit se retrouver sans tâtonner.
 */
function Controls({
  zoom,
  onZoom,
  onReset,
  onFit,
}: {
  zoom: number
  onZoom: (factor: number) => void
  onReset: () => void
  onFit: () => void
}) {
  const button =
    'cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 22px; border-radius: 5px; border: none; background: transparent; color: #b6bac1;'

  return (
    <div
      style={s(
        'position: absolute; left: 14px; bottom: 14px; display: flex; align-items: center; gap: 3px; padding: 3px; border-radius: 8px; border: 1px solid #2b2d35; background: #0e0f12; z-index: 4;',
      )}
    >
      <button type="button" title={t('produit.zoom_out')} onClick={() => onZoom(1 / 1.2)} style={s(button)}>
        <Minus size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        title={t('produit.zoom_100')}
        onClick={onReset}
        style={s(
          'cursor: pointer; min-width: 40px; border: none; background: transparent; font-family: var(--font-mono); font-size: 11px; color: #b6bac1; font-variant-numeric: tabular-nums;',
        )}
      >
        {Math.round(zoom * 100)} %
      </button>
      <button type="button" title={t('produit.zoom_in')} onClick={() => onZoom(1.2)} style={s(button)}>
        <Plus size={13} aria-hidden="true" />
      </button>
      <div style={s('width: 1px; height: 14px; background: #2b2d35;')} />
      <button type="button" title={t('produit.fit_window')} onClick={onFit} style={s(button)}>
        <ArrowsOutSimple size={13} aria-hidden="true" />
      </button>
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
 * autres : les cinq pages de l'ovrsee produisent vingt liens, dont seize entre
 * frères de même niveau. Tracés, ils donnaient à `/stack` l'air de découler de
 * `/donnees`. Un lien frère ne dit rien de la structure — il dit qu'il y a un
 * menu. Un lien qui remonte non plus : toute page ramène à l'accueil.
 *
 * Ce qui est perdu : on ne voit plus qu'une page en atteint une autre
 * latéralement. Ce qui est gagné : ce qui reste à l'écran est vrai. Un enfant
 * atteint depuis deux parents garde bien ses deux arêtes — on ne réduit pas à
 * l'arbre du parcours.
 *
 * Une profondeur occupe désormais une seule rangée : une arête descend donc
 * toujours d'exactement un `ROW_STEP`, et le détour par une voie latérale qui
 * contournait les sous-rangées n'a plus lieu d'être.
 */
function Edges({ placed, width, height }: { placed: Placed[]; width: number; height: number }) {
  const byRoute = new Map(placed.map(item => [item.page.route, item]))
  const forward: string[] = []

  for (const from of placed) {
    for (const link of from.page.links) {
      const to = byRoute.get(link)
      if (!to || to.depth !== from.depth + 1) continue

      // Bas du centre → haut du centre, avec un décrochement horizontal à
      // mi-hauteur.
      const x1 = from.x + CARD_W / 2
      const y1 = from.y + CARD_H
      const x2 = to.x + CARD_W / 2
      const y2 = to.y
      forward.push(`M ${x1} ${y1} V ${y1 + (y2 - y1) / 2} H ${x2} V ${y2}`)
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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#2f313b" />
        </marker>
      </defs>
      <g fill="none" stroke="#2f313b" strokeWidth="1.25" markerEnd="url(#na)">
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
  isSelected,
  onPick,
}: {
  item: Placed
  pages: Page[]
  snapshot: Snapshot
  isEntry: boolean
  isSelected: boolean
  onPick: () => void
}) {
  const hover = useHover()
  const { page, x, y } = item
  const plans = plansForPage(snapshot.plans, page)
  const shots = snapshot.shots[page.slug] ?? []

  // Hauteur fixe : les arêtes s'ancrent sur CARD_H, une carte qui grandit avec
  // son titre les décrocherait.
  const base = `position: absolute; left: ${x}px; top: ${y}px; width: ${CARD_W}px; height: ${CARD_H}px; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; padding: 11px 13px; border-radius: 10px; cursor: pointer;`
  // Jamais de filet accent pour signifier un état (règle d'or §5.1) — le
  // survol et la sélection restent dans la même gamme neutre que le reste
  // de l'app, la sélection se distinguant par un halo, pas une couleur.
  const etat = isSelected
    ? 'background: #202229; border: 1px solid #4d5060; box-shadow: var(--ring-selected);'
    : hover.on
      ? 'background: var(--color-surface); border: 1px solid #4d5060;'
      : 'background: var(--color-surface); border: 1px solid var(--color-neutral-800);'

  return (
    <div {...hover.props} onClick={onPick} style={s(base + etat)}>
      <div style={s('display: flex; align-items: center; gap: 7px;')}>
        {isEntry && (
          <span
            style={s(
              'width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); display: block; flex: none;',
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
      <div style={s('font-family: var(--font-mono); font-size: 10.5px; color: #737983; margin-top: 3px;')}>
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
            `width: 100%; aspect-ratio: ${shotRatio(page)}; border-radius: 5px; border: 1px dashed var(--color-neutral-700); margin-top: 9px; display: flex; align-items: center; justify-content: center; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);`,
          )}
        >
          {t('produit.scan_failed')}
        </div>
      )}

      <div style={s('flex: 1;')} />

      <div
        style={s(
          'display: flex; gap: 8px; margin-top: 9px; font-size: 10px; color: var(--color-neutral-600); white-space: nowrap;',
        )}
      >
        <span>{plans.length > 0 ? `${plans.length} ${plans.length > 1 ? t('produit.plan_count_plural', { n: plans.length }) : t('produit.plan_count', { n: 1 })}` : t('produit.no_plans')}</span>
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
  onOuvrirDansNavigateur,
}: {
  page: Page
  pages: Page[]
  snapshot: Snapshot
  side: boolean
  width: number
  onClose: () => void
  onOuvrirDansNavigateur: () => void
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
          ? `position: absolute; top: 0; right: 0; bottom: 0; width: ${width}px; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); padding: 20px; overflow: auto; box-shadow: -22px 0 44px rgba(0,0,0,0.55); z-index: 5;`
          : `width: ${width}px; flex: none; border-left: 1px solid var(--color-divider); background: var(--theme-bg-secondary); padding: 20px; overflow: auto;`,
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <div style={s('font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);')}>
          {t('produit.page_selected')}
        </div>
        <div style={s('flex: 1;')} />
        <button type="button" onClick={onClose} className="btn btn-ghost" style={s('font-size: 11px; padding: 3px 9px;')}>
          {t('produit.close')}
        </button>
      </div>

      <div style={s('font-family: var(--font-heading); font-size: 17px; margin-top: 8px;')}>
        {pageName(page, pages)}
      </div>
      <div style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-accent); margin-top: 3px;')}>
        {page.route}
      </div>
      <div style={s('font-size: 12px; color: var(--color-neutral-400); margin-top: 9px; line-height: 1.5; text-wrap: pretty;')}>
        {page.excerpt?.trim() || t('produit.no_excerpt')}
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={s('font-size: 11px; margin-top: 10px; width: 100%; justify-content: center;')}
        onClick={onOuvrirDansNavigateur}
      >
        {t('produit.open_in_navigateur')}
      </button>

      {shots[0] ? (
        <img
          src={shotUrl(snapshot.root, `shots/${page.slug}/${shots[0]}`)}
          alt=""
          title={t('produit.zoom')}
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
          {t('produit.no_screenshot')}
        </div>
      )}

      <div style={s('display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-neutral-500); margin-top: 8px;')}>
        <span style={s('width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-500); display: block;')} />
        {shots[0]
          ? `capture du ${frDate(shotDate(shots[0]))} — ${humanAge(shotDate(shots[0]))}`
          : t('produit.never_captured')}
      </div>

      <Section title={t('produit.previous_screenshots')}>
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
                    title={t('produit.zoom')}
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
            <div style={s('display: flex; gap: 8px; margin-top: 9px;')}>
              <button
                type="button"
                onClick={() => setZoom(0)}
                className="btn btn-ghost"
                style={s('font-size: 11px; padding: 4px 9px;')}
              >
                {t('produit.view_all_screenshots', { n: shots.length })}
              </button>
            </div>
          </>
        ) : (
          <Empty text={t('produit.single_screenshot')} />
        )}
      </Section>

      <Section title={t('produit.page_links')}>
        {page.links.length > 0 ? (
          <div style={s('display: flex; flex-wrap: wrap; gap: 6px;')}>
            {page.links.map(link => (
              <span key={link} className="tag tag-outline" style={s('font-size: 11px;')}>
                {link}
              </span>
            ))}
          </div>
        ) : (
          <Empty text={t('produit.no_outgoing_links')} />
        )}
      </Section>

      <Section title={t('produit.closed_plans')}>
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
          <Empty text={t('produit.no_related_plans')} />
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

/**
 * Deux captures de la même page, côte à côte. Pas de diff pixel : les deux
 * images suffisent à voir ce qui a changé, et un diff automatique sur une
 * page qui peut contenir des données dynamiques (dates, IDs) produirait plus
 * de faux positifs qu'il n'en évite.
 */
function CompareModal({
  root,
  slug,
  files,
  label,
  onClose,
}: {
  root: string
  slug: string
  files: string[]
  label: string
  onClose: () => void
}) {
  // Plus récent à droite : la lecture gauche→droite suit alors le temps.
  const [leftAt, setLeftAt] = useState(Math.min(1, files.length - 1))
  const [rightAt, setRightAt] = useState(0)

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 50; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; flex-direction: column; padding: 16px 20px 14px;',
      )}
    >
      <div style={s('display: flex; align-items: center; gap: 12px; flex: none;')}>
        <button type="button" onClick={onClose} className="btn btn-ghost" style={s('font-size: 12px; padding: 4px 10px;')}>
          ✕ {t('produit.close')}
        </button>
        <div style={s('font-size: 12.5px; color: var(--color-neutral-400);')}>{t('produit.compare_title')} — {label}</div>
      </div>

      <div
        onClick={event => event.stopPropagation()}
        style={s('flex: 1; min-height: 0; display: flex; gap: 14px; padding: 14px 0;')}
      >
        <CompareSide root={root} slug={slug} files={files} label={t('produit.compare_left')} at={leftAt} onAt={setLeftAt} />
        <CompareSide root={root} slug={slug} files={files} label={t('produit.compare_right')} at={rightAt} onAt={setRightAt} />
      </div>
    </div>
  )
}

function CompareSide({
  root,
  slug,
  files,
  label,
  at,
  onAt,
}: {
  root: string
  slug: string
  files: string[]
  label: string
  at: number
  onAt: (index: number) => void
}) {
  const file = files[at]
  return (
    <div style={s('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;')} onClick={event => event.stopPropagation()}>
      <div style={s('display: flex; align-items: center; gap: 8px;')}>
        <span style={s('font-size: 11px; color: var(--color-neutral-500);')}>{label}</span>
        <select
          className="btn btn-ghost"
          style={s('font-size: 11px; padding: 3px 7px;')}
          value={at}
          onChange={event => onAt(Number(event.target.value))}
        >
          {files.map((candidate, index) => (
            <option key={candidate} value={index}>
              {frDate(shotDate(candidate))}
            </option>
          ))}
        </select>
      </div>
      {file ? (
        <img
          src={shotUrl(root, `shots/${slug}/${file}`)}
          alt={`${label} — ${frDate(shotDate(file))}`}
          style={s(
            'flex: 1; min-height: 0; width: 100%; object-fit: contain; border-radius: 8px; border: 1px solid var(--color-neutral-800); background: var(--theme-bg-lightbox);',
          )}
        />
      ) : (
        <Empty text={t('produit.no_screenshot')} />
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
 * Ce que la carte ne peut pas dessiner : routes protégées, captures orphelines.
 *
 * Ces deux blocs vivaient sous le graphe, dans le même défilement. Le canevas
 * prend maintenant toute la hauteur, et les faire défiler avec lui n'a plus de
 * sens. Repliés, ils tiennent en une ligne qui dit leur compte — assez pour
 * qu'on sache qu'il y a quelque chose à lire, pas assez pour encombrer.
 */
function Footnotes({
  redirects,
  orphans,
}: {
  redirects: Record<string, string>
  orphans: string[]
}) {
  const [open, setOpen] = useState(false)
  const routes = Object.keys(redirects).length

  if (routes === 0 && orphans.length === 0) return null

  const counts = [
    routes > 0
      ? `${t(routes > 1 ? 'produit.protected_route_count_plural' : 'produit.protected_route_count', { n: routes })} ${t(routes > 1 ? 'produit.protected_route_plural' : 'produit.protected_route')}`
      : null,
    orphans.length > 0
      ? t(orphans.length > 1 ? 'produit.screenshot_count_plural' : 'produit.screenshot_count', {
          n: orphans.length,
        }) + ' ' + t('produit.without_page')
      : null,
  ].filter(Boolean)

  return (
    <div style={s('flex: none; border-top: 1px solid var(--color-divider); background: var(--theme-bg-secondary);')}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={s(
          'display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: transparent; border: 0; padding: 8px 22px; cursor: pointer; font-family: var(--font-body); font-size: 11.5px; color: var(--color-neutral-500);',
        )}
      >
        <span style={s('color: var(--color-neutral-600);')}>{open ? '▾' : '▸'}</span>
        {counts.join(' · ')}
      </button>
      {open && (
        <div style={s('max-height: 34vh; overflow: auto; padding: 0 22px 16px;')}>
          {routes > 0 && <Redirects redirects={redirects} />}
          {orphans.length > 0 && <Orphans slugs={orphans} />}
        </div>
      )}
    </div>
  )
}

/**
 * Captures qui ne correspondent à aucune page actuelle. Les taire les ferait
 * passer pour des écrans du produit auprès de qui ouvre le dossier.
 */
function Orphans({ slugs }: { slugs: string[] }) {
  return (
    <div style={s('margin-top: 14px;')}>
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 8px;',
        )}
      >
        {t('produit.orphan_screenshots')}
      </div>
      <div style={s('font-size: 11px; color: var(--color-neutral-600); line-height: 1.5; max-width: 62ch;')}>
        {slugs.join(', ')} — {t('produit.orphan_screenshots_help')}
      </div>
    </div>
  )
}

/** Une route qui redirige existe et est protégée : c'est une information. */
function Redirects({ redirects }: { redirects: Record<string, string> }) {
  return (
    <div style={s('margin-top: 14px;')}>
      <div
        style={s(
          'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600); margin-bottom: 10px;',
        )}
      >
        {t('produit.protected_routes')}
      </div>
      <div style={s('display: flex; flex-direction: column; gap: 6px;')}>
        {Object.entries(redirects).map(([from, to]) => (
          <div key={from} style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral-500);')}>
            {from} <span style={s('color: var(--color-neutral-700);')}>→</span> {to}
          </div>
        ))}
      </div>
    </div>
  )
}
