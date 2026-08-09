/**
 * Export de `cockpit/` en coffre Obsidian.
 *
 * Le cockpit stocke déjà du markdown lié : des plans, des tickets qui citent un
 * plan, des pages qui se lient entre elles. C'est un graphe de notes, et
 * Obsidian est fait pour ça. L'export ne calcule rien de neuf — il traduit ce
 * qui est sur le disque dans les conventions du coffre : frontmatter YAML,
 * wikilinks, images dans le coffre.
 *
 * Deux traductions, et une seule raison à chacune :
 *
 * 1. **JSON → YAML.** Le frontmatter du cockpit est du JSON, lisible par ses
 *    propres outils. Obsidian et Dataview ne lisent que du YAML : un
 *    frontmatter JSON s'affiche comme du texte brut et ne se requête pas.
 * 2. **Captures copiées dans le coffre.** Obsidian n'affiche pas une image
 *    située hors du coffre. Une seule par page, la plus récente ; l'historique
 *    complet reste dans `cockpit/pages/shots/`.
 *
 * Cohabitation avec Graphify : Graphify écrit `index.md`, `graph.canvas` et un
 * fichier par nœud **à la racine** du dossier qu'on lui donne. Lui donner le
 * coffre entier écraserait cet `index.md`-ci. On lui réserve donc `graphe/`,
 * que cet export ne touche jamais — ni en écriture, ni en nettoyage.
 */

import { copyFileSync, existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

import { writeFileNoFollow } from './plans.js'
import { shotPath, snapshot } from './snapshot.js'
import { colonneFinale } from './tickets.js'

/** Ce que cet export possède. Le reste du coffre — `graphe/` — lui survit. */
const NOTRE = ['index.md', 'plans', 'tickets', 'pages', 'shots']

/** Le sous-dossier laissé à Graphify. */
export const GRAPHE = 'graphe'

/**
 * Un scalaire YAML sûr.
 *
 * L'échappement JSON est un sous-ensemble strict du scalaire YAML entre
 * guillemets doubles : `JSON.stringify` n'émet que `\" \\ \b \f \n \r \t` et
 * `\uXXXX`, tous valides en YAML. Citer systématiquement évite d'avoir à
 * deviner quels titres se liraient comme un booléen, une date ou une ancre.
 */
const scalar = value => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(String(value))
}

/** Frontmatter YAML. Les listes sortent en blocs, donc requêtables en Dataview. */
function frontmatter(fields) {
  const lines = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
        continue
      }
      lines.push(`${key}:`)
      for (const item of value) lines.push(`  - ${scalar(item)}`)
      continue
    }
    lines.push(`${key}: ${scalar(value)}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

/** `2026-08-09-slug.md` → `2026-08-09-slug`. Un wikilink ne porte pas l'extension. */
const noteName = file => basename(String(file ?? ''), '.md')

const link = (path, label) => (label ? `[[${path}|${label}]]` : `[[${path}]]`)

const puces = items => (items.length > 0 ? items.map(i => `- ${i}`).join('\n') : '_Aucun._')

/**
 * Nom lisible d'une page. Même règle que `pageName` dans l'interface.
 *
 * `document.title` est souvent le même sur toutes les pages d'une application
 * à page unique : le reprendre tel quel donnerait six liens « Cockpit » dans
 * l'index, c'est-à-dire six liens qu'on ne peut pas distinguer. On se rabat
 * alors sur la route, qui, elle, distingue toujours.
 */
function pageName(page, pages) {
  const titre = page.title?.trim()
  if (titre && pages.filter(p => p.title?.trim() === titre).length === 1) return titre

  const segments = page.route.split('/').filter(Boolean)
  if (segments.length === 0) return 'Accueil'

  const last = segments.at(-1)
  const label = last.startsWith(':') ? (segments.at(-2) ?? last) : last
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ')
}

/**
 * Écrit le coffre. Rend la liste de ce qui a été fait, ligne par ligne — même
 * forme de retour que `install()`, que l'interface sait déjà afficher.
 *
 * Réexécutable : les dossiers que cet export possède sont vidés d'abord, pour
 * qu'un plan ou un ticket supprimé disparaisse aussi du coffre. Un export qui
 * empile laisserait des notes fantômes dont les liens ne résolvent plus.
 *
 * @param {string} root racine du dépôt observé
 * @param {string} [dir] dossier du coffre
 * @returns {string[]}
 */
export function exportVault(root, dir = join(root, 'cockpit', 'obsidian')) {
  const snap = snapshot(root)
  const done = []

  mkdirSync(dir, { recursive: true })
  if (lstatSync(dir).isSymbolicLink()) {
    throw new Error(`refus d'écrire : ${dir} est un lien symbolique`)
  }

  // Nettoyage nommé, jamais récursif sur le coffre : `graphe/` appartient à
  // Graphify, et le coffre peut aussi contenir des notes écrites à la main.
  for (const nom of NOTRE) rmSync(join(dir, nom), { recursive: true, force: true })

  done.push(...ecrirePlans(dir, snap))
  done.push(...ecrireTickets(dir, snap))
  done.push(...ecrirePages(dir, snap, root))
  ecrireIndex(dir, snap)
  done.push(`index.md écrit — ouvrir ${dir} comme coffre dans Obsidian`)

  return done
}

function ecrirePlans(dir, snap) {
  for (const plan of snap.plans) {
    const nom = noteName(plan.file)
    const fichiers = [...new Set((plan.commits ?? []).flatMap(c => c.files ?? []))]
    const tickets = snap.tickets.filter(t => t.plan === plan.file)

    const corps = [
      frontmatter({
        type: 'plan',
        titre: plan.title,
        status: plan.status,
        opened: plan.opened,
        closed: plan.closed ?? null,
        commits: (plan.commits ?? []).length,
        fichiers,
      }),
      `# ${plan.title}`,
      '',
      plan.body?.trim() ?? '',
      '',
      '## Tickets liés',
      '',
      puces(tickets.map(t => link(`tickets/${noteName(t.file)}`, t.titre))),
      '',
    ].join('\n')

    writeFileNoFollow(join(dir, 'plans', `${nom}.md`), corps)
  }

  return [`plans/ — ${snap.plans.length} note(s)`]
}

function ecrireTickets(dir, snap) {
  const titres = new Map(snap.board.map(c => [c.id, c.titre]))

  for (const ticket of snap.tickets) {
    const nom = noteName(ticket.file)
    const corps = [
      frontmatter({
        type: 'ticket',
        id: ticket.id,
        titre: ticket.titre,
        colonne: ticket.colonne,
        colonne_titre: titres.get(ticket.colonne) ?? ticket.colonne,
        priorite: ticket.priorite,
        tags: ticket.tags ?? [],
        cree: ticket.cree,
        maj: ticket.maj,
      }),
      `# ${ticket.id} — ${ticket.titre}`,
      '',
      ticket.plan ? `Plan : ${link(`plans/${noteName(ticket.plan)}`)}` : '_Aucun plan lié._',
      '',
      ticket.corps?.trim() ?? '',
      '',
    ].join('\n')

    writeFileNoFollow(join(dir, 'tickets', `${nom}.md`), corps)
  }

  return [`tickets/ — ${snap.tickets.length} note(s)`]
}

/**
 * Une note par page crawlée, capture comprise.
 *
 * Un scan raté laisse des captures plus vieilles que le commit. La note le dit
 * et date l'image : présenter une capture périmée comme fraîche est la seule
 * chose que ce projet ne fait jamais.
 */
function ecrirePages(dir, snap, root) {
  const pages = snap.pages?.pages ?? []
  if (pages.length === 0) return ['pages/ — aucun scan à exporter']

  const perime = snap.scans.at(-1)?.ok === false
  const parRoute = new Map(pages.map(p => [p.route, p]))
  let captures = 0

  for (const page of pages) {
    const source = page.shot ? shotPath(root, page.shot) : null
    if (source) {
      mkdirSync(join(dir, 'shots'), { recursive: true })
      copyFileSync(source, join(dir, 'shots', `${page.slug}.png`))
      captures += 1
    }

    const sortants = (page.links ?? [])
      .map(route => parRoute.get(route))
      .filter(Boolean)
      .map(p => link(`pages/${p.slug}`, pageName(p, pages)))

    const corps = [
      frontmatter({
        type: 'page',
        route: page.route,
        titre: pageName(page, pages),
        titre_document: page.title ?? '',
        capture: page.shotDate ?? null,
        capture_perimee: perime,
      }),
      `# ${pageName(page, pages)}`,
      '',
      `\`${page.route}\``,
      '',
      page.excerpt?.trim() ?? '',
      '',
      ...(source
        ? [
            perime
              ? `> Le dernier scan a échoué. Cette capture date du ${page.shotDate} et peut ne plus correspondre au code.`
              : `Capture du ${page.shotDate}.`,
            '',
            `![[shots/${page.slug}.png]]`,
            '',
          ]
        : ['_Aucune capture pour cette page._', '']),
      '## Liens sortants',
      '',
      puces(sortants),
      '',
    ].join('\n')

    writeFileNoFollow(join(dir, 'pages', `${page.slug}.md`), corps)
  }

  return [`pages/ — ${pages.length} note(s), ${captures} capture(s) copiée(s)`]
}

function ecrireIndex(dir, snap) {
  const ouverts = snap.plans.filter(p => p.status === 'open')
  const fini = colonneFinale(snap.board)
  const restants = snap.tickets.filter(t => t.colonne !== fini)
  const dernier = snap.scans.at(-1)
  const pages = snap.pages?.pages ?? []
  const nom = basename(snap.root)

  const corps = [
    frontmatter({
      type: 'cockpit',
      projet: nom,
      plans_ouverts: ouverts.length,
      tickets_restants: restants.length,
      pages: pages.length,
      dernier_scan: dernier?.date ?? null,
      dernier_scan_ok: dernier ? dernier.ok !== false : null,
    }),
    `# ${nom}`,
    '',
    "Coffre écrit par Cockpit depuis `cockpit/`. C'est une vue : la source reste le dépôt.",
    '',
    '## Ce qui est ouvert',
    '',
    puces(ouverts.map(p => link(`plans/${noteName(p.file)}`, p.title))),
    '',
    '## Ce qui reste à faire',
    '',
    puces(restants.map(t => link(`tickets/${noteName(t.file)}`, `${t.id} — ${t.titre}`))),
    '',
    '## Pages',
    '',
    puces(pages.map(p => link(`pages/${p.slug}`, pageName(p, pages)))),
    '',
    '## Plans clos',
    '',
    puces(
      snap.plans
        .filter(p => p.status === 'closed')
        .sort((a, b) => (b.closed ?? '').localeCompare(a.closed ?? ''))
        .map(p => `${p.closed} — ${link(`plans/${noteName(p.file)}`, p.title)}`),
    ),
    '',
    '## Graphe du code',
    '',
    existsSync(join(dir, GRAPHE))
      ? link(`${GRAPHE}/index`, 'Graphe du code')
      : `_Absent. Le produire avec_ \`/graphify . --obsidian --obsidian-dir <coffre>/${GRAPHE}\`.`,
    '',
  ].join('\n')

  writeFileNoFollow(join(dir, 'index.md'), corps)
}
