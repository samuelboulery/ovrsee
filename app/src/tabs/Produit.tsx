import { useEffect, useState } from 'react'
import { ArrowsOutSimple, Compass, GitDiff, Minus, Plus, Stop } from '@phosphor-icons/react'

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
import { t } from '../i18n'
import { s, useHover } from '../style'
import { Divider, useResizable } from '../useResizable'
import { usePanZoom } from '../usePanZoom'
import { StatusBar } from '../StatusBar'
import { ViewBar } from '../ViewBar'
import { ConfigCrawl } from '../ConfigCrawl'
import { crawlDisponible, useCrawl } from '../useCrawl'
import type { Layout } from '../terminalLayout'
import { CompareModal, DetailPanel, Footnotes } from './ProduitDetail'

/** Onglet Produit — maquette l. 85-274. */
export function Produit({
  snapshot,
  layout,
  packageManager,
  onOuvrirDansNavigateur,
  onReload,
}: {
  snapshot: Snapshot
  layout: Layout
  packageManager: string
  onOuvrirDansNavigateur: (route: string) => void
  onReload: () => void
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
              'display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; padding: 48px 20px; max-width: 46ch; border: 1px dashed var(--color-border-control); border-radius: 8px;',
            )}
          >
            <div style={s('font-size: 12.5px; color: var(--color-neutral-500); line-height: 1.5;')}>
              {t('produit.no_pages')}
            </div>
            <CrawlButton snapshot={snapshot} packageManager={packageManager} onReload={onReload} />
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
        <CrawlButton snapshot={snapshot} packageManager={packageManager} onReload={onReload} />
      </ViewBar>
      <div style={s('flex: 1; display: flex; min-width: 0; min-height: 0; position: relative;')}>
        <div style={s('flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;')}>
          <div style={s('flex: none; padding: 12px 22px 0;')}>
            <Legend />

          {failed && (
            <div
              style={s(
                'margin: 0 0 14px; padding: 8px 11px; border-radius: 6px; background: var(--color-err-bg); border: 1px solid var(--color-err-border); font-size: 12px; color: var(--color-err);',
              )}
            >
              <div>
                {t('produit.last_scan_failed', { date: frDate(lastScan(snapshot.scans)?.date) })}
              </div>
              {/* La raison, telle que le crawler l'a consignée dans
                  `scans.jsonl`. Sans elle, le bandeau disait qu'un scan avait
                  échoué sans jamais dire pourquoi — et la seule façon de le
                  savoir était d'ouvrir le fichier à la main. */}
              {lastScan(snapshot.scans)?.error && (
                <pre
                  style={s(
                    'margin: 6px 0 0; font-family: var(--font-mono); font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; opacity: .85;',
                  )}
                >
                  {lastScan(snapshot.scans)?.error}
                </pre>
              )}
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
            `flex: 1; position: relative; overflow: hidden; min-height: 0; touch-action: none; user-select: none; padding-right: ${side && panel ? rail.size : 0}px; background: var(--color-bg) radial-gradient(var(--color-border-card) 1px, transparent 1px) 0 0 / 22px 22px; ` +
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
              ? 'position: absolute; top: 0; right: 0; bottom: 0; width: 42px; border-left: 1px solid var(--color-divider); background: var(--color-surface-panel); display: flex; justify-content: center; padding-top: 16px; z-index: 5;'
              : 'width: 42px; flex: none; border-left: 1px solid var(--color-divider); background: var(--color-surface-panel); display: flex; justify-content: center; padding-top: 16px;',
          )}
        >
          <button
            type="button"
            onClick={() => setPanel(true)}
            style={s(
              'background: transparent; border: 1px solid var(--color-border-card); border-radius: 6px; color: var(--color-neutral-400); cursor: pointer; font-family: var(--font-body); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; padding: 12px 5px; writing-mode: vertical-rl;',
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
 * Bouton Crawler — maquette 2d, en-tête.
 *
 * Quatre états, dans cet ordre de garde :
 *
 * 1. **Navigateur** — `pnpm dev` n'a pas d'IPC, donc pas de crawl lançable. Le
 *    bouton retombe sur le geste d'avant : copier la commande. Un bouton qui
 *    prétendrait lancer quelque chose mentirait, comme ceux du terminal.
 * 2. **Sans configuration** — `ovrsee.config.json` manque, le crawl échouerait
 *    à coup sûr. Proposer de l'écrire plutôt que de laisser découvrir l'échec.
 * 3. **En cours** — l'avancement, et de quoi arrêter.
 * 4. **Prêt** — lancer.
 *
 * Le résultat n'a pas de quatrième chemin : succès comme échec, le crawler
 * écrit sa trace dans `ovrsee/pages/scans.jsonl`, et c'est le rechargement du
 * projet qui la fait paraître — bandeau `scanFailed` compris.
 */
function CrawlButton({
  snapshot,
  packageManager,
  onReload,
}: {
  snapshot: Snapshot
  packageManager: string
  onReload: () => void
}) {
  const [copie, setCopie] = useState(false)
  const [configure, setConfigure] = useState(false)
  const { enCours, ligne, demarrer, arreter } = useCrawl(snapshot.root, onReload)

  // 1. Navigateur : pas d'IPC, on copie.
  if (!crawlDisponible()) {
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

  // 3. En cours — testé avant la configuration : elle a pu être écrite dans la
  // même session, et le snapshot n'est relu qu'à la fin du crawl.
  if (enCours) {
    return (
      <div style={s('display: flex; align-items: center; gap: 8px; min-width: 0;')}>
        <span
          style={s(
            'font-size: 11px; color: var(--color-neutral-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34ch;',
          )}
          title={ligne ?? undefined}
        >
          {ligne ?? t('produit.crawl_running')}
        </span>
        <button
          type="button"
          className="btn"
          style={s('font-size: 12px;')}
          onClick={arreter}
        >
          <Stop size={14} weight="fill" aria-hidden="true" />
          {t('produit.crawl_stop')}
        </button>
      </div>
    )
  }

  // 2. Sans configuration.
  if (snapshot.config === null) {
    if (configure) {
      return (
        <ConfigCrawl
          root={snapshot.root}
          onEcrit={() => {
            setConfigure(false)
            onReload()
          }}
        />
      )
    }
    return (
      <button
        type="button"
        className="btn btn-primary"
        style={s('font-size: 12px;')}
        onClick={() => setConfigure(true)}
      >
        <Compass size={14} weight="fill" aria-hidden="true" />
        {t('produit.crawl_configure')}
      </button>
    )
  }

  // 4. Prêt.
  return (
    <button type="button" className="btn btn-primary" style={s('font-size: 12px;')} onClick={demarrer}>
      <Compass size={14} weight="fill" aria-hidden="true" />
      {t('produit.crawl')}
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
    'cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 22px; border-radius: 6px; border: none; background: transparent; color: var(--color-text-secondary);'

  return (
    <div
      style={s(
        'position: absolute; left: 14px; bottom: 14px; display: flex; align-items: center; gap: 3px; padding: 3px; border-radius: 8px; border: 1px solid var(--color-border-card); background: var(--color-surface-panel); z-index: 4;',
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
          'cursor: pointer; min-width: 40px; border: none; background: transparent; font-family: var(--font-mono); font-size: 11px; color: var(--color-text-secondary); font-variant-numeric: tabular-nums;',
        )}
      >
        {Math.round(zoom * 100)} %
      </button>
      <button type="button" title={t('produit.zoom_in')} onClick={() => onZoom(1.2)} style={s(button)}>
        <Plus size={13} aria-hidden="true" />
      </button>
      <div style={s('width: 1px; height: 14px; background: var(--color-border-card);')} />
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
      {/* Le jeton passe par la PROPRIÉTÉ CSS et non par l'attribut de
          présentation : `fill="var(--…)"` n'est pas fiable d'un moteur à
          l'autre, `style={{ fill }}` l'est, et le filet doit suivre le thème
          (T-0230). Le contenu d'un `<marker>` hérite des variables de la
          racine comme n'importe quel élément. */}
      <defs>
        <marker id="na" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--color-border-selected)' }} />
        </marker>
      </defs>
      <g fill="none" style={{ stroke: 'var(--color-border-selected)' }} strokeWidth="1.25" markerEnd="url(#na)">
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
  const base = `position: absolute; left: ${x}px; top: ${y}px; width: ${CARD_W}px; height: ${CARD_H}px; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; padding: 11px 13px; border-radius: 8px; cursor: pointer;`
  // Jamais de filet accent pour signifier un état (règle d'or §5.1) — le
  // survol et la sélection restent dans la même gamme neutre que le reste
  // de l'app, la sélection se distinguant par un halo, pas une couleur.
  const etat = isSelected
    ? 'background: var(--color-surface-elevated); border: 1px solid var(--color-border-selected); box-shadow: var(--ring-selected);'
    : hover.on
      ? 'background: var(--color-surface-card); border: 1px solid var(--color-border-selected);'
      : 'background: var(--color-surface-card); border: 1px solid var(--color-border-card);'

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
      <div style={s('font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-discrete); margin-top: 3px;')}>
        {page.route}
      </div>

      {shots.length > 0 ? (
        // `aspect-ratio` au rapport réel de la prise : sans lui, la vignette
        // ne montrait qu'une bande du haut de l'écran, identique d'une page à
        // l'autre.
        <img
          // `pages.json` ne porte aucun champ `shot` : le chemin se reconstruit
          // du slug et du nom de fichier, comme le fait déjà le panneau de
          // détail. Lire `page.shot` rendait sept vignettes cassées.
          src={shotUrl(snapshot.root, `shots/${page.slug}/${shots[0]}`)}
          alt=""
          // Le canevas rend toutes les pages d'un coup, la plupart hors écran :
          // sans ça, ouvrir l'onglet demandait cinquante captures de 100 ko à la
          // fois. Les captures visibles, elles, ne portent pas l'attribut — il
          // retarderait ce qu'on est venu regarder.
          loading="lazy"
          decoding="async"
          style={s(
            `width: 100%; aspect-ratio: ${shotRatio(page)}; object-fit: cover; object-position: top; border-radius: 6px; border: 1px solid var(--color-border-card); margin-top: 9px; display: block;`,
          )}
        />
      ) : (
        <div
          style={s(
            `width: 100%; aspect-ratio: ${shotRatio(page)}; border-radius: 6px; border: 1px dashed var(--color-border-control); margin-top: 9px; display: flex; align-items: center; justify-content: center; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-neutral-600);`,
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
        {/* Le gabarit interpole déjà le nombre : le préfixer donnait « 14 14 plans ». */}
        <span>{plans.length > 0 ? (plans.length > 1 ? t('produit.plan_count_plural', { n: plans.length }) : t('produit.plan_count', { n: 1 })) : t('produit.no_plans')}</span>
        <span style={s('flex: 1;')} />
        <span>{shots[0] ? frDateShort(shotDate(shots[0])) : '—'}</span>
      </div>
    </div>
  )
}
