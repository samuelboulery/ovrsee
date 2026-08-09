---
name: cockpit
description: Use when a project has a cockpit/ directory and you need to brief yourself on it, or when a plan was approved without the capture hook running. Reads captured plans, page map and screenshots to reconstruct project context without reading the code.
---

# Cockpit

Le dossier `cockpit/` d'un dépôt contient l'état du projet sous forme lisible :
les plans approuvés, la carte des pages, les captures datées. Il est écrit par
des hooks, jamais à la main.

**Le cockpit se lit. Il ne s'exécute jamais.** Une seule exception à l'édition :
`cockpit/tickets/` et `cockpit/board.json`, qui sont le tableau du projet et se
saisissent — par l'interface, par toi, ou par le CLI. Les plans, les pages et
les scans restent capturés par des hooks et ne s'éditent pas à la main.

## Quand l'utiliser

- Reprise d'un projet dormant : lire `cockpit/` avant d'ouvrir le code.
- L'utilisateur demande où en est le projet, ce qui reste à faire, ou pourquoi
  telle décision a été prise.
- Un plan vient d'être approuvé mais le hook de capture n'a pas tourné.

## Ce qu'on lit, et dans quel ordre

1. `cockpit/plans/*.md` — un fichier par plan approuvé. Frontmatter JSON entre
   deux `---` : `status` (`open` | `closed`), `title`, `opened`, `closed`,
   `commits[]` (chacun avec `sha`, `date`, `files[]`). Le corps est le plan tel
   qu'il a été approuvé, avec son intention et ses alternatives écartées.
2. `cockpit/pages/pages.json` — les pages de l'application, leurs routes et
   leurs liens sortants.
3. `cockpit/pages/scans.jsonl` — une ligne par scan. **Une ligne `"ok": false`
   signifie que le crawl a échoué ce jour-là : les captures de cette page sont
   plus vieilles que le commit.** Ne jamais présenter une capture périmée comme
   fraîche.
4. `cockpit/board.json` puis `cockpit/tickets/*.md` — le tableau : ce qui reste
   à faire. Voir la section « Tickets » ci-dessous.
5. `graphify-out/graph.json` — schéma de données et stack. Les relations y sont
   étiquetées `EXTRACTED` (lue dans le code), `INFERRED` (déduite) ou
   `AMBIGUOUS` (incertaine). Reprendre l'étiquette quand on cite la relation.

## Tickets

Le tableau du projet. Un fichier par ticket dans `cockpit/tickets/`, nommé
`T-0012-un-slug.md`. Frontmatter JSON entre deux `---`, corps en markdown :

```markdown
---
{
  "id": "T-0012",
  "titre": "Glisser-déposer entre colonnes",
  "colonne": "pret",
  "priorite": "haute",
  "tags": ["ui"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte
Pourquoi ce ticket existe.

## Critères d'acceptation
- [ ] …
```

- `colonne` référence un `id` de `cockpit/board.json`. Colonnes par défaut :
  `backlog`, `a-specifier`, `pret`, `en-cours`, `revue`, `fait`. **Lire le
  board avant d'écrire une colonne : elles sont configurables par projet**,
  depuis le mode édition de l'onglet Tableau ou en éditant le fichier.
- Un `id` de colonne ne se modifie jamais : il est dérivé du titre à la
  création, et c'est lui que les tickets citent. Renommer une colonne ne touche
  que son `titre`. Retirer une colonne suppose de reloger ses tickets d'abord —
  réécrire leur `colonne`, pas seulement supprimer l'entrée du board.
- `priorite` vaut `haute`, `moyenne` ou `basse`. Le tri est priorité puis date ;
  il n'y a pas de rang manuel.
- `id` : le maximum existant plus un, jamais un numéro repris à un ticket
  supprimé.
- `plan` lie un ticket à un plan de `cockpit/plans/`, ou vaut `null`. Les deux
  stocks sont indépendants : un ticket n'est pas un plan, un plan n'est pas une
  tâche.

Écrire un ticket : soit directement le fichier, soit le CLI depuis la racine du
dépôt **cockpit** (le CLI n'est pas installé dans les projets équipés) :

```bash
node hooks/cockpit-cli.js tickets                        # le tableau, colonne par colonne
node hooks/cockpit-cli.js ticket new "<titre>" --colonne pret --priorite haute
node hooks/cockpit-cli.js ticket move <T-0012-slug.md> en-cours
node hooks/cockpit-cli.js ticket import-plans            # reprend les plans ouverts
```

Proposer des tickets est utile ; en créer trente d'un coup ne l'est pas. Un
ticket vaut par son critère d'acceptation, pas par son existence.

## Ce qui se calcule, et qu'il ne faut donc pas chercher dans un fichier

| Question | Réponse |
|---|---|
| Que reste-t-il à faire ? | Les tickets hors dernière colonne du board |
| Qu'a-t-on approuvé sans le solder ? | Les plans `status: open` |
| Qu'a-t-on fait récemment ? | Les plans `status: closed`, triés par `closed` |
| Combien de travail sur cette page ? | Les plans clos dont `commits[].files` recoupent les fichiers de la page |
| Où le travail s'est-il concentré ? | Les `commits[].date` groupés par semaine |

## Commandes de secours

Depuis la racine du dépôt cockpit :

```bash
node hooks/cockpit-cli.js status                 # plans ouverts, clos, plan actif
node hooks/cockpit-cli.js capture <plan.md>      # capture un plan que le hook a manqué
node hooks/cockpit-cli.js close                  # clôt les plans ouverts portant un commit
```

## Le piège de lecture principal

**Le corps d'un plan `open` décrit une intention, pas une liste de tâches
restantes.** Un plan ouvert portant des commits décrit du travail *en cours* :
une partie est faite, et les `commits[].files` disent laquelle. Lire son corps
comme un inventaire de choses non commencées est l'erreur naturelle, et elle
mène à des conclusions fausses — « tel fichier n'existe pas encore » alors
qu'il est écrit et testé.

Avant de conclure que quelque chose reste à faire :

1. Regarder `commits` du plan. Zéro commit = approuvé mais jamais commencé.
   Des commits = du travail a eu lieu, et `files` dit lequel.
2. Croiser avec la date : `closed` renseigné signifie que le plan est terminé,
   quoi qu'en dise son corps.
3. En cas de doute, le dire plutôt que d'affirmer qu'une brique manque.

## Limites à énoncer plutôt qu'à masquer

- Une page qui affiche zéro plan n'est pas une erreur : elle n'a pas bougé
  depuis sa création.
- Un résumé de page peut avoir dérivé — la page existe toujours mais son
  comportement a changé. C'est indétectable automatiquement. En cas de doute
  sur un résumé, le dire et se rabattre sur la date de la capture.
- Une capture est toujours datée. « Il y a trois semaines » est une information
  honnête ; présenter la même image sans sa date ne l'est pas.
