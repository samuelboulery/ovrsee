/**
 * Les raccourcis clavier tels qu'on les ÉCRIT, par plateforme.
 *
 * Ce module ne câble rien : il ne fait que rendre la chaîne qu'on montre à
 * l'utilisateur. Les menus natifs, eux, n'en ont pas besoin — `electron/menu.js`
 * déclare ses accélérateurs en `CmdOrCtrl` et Electron fait la bascule tout
 * seul. Le rendu React n'avait pas cet équivalent : ses `⌘K`, `⇧⌘E`, `⌘⇧C`
 * étaient des littéraux, et sous Windows ils désignaient une touche absente du
 * clavier.
 *
 * Calqué sur `i18n.ts`, qui résout le même problème pour la langue : un état de
 * module, un `set…()` pour l'épingler, une détection en repli.
 */

export type Plateforme = 'mac' | 'autre'

/** Plateforme épinglée, ou `null` pour laisser parler la détection. */
let plateformeStockee: Plateforme | null = null

/**
 * Épingle la plateforme. Existe pour les tests, et ils en ont besoin.
 *
 * Node ≥ 21 définit un global `navigator`, avec un `platform` qui porte l'OS de
 * la machine. Sous `node --test`, la détection ci-dessous répond donc « mac »
 * sur un Mac et « autre » sur un poste Windows : toute assertion sur un glyphe
 * dépendrait du poste qui la joue, verte en CI et rouge chez le contributeur.
 *
 * Ce dépôt s'est déjà fait mordre par ce mécanisme exact, pour `navigator.language`
 * — voir le commentaire en tête de `prefs.test.tsx`. Tout test qui affirme un
 * raccourci épingle la plateforme d'abord.
 */
export function setPlateforme(plateforme: Plateforme | null): void {
  plateformeStockee = plateforme === 'mac' || plateforme === 'autre' ? plateforme : null
}

/**
 * Le clavier sous les doigts porte-t-il les touches Apple ?
 *
 * `navigator` répond des deux côtés — Electron comme `pnpm dev` — puisque le
 * rendu tourne dans Chromium dans les deux cas. Rien à faire passer par le
 * préchargement : ce serait un aller-retour IPC pour ce que la page sait déjà.
 *
 * `userAgentData` d'abord, `platform` ensuite : le second est déprécié, mais il
 * reste le seul repli hors des navigateurs Chromium.
 */
export function estMac(): boolean {
  if (plateformeStockee) return plateformeStockee === 'mac'
  if (typeof navigator === 'undefined') return false

  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const plateforme = nav.userAgentData?.platform ?? nav.platform ?? ''
  return plateforme.toLowerCase().includes('mac')
}

/** La touche modificatrice seule, pour l'insérer dans une phrase. */
export function toucheMod(): string {
  return estMac() ? '⌘' : 'Ctrl'
}

/**
 * Les modificateurs reconnus, dans l'ordre où Apple les écrit — `⌃⌥⇧⌘`, dont
 * il ne reste ici que le milieu. `⌃` n'y est pas : aucun raccourci de
 * l'application ne l'utilise, et sous Windows il ferait doublon avec la touche
 * « commande » que `raccourci()` pose déjà.
 */
const MODIFICATEURS = ['alt', 'shift'] as const

type Modificateur = (typeof MODIFICATEURS)[number]

const GLYPHE: Record<Modificateur, string> = { alt: '⌥', shift: '⇧' }
const MOT: Record<Modificateur, string> = { alt: 'Alt', shift: 'Shift' }

const estModificateur = (touche: unknown): touche is Modificateur =>
  typeof touche === 'string' && (MODIFICATEURS as readonly string[]).includes(touche)

/**
 * Un raccourci écrit pour la plateforme courante.
 *
 * La touche « commande » est implicite : tous les raccourcis de l'application
 * la portent, et l'écrire à chaque appel ne dirait rien de plus.
 *
 * ```
 * raccourci('K')          → ⌘K    | Ctrl+K
 * raccourci(',')          → ⌘,    | Ctrl+,
 * raccourci('shift', 'E') → ⇧⌘E   | Ctrl+Shift+E
 * raccourci('shift', 3)   → ⇧⌘3   | Ctrl+Shift+3
 * ```
 *
 * L'ordre des modificateurs est normalisé, pas repris de l'appelant : macOS
 * écrit `⌃⌥⇧⌘`, et le code portait les deux formes — `⇧⌘E` dans l'onglet
 * Navigateur, `⌘⇧C` dans l'Aperçu.
 *
 * @param touches des modificateurs (`shift`, `alt`) puis la touche
 */
export function raccourci(...touches: Array<Modificateur | string | number>): string {
  const mods = MODIFICATEURS.filter(mod => touches.some(touche => touche === mod))
  const finale = touches.filter(touche => !estModificateur(touche)).join('')

  if (estMac()) return `${mods.map(mod => GLYPHE[mod]).join('')}⌘${finale}`
  return ['Ctrl', ...mods.map(mod => MOT[mod]), finale].join('+')
}
