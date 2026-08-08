/**
 * Frise du projet : les commits, et les plans qui les expliquent.
 *
 * L'historique ne montrait que les plans clos. Un projet vibecodé avance aussi
 * par commits hors plan — correctifs, retouches, dépendances — et les taire
 * donnait une chronologie à trous : on voyait les intentions, jamais le travail
 * entre elles.
 *
 * Le regroupement se fait ici, en Node, plutôt que dans le rendu : c'est la
 * seule logique non triviale du lot, et c'est ici qu'elle tombe sous
 * `pnpm test` sans imposer un lanceur de tests au TypeScript de l'interface.
 */

/**
 * @typedef {{sha: string, date: string, subject: string}} GitCommit
 * @typedef {{
 *   kind: 'plan',
 *   date: string,
 *   plan: string,
 *   title: string,
 *   status: 'open' | 'closed',
 *   commits: GitCommit[],
 * }} PlanEntry
 * @typedef {{kind: 'commit', date: string, commit: GitCommit}} CommitEntry
 * @typedef {PlanEntry | CommitEntry} Entry
 */

/**
 * Une entrée par commit, sauf pour les suites de commits d'un même plan.
 *
 * Le repli ne vaut que pour des commits *consécutifs*. Un plan repris après
 * un détour donne deux bandes — c'est ce qui s'est passé, et prétendre le
 * contraire ferait passer un aller-retour pour une seule poussée.
 *
 * Un plan dont aucun commit n'apparaît dans le journal (jamais commencé, ou
 * plus vieux que la fenêtre lue) est ajouté à sa date : le backlog et
 * l'historique ne doivent pas perdre un plan parce que git n'en sait rien.
 *
 * @param {GitCommit[]} commits du plus récent au plus ancien
 * @param {Array<{file: string, title: string, status: 'open'|'closed', opened: string, closed: string|null, commits?: Array<{sha: string}>}>} plans
 * @returns {Entry[]}
 */
export function timeline(commits, plans) {
  const planOf = new Map()
  for (const plan of plans ?? []) {
    for (const commit of plan.commits ?? []) {
      if (commit?.sha) planOf.set(commit.sha, plan)
    }
  }

  /** @type {Entry[]} */
  const entries = []
  const banded = new Set()

  for (const commit of commits ?? []) {
    const plan = planOf.get(commit.sha)

    if (!plan) {
      entries.push({ kind: 'commit', date: commit.date, commit })
      continue
    }

    const last = entries.at(-1)
    if (last?.kind === 'plan' && last.plan === plan.file) {
      last.commits.push(commit)
      continue
    }

    banded.add(plan.file)
    entries.push({
      kind: 'plan',
      date: commit.date,
      plan: plan.file,
      title: plan.title,
      status: plan.status,
      commits: [commit],
    })
  }

  for (const plan of plans ?? []) {
    if (banded.has(plan.file)) continue
    const date = plan.closed ?? plan.opened
    if (!date) continue
    entries.push({
      kind: 'plan',
      date,
      plan: plan.file,
      title: plan.title,
      status: plan.status,
      commits: [],
    })
  }

  // Tri stable : deux entrées du même jour gardent l'ordre du journal git.
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}
