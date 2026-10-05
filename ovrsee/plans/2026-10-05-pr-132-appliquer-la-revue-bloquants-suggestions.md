---
{
  "status": "closed",
  "title": "PR #132 — appliquer la revue (bloquants + suggestions)",
  "opened": "2026-10-05",
  "closed": "2026-10-05",
  "commits": [
    {
      "sha": "8e28d14",
      "date": "2026-10-05",
      "files": []
    }
  ]
}
---

# PR #132 — appliquer la revue (bloquants + suggestions)

## Contexte

PR #132 (`fix/post-commit-tickets-sans-plan`) : `avancerTicketsCites` solde au commit
les tickets **sans plan**, **cités**, **en vol**. Revue `CHANGES_REQUESTED` : deux points
de doc bloquants, cinq suggestions. Périmètre retenu par l'utilisateur : **tout**.

Travail sur la branche de la PR, dans un worktree (`git worktree add ../ovrsee-pr132
fix/post-commit-tickets-sans-plan`) : le checkout courant est sur `feat/epics-prefixe-e`
(PR #133) avec des fichiers `ovrsee/` sales à ne pas embarquer.

Ticket ovrsee : skill `ovrsee-tickets`, lié au plan capturé, cité dans chaque commit.

## Bloquants (doc)

1. **`skills/ovrsee-tickets/SKILL.md:113-115`** — remplacer « ou pour un ticket sans
   `plan` … ne suivent que les tickets liés au plan actif » : un commit qui **cite** un
   ticket sans plan en vol le solde. Ajouter : *citer un ticket ad hoc le clôt ; pour un
   commit intermédiaire (`wip:`), ne pas le citer* — sinon l'édition suivante est bloquée
   par le gate. Ajouter la même chose près du paragraphe « ticket actif hors-plan ».
2. **`CLAUDE.md:222`** (puce « Un commit s'inscrit dans tous les plans… ») — une phrase :
   un ticket sans plan cité est soldé par `avancerTicketsCites` ; citer un ticket ad hoc le
   clôt, ne pas le citer dans un commit intermédiaire.

## Suggestions

3. **Prédicat « en vol » commun** — dans `hooks/tickets.js`, exporter
   `predicatEnVol(colonnes)` : renvoie `null` sans colonne finale ou sans `en-cours`,
   sinon `t => t.meta.colonne !== finale && rang(t) >= iEnCours`. Le brancher dans
   `avancerTicketsDuPlan` (`ovrsee-post-commit.js:180-198`), `avancerTicketsClos`
   (`tickets.js:652-680`) et `avancerTicketsCites`. Garder le commentaire « sans
   `en-cours`, ne rien fermer » à la définition.
4. **Regex de citation partagée** — `export const CITATION_TICKET = /\bT-\d{4,}\b/g` dans
   `tickets.js` (bornes `\b` comme #133). Utiliser aux trois `match(/T-\d{4}/g)` de
   `ovrsee-post-commit.js` (l. 109, 200, 241) et dans `ticketsCites` de
   `hooks/reconcile.js:52`; l'intervalle (`reconcile.js:54`) passe à `T-(\d{4,})`.
   Les validateurs ancrés `^T-\d+$` ne bougent pas (déjà justes).
   ⚠ #133 réécrit ces mêmes lignes en `[TE]-\d{4}` et crée `hooks/ticket-id.js` : le
   second des deux à merger se rebase, et la constante devient `/\b[TE]-\d{4,}\b/g`
   dans `ticket-id.js`.
5. **Plan inexistant** — dans `avancerTicketsCites`, traiter comme « sans plan » un
   ticket dont `plan` n'est pas un fichier présent de `ovrsee/plans/`
   (`isSafePlanFileName` + `existsSync`). Corriger le commentaire « reste à la règle du
   plan » en conséquence.
6. **Trace** — dans le corps du hook (`ovrsee-post-commit.js:328-334`), écrire sur stderr
   `[ovrsee] ticket soldé : T-XXXX` pour chaque id renvoyé par `avancerTicketsDuPlan` et
   `avancerTicketsCites` (même canal que `reconcile`).
7. **Message du gate** — `hooks/ovrsee-tool-edit-gate.js:107-110` : si le ticket actif
   existe mais est en colonne finale, dire « T-XXXX soldé par un commit — le rouvrir
   (`moveTicket` vers en-cours) ou en créer un » au lieu de « ni plan actif ni ticket
   actif ». Calcul local dans `main()` via `readActiveTicket`, `ticketActifManquant`
   inchangé.

## Tests (`node:test`, style existant)

Dans `hooks/ovrsee-post-commit.test.js`, rouges avant correctif quand applicable :
- ticket cité déjà en `fait` : rien ne bouge, `soldes` vide (idempotence) ;
- board sans colonne `en-cours` : rien ne bouge ;
- ticket dont `plan` pointe vers un plan absent : soldé ;
- citation `T-10000` : lue comme `T-10000`, pas `T-1000`.
Dans `hooks/tickets.test.js` : `predicatEnVol` (null sans `en-cours`, vrai/faux par colonne).
`hooks/reconcile.test.js` : un intervalle à 5 chiffres reste lu.

## Vérification

- `pnpm test` (et `pnpm lint`) dans le worktree, sortie lue.
- Repro jetable : dépôt équipé, ticket `en-cours` sans plan, commit `fix: x (T-0001)` →
  `fait` + ligne `[ovrsee] ticket soldé : T-0001` sur stderr ; puis édition → message
  du gate nomme T-0001.
- Commit(s) Conventional Commits français citant le ticket, push sur
  `fix/post-commit-tickets-sans-plan`, réponse à la revue sur la PR. Pas de
  `Co-Authored-By`.
