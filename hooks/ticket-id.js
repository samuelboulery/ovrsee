/**
 * Les identifiants de tickets : `T-0012` pour un ticket, `E-0012` pour un epic
 * (issue #131), sur un seul compteur.
 */

/**
 * Le prochain identifiant libre.
 *
 * Le maximum plus un, jamais le nombre de tickets : supprimer un ticket ne doit
 * pas faire réapparaître son numéro sur un autre. Un identifiant réutilisé
 * rendrait faux tout ce qui le cite — un commit, un plan, une conversation.
 *
 * Un seul compteur pour les tickets (`T-`) et les epics (`E-`, issue #131) : un
 * numéro ne désigne qu'une chose. C'est ce qui permet à une promotion de ne
 * changer que le préfixe, et à une citation ancienne de rester juste.
 *
 * @param {string|null} [type] `'epic'` pour un epic
 */
export function nextTicketId(tickets, type = null) {
  const max = tickets.reduce((haut, t) => {
    const found = /^[TE]-(\d+)$/.exec(String(t?.meta?.id ?? ''))
    return found ? Math.max(haut, Number(found[1])) : haut
  }, 0)

  return `${prefixe(type)}-${String(max + 1).padStart(4, '0')}`
}

/** Un identifiant de ticket : `T-` pour un ticket, `E-` pour un epic. */
export const ID_TICKET = /^[TE]-\d+$/

/**
 * Un ticket ou un epic cité dans un message de commit. Borné au mot en tête,
 * ce qui écarte `CVE-2024` ; `\d{4,}`, car `T-\d{4}` lisait `T-10000` comme
 * `T-1000`. Globale — pour `match`/`matchAll`, jamais `test`/`exec`.
 */
export const CITATION_TICKET = /\b[TE]-\d{4,}/g

const prefixe = type => (type === 'epic' ? 'E' : 'T')

/** Le même numéro, sous le préfixe que le type impose. */
export const idPourType = (id, type) => `${prefixe(type)}${id.slice(1)}`

/**
 * Un id de ticket est-il sûr à recoller à une comparaison ?
 *
 * Le ticket actif est la seule valeur relue du disque puis réinjectée dans une
 * comparaison d'id — même regex que la validation d'`epic` (`tickets.js`).
 */
export function isSafeTicketId(id) {
  return typeof id === 'string' && ID_TICKET.test(id)
}

/** L'id porté par un nom de fichier de ticket (`T-0012-slug.md` → `T-0012`), ou `null`. */
export const idFromFile = file => /^([TE]-\d+)-/.exec(file)?.[1] ?? null
