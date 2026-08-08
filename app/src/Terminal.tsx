import { useState } from 'react'

import { backlog, frDate, lastScan, type Snapshot } from './data'
import { s } from './style'
import { useTerminal } from './useTerminal'

export type Layout = 'bottom' | 'side' | 'full'

const LAYOUTS: Array<[Layout, string]> = [
  ['bottom', 'Bas'],
  ['side', 'Côté'],
  ['full', 'Plein'],
]

const PANEL: Record<Layout, string> = {
  bottom:
    'height: 244px; flex: none; border-top: 1px solid var(--color-divider); background: #101120; display: flex; flex-direction: column; min-height: 0;',
  side: 'width: 468px; flex: none; border-left: 1px solid var(--color-divider); background: #101120; display: flex; flex-direction: column; min-height: 0;',
  full: 'flex: 1; background: #101120; display: flex; flex-direction: column; min-height: 0; min-width: 0;',
}

/**
 * Panneau terminal — maquette l. 374-418.
 *
 * La disposition et les trois modes sont portés à l'identique, mais le
 * terminal n'est pas branché : xterm.js et le pseudo-terminal arrivent en v1.1,
 * volontairement en dernier parce que c'est la seule brique qui ne produit
 * aucune donnée.
 *
 * En attendant, les boutons d'injection copient le contexte dans le
 * presse-papier. Un bouton qui prétend écrire dans une session inexistante
 * serait un mensonge d'interface ; un bouton qui copie fait vraiment ce qu'il
 * annonce.
 */
export function Terminal({
  layout,
  onLayout,
  onToggle,
  snapshot,
}: {
  layout: Layout
  onLayout: (layout: Layout) => void
  onToggle: () => void
  snapshot: Snapshot | null
}) {
  const [notice, setNotice] = useState<string | null>(null)
  const { host, error, inject, available } = useTerminal(snapshot?.root ?? null)

  /**
   * Un clic injecte dans la session quand elle existe, et copie sinon.
   *
   * Le repli n'est pas un pis-aller déguisé : le libellé du panneau change
   * aussi, pour que le bouton ne prétende jamais écrire dans une session
   * inexistante.
   */
  const activate = async (label: string, text: string) => {
    if (inject(text + '\n')) {
      setNotice(`« ${label} » injecté`)
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setNotice(`« ${label} » copié`)
      } catch {
        setNotice('copie refusée par le navigateur')
      }
    }
    setTimeout(() => setNotice(null), 2000)
  }

  const injections = buildInjections(snapshot)

  return (
    <div style={s(PANEL[layout])}>
      <div
        style={s(
          'height: 34px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--color-divider);',
        )}
      >
        <span
          style={s(
            'font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--color-neutral-500);',
          )}
        >
          Terminal · claude
        </span>
        <span
          title={available ? 'Session claude en cours' : 'Terminal disponible dans l’application'}
          style={s(
            available && !error
              ? 'width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 8px var(--color-accent); display: block;'
              : 'width: 6px; height: 6px; border-radius: 50%; border: 1px solid var(--color-neutral-600); display: block;',
          )}
        />
        <div style={s('flex: 1;')} />
        <span
          style={s(
            'font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--color-neutral-600);',
          )}
        >
          Disposition
        </span>
        <div style={s('display: flex; gap: 2px;')}>
          {LAYOUTS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onLayout(id)}
              style={s(
                'cursor: pointer; font-family: var(--font-body); font-size: 10.5px; letter-spacing: .06em; padding: 3px 9px; border-radius: 5px; border: 1px solid ' +
                  (layout === id
                    ? 'var(--color-accent-600); background: var(--color-accent-900); color: var(--color-accent-200);'
                    : 'var(--color-neutral-800); background: transparent; color: var(--color-neutral-500);'),
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="btn btn-ghost"
          style={s('font-size: 11px; padding: 4px 9px;')}
        >
          Réduire
        </button>
      </div>

      <div
        style={s(
          layout === 'side'
            ? 'flex: 1; display: flex; flex-direction: column; min-height: 0;'
            : 'flex: 1; display: flex; min-height: 0;',
        )}
      >
        {available && (
          // Session réelle : xterm occupe la zone, `claude` tourne derrière.
          <div style={s('flex: 1; min-width: 0; min-height: 0; padding: 8px 4px 8px 10px;')}>
            <div ref={host} style={s('width: 100%; height: 100%;')} />
          </div>
        )}

        {/* Sans passerelle IPC — c'est-à-dire dans un navigateur — pas de
            terminal. On le dit, plutôt que d'afficher une invite qui ne
            répondrait jamais. */}
        <div
          hidden={available}
          style={s(
            'flex: 1; overflow: auto; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; line-height: 1.75; min-width: 0;',
          )}
        >
          {briefLines(snapshot).map((line, i) => (
            <div key={i} style={s(line.style)}>
              {line.text || ' '}
            </div>
          ))}
          <div style={s('display: flex; align-items: center; gap: 7px; color: var(--color-neutral-600);')}>
            <span style={s('color: var(--color-neutral-700);')}>›</span>
            <span>terminal disponible dans l'application, pas dans le navigateur</span>
          </div>
        </div>

        <div
          style={s(
            layout === 'side'
              ? 'flex: none; border-top: 1px solid var(--color-divider); padding: 12px 14px;'
              : 'width: 268px; flex: none; border-left: 1px solid var(--color-divider); padding: 12px 14px;',
          )}
        >
          <div
            style={s(
              'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);',
            )}
          >
            {available ? 'Injecter dans la session' : 'Copier pour la session'}
          </div>
          <div style={s('display: flex; flex-direction: column; gap: 7px; margin-top: 11px;')}>
            {injections.map(({ label, text }) => (
              <button
                key={label}
                type="button"
                onClick={() => activate(label, text)}
                className="btn btn-secondary btn-block"
                style={s('font-size: 11.5px; padding: 5px 10px;')}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            style={s(
              'font-size: 11px; color: var(--color-neutral-600); margin-top: 13px; line-height: 1.5;',
            )}
          >
            {notice ??
              (error
                ? error
                : available
                  ? "Un clic écrit dans la session. Le cockpit ne lance rien d'autre que claude."
                  : "Un clic copie le contexte. Le cockpit n'exécute jamais.")}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Ce que le cockpit sait dire du projet, sans lire une ligne de code. */
function briefLines(snapshot: Snapshot | null): Array<{ text: string; style: string }> {
  const dim = 'color: var(--color-neutral-400);'
  if (!snapshot) return [{ text: 'lecture de cockpit/…', style: 'color: var(--color-neutral-600);' }]

  const open = backlog(snapshot.plans)
  const closed = snapshot.plans.length - open.length
  const pages = snapshot.pages?.pages.length ?? 0
  const scan = lastScan(snapshot.scans)

  const lines = [
    { text: '$ claude', style: 'color: var(--color-neutral-500);' },
    {
      text: `◆ Contexte lisible dans ${snapshot.root}/cockpit — ${pages} page(s), ${closed} plan(s) clos, ${open.length} ouvert(s)`,
      style: 'color: var(--color-accent-300);',
    },
    { text: '', style: '' },
  ]

  if (scan) {
    lines.push({
      text: scan.ok
        ? `Dernier scan réussi le ${frDate(scan.date)} (commit ${scan.commit}).`
        : `Dernier scan ÉCHOUÉ le ${frDate(scan.date)} : ${scan.error ?? 'raison non enregistrée'}.`,
      style: scan.ok ? dim : 'color: var(--color-accent-200);',
    })
  } else {
    lines.push({ text: 'Aucun scan enregistré : la carte des pages est vide.', style: dim })
  }

  const oldest = open.at(-1)
  if (oldest) {
    lines.push({ text: `Le plus ancien plan ouvert porte sur « ${oldest.title} ».`, style: dim })
  }
  lines.push({ text: '', style: '' })
  return lines
}

function buildInjections(snapshot: Snapshot | null): Array<{ label: string; text: string }> {
  if (!snapshot) return []

  const open = backlog(snapshot.plans)
  const pages = snapshot.pages?.pages ?? []

  return [
    {
      label: `Carte des pages (${pages.length})`,
      text: pages.map(p => `${p.route} — ${p.title} → ${p.links.join(', ') || 'aucun lien'}`).join('\n'),
    },
    {
      label: `${open.length} plan(s) ouvert(s)`,
      text: open.map(p => `- ${p.title} (ouvert le ${frDate(p.opened)})`).join('\n'),
    },
    {
      label: 'Chemin du cockpit',
      text: `Lis ${snapshot.root}/cockpit/ pour l'état du projet. N'ouvre pas le code.`,
    },
  ]
}
