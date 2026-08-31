---
{
  "status": "open",
  "title": "Un plan ne doit plus pouvoir rester ouvert sans commit",
  "opened": "2026-08-31",
  "closed": null,
  "commits": []
}
---

# Un plan ne doit plus pouvoir rester ouvert sans commit

## Contexte

Cette session a laissé un plan bloqué : *« Préférences : séparer ce projet de
tous les projets »*, ouvert, zéro commit, inclosable. Il a fallu un script
jetable appelant `updatePlanMeta` à la main, puis une PR (#88), pour en venir à
bout.

**La cause est dans `planPourCommit`** (`hooks/ovrsee-post-commit.js:90`) : ses
quatre étages s'arrêtent au **premier** qui répond. Le commit `40bdb70` citait
`T-0216`, il est donc parti au plan de ce ticket — et le plan actif de la
session, celui des préférences, n'a rien reçu. Sans commit, `closeOpenPlans`
(`hooks/plans.js:401`) refuse de dater la clôture, et **passe son tour en
silence** : `continue` sans un mot. Le plan serait resté ouvert indéfiniment,
en captant au passage tout commit de la session.

Deux mécanismes se sont donc manqués : l'attribution qui perd un plan vrai, et
la clôture qui ne dit pas pourquoi elle ne fait rien. On corrige les deux.

**Décisions prises** : un commit s'inscrit dans **tous** les plans qu'il
réalise, mais seuls les tickets du plan **désigné par la citation** avancent en
colonne finale — le plan de session reçoit la trace, pas le pouvoir de solder.

## Le travail

### 1. `hooks/ovrsee-post-commit.js` — l'union, plus le premier qui répond

`planPourCommit` devient `plansPourCommit` et rend un **tableau**
`Array<{file, source}>`, sans doublon :

- tous les plans des **tickets cités** (`source: 'ticket'`) ;
- **plus** le plan actif de la session (`source: 'session'`), s'il y en a un ;
- si les deux précédents sont vides, l'**unique plan actif** (`source: 'unique'`)
  — le repli le plus hasardeux reste un dernier recours, pas un ajout.

`isSafePlanFileName` continue de filtrer chaque entrée. Le doc-comment des
quatre étages (`:67-88`) se réécrit : ce ne sont plus des étages qui
s'excluent, mais deux sources qui s'additionnent et un repli.

`attachCommit` (`:109`) attache le même objet commit à chaque plan trouvé et
rend le tableau. Son message d'avertissement (« aucun plan rattaché ») ne
change pas.

Dans le corps du hook (`:253-266`) : une ligne `[ovrsee] commit rattaché à …`
par plan, et **`avancerTicketsDuPlan` seulement** sur les entrées de source
`ticket` ; s'il n'y en a aucune, sur l'unique plan trouvé, avec
`devine = source === 'unique'` comme aujourd'hui. C'est le seul point où le
comportement ne se généralise pas, et il mérite son commentaire.

### 2. `hooks/plans.js` — `closeOpenPlans` dit ce qu'il ne fait pas, et sait viser

- Le test `commits.length === 0` passe **après** le filtre de portée, et
  journalise : `« … : aucun commit, laissé ouvert — ovrsee:close <fichier>
  --commit <sha> »`. Sans le filtre d'abord, une capture de plan crierait sur
  les plans des sessions voisines.
- `options` accepte `{ only: <fichier> }` : ne considérer que ce plan-là.
  Cumulable avec `session`, et sans effet sur les appelants existants qui
  passent `undefined`.

### 3. `hooks/ovrsee-cli.js` — `close` cesse d'être un rouleau compresseur

```
close [<plan.md>] [--commit <sha>] [--help]
```

- `--help` (ou `-h`) affiche l'usage **sans exécuter** — aujourd'hui
  `close --help` clôt tout, ce que `CLAUDE.md` signale déjà comme un piège.
- Un fichier de plan en argument : `closeOpenPlans(…, { only: fichier })`.
  Sans argument, le comportement actuel — tous les plans ouverts — avec une
  ligne le rappelant avant d'agir.
- `--commit <sha>` : rattache d'abord ce commit au plan visé (exige donc le
  plan), via `attachCommitToPlan` (`hooks/plans.js:464`), en résolvant `sha`
  court et date par `git rev-parse --short` et `git log -1 --format=%cs` — le
  geste exact que ce dépannage a demandé, en une commande au lieu d'un script
  jetable.
- L'en-tête d'usage du fichier (`:8`) suit.

### 4. `hooks/ovrsee-cli.js` — `status` montre les plans à zéro commit

Le bloc existant (`:84-95`) ne signale que les **tickets** liés à un plan sans
commit. Ajouter juste avant la liste des plans **eux-mêmes** dans ce cas, avec
le geste : `ovrsee:close <fichier> --commit <sha>`. C'est ce qui aurait rendu
la panne visible sans qu'on la cherche.

## Tests (`node:test`, aucun framework — style existant)

- `hooks/ovrsee-post-commit.test.js` : les cinq tests de `planPourCommit`
  (`:216-280`) migrent vers `plansPourCommit` et son tableau. **Le test neuf
  est celui qui aurait attrapé la panne** : un message citant `T-XXXX` du plan A
  pendant que la session pointe le plan B rend **les deux**, sources `ticket`
  et `session`. Le vérifier rouge avant la correction.
- `hooks/plans.test.js` : `closeOpenPlans` journalise un plan ouvert sans
  commit ; `{ only }` ne ferme que le plan visé et laisse les autres ouverts.
- Pas de test du dispatch CLI — aucun n'existe, et en ajouter un demanderait un
  harnais que ce dépôt n'a pas.

## Vérification

1. `pnpm lint && pnpm typecheck && pnpm test` — vert.
2. `pnpm ovrsee:status` : la section des plans à zéro commit apparaît (vide
   aujourd'hui, les 82 plans étant clos).
3. `pnpm ovrsee:close --help` : affiche l'usage, **ne clôt rien** — vérifier
   qu'aucun plan n'a bougé après.
4. Bout en bout, sur ce dépôt : capturer un plan, faire un commit citant un
   ticket rattaché à un **autre** plan, et constater que les deux plans portent
   le commit — puis que seuls les tickets du plan cité ont avancé.

## Suite

Ticket à créer via le skill `ovrsee-tickets` (charge `s`, priorité moyenne) :
« Un commit s'inscrit dans tous les plans qu'il réalise ». Commit et PR
séparés du travail d'interface déjà mergé.
