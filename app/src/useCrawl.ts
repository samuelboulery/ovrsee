/**
 * L'état du crawl en cours, vu du rendu.
 *
 * Il vit dans le processus principal (`electron/crawl.js`), pas ici : un
 * changement d'onglet démonte le composant, et le crawl continue. `listen`
 * redemande l'état courant à l'abonnement, sinon un onglet remonté pendant un
 * crawl s'afficherait inerte.
 *
 * Dans un navigateur (`pnpm dev`), `window.ovrsee` n'existe pas : le pont rend
 * `null`, `running` reste faux, et l'appelant montre le geste d'avant plutôt
 * qu'un bouton qui ne ferait rien.
 */

import { useCallback, useEffect, useState } from 'react'

export interface CrawlState {
  running: boolean
  project: string | null
  line: string | null
}

const REPOS: CrawlState = { running: false, project: null, line: null }

interface CrawlBridge {
  start: (projectPath: string) => Promise<CrawlState | { error: string }>
  stop: (projectPath: string) => Promise<CrawlState>
  listen: (handler: (etat: CrawlState) => void) => () => void
  approve?: (projectPath: string, devSaisi: string | null) => Promise<boolean>
}

/** Le pont Electron, ou `null` dans un navigateur. */
function crawlBridge(): CrawlBridge | null {
  return (globalThis as { ovrsee?: { crawl?: CrawlBridge } }).ovrsee?.crawl ?? null
}

/**
 * Accorde la confiance à la commande `dev` d'un projet qu'on vient d'équiper.
 *
 * `devSaisi` est ce que l'utilisateur a tapé au formulaire, pas ce qui sera
 * approuvé : le processus principal relit le disque et n'approuve que ce qu'il
 * y trouve. La valeur ne sert qu'à distinguer « le disque dit ce que vous venez
 * de taper » — accord tacite — de « le dépôt avait déjà sa propre commande »,
 * qui pose la question.
 *
 * Sans IPC (mode navigateur), l'appel ne fait rien : aucun accord ne s'y donne,
 * et le crawl n'y est de toute façon pas lançable.
 */
export function approuverCrawl(root: string, devSaisi: string | null): void {
  void crawlBridge()?.approve?.(root, devSaisi)
}

/** `true` quand le crawl est lançable d'un clic — donc seulement dans Electron. */
export const crawlDisponible = (): boolean => crawlBridge() !== null

export function useCrawl(root: string, onFini: () => void) {
  const [etat, setEtat] = useState<CrawlState>(REPOS)

  useEffect(() => {
    const bridge = crawlBridge()
    if (!bridge) return

    let precedent = false
    return bridge.listen(suivant => {
      // Le passage de « en cours » à « fini » est le seul moment où relire le
      // projet vaut la peine : c'est là que `pages.json` et `scans.jsonl`
      // viennent de changer. Un échec passe par le même chemin — le crawler
      // l'écrit dans `scans.jsonl` et sort proprement, et c'est `scanFailed`
      // qui l'affichera, comme pour un scan lancé au commit.
      if (precedent && !suivant.running) onFini()
      precedent = suivant.running
      setEtat(suivant)
    })
  }, [onFini])

  const demarrer = useCallback(() => {
    crawlBridge()?.start(root)
  }, [root])

  const arreter = useCallback(() => {
    crawlBridge()?.stop(root)
  }, [root])

  // `project` compte : un crawl peut tourner sur un autre projet que celui
  // qu'on regarde, et son avancement n'a alors rien à dire ici.
  const enCours = etat.running && etat.project === root

  return { enCours, ligne: enCours ? etat.line : null, demarrer, arreter }
}
