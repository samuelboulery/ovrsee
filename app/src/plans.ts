/**
 * Les plans capturés : leur forme, l'extraction de leurs sections markdown, et
 * les trois listes qu'on en tire (ouverts, historique, plans d'une page).
 */

import { t } from './i18n'
import { liste } from './liste'
import type { Page } from './pages'

export interface Commit {
  sha: string
  date: string
  files: string[]
}

export interface Plan {
  file: string
  status: 'open' | 'closed'
  title: string
  opened: string
  closed: string | null
  commits: Commit[]
  /** Le plan tel qu'il a été approuvé, en markdown. */
  body: string
}

const section = (body: string, headings: RegExp): string | null => {
  const lines = (body ?? '').split('\n')
  const start = lines.findIndex(line => /^#{1,4}\s/.test(line) && headings.test(line))
  if (start === -1) return null

  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => /^#{1,4}\s/.test(line))
  const text = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return text || null
}

/**
 * Retire la syntaxe markdown pour un affichage en texte simple.
 *
 * Le corps d'un plan est du markdown écrit pour être lu par Claude ; l'afficher
 * brut fait apparaître les astérisques et les accents graves à l'écran. On
 * retire les marques, jamais les mots : le sens n'est pas touché.
 */
export function stripMarkdown(text: string): string {
  return (text ?? '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const firstParagraph = (text: string): string =>
  text
    .split('\n\n')
    .map(p => p.trim())
    .find(p => p && !p.startsWith('#') && !p.startsWith('|')) ?? ''

/**
 * L'intention derrière un plan : le « pourquoi », pas le « quoi ».
 *
 * Extrait de la section Contexte / Problème / Intention, et réduit à son
 * premier paragraphe — celui qui pose le problème. On ne résume JAMAIS : un
 * résumé généré serait exactement la documentation fausse que ce projet existe
 * pour éviter. On coupe, ce qui est vérifiable ; on ne reformule pas.
 */
export function planWhy(plan: Plan): string {
  const found = section(plan.body, /contexte|probl[eè]me|intention|pourquoi/i)
  const raw = firstParagraph(found ?? plan.body ?? '')
  return raw ? stripMarkdown(raw) : t('msg.no_intention')
}

/**
 * L'alternative explicitement écartée.
 *
 * C'est le critère qui distingue une décision d'une simple trace : une
 * décision ferme une porte. Un plan sans alternative écartée n'en avait pas.
 */
export function planRejected(plan: Plan): string | null {
  const found = section(plan.body, /[ée]cart|alternative|rejet|au lieu de|pourquoi pas/i)
  const raw = found ? firstParagraph(found) || found : null
  return raw ? stripMarkdown(raw) : null
}

/** Fichiers sources touchés par un plan, tous commits confondus. */
export const planFiles = (plan: Plan): string[] => [
  ...new Set(plan.commits.flatMap(commit => commit.files ?? [])),
]

/**
 * Les plans jamais clos.
 *
 * Ce n'est plus le backlog — celui-ci se saisit maintenant, ticket par ticket.
 * C'est l'intention en cours : ce qui a été approuvé et pas encore soldé par un
 * commit. Les deux listes se répondent sans se confondre.
 */
export const plansOuverts = (plans: Plan[]): Plan[] =>
  liste(plans).filter(p => p.status === 'open').sort((a, b) => (b.opened ?? '').localeCompare(a.opened ?? ''))

/** L'historique n'est pas saisi : ce sont les plans clos, par date de clôture. */
export const history = (plans: Plan[]): Plan[] =>
  liste(plans)
    .filter(p => p.status === 'closed')
    .sort((a, b) => (b.closed ?? '').localeCompare(a.closed ?? ''))

/**
 * Plans clos ayant touché les fichiers d'une page.
 *
 * C'est ce qui relie l'historique à la carte : un plan touche des fichiers, et
 * ces fichiers appartiennent à une page. Le rapprochement se fait sur le nom
 * de fichier — une page `/plante/:id` retient les plans touchant un fichier
 * dont le nom évoque « plante ».
 *
 * Approximation assumée : sans analyse du routeur, on ne sait pas relier un
 * fichier à une route de façon certaine. Une page sans plan n'est pas une
 * erreur, c'est l'information qu'elle n'a pas bougé.
 */
export function plansForPage(plans: Plan[], page: Page): Plan[] {
  const words = page.route
    .split('/')
    .filter(segment => segment && !segment.startsWith(':'))
    .map(segment => segment.toLowerCase())

  if (words.length === 0) return [] // la racine ne se rapproche de rien de fiable

  return history(plans).filter(plan =>
    plan.commits.some(commit =>
      commit.files.some(file => words.some(word => file.toLowerCase().includes(word))),
    ),
  )
}
