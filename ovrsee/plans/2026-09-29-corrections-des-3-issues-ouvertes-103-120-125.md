---
{
  "status": "closed",
  "title": "Corrections des 3 issues ouvertes (#103, #120, #125)",
  "opened": "2026-09-29",
  "closed": "2026-09-29",
  "commits": [
    {
      "sha": "05098bc",
      "date": "2026-09-29",
      "files": [
        "hooks/notify.test.js",
        "hooks/ovrsee-notify.js"
      ]
    },
    {
      "sha": "17abc00",
      "date": "2026-09-29",
      "files": []
    }
  ]
}
---

# Corrections des 3 issues ouvertes (#103, #120, #125)

## Contexte
Trois issues GitHub ouvertes : un bug de statut (#125), deux évolutions (#120, #103).
Une branche + une PR par issue, chacune avec son ticket `T-XXXX` (skill `ovrsee-tickets`),
en TDD, `pnpm test` / `lint` / `typecheck` avant PR. Ordre proposé : #103 (petit, isolé),
#125, puis #120 (touche l'invariant, CLAUDE.md à mettre à jour).

---

## #103 — Colonne « fait » : plus récemment soldé en haut

**Cause** : `sortTickets` (`app/src/data.ts:353`) trie toutes les colonnes par priorité puis `cree`.
Aucun champ ne date le passage en « fait » ; `maj` est date seule et bouge à chaque édition.

**Correction**
1. `hooks/tickets.js` `moveTicket` (:315) : si destination = `colonneFinale(board)`,
   écrire `fait: now.toISOString()` ; sinon retirer `fait`. Idem `createTicket` (:206)
   quand il crée directement en colonne finale. Tous les chemins (post-commit,
   `avancerTicketsClos`, route API, CLI, `removeColumn`) passent par `moveTicket` : un seul point.
2. `app/src/data.ts` : `fait?: string` dans `Ticket` (:168) ; nouvelle `sortFaits` :
   `(b.fait ?? b.maj).localeCompare(a.fait ?? a.maj) || b.id.localeCompare(a.id)`.
   Repli `maj` puis id décroissant : les anciens tickets sans `fait` sortent déjà dans le
   bon ordre sur l'exemple de l'issue (0179 avant 0178).
3. `app/src/tabs/Tableau.tsx:296` : `sortFaits` pour la colonne finale, `sortTickets` ailleurs.
   `sortTickets` partagé (brief, CLI, epics) reste intact.
4. `Tableau.tsx:102-111` (`deplacer`, optimiste) : poser `fait` localement aussi, sinon la
   carte déposée saute à sa place « maj » jusqu'au prochain snapshot.
5. Mention du champ `fait` dans le skill `ovrsee-tickets` s'il décrit le format.

**Tests** : `hooks/tickets.test.js` (moveTicket pose/retire `fait`), `app/src/data.test.ts` (`sortFaits`, repli maj, repli id).

---

## #125 — Le statut passe à « fait » alors que des agents d'arrière-plan tournent

**Cause** : `genrePour` (`hooks/ovrsee-notify.js:131-155`) mappe tout `Stop` sur `stop`, et
`Terminal.tsx:200` écrase l'état de la session au dernier signal. Rien n'écoute
`SubagentStart`/`SubagentStop`.

**Correction** (hook reste sans état ; le comptage vit dans le rendu, qui tient déjà l'état)
1. `ovrsee-notify.js` : `SubagentStart` → genre `sub-start`, `SubagentStop` → `sub-stop`,
   détail = `agent_id`.
2. `hooks/install.js:154` : ajouter les deux événements à `SIGNAL_EVENTS`. `signalInstalle`
   les exigera → une install ancienne apparaît « incomplète » et invite à `pnpm ovrsee:install` (voulu).
3. `app/src/attention.ts` (:20, :64) : accepter les deux nouveaux genres.
4. `app/src/Terminal.tsx:176-233` : `Set<agent_id>` par session. `sub-start` ajoute,
   `sub-stop` retire. `stop` reçu avec set non vide → afficher `busy` et mémoriser un « stop
   en attente » ; dernier `sub-stop` avec stop en attente → `stop`. `reset` vide le set.
   Set d'identifiants plutôt que compteur : un doublon ne dérègle rien.
5. Limites assumées, à écrire dans le PR : les tâches Bash d'arrière-plan n'ont pas de hook
   (non couvertes) ; un `SubagentStop` perdu laisse l'onglet « occupé » jusqu'au prochain `reset`/`/clear`.

**À vérifier d'abord** (agent `docs-lookup` + essai réel) : que `SubagentStart/Stop` se
déclenchent bien pour les agents lancés en arrière-plan **et** ceux d'un Workflow, et le nom
exact du champ `agent_id`. Si les Workflows ne les émettent pas, le signaler sur l'issue
plutôt que lire le transcript.

**Tests** : `hooks/notify.test.js` (mapping), `hooks/install.test.js:190` (6 événements),
`app/src/attention.test.ts`, et extraire la réduction d'état de Terminal.tsx en fonction pure
(`app/src/etatSession.ts` ou dans `menubar.ts`) pour la tester en `node:test`.

---

## #120 — Bouton « Lancer le serveur » dans le Navigateur

**Invariant** : compatible — c'est un terminal que l'utilisateur demande d'un clic. Mais la
commande `dev` vient du dépôt observé : elle passe par le même accord que le crawl
(`crawl/confiance.js`), et le rendu ne nomme toujours aucun programme.

**Correction**
1. `electron/pty.js` : nouveau `kind: 'dev'`. `openSession` lit `devSurDisque()`
   (`electron/crawl.js:53`), exige `estApprouve` (`crawl/confiance.js:109`), sinon refuse.
   Commande de démarrage = la chaîne approuvée + `\n`, dans le shell `-lic` habituel.
2. `electron/main.js` `pty:open` (:371) : pour `dev` non approuvé, passer d'abord par
   `demanderAccord` (:401, la modale native de `crawl:approve`) — pas de nouvelle modale.
3. `app/src/pty.ts:22` : `kind` accepte `'dev'`. `useTerminal.ts` `openShell` (:311) prend un `kind`.
4. `Terminal.tsx` : `TerminalActions` (:24) gagne `lancerDev()` ; réutilise le message
   « lancé dans un nouveau terminal » d'`activate` (:467-527).
5. `App.tsx` : prop `onLancerServeur` vers `<Navigateur>` (:698). Panneau replié
   (`terminalActions.current` nul) → `setTerminal(true)` + demande gardée dans une ref,
   rejouée au montage.
6. `Navigateur.tsx:576-596` : bouton dans l'overlay d'échec, seulement si `errorCode === -102`
   (connexion refusée) et Electron. Après lancement, relancer `view.current?.reload()` toutes
   les 2 s jusqu'au succès (plafond 60 s, comme le crawl). Sortir le « et lancez » codé en dur
   vers `hooks/i18n.js` (:596, :1358) + nouvelle clé du bouton.
7. Doc : commentaires `Navigateur.tsx:35` et `data.ts:195` (« jamais exécutée ») deviennent
   faux ; ajouter une puce dans CLAUDE.md (§ invariant) : la ligne `dev` s'exécute aussi par
   le terminal, même accord, même relecture disque.

**Tests** : `electron/pty` — `kind: 'dev'` refusé sans accord, commande lue sur disque et non
reçue du rendu ; le reste se vérifie en lançant l'app (`pnpm electron`) : dev arrêté → bouton →
modale d'accord → terminal ouvert → page rechargée.

---

## Vérification
- `pnpm test`, `pnpm lint`, `pnpm typecheck` verts sur chaque branche.
- `pnpm electron` : Kanban (déplacer 2 tickets en « fait », ordre), onglet terminal avec un
  agent d'arrière-plan lancé depuis Claude (reste « occupé »), bouton Navigateur.
- Protocole `ovrsee://` et dev server testés tous deux pour toute route touchée (aucune prévue).
