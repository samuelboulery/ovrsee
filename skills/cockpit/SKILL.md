---
name: cockpit
description: Use when a project has a cockpit/ directory and you need to brief yourself on it, or when a plan was approved without the capture hook running. Reads captured plans, page map and screenshots to reconstruct project context without reading the code.
---

# Cockpit

Le dossier `cockpit/` d'un dépôt contient l'état du projet sous forme lisible :
les plans approuvés, la carte des pages, les captures datées. Il est écrit par
des hooks, jamais à la main.

**Le cockpit se lit. Il ne s'exécute jamais, et il ne s'édite jamais à la main.**

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
4. `graphify-out/graph.json` — schéma de données et stack. Les relations y sont
   étiquetées `EXTRACTED` (lue dans le code), `INFERRED` (déduite) ou
   `AMBIGUOUS` (incertaine). Reprendre l'étiquette quand on cite la relation.

## Ce qui se calcule, et qu'il ne faut donc pas chercher dans un fichier

| Question | Réponse |
|---|---|
| Que reste-t-il à faire ? | Les plans `status: open` |
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

## Limites à énoncer plutôt qu'à masquer

- Une page qui affiche zéro plan n'est pas une erreur : elle n'a pas bougé
  depuis sa création.
- Un résumé de page peut avoir dérivé — la page existe toujours mais son
  comportement a changé. C'est indétectable automatiquement. En cas de doute
  sur un résumé, le dire et se rabattre sur la date de la capture.
- Une capture est toujours datée. « Il y a trois semaines » est une information
  honnête ; présenter la même image sans sa date ne l'est pas.
