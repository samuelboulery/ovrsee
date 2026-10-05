---
{
  "status": "open",
  "title": "Issue #131 — nommer les epics `E-` plutôt que `T-`",
  "opened": "2026-09-30",
  "closed": null,
  "commits": [
    {
      "sha": "81c2a45",
      "date": "2026-09-30",
      "files": [
        "CLAUDE.md",
        "README.fr.md",
        "README.md",
        "app/src/tabs/Tableau.tsx",
        "hooks/active.js",
        "hooks/ovrsee-cli.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/ovrsee-post-commit.test.js",
        "hooks/reconcile.js",
        "hooks/reconcile.test.js",
        "hooks/ticket-id.js",
        "hooks/ticket-images.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js",
        "hooks/timeline.js",
        "mcp/server.js",
        "package.json",
        "skills/ovrsee-tickets/SKILL.md",
        "skills/ovrsee/SKILL.md"
      ]
    },
    {
      "sha": "e22be79",
      "date": "2026-10-05",
      "files": []
    }
  ]
}
---

# Issue #131 — nommer les epics `E-` plutôt que `T-`

## Contexte

Issue #131 (Floriane-ju) : Claude parle d'un « ticket » qui est en fait un epic ; le
préfixe commun `T-` ne les distingue pas. Demande : `T-XXXX` pour les tickets,
`E-XXXX` pour les epics.

Arbitrages déjà pris avec l'utilisateur :
- **Compteur partagé** entre `T-` et `E-` : un numéro désigne une seule chose. Les
  citations anciennes (`T-0243` dans les plans, les commits) restent lisibles, car
  le numéro ne bouge pas.
- **La promotion est conservée.** Cocher « epic » échange le préfixe en gardant le
  numéro (T-0250 → E-0250) ; décocher fait l'inverse. Le fichier, les images et le
  champ `epic` des enfants sont renommés. C'est l'unique exception à « le fichier
  n'est jamais renommé ».
- **Migration par commande manuelle.** `pnpm ovrsee:migrate-epics` applique le même
  échange à tout epic encore en `T-`. D'ici là, le code tolère un epic hérité en `T-`.

## Démarche

Branche `feat/epics-prefixe-e`. Un ticket via le skill `ovrsee-tickets`. TDD
(`node:test`, style existant). PR « Closes #131 ».

### 1. `hooks/tickets.js` : le cœur

- Une seule regex d'identifiant, `/^[TE]-\d+$/`. Elle remplace les copies des
  lignes 238, 398 et 572 (`isSafeTicketId`), ainsi que l'`idFromFile` de la
  ligne 651 (`/^([TE]-\d+)-/`). Le message d'erreur devient
  « epic doit être un ID E-XXXX ».
- `nextTicketId(tickets, type = null)` prend le maximum sur les **deux** préfixes et
  préfixe `E-` si `type === 'epic'`. Dans `creerTicket`, la validation de
  `champs.type` passe **avant** le calcul de l'id (lignes 219-234 réordonnées).
- Nouvelle fonction `changerPrefixe(ovrseeDir, file, type)`, appelée par
  `updateTicket` quand `patch.type` change réellement l'état epic, et par la
  migration. Elle tourne sous `withLock`, et elle :
  1. calcule le nouvel id (même numéro, autre préfixe) et refuse si un ticket le porte déjà ;
  2. écrit le nouveau fichier `ticketFileName(nouvelId, titre)` avec le nouveau
     `meta.id`, puis supprime l'ancien ;
  3. renomme les images `imagesDuTicket(ancienId)` et réécrit leurs chemins
     `ovrsee/tickets/images/T-0250-…` dans le corps ;
  4. réécrit le champ `epic` des enfants (`childrenOf`, ligne 725) ;
  5. déplace le pointeur de ticket actif des sessions qui le portaient
     (`allActive`, `writeActive` de `hooks/active.js`).
- `migrerEpics(ovrseeDir)` : `changerPrefixe` sur chaque ticket
  `type: 'epic'` dont l'id commence par `T-`. Elle rend la liste des renommages.

### 2. Les regex de citation

- `hooks/ovrsee-post-commit.js:109,200` : `/[TE]-\d{4}/g`. Le message stderr de la
  ligne 131 devient « Citer « T-XXXX » ou « E-XXXX » ».
- `hooks/reconcile.js:52-58` : citation `[TE]`. Un intervalle (`T-0164 → T-0179`)
  produit `T-n` **et** `E-n` pour chaque numéro : un id inexistant ne correspond à
  rien, et un epic au milieu de l'intervalle est trouvé.
- `hooks/active.js:103,152` : `[TE]`.
- `hooks/timeline.js:162` (`idNum`) : `[TE]`.

### 3. CLI et MCP

- `hooks/ovrsee-cli.js` : sous-commande `ticket migrate-epics`, qui imprime chaque
  renommage. Les textes d'usage passent de `--epic <T-XXXX>` à `<E-XXXX>`
  (lignes 14, 277 et 318).
- `package.json` : `"ovrsee:migrate-epics": "node hooks/ovrsee-cli.js ticket migrate-epics"`.
- `mcp/server.js:134-168` : la description du champ `epic` dit `E-XXXX`.

### 4. Interface

- `app/src/tabs/Tableau.tsx:163` `modifier` : quand `patch.type !== undefined`, pas
  d'aperçu optimiste, car le fichier change. On attend `ticketAction('update')`, puis
  `setOuverte` sur le ticket du même numéro dans l'instantané rendu. Sans ce suivi,
  le panneau de détail se ferme à la promotion.
- Rien d'autre dans `app/src` : l'interface n'analyse jamais les identifiants.

### 5. Documentation

- `skills/ovrsee-tickets/SKILL.md` (lignes 47-95 et 173-199) : un epic s'écrit
  `E-NNNN-slug.md` avec `"id": "E-NNNN"`. Le compteur est partagé : prendre le
  maximum sur `T-` et `E-`. Un epic hérité en `T-` se migre avec
  `ovrsee:migrate-epics`.
- `skills/ovrsee/SKILL.md` lignes 45-50 et 78.
- `README.md` et `README.fr.md` (sections epics et citations en commit, lignes ~86
  et ~332), `CLAUDE.md` (piège « Un commit s'inscrit… » : `T-XXXX` / `E-XXXX`).

### 6. Migration de ce dépôt

`pnpm ovrsee:migrate-epics` : 18 epics et 116 enfants. Commit séparé
`chore: migre les epics vers le préfixe E- (#131)`. Les plans qui citent `T-0243`
ne se touchent pas (produits par les hooks) ; leur numéro reste juste.

## Tests (TDD, rouge d'abord)

- `hooks/tickets.test.js` :
  - `nextTicketId` : compteur partagé, avec le préfixe selon le type ;
  - `createTicket({type:'epic'})` rend `E-…` ;
  - la promotion renomme le fichier, les images, le chemin dans le corps et les
    enfants, et la rétrogradation fait l'inverse ;
  - la promotion refuse un id déjà pris ;
  - `isSafeTicketId('E-0001')` est accepté ;
  - `migrerEpics` ne touche que les epics en `T-`, et un second passage ne fait rien.
- `hooks/reconcile.test.js` : un intervalle trouve un epic `E-` situé en son milieu.
- `hooks/ovrsee-post-commit.test.js` : un commit qui cite `E-XXXX` est rattaché au
  plan de l'epic.
- `hooks/active.test.js` : une entrée `E-` est lue.

## Vérification

- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build:ui`.
- `pnpm electron` : promouvoir un ticket, puis vérifier que le panneau reste ouvert
  sur `E-…`, que l'image collée s'affiche toujours, et qu'un enfant rattaché suit.
  Rétrograder de même.
- Après la migration, `ls ovrsee/tickets | grep '^E-' | wc -l` doit donner 18, et
  `grep -l '"epic": "T-' ovrsee/tickets/*.md` ne doit rien rendre.

## Hors périmètre

Les dépôts observés via l'app empaquetée n'ont pas de CLI : ils gardent leurs epics
`T-` (tolérés) tant que personne ne lance la migration. Un bouton ou un outil MCP
s'ajoutera si le besoin se présente.
