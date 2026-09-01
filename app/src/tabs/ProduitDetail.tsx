/**
 * Le rail de détail de l'onglet Produit : une page, ses plans, ses captures, et
 * la comparaison de deux dates.
 *
 * Sorti de `Produit.tsx` (T-0206) — le canevas du graphe et le panneau de
 * détail ne partagent aucun état, seulement la page sélectionnée.
 */

import { useState } from 'react'

import {
  frDate,
  humanAge,
  pageName,
  plansForPage,
  shotDate,
  shotRatio,
  shotUrl,
  type Page,
  type Snapshot,
} from '../data'
import { Lightbox } from '../Lightbox'
import { t } from '../i18n'
import { s } from '../style'

/** Rail de détail — maquette l. 213-266. */
export function DetailPanel({
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
          ? `position: absolute; top: 0; right: 0; bottom: 0; width: ${width}px; border-left: 1px solid var(--color-divider); background: var(--color-surface-panel); padding: 20px; overflow: auto; box-shadow: var(--shadow-drawer); z-index: 5;`
          : `width: ${width}px; flex: none; border-left: 1px solid var(--color-divider); background: var(--color-surface-panel); padding: 20px; overflow: auto;`,
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
            `margin-top: 14px; border-radius: 8px; border: 1px solid var(--color-border-card); width: 100%; aspect-ratio: ${shotRatio(page)}; object-fit: cover; object-position: top; display: block; cursor: zoom-in;`,
          )}
        />
      ) : (
        <div
          style={s(
            `margin-top: 14px; border-radius: 8px; border: 1px dashed var(--color-border-control); width: 100%; aspect-ratio: ${shotRatio(page)}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--color-neutral-500);`,
          )}
        >
          {t('produit.no_screenshot')}
        </div>
      )}

      <div style={s('display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-neutral-500); margin-top: 8px;')}>
        <span style={s('width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-ink); display: block;')} />
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
                      'height: 44px; width: 100%; object-fit: cover; object-position: top; border-radius: 6px; border: 1px solid var(--color-border-card); display: block; cursor: zoom-in;',
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
              <div key={plan.file} style={s('border-left: 2px solid var(--color-accent-line); padding-left: 10px;')}>
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
export function CompareModal({
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
        'position: fixed; inset: 0; z-index: 50; background: var(--color-scrim); backdrop-filter: blur(3px); display: flex; flex-direction: column; padding: 16px 20px 14px;',
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
            'flex: 1; min-height: 0; width: 100%; object-fit: contain; border-radius: 8px; border: 1px solid var(--color-border-card); background: var(--theme-bg-lightbox);',
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
export function Footnotes({
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
    <div style={s('flex: none; border-top: 1px solid var(--color-divider); background: var(--color-surface-panel);')}>
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

