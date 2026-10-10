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
  approve?: (projectPath: string) => Promise<boolean>
}

/** Le pont Electron, ou `null` dans un navigateur. */
function crawlBridge(): CrawlBridge | null {
  return (globalThis as { ovrsee?: { crawl?: CrawlBridge } }).ovrsee?.crawl ?? null
}

/**
 * Demande l'accord pour la commande `dev` d'un projet qu'on vient d'équiper.
 *
 * Le processus principal relit le disque et pose la question dans une modale
 * native : ce que le formulaire a saisi n'y entre pas, un rendu compromis
 * pouvant affirmer n'importe quoi (T-0273).
 *
 * Sans IPC (mode navigateur), l'appel ne fait rien et rend `null` : aucun
 * accord ne s'y donne, et le crawl n'y est de toute façon pas lançable.
 * `false` dit un refus — ou rien à approuver, faute de commande `dev`.
 */
export async function approuverCrawl(root: string): Promise<boolean | null> {
  return (await crawlBridge()?.approve?.(root)) ?? null
}

/** `true` quand le crawl est lançable d'un clic — donc seulement dans Electron. */
export const crawlDisponible = (): boolean => crawlBridge() !== null

export function useCrawl(root: string, onFini: () => void) {
  const [etat, setEtat] = useState<CrawlState>(REPOS)
  // Un refus au lancement (projet inconnu, accord refusé) ne produit aucune
  // transition d'état : sans lui, le clic ne faisait rien de visible (T-0283).
  const [erreur, setErreur] = useState<string | null>(null)

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
    setErreur(null)
    crawlBridge()
      ?.start(root)
      .then(retour => {
        if ('error' in retour) setErreur(retour.error)
      })
      .catch((err: unknown) => setErreur(String((err as Error)?.message ?? err)))
  }, [root])

  const arreter = useCallback(() => {
    crawlBridge()?.stop(root)
  }, [root])

  // `project` compte : un crawl peut tourner sur un autre projet que celui
  // qu'on regarde, et son avancement n'a alors rien à dire ici.
  const enCours = etat.running && etat.project === root

  return { enCours, ligne: enCours ? etat.line : null, erreur, demarrer, arreter }
}
