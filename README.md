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
# puis ajouter le hook PostToolUse affiché à la fin, dans ~/.claude/settings.json

# 2. Cartographier l'application (nécessite un cockpit.config.json à sa racine)
pnpm cockpit:auth /chemin/du/projet    # facultatif : pages protégées
pnpm cockpit:crawl /chemin/du/projet

# 3. Lire
pnpm electron                           # l'application, terminal claude compris
pnpm dev                                # ou dans un navigateur, sans terminal
pnpm cockpit:brief                      # ou en texte, depuis le terminal
pnpm package                            # DMG dans release/
```

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

Exemple de `cockpit.config.json`, à la racine du projet observé :

```json
{
  "dev": "pnpm dev --port 8099 --strictPort",
  "baseUrl": "http://localhost:8099",
  "entryRoutes": ["/", "/login"],
  "auth": { "storageState": ".cockpit-auth.json" },
  "ignore": ["/auth/callback"]
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
