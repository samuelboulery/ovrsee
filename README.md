# Cockpit

Une vue en lecture seule sur un projet développé en vibecoding : ce qui a été fait,
pourquoi, ce qui reste ouvert, et à quoi l'application ressemblait à chaque commit.

**Le cockpit lit ; il n'exécute que le terminal qu'on lui demande.** La vérité vit dans `<repo>/cockpit/`, en
markdown et en images, versionnée par git. L'application n'est qu'une vue : si elle
disparaît, rien n'est perdu.

- Cadrage complet : [`cadrage-cockpit.md`](./cadrage-cockpit.md)
- Référence visuelle de l'interface : [`Cockpit-A-Nocturne.dc.html`](./Cockpit-A-Nocturne.dc.html)

## Mise en route

```bash
pnpm install

# 1. Installer la capture dans un dépôt (à faire une fois par projet)
pnpm cockpit:install /chemin/du/projet
pnpm cockpit:install /chemin/du/projet --skills cockpit,cockpit-tickets
# puis ajouter le hook PostToolUse affiché à la fin, dans ~/.claude/settings.json

# 2. Cartographier l'application (nécessite un cockpit.config.json à sa racine)
pnpm cockpit:auth /chemin/du/projet    # facultatif : pages protégées
pnpm cockpit:crawl /chemin/du/projet

# 3. Lire
pnpm electron                           # l'application, terminal claude compris
pnpm dev                                # ou dans un navigateur, sans terminal
pnpm cockpit:brief                      # ou en texte, depuis le terminal
pnpm package                            # DMG dans release/

# 4. Clore le plan quand son travail est fini
pnpm cockpit:status                     # quel plan est actif
pnpm cockpit:close                      # le clore, et lâcher le pointeur

# 5. Emporter le tout dans Obsidian (facultatif)
pnpm cockpit:obsidian                   # ou le bouton de l'onglet Aperçu
```

Clore n'est pas une formalité. Tant qu'un plan est actif, le hook post-commit
lui rattache **tout** commit — un correctif sans rapport se retrouve inscrit
comme du travail de l'intention précédente. Clore retire `.active-plan` : après,
un commit ne se rattache à rien, ce qui est vrai. Capturer un nouveau plan clôt
le précédent, donc le geste ne se pose que si l'on s'arrête là.

Le terminal intégré n'existe que dans l'application : il passe par IPC, qu'un
navigateur n'a pas. C'est délibéré — l'exposer par une socket locale
l'ouvrirait à tout processus tournant sous le même compte.

C'est un terminal complet : le pty ouvre un shell de connexion et y lance
`claude`. Quitter Claude laisse le shell, on peut y taper autre chose. Le shell
de connexion n'est pas un confort : sans lui, une application lancée depuis le
Finder n'a qu'un PATH minimal, et les hooks de Claude Code échouent sur
`node: command not found`.

Les deux hooks Claude Code (affichés par `cockpit:install`) ferment la boucle :
l'un capture chaque plan approuvé, l'autre réinjecte l'état du projet au
démarrage d'une session — Claude Code sait où en est le projet sans qu'on le
lui explique.

## Skills Claude Code

Un dossier `cockpit/` ne sert à rien si Claude Code ne sait pas le lire ni le
remplir. Deux skills livrés répondent à ça, et s'installent dans
`~/.claude/skills/` — depuis l'écran d'initialisation d'un projet, depuis le
bouton « Skills Claude Code » de la barre latérale, ou avec `--skills`.

| Skill | Ce qu'il apprend |
|---|---|
| `cockpit` | Lire `cockpit/` : plans, pages, scans, et les pièges de lecture |
| `cockpit-tickets` | Écrire les tickets du Tableau, format et gestes compris |

Le catalogue signale aussi **Graphify**, qui alimente l'onglet Données. Celui-là
est seulement détecté : le cockpit n'installe pas le paquet de quelqu'un
d'autre à votre place, il affiche la commande.

## Coffre Obsidian

`pnpm cockpit:obsidian`, ou le bouton de l'onglet Aperçu, traduit `cockpit/` en
notes Obsidian dans `cockpit/obsidian/` : frontmatter YAML — donc requêtable en
Dataview —, wikilinks entre plans, tickets et pages, et la dernière capture de
chaque page copiée dans le coffre. C'est une vue, comme l'application : la
source reste le dépôt, et réexporter écrase.

Graphify écrit son propre `index.md` à la racine du dossier qu'on lui donne. On
lui réserve donc `graphe/`, que l'export ne touche jamais :

```
/graphify . --obsidian --obsidian-dir cockpit/obsidian/graphe
```

C'est ce que fait le bouton « ◈ Graphe → coffre Obsidian » du terminal intégré.

### Un coffre comme source de l'onglet Données

L'export ci-dessus va du dépôt vers le coffre. Le chemin inverse existe aussi,
pour qui documente son projet dans Obsidian plutôt qu'avec Graphify : le champ
`obsidianVault` désigne un coffre, et l'onglet Données le lit **quand Graphify
n'a rien produit**.

La convention est étroite, et volontairement. **Une note est une table quand son
frontmatter porte `type: table`** — rien d'autre n'en fait une. `columns` en
donne les colonnes, `maj` la date de dernière mise à jour, et les notes qui la
citent en wikilink en deviennent les usages.

```markdown
---
type: table
titre: Commandes
columns: [id, client_id, total]
maj: 2026-03-12
---

Les commandes passées.
```

**Graphify passe devant, toujours.** Le cadrage écarte de reconstruire la vue
base de données parce que Graphify la fait mieux et à jour à chaque commit : son
graphe vient du code, celui du coffre de ce que quelqu'un a tapé. Un coffre
déclaré alors que `graphify-out/graph.json` existe n'est pas lu — et l'onglet le
dit, plutôt que de laisser un champ de config sans effet visible.

Ces lignes ne portent donc pas la confiance `EXTRACTED` / `INFERRED` /
`AMBIGUOUS` de Graphify, qui dit ce qu'un parseur a tiré du code. Elles portent
leur date, ou la mention **non daté**. C'est la seule condition à laquelle une
donnée écrite à la main a sa place ici : datée, on peut en juger ; sans date,
elle ment sans prévenir.

Le chemin est absolu, ou relatif à la racine du dépôt — donc il peut en sortir,
et c'est l'intérêt. Le cockpit lira alors des fichiers hors du dépôt : seulement
des `.md`, seulement leur frontmatter et leurs wikilinks, jamais leur corps,
sans suivre les liens symboliques et dans la limite de 4000 notes. Il n'écrit
jamais dans le coffre.

Exemple de `cockpit.config.json`, à la racine du projet observé :

```json
{
  "dev": "pnpm dev --port 8099 --strictPort",
  "baseUrl": "http://localhost:8099",
  "entryRoutes": ["/", "/login"],
  "auth": { "storageState": ".cockpit-auth.json" },
  "ignore": ["/auth/callback"],
  "obsidianVault": "~/Coffres/mon-projet"
}
```

Donnez-lui un port dédié : le crawl **refuse de démarrer** si `baseUrl` répond
déjà. Rien dans une réponse HTTP ne permet de reconnaître son propre serveur, et
photographier celui d'un autre projet produirait des captures datées
d'aujourd'hui montrant la mauvaise application.

## Arborescence

| Dossier | Rôle |
|---|---|
| `hooks/` | Capture des plans approuvés et clôture au commit (v0.1) |
| `crawl/` | Parcours Playwright de l'app, captures datées (v0.2) |
| `app/` | Interface Vite + React, six onglets en lecture seule (v0.3) |
| `_ds/` | Design systems. Nocturne est celui retenu. |

## Données produites, dans le repo observé

```
<repo>/cockpit/
  plans/<date>-<slug>.md    1 fichier = 1 plan approuvé
  pages/pages.json          pages, liens, résumés
  pages/scans.jsonl         1 ligne par scan — les échecs aussi
  pages/shots/<page>/…png   captures datées, rattachées à un commit
```

Backlog, historique et densité d'activité ne sont pas stockés : ils se calculent
à partir des plans.

## Un plan capturé est versionné en clair

`cockpit/plans/` part dans git avec le reste du dépôt — c'est le but : c'est ce
qui rend le raisonnement récupérable trois semaines plus tard. Conséquence
directe : **un secret collé dans un plan approuvé se retrouve dans l'historique
git**, et l'y retirer demande une réécriture d'historique.

Ne pas l'ignorer via `.gitignore` : un plan non versionné ne sert à rien. La
parade est en amont — ne pas coller de clé, de jeton ni de mot de passe dans un
plan. Les identifiants vivent dans un gestionnaire de mots de passe et dans un
`ACCESS.md` non versionné (cadrage §3).
