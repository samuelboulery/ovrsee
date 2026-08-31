/**
 * Le brief : ce que l'ovrsee sait dire du projet, et les lignes qu'il propose
 * d'injecter dans le terminal.
 *
 * Pas re-exporté par `data.ts` : ce module lit les dérivations de la façade, et
 * la façade le re-exporter fermerait un cycle. Ses quatre appelants l'importent
 * directement.
 */

import { t } from './i18n'
import {
  childrenOf,
  colonneFinale,
  epicProgress,
  frDate,
  lastScan,
  sortTickets,
} from './data'
import { plansOuverts } from './plans'
import type { Action, SettingsType, Snapshot } from './data'

/**
 * Ce que l'ovrsee sait dire du projet, sans lire une ligne de code.
 *
 * Vit ici et pas dans le panneau terminal : c'est une lecture d'instantané, pas
 * du rendu. Le panneau, lui, importe xterm et sa feuille de style — l'y laisser
 * rendait ces lignes intestables autrement qu'en démarrant un navigateur.
 */
export function briefLines(snapshot: Snapshot | null): Array<{ text: string; style: string }> {
  const dim = 'color: var(--color-neutral-400);'
  if (!snapshot)
    return [{ text: t('brief.reading'), style: 'color: var(--color-neutral-600);' }]

  const open = plansOuverts(snapshot.plans ?? [])
  const closed = (snapshot.plans ?? []).length - open.length
  const pages = snapshot.pages?.pages?.length ?? 0
  const scan = lastScan(snapshot.scans ?? [])

  const lines = [
    { text: '$ claude', style: 'color: var(--color-neutral-500);' },
    {
      text: `◆ ${t('brief.readable_in', { root: snapshot.root })} — ${t(pages > 1 ? 'brief.pages_plural' : 'brief.pages', { n: pages })}, ${t(closed > 1 ? 'brief.closed_plural' : 'brief.closed', { n: closed })}, ${t(open.length > 1 ? 'brief.open_plural' : 'brief.open', { n: open.length })}`,
      style: 'color: var(--color-accent);',
    },
    { text: '', style: '' },
  ]

  if (scan) {
    lines.push({
      text: scan.ok
        ? t('brief.scan_ok', { date: frDate(scan.date), commit: scan.commit })
        : t('brief.scan_failed', {
            date: frDate(scan.date),
            error: scan.error ?? t('brief.no_reason'),
          }),
      style: scan.ok ? dim : 'color: var(--color-accent);',
    })
  } else {
    lines.push({ text: t('brief.no_scan'), style: dim })
  }

  const oldest = open.at(-1)
  if (oldest) {
    lines.push({ text: t('brief.oldest_plan', { title: oldest.title }), style: dim })
  }
  lines.push({ text: '', style: '' })
  return lines
}

/** Les blocs de contexte que les boutons du panneau écrivent dans la session. */
export function buildInjections(snapshot: Snapshot | null): Array<{ label: string; text: string }> {
  if (!snapshot) return []

  const open = plansOuverts(snapshot.plans ?? [])
  const pages = snapshot.pages?.pages ?? []
  const tickets = snapshot.tickets ?? []
  const epicIds = new Set(tickets.filter(t => t.type === 'epic').map(t => t.id))
  const epicCount = epicIds.size

  return [
    {
      label: `Carte des pages (${pages.length})`,
      text: pages
        .map(p => `${p.route} — ${p.title} → ${(p.links ?? []).join(', ') || 'aucun lien'}`)
        .join('\n'),
    },
    {
      label: `${open.length} plan(s) ouvert(s)`,
      text: open.map(p => `- ${p.title} (ouvert le ${frDate(p.opened)})`).join('\n'),
    },
    {
      label: `Tableau (${tickets.length} ticket(s)${epicCount > 0 ? `, dont ${epicCount} epic(s)` : ''})`,
      // Colonne par colonne, dans l'ordre du tableau : c'est ce qui permet à
      // Claude de proposer un déplacement plutôt qu'un ticket de plus.
      // Les epics affichent leur progression ; les enfants affichent leur parent.
      text: (snapshot.board ?? [])
        .map(colonne => {
          const dedans = sortTickets(tickets.filter(t => t.colonne === colonne.id))
          const lignes = dedans.map(t => {
            let ligne = `  ${t.id} [${t.priorite}] ${t.titre}`
            // Si c'est un epic, afficher la progression
            if (t.type === 'epic') {
              const children = childrenOf(tickets, t.id)
              const prog = epicProgress(children, colonneFinale(snapshot.board ?? []))
              ligne += ` [${prog.done}/${prog.total} fait]`
            }
            // Si c'est un enfant, afficher le parent
            if (t.epic && epicIds.has(t.epic)) {
              ligne += ` (enfant de ${t.epic})`
            }
            return ligne
          })
          return [`${colonne.titre} (${dedans.length})`, ...lignes].join('\n')
        })
        .join('\n'),
    },
    {
      label: "Chemin de l'ovrsee",
      text: `Lis ${snapshot.root}/ovrsee/ pour l'état du projet. N'ouvre pas le code.`,
    },
  ]
}

/**
 * Décide si un texte est une commande (! ou /) ou du contexte.
 *
 * Les commandes s'injectent directement avec `\n` final : elles partent illico
 * dans le shell. Les contextes passent par le collage encadré (bracket paste) :
 * littéral, multiligne accepté, sans `\n` final — l'utilisateur relit et valide.
 *
 * @param text texte à injecter
 * @returns objet avec mode ('command' ou 'context') et texte adapté
 */
export function decideInjection(text: string): { mode: 'command' | 'context'; text: string } {
  // Les commandes commencent par ! ou /
  if (text.startsWith('!') || text.startsWith('/')) {
    // Commande : ajouter \n pour exécuter immédiatement
    return { mode: 'command', text: text + '\n' }
  }

  // Contexte : l'encadrement (bracket paste) sera fait par pasteToClaude()
  // On ne met pas de \n final — l'utilisateur valide lui-même
  return { mode: 'context', text }
}

/**
 * Actions livrées + actions personnalisées, avec validation des sauts de ligne.
 *
 * Les actions livrées demandent le gestionnaire : `!pnpm ovrsee:crawl` sur un
 * projet pnpm, `!npm run ovrsee:crawl` sur npm. Les actions perso sont tapées
 * telles quelles et refusent les sauts de ligne : une action multiligne serait
 * une commande shell qui s'exécute ligne par ligne, ce qui n'est pas explicite
 * au clic.
 *
 * Une action perso qui contient `\n` retourne une erreur dans le tableau.
 */
/**
 * Les commandes livrées avec l'ovrsee — extraites de `buildActions()` pour que
 * la palette ⌘K (T-0048) les propose sans les mêler aux actions personnalisées.
 *
 * Le crawl n'en fait plus partie. Il y était en `!<pm> ovrsee:crawl`, **sans
 * chemin de projet**, injecté dans une session dont le dossier courant est le
 * projet observé — où ce script n'existe pas. C'est le bouton de l'onglet
 * Produit qui lance désormais le crawl, par IPC et sur le bon dépôt.
 */
export function deliveredActions(_settings: SettingsType): Action[] {
  return [
    {
      label: t('action.graph'),
      text: '/graphify',
    },
    {
      label: t('action.graph_obsidian'),
      text: '/graphify . --obsidian --obsidian-dir ovrsee/obsidian/graphe',
    },
  ]
}

export function buildActions(
  snapshot: Snapshot | null,
  settings: SettingsType,
): Array<Action | { label: string; error: string }> {
  // Rejette les sauts de ligne — une action multiligne est plusieurs commandes
  // envoyées au shell d'un coup, ce qui n'est pas explicite au clic.
  const valider = (action: Action) =>
    action.text.includes('\n') ? { label: action.label, error: t('actions.newline_refused') } : action

  // Les actions du projet ouvert d'abord : ce sont les plus proches du travail
  // en cours. Elles vivent dans `~/.claude/ovrsee/settings.json` indexées par
  // chemin, jamais dans le dépôt observé (T-0216).
  const duProjet = snapshot ? (settings.projectActions?.[snapshot.root] ?? []) : []

  return [
    ...deliveredActions(settings),
    ...duProjet.map(valider),
    ...(settings.customActions ?? []).map(valider),
  ]
}

