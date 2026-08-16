/**
 * État des sessions Claude tel que la barre de menu le montre.
 *
 * Le calcul vit ici, dans `app/src`, et pas dans `electron/tray.js` : le flux
 * pty n'est reconnu que dans le rendu (`attention.ts`, `useTerminal.ts`), et
 * `electron/` n'est ni typé ni couvert par `pnpm test`. Le processus principal
 * ne fait que retenir ce qu'on lui envoie et le republier au popover — une
 * plaque tournante, pas une seconde source de vérité.
 *
 * **Deux listes, pas une.** Une session existe parce que son pty est ouvert,
 * pas parce qu'elle a signalé quelque chose. Le premier jet les confondait :
 * une session ouverte et silencieuse n'apparaissait nulle part, et le popover
 * annonçait « aucune session » pendant qu'une tournait sous les yeux. D'où
 * `composer()`, qui prend les deux et rend l'union.
 */

import type { AttentionKind } from './attention'
import { EMPTY_GIT_STATUS, lastScan, plansOuverts, restant, type Snapshot } from './data'

/**
 * Ce qu'on peut répondre depuis le popover.
 *
 * Deux valeurs, et rien de plus : le rendu ne transmet jamais le texte à
 * écrire dans le pty. La correspondance touche vit dans `electron/tray.js`,
 * comme le nom du programme à lancer vit dans `electron/pty.js`.
 */
export type MenuBarDecision = 'allow' | 'deny'

/** Une session Claude dont le pty est ouvert. */
export interface MenuBarOuverte {
  /** `<chemin du projet>#claude` — voir `claudeSlot` dans `useTerminal.ts`. */
  sessionKey: string
  /** Identifiant du pty, seul jeton que le principal accepte pour écrire. */
  ptyId: string
  /** Chemin du projet, pour rebasculer dessus au clic. */
  projet: string
  /** Nom de dossier, pour l'affichage. */
  nom: string
}

/** Le dernier signal reçu d'une session. */
export interface MenuBarAttention {
  kind: AttentionKind
  /** Message du hook, quand il y en avait un — voir `hooks/ovrsee-notify.js`. */
  detail: string | null
  /** Horodatage du signal, en millisecondes. */
  at: number
}

/** Une session telle que le popover l'affiche. */
export interface MenuBarSession extends MenuBarOuverte {
  /** `null` quand la session tourne sans avoir rien signalé. */
  attention: MenuBarAttention | null
}

/** Le résumé du projet affiché, montré quand aucune session ne tourne. */
export interface MenuBarProjet {
  nom: string
  projet: string
  planActif: string | null
  ticketsRestants: number
  branche: string | null
  fichiersModifies: number
  /** Date du dernier scan réussi, `YYYY-MM-DD`, ou null. */
  dernierScan: string | null
}

/** Ce que le rendu principal publie. */
export interface MenuBarEtat {
  sessions: MenuBarSession[]
  projet: MenuBarProjet | null
}

/**
 * Ce que le popover reçoit — l'état publié, plus ce que seul le processus
 * principal sait.
 */
export interface MenuBarVue extends MenuBarEtat {
  /**
   * Le hook `ovrsee-notify.js` est-il enregistré dans `~/.claude/settings.json` ?
   *
   * Faux, aucune attente ne remontera jamais. Le popover doit le dire : sans
   * ça, la panne est parfaitement silencieuse.
   */
  signalInstalle: boolean
}

/**
 * Au-delà, une attente n'est plus décidable à distance.
 *
 * Le risque est concret : un signal vieux de trois minutes auquel on a déjà
 * répondu dans le terminal. Cliquer « Autoriser » approuverait alors à
 * l'aveugle la demande d'après. Deux minutes est court exprès — se tromper ici
 * autorise une commande qu'on n'a pas lue.
 */
export const PEREMPTION_MS = 2 * 60 * 1000

/** Une attente trop vieille pour qu'on décide sans regarder. */
export const estPerime = (session: MenuBarSession, now: number): boolean =>
  session.attention !== null && now - session.attention.at > PEREMPTION_MS

/** Une session sur laquelle les boutons de décision ont un sens. */
export const estDecidable = (session: MenuBarSession, now: number): boolean =>
  session.attention?.kind === 'question' && !estPerime(session, now)

/** 0 = attend une réponse, 1 = a rendu la main, 2 = silencieuse. */
const rang = (session: MenuBarSession): number => {
  if (session.attention === null) return 2
  return session.attention.kind === 'question' ? 0 : 1
}

/**
 * Compose la liste ouverte et les signaux reçus.
 *
 * Les attentes passent devant, puis le signal le plus récent. Les sessions
 * silencieuses ferment la marche **par ordre alphabétique** et non par ordre
 * d'ouverture : sans clé stable, deux sessions muettes changeraient de place
 * d'un rendu à l'autre.
 *
 * Une attente dont la session n'est plus ouverte disparaît avec elle — c'est
 * `ouvertes` qui décide de ce qui existe, jamais `attentions`.
 */
export function composer(
  ouvertes: readonly MenuBarOuverte[],
  attentions: Readonly<Record<string, MenuBarAttention>>,
): MenuBarSession[] {
  return ouvertes
    .map(ouverte => ({ ...ouverte, attention: attentions[ouverte.sessionKey] ?? null }))
    .sort((a, b) => {
      const ecart = rang(a) - rang(b)
      if (ecart !== 0) return ecart
      if (a.attention && b.attention) return b.attention.at - a.attention.at
      return a.nom.localeCompare(b.nom) || a.sessionKey.localeCompare(b.sessionKey)
    })
}

/**
 * Résumé du projet affiché, pour le popover quand aucune session ne tourne.
 *
 * Dérivé ici et publié avec l'état plutôt que refait par le popover : celui-ci
 * est un rendu isolé, et lui faire relire `/api/project` créerait une seconde
 * source pour une donnée que le rendu principal tient déjà.
 *
 * Tout vient de fonctions qui existent — rien n'est recompté à la main.
 */
export function resumeProjet(snapshot: Snapshot | null): MenuBarProjet | null {
  if (!snapshot?.root) return null

  const git = snapshot.gitStatus ?? EMPTY_GIT_STATUS
  const ouverts = plansOuverts(snapshot.plans ?? [])
  // `activePlans` porte des noms de fichiers ; c'est leur titre qui se lit. Le
  // popover n'a la place que d'un plan : on prend le premier actif. À défaut,
  // le plan ouvert le plus récent — `plansOuverts` les rend déjà triés.
  const actif =
    (snapshot.plans ?? []).find(plan => (snapshot.activePlans ?? []).includes(plan.file)) ??
    ouverts[0] ??
    null
  const scan = lastScan(snapshot.scans ?? [])

  return {
    nom: snapshot.packageJson?.name ?? snapshot.root.split('/').filter(Boolean).pop() ?? snapshot.root,
    projet: snapshot.root,
    planActif: actif?.title ?? null,
    ticketsRestants: restant(snapshot.tickets ?? [], snapshot.board ?? []),
    branche: git.branch,
    fichiersModifies: git.dirty.staged + git.dirty.unstaged + git.dirty.untracked,
    // Un scan en échec n'est pas un dernier scan : il ne dit rien de l'état
    // des pages, et l'afficher comme tel mentirait.
    dernierScan: scan?.ok ? scan.date : null,
  }
}

/** Y a-t-il de quoi allumer l'icône de la barre de menu ? */
export const compteEnAttente = (sessions: readonly MenuBarSession[], now: number): number =>
  sessions.filter(session => estDecidable(session, now)).length
