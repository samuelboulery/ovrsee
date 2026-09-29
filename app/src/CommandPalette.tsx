/**
 * Palette de commandes ⌘K (T-0048, maquette 2b/2k).
 *
 * Aucune infrastructure de ce genre n'existait avant la refonte : ni
 * raccourci, ni registre de commandes. Celle-ci reste volontairement étroite
 * — naviguer vers une vue ou les Préférences, retrouver un ticket par son
 * titre, lancer une des trois commandes terminal déjà livrées
 * (`deliveredActions()` dans `data.ts`). Rien d'autre : pas de recherche
 * plein texte dans les plans ou les commits, pas de registre extensible.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { deliveredActions } from './brief'
import { FolderOpen, Gear, MagnifyingGlass, Terminal as TerminalIcon, Ticket as TicketIcon } from '@phosphor-icons/react'

import { TAB_ICONS, activeTabsInOrder, type TabId } from './views'
import {
  type Project,
  type SettingsType,
  type Ticket,
} from './data'
import { pasteToClaude } from './pty'
import { t } from './i18n'
import { raccourci } from './raccourcis'
import { s } from './style'

type Item =
  | { kind: 'project'; key: string; label: string; path: string; badge: number | null }
  | { kind: 'view'; key: string; id: TabId; label: string; path: string; shortcut: number | null }
  | { kind: 'preferences'; key: string; label: string }
  | { kind: 'ticket'; key: string; label: string; sub: string; file: string }
  | { kind: 'command'; key: string; label: string; text: string }

/** Projets listés sans recherche — au-delà, il faut taper. */
const RECENTS = 5

export function CommandPalette({
  settings,
  tickets,
  projects,
  current,
  onClose,
  onTabPick,
  onPick,
  onOpenPreferences,
  onOpenTicket,
}: {
  settings: SettingsType | null
  tickets: Ticket[]
  projects: Project[]
  current: string | null
  onClose: () => void
  onTabPick: (id: TabId, path: string) => void
  onPick: (path: string) => void
  onOpenPreferences: () => void
  onOpenTicket: (file: string) => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const groups = useMemo(() => {
    // Sans dénormaliser, chercher « theme » ne trouve pas un ticket « Thème
    // clair » — le clavier français ne tape pas toujours l'accent, la
    // recherche ne doit pas l'exiger.
    const normalise = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    const q = normalise(query.trim())
    const match = (label: string) => q === '' || normalise(label).includes(q)

    const activeViews = activeTabsInOrder(settings)
    // Sans recherche, la liste est bornée aux plus récents : `projects` arrive
    // trié par dernière ouverture (`hooks/snapshot.js`), et onze projets au
    // registre mangeaient la palette avant qu'on ait tapé quoi que ce soit. La
    // recherche, elle, porte sur tous — c'est ce que le titre de section dit.
    const projectItems: Item[] = projects
      .filter(project => match(project.name))
      .slice(0, q === '' ? RECENTS : undefined)
      .map(
        project =>
          ({
            kind: 'project',
            key: `project:${project.path}`,
            label: project.name,
            path: project.path,
            badge: project.path === current ? tickets.length : null,
          }) as const,
      )

    const views: Item[] = activeViews
      .filter(([, cle]) => match(t(cle)))
      .map(
        ([id, cle, path]) =>
          ({
            kind: 'view',
            key: `view:${id}`,
            id,
            label: t(cle),
            path,
            shortcut: activeViews.findIndex(([viewId]) => viewId === id) + 1,
          }) as const,
      )

    const preferences: Item[] = match(t('sidebar.preferences'))
      ? [{ kind: 'preferences', key: 'preferences', label: t('sidebar.preferences') } as const]
      : []

    // Vide, la recherche de tickets n'a rien à proposer de plus utile que la
    // vue Tableau elle-même — et lister les 45 tickets du projet au premier
    // ⌘K serait plus bruyant qu'utile.
    const ticketItems: Item[] =
      q === ''
        ? []
        : tickets
            .filter(tk => normalise(tk.titre).includes(q) || normalise(tk.id).includes(q))
            .slice(0, 8)
            .map(tk => ({ kind: 'ticket', key: `ticket:${tk.file}`, label: tk.titre, sub: tk.id, file: tk.file }) as const)

    const commands: Item[] = settings
      ? deliveredActions(settings)
          .filter(action => match(action.label))
          .map(action => ({ kind: 'command', key: `command:${action.label}`, label: action.label, text: action.text }) as const)
      : []

    return [
      { title: q === '' ? t('palette.recent_projects') : t('sidebar.projects'), items: projectItems },
      { title: t('sidebar.views'), items: [...views, ...preferences] },
      { title: t('palette.tickets'), items: ticketItems },
      { title: t('palette.commands'), items: commands },
    ].filter(group => group.items.length > 0)
  }, [query, settings, tickets, projects, current])

  const flat = useMemo(() => groups.flatMap(group => group.items), [groups])

  // La sélection suit la liste filtrée : sans ce clamp, taper une lettre qui
  // réduit les résultats laisse l'index pointer au-delà de la fin.
  useEffect(() => {
    setSelected(before => Math.min(before, Math.max(flat.length - 1, 0)))
  }, [flat.length])

  const activate = (item: Item) => {
    if (item.kind === 'project') onPick(item.path)
    else if (item.kind === 'view') onTabPick(item.id, item.path)
    else if (item.kind === 'preferences') onOpenPreferences()
    else if (item.kind === 'ticket') onOpenTicket(item.file)
    else if (item.kind === 'command') {
      // Même repli que les boutons du terminal (`Terminal.tsx`) : sans
      // session active (terminal masqué, ou navigateur), copier plutôt que
      // perdre le geste.
      if (!pasteToClaude(item.text)) void navigator.clipboard.writeText(item.text).catch(() => {})
    }
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 60; background: var(--color-scrim); backdrop-filter: blur(3px); display: flex; align-items: flex-start; justify-content: center; padding: 14vh 24px 24px;',
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.placeholder')}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            onClose()
            event.preventDefault()
          } else if (event.key === 'ArrowDown') {
            setSelected(before => Math.min(before + 1, flat.length - 1))
            event.preventDefault()
          } else if (event.key === 'ArrowUp') {
            setSelected(before => Math.max(before - 1, 0))
            event.preventDefault()
          } else if (event.key === 'Enter') {
            const item = flat[selected]
            if (item) activate(item)
            event.preventDefault()
          }
        }}
        style={s(
          'width: min(560px, 100%); max-height: 60vh; display: flex; flex-direction: column; overflow: hidden; background: var(--color-surface-control); border: 1px solid var(--color-divider); border-radius: 8px; box-shadow: var(--shadow-lg);',
        )}
      >
        <div
          style={s(
            'flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--color-divider);',
          )}
        >
          <MagnifyingGlass size={16} aria-hidden="true" color="var(--color-text-tertiary)" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            style={s(
              'flex: 1; border: 0; background: transparent; color: var(--color-text); font-family: var(--font-mono); font-size: 12px;',
            )}
          />
        </div>

        <div style={s('flex: 1; overflow-y: auto; padding: 6px;')}>
          {flat.length === 0 && (
            <div style={s('padding: 24px 14px; text-align: center; font-size: 13px; color: var(--color-text-quaternary);')}>
              {t('palette.no_results')}
            </div>
          )}

          {groups.map(group => (
            <div key={group.title}>
              <div
                style={s(
                  'padding: 8px 8px 4px; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);',
                )}
              >
                {group.title}
              </div>
              {group.items.map(item => (
                <PaletteRow
                  key={item.key}
                  item={item}
                  active={flat.indexOf(item) === selected}
                  onHover={() => setSelected(flat.indexOf(item))}
                  onPick={() => activate(item)}
                />
              ))}
            </div>
          ))}
        </div>

        <div
          style={s(
            'flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-top: 1px solid var(--color-divider);',
          )}
        >
          <FolderOpen size={14} weight="regular" aria-hidden="true" color="var(--color-text-quaternary)" />
          <span style={s('flex: 1; font-size: 12px; color: var(--color-text-tertiary);')}>
            {projects.find(project => project.path === current)?.name ?? t('sidebar.projects')}
          </span>
          <button
            type="button"
            onClick={() => {
              onOpenPreferences()
              onClose()
            }}
            title={t('sidebar.preferences')}
            style={s(
              'display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-text-quaternary); cursor: pointer;',
            )}
          >
            <Gear size={14} weight="regular" aria-hidden="true" />
          </button>
        </div>

        <div
          style={s(
            'flex: none; display: flex; gap: 14px; padding: 8px 14px; border-top: 1px solid var(--color-divider); font-size: 11px; color: var(--color-text-quaternary);',
          )}
        >
          <span>↑↓ {t('palette.hint_navigate')}</span>
          <span>⏎ {t('palette.hint_open')}</span>
          <span>esc {t('palette.hint_close')}</span>
        </div>
      </div>
    </div>
  )
}

function PaletteRow({
  item,
  active,
  onHover,
  onPick,
}: {
  item: Item
  active: boolean
  onHover: () => void
  onPick: () => void
}) {
  const Icon =
    item.kind === 'project'
      ? FolderOpen
      : item.kind === 'view'
        ? TAB_ICONS[item.id]
        : item.kind === 'preferences'
          ? Gear
          : item.kind === 'ticket'
            ? TicketIcon
            : TerminalIcon

  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onPick}
      style={s(
        'width: 100%; display: flex; align-items: center; gap: 10px; padding: 7px 8px; border: 0; border-radius: var(--radius-sm); cursor: pointer; text-align: left; font-size: 13px; font-family: var(--font-body); ' +
          (active
            ? 'background: var(--color-surface-active); color: var(--color-text);'
            : 'background: transparent; color: var(--color-text-secondary);'),
      )}
    >
      <Icon size={16} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
      <span style={s('flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{item.label}</span>
      {item.kind === 'ticket' && (
        <span style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-text-quaternary);')}>
          {item.sub}
        </span>
      )}
      {item.kind === 'project' && item.badge !== null && (
        <span
          className="tag tag-neutral"
          style={s('font-family: var(--font-mono);')}
        >
          {item.badge}
        </span>
      )}
      {item.kind === 'view' && item.shortcut !== null && item.shortcut > 0 && item.shortcut <= 9 && (
        <span style={s('font-family: var(--font-mono); font-size: 11px; color: var(--color-text-quaternary);')}>
          {raccourci(item.shortcut)}
        </span>
      )}
    </button>
  )
}
