/**
 * Densité d'activité : le calcul, et rien d'autre.
 *
 * Ce module vit à part de `plans.js` pour une raison précise : `app/src` en a
 * besoin, et `plans.js` importe `node:fs`. Un import depuis l'interface y
 * ferait entrer des modules Node dans le bundle du navigateur, que Vite
 * externalise — l'application se charge, puis tombe à la première lecture.
 *
 * D'où la règle : ici, aucun accès au disque, aucun module Node. Rien que des
 * dates et des nombres. C'est ce qui permet à l'interface, au CLI et au serveur
 * MCP de partager une seule implémentation.
 */


/**
 * Calcule l'indice du seau pour un commit donné selon la granularité.
 * Retourne un nombre >= 0. Les seaux sont numérotés du plus ancien au plus récent.
 *
 * @param {Date} commitDate
 * @param {Date} now
 * @param {'heure'|'jour'|'semaine'|'mois'} granularite
 * @returns {number} indice du seau (-1 si incalculable)
 */
function bucketIndex(commitDate, now, granularite = 'semaine') {
  if (granularite === 'heure') {
    const now_h = Math.floor(now.getTime() / (60 * 60 * 1000))
    const commit_h = Math.floor(commitDate.getTime() / (60 * 60 * 1000))
    return now_h - commit_h
  }

  if (granularite === 'jour') {
    // Nombre de jours calendaires entre commitDate et now
    const now_days = Math.floor(now.getTime() / (24 * 60 * 60 * 1000))
    const commit_days = Math.floor(commitDate.getTime() / (24 * 60 * 60 * 1000))
    return now_days - commit_days
  }

  if (granularite === 'semaine') {
    // Nombre de semaines (lun-dim) entre commitDate et now
    const toMonday = (date) => {
      const d = new Date(date)
      const day = d.getDay() // 0 = dimanche
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      d.setDate(diff)
      d.setHours(0, 0, 0, 0)
      return Math.floor(d.getTime() / (24 * 60 * 60 * 1000))
    }
    const now_monday = toMonday(now)
    const commit_monday = toMonday(commitDate)
    return (now_monday - commit_monday) / 7
  }

  if (granularite === 'mois') {
    // Nombre de mois civils entre commitDate et now
    const now_months = now.getFullYear() * 12 + now.getMonth()
    const commit_months = commitDate.getFullYear() * 12 + commitDate.getMonth()
    return now_months - commit_months
  }

  return -1
}

/**
 * Retourne la granularité pour une fenêtre donnée.
 *
 * @param {'jour'|'semaine'|'mois'|'3mois'|'an'} fenetre
 * @returns {'heure'|'jour'|'semaine'|'mois'}
 */
function granulariteForFenetre(fenetre = '3mois') {
  if (fenetre === 'jour') return 'heure'
  if (fenetre === 'semaine') return 'jour'
  if (fenetre === 'mois') return 'jour'
  if (fenetre === '3mois') return 'semaine'
  if (fenetre === 'an') return 'mois'
  return 'semaine'
}

/**
 * Retourne le nombre de seaux pour une fenêtre donnée.
 *
 * @param {'jour'|'semaine'|'mois'|'3mois'|'an'} fenetre
 * @returns {number}
 */
function bucketCount(fenetre = '3mois') {
  if (fenetre === 'jour') return 24 // 24 heures
  if (fenetre === 'semaine') return 7 // 7 jours
  if (fenetre === 'mois') return 30 // 30 jours (approx)
  if (fenetre === '3mois') return 13 // 13 semaines
  if (fenetre === 'an') return 12 // 12 mois
  return 16 // défaut
}

/**
 * Densité d'activité : nombre de commits par seau.
 *
 * Un seul réglage, la fenêtre, parce qu'un seul geste est offert à l'écran :
 * cinq crans, du jour à l'année. La granularité s'en déduit — une fenêtre d'un
 * an découpée à l'heure ferait 8 760 colonnes, et une fenêtre d'un jour
 * découpée au mois en ferait une seule. Laisser les deux axes libres n'offrait
 * que des combinaisons absurdes en plus.
 *
 * L'entrée est une liste de commits, jamais de plans : la densité compte tout
 * ce qui a été poussé, y compris hors plan.
 *
 * @param {Array<{date: string}>} commits
 * @param {{fenetre?: string, now?: Date}} [opts]
 * @returns {number[]} tableau du plus ancien seau au plus récent
 */
export function density(commits, { fenetre, now = new Date() } = {}) {
  const fenetreNorm = fenetre ?? '3mois'
  const granulariteNorm = granulariteForFenetre(fenetreNorm)
  const bucketCnt = bucketCount(fenetreNorm)
  const buckets = new Array(bucketCnt).fill(0)

  for (const commit of Array.isArray(commits) ? commits : []) {
    const at = Date.parse(commit.date)
    if (Number.isNaN(at)) continue
    const index = bucketIndex(new Date(at), now, granulariteNorm)
    if (index >= 0 && index < bucketCnt) {
      buckets[bucketCnt - 1 - index] += 1 // Renverse : seau 0 = ancien, n-1 = récent
    }
  }

  return buckets
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Nombre d'entrées par jour calendaire, sur une fenêtre de `days` jours se
 * terminant aujourd'hui. Du plus ancien au plus récent, comme `density()`.
 *
 * Primitive volontairement plus simple que `density()` : celle-ci choisit sa
 * granularité selon une fenêtre nommée (jour/semaine/mois/an), utile pour un
 * seul réglage à l'écran. Le graphe d'activité de l'onglet Historique a besoin
 * de fenêtres fixes en jours (14, 30) et d'un repliage en semaines (12×7) —
 * une seule primitive suffit aux trois, pas besoin d'étendre `density()`.
 *
 * @param {Array<{date: string}>} entries
 * @param {number} days
 * @param {Date} [now]
 * @returns {number[]}
 */
export function dailyCounts(entries, days, now = new Date()) {
  const buckets = new Array(days).fill(0)
  const nowDays = Math.floor(now.getTime() / DAY_MS)

  for (const entry of Array.isArray(entries) ? entries : []) {
    const at = Date.parse(entry?.date)
    if (Number.isNaN(at)) continue
    const age = nowDays - Math.floor(at / DAY_MS)
    if (age >= 0 && age < days) buckets[days - 1 - age] += 1
  }

  return buckets
}

/**
 * Replie une série journalière (plus ancien → plus récent) en sommes
 * hebdomadaires, même ordre. `daily.length` doit être un multiple de 7 —
 * appelant contrôlé (`dailyCounts(entries, weeks * 7)`), pas une entrée
 * externe à valider.
 *
 * @param {number[]} daily
 * @returns {number[]}
 */
export function foldWeekly(daily) {
  const weeks = []
  for (let i = 0; i < daily.length; i += 7) {
    weeks.push(daily.slice(i, i + 7).reduce((sum, n) => sum + n, 0))
  }
  return weeks
}
