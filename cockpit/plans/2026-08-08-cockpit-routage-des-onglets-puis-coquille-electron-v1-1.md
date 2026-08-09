---
{
  "status": "closed",
  "title": "Cockpit — routage des onglets, puis coquille Electron (v1.1)",
  "opened": "2026-08-08",
  "closed": "2026-08-08",
  "commits": [
    {
      "sha": "196e38f",
      "date": "2026-08-08",
      "files": [
        "hooks/cockpit-capture-plan.js",
        "hooks/cockpit-cli.js",
        "hooks/plans.js",
        "hooks/plans.test.js",
        "skills/cockpit/SKILL.md"
      ]
    },
    {
      "sha": "761ee35",
      "date": "2026-08-08",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/preload.cjs",
        "electron/pty.js",
        "hooks/cockpit-capture-plan.js",
        "hooks/cockpit-cli.js",
        "hooks/plans.js",
        "hooks/snapshot.js",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "scripts/fix-pty-permissions.js"
      ]
    },
    {
      "sha": "25c1b33",
      "date": "2026-08-08",
      "files": [
        ".gitignore",
        "README.md",
        "electron-builder.yml",
        "package.json"
      ]
    },
    {
      "sha": "2654b64",
      "date": "2026-08-08",
      "files": [
        "app/src/data.ts",
        "app/src/tabs/Produit.tsx",
        "app/src/useMeasure.ts",
        "crawl/index.js",
        "hooks/install.js"
      ]
    },
    {
      "sha": "b34bf11",
      "date": "2026-08-08",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/useResizable.tsx",
        "electron/main.js"
      ]
    },
    {
      "sha": "3b05ce4",
      "date": "2026-08-08",
      "files": [
        ".gitignore",
        "build/icon.icns",
        "build/icon.svg",
        "scripts/make-icon.js"
      ]
    },
    {
      "sha": "51dfab0",
      "date": "2026-08-08",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/tabs/Produit.tsx",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/preload.cjs",
        "hooks/install.js",
        "hooks/plans.js",
        "hooks/plans.test.js",
        "hooks/snapshot.js",
        "server/api.js",
        "server/api.test.js"
      ]
    }
  ]
}
---

# Cockpit — routage des onglets, puis coquille Electron (v1.1)

## Contexte

Cockpit capture les plans approuvés, cartographie les pages au commit et les
affiche en lecture seule. Les incréments v0.1 → v1 du cadrage sont livrés :
capture, crawl, les cinq onglets, et la réinjection de l'état du projet au
démarrage d'une session Claude Code. 60 tests verts.

Deux manques restent, et ils se tiennent.

**Le crawl ne voit qu'une page de Cockpit.** L'interface change d'onglet par
état React, sans jamais toucher à l'URL. Un crawler qui suit les liens ne peut
donc rien découvrir : Cockpit produit une carte à une seule page de lui-même.
C'est la limite qu'on a déjà rencontrée sur `associa`, sauf qu'ici elle est
réparable — et la réparer fait de Cockpit la première cible sérieuse de son
propre crawl, avec **des plans et des pages**. Le critère de succès v0.1 du
cadrage (« ne lui donner que `/cockpit/`, demander un brief ») n'a encore
jamais pu être évalué sur un projet portant les deux.

**Le terminal n'est qu'un décor.** Le panneau est porté visuellement, les trois
dispositions fonctionnent, mais aucune session ne tourne derrière et les
boutons d'injection se contentent de copier dans le presse-papier. C'est le
v1.1 du cadrage : la coquille de bureau avec le terminal Claude intégré, et
l'injection de contexte par clic.

**Résultat visé** : Cockpit se cartographie complètement lui-même, et Sam ne
quitte plus l'application pendant une session de travail.

## Décisions prises en amont

- **Electron, pas Tauri.** Facteur décisif : toute la couche de données est en
  Node (parsing des plans, dérivations, appels git) et le crawl repose sur
  `playwright-core`, qui est Node et uniquement Node. En Tauri il faudrait soit
  réimplémenter ces règles en Rust — deux sources de vérité pour le calcul du
  backlog, exactement la dérive que ce projet combat — soit embarquer Node en
  sidecar, ce qui annule l'avantage de taille. Le seul argument sérieux pour
  Tauri reste la mise à jour du moteur de rendu par l'OS ; il pèsera le jour où
  l'application sera distribuée publiquement, pas aujourd'hui.
- **La frontière compte plus que le framework.** Couche de données = modules
  Node purs, aucun import Electron. Interface = React, aucun import Node. Une
  seule interface étroite entre les deux. C'est ce qui garde le remplacement de
  la coquille à un après-midi de travail, comme l'annonce le cadrage §7.
- ~~**Le pty lance `claude` seul**, sans shell intermédiaire. Le cockpit
  n'exécute jamais, sauf la session Claude elle-même.~~ **Révisé après essai :
  le pty lance un shell de connexion (`$SHELL -l`) et y tape `claude`.** Lancée
  depuis le Finder, une application graphique n'hérite que d'un PATH minimal ;
  `claude` démarrait, mais ses hooks mouraient sur
  `/bin/sh: node: command not found`, et rien d'autre ne pouvait être lancé
  depuis le panneau. Le shell de connexion source `~/.zprofile` / `~/.zshrc` et
  rétablit le vrai environnement. Conséquence assumée : le panneau est un
  terminal, ce qu'on y tape s'exécute. L'isolation par IPC garde sa raison
  d'être — empêcher un **autre** processus de la machine de s'y brancher, ce
  qu'une socket locale aurait permis.
- **Routage d'abord**, coquille ensuite.

---

## Lot A — Les onglets dans l'URL

Petit, autonome, et il débloque le crawl.

### A.1 Routes

| Route | Onglet |
|---|---|
| `/` | Produit |
| `/historique` | Historique |
| `/backlog` | Backlog |
| `/donnees` | Données |
| `/stack` | Stack |

Produit reste sur `/` : pas de redirection, pas de page fantôme, et la page
d'entrée du graphe garde son sens.

Le projet sélectionné passe en paramètre de requête (`?p=<chemin>`) et non dans
le chemin. Deux raisons : `pathOf()` dans `crawl/routes.js` ignore la requête,
donc le crawl n'est pas multiplié par le nombre de projets ; et un rechargement
de page conserve le projet courant, ce qui n'est pas le cas aujourd'hui.

### A.2 Ce qui change

`app/src/App.tsx` uniquement, sur trois points :

1. `TABS` porte désormais un chemin par onglet.
2. L'état `tab` est dérivé de `window.location.pathname`, avec un écouteur
   `popstate` pour que les boutons Précédent/Suivant du navigateur marchent.
3. Les onglets deviennent de **vrais liens** :

```tsx
<a
  href={path}
  onClick={e => { e.preventDefault(); navigate(path) }}
  style={s(/* styles inchangés de la maquette */)}
>
```

Le `href` réel est indispensable : c'est ce que lit `page.$$eval('a[href]')`
dans `crawl/index.js`. Un `<button>` avec un `onClick` est invisible pour le
crawl — c'est précisément le diagnostic posé sur `associa`.

Les chaînes de style inline restent copiées à l'identique. Seule la balise
change, `<button>` → `<a>` : il faudra `text-decoration: none` et
`display: flex; align-items: center` pour retrouver exactement le rendu de la
maquette (l. 75-79), un lien n'ayant pas la même mise en forme par défaut.

### A.3 Ce qui ne change pas

Rien côté serveur. Vite sert `index.html` en repli pour tout chemin inconnu
(`appType: 'spa'` par défaut), et le middleware `/api` de `vite.config.js` est
monté avant, donc il continue de répondre.

### A.4 Vérification

```bash
pnpm dev
node crawl/index.js            # sur cockpit lui-même
python3 -c "import json; d=json.load(open('cockpit/pages/pages.json')); print([p['route'] for p in d['pages']])"
```

Attendu : `['/', '/historique', '/backlog', '/donnees', '/stack']`, cinq
captures datées, et un graphe où chaque onglet pointe vers les quatre autres.
Vérifier aussi que `orphanShots` reste vide et que le rechargement sur
`/backlog?p=…` retombe sur le bon onglet et le bon projet.

Puis relancer le test d'acceptation v0.1 sur Cockpit — le premier projet à
porter des plans **et** des pages :

> Session Claude Code, interdiction de lire le code, seul `/cockpit/` est
> autorisé, demander un brief. Les six questions doivent trouver une réponse,
> y compris « quel travail récent » et « que restait-il à faire », restées sans
> réponse sur `humankindr-platform` faute de plans capturés.

---

## Lot B — La coquille Electron et le terminal

Arborescence ajoutée :

```
electron/
  main.js        # fenêtre, protocol.handle, IPC du pty
  preload.js     # contextBridge — surface minimale
  pty.js         # enveloppe node-pty, une session par projet
server/
  api.js         # gestionnaire des trois routes, partagé Vite / Electron
hooks/
  snapshot.js    # lecture d'un projet (extrait de vite.config.js)
```

### B.0 Dépendances à ajouter

| Paquet | Version | Publiée le | Rôle |
|---|---|---|---|
| `electron` | 43.3.0 | 2026-08-04 | coquille |
| `electron-builder` | 26.15.3 | — | empaquetage macOS |
| `@electron/rebuild` | — | — | recompile le module natif pour l'ABI d'Electron |
| `@xterm/xterm` | 6.0.0 | 2025-12-22 | rendu du terminal |
| `node-pty` | 1.1.0 | 2025-12-22 | pseudo-terminal |

Toutes ont plus de 24 h, conformément à la règle de quarantaine de
`rules/common/package-manager.md`.

`node-pty` est un **module natif** compilé contre une ABI donnée. Deux
conséquences :

1. pnpm 10 bloque les scripts d'installation des dépendances. Il faut créer un
   `pnpm-workspace.yaml` autorisant **`node-pty` nommément** dans
   `onlyBuiltDependencies` — l'autorisation porte sur le paquet qui compile,
   pas sur l'outil de compilation. Jamais de désactivation globale.
2. Le binaire doit être recompilé pour l'ABI d'Electron, pas celle de Node :
   `@electron/rebuild` en script `postinstall` du dépôt racine (les scripts du
   projet lui-même ne sont pas bloqués par pnpm, seuls ceux des dépendances le
   sont).

Le fork `@lydell/node-pty` a été écarté : ses binaires précompilés couvrent
l'ABI de Node, rien ne garantit celle d'Electron 43, et c'est une dépendance
tierce de plus sur un chemin critique.

### B.1 Extraction préalable de la couche de données

**À faire avant tout le reste.** Aujourd'hui la lecture d'un projet vit dans
`vite.config.js` (`projects()`, `snapshot()`, `shotsByPage()`). Elle n'est donc
utilisable que par le dev server. Elle doit devenir un module Node pur,
`hooks/snapshot.js`, consommé à la fois par le plugin Vite et par Electron.

C'est la frontière annoncée plus haut. Sans cette extraction, la coquille
dupliquerait la lecture des projets — et deux lectures divergent toujours.

Découpage précis :

| Fichier | Contenu | Consommé par |
|---|---|---|
| `hooks/snapshot.js` | `projects()`, `snapshot(root)`, `shotsByPage(root)`, `shotPath(root, rel)` | l'API, et le CLI si besoin |
| `server/api.js` | un gestionnaire `(req, res) => boolean` sans framework, qui répond aux trois routes | le plugin Vite **et** le serveur Electron |
| `vite.config.js` | ne garde que le branchement du plugin | — |

Réutilise `readPlans()` de `hooks/plans.js` et la même tolérance aux fichiers
illisibles. Conserve le contrôle de traversée de chemin déjà présent sur
`/api/shot` (`file.startsWith(base)`), qui devient d'autant plus important
qu'il servira aussi en production.

Le contrat vu par l'interface ne change pas d'un caractère — `app/src/data.ts`
appelle `/api/projects`, `/api/project?path=…` et `/api/shot?…` en URL
relatives, donc servir l'interface et l'API depuis la même origine suffit à ce
que le même code fonctionne en développement comme dans l'application
empaquetée. Aucun `if (isElectron)` dans l'interface.

### B.2 Aucun serveur HTTP : `protocol.handle`

Ma première idée était que le processus principal serve l'interface et l'API par
un `node:http` sur `127.0.0.1`. **Abandonné.** Lier une socket à `127.0.0.1` est
une isolation *réseau*, pas une isolation de *sécurité* : sur macOS, tout
processus tournant sous le même compte peut s'y connecter. Un jeton n'y répond
pas, puisque ce même processus peut charger la page servie et y lire le jeton.

À la place, Electron enregistre un schéma privilégié et sert tout par
`protocol.handle('cockpit://')` : l'interface construite par Vite **et** les
trois routes `/api`, à partir du gestionnaire partagé de `server/api.js`. Rien
n'écoute sur le réseau, il n'y a pas de port à découvrir, et la CSP par défaut
d'un schéma privilégié est stricte.

Le code React ne change toujours pas : ses `fetch` sont en URL relatives et se
résolvent sur l'origine du schéma. Aucun `if (isElectron)` dans les onglets.

### B.3 Le terminal, par IPC uniquement

`@xterm/xterm` côté interface, `node-pty` côté processus principal, reliés par
`ipcMain`/`ipcRenderer` à travers un `preload` en `contextBridge`. C'est la
seule voie qui garantisse que **seul le rendu de cette application** peut
demander l'ouverture d'un processus.

Réglages de la fenêtre, tous obligatoires : `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`, et un `preload` qui expose une
surface minimale — ouvrir, écrire, redimensionner, écouter. Rien qui accepte un
nom de programme depuis le rendu : le processus lancé est `claude`, en dur, dans
le dossier du projet sélectionné.

Changer de projet dans la barre latérale ouvre une session distincte. Les trois
boutons d'injection de `app/src/Terminal.tsx` écrivent dans le pty au lieu de
copier dans le presse-papier.

**Conséquence assumée** : le terminal ne fonctionne que dans l'application
Electron, pas sous `pnpm dev` dans un navigateur — un navigateur n'a pas d'IPC.
Le composant teste la présence de la passerelle et, à défaut, garde le panneau
décoratif actuel avec la mention « terminal disponible dans l'application ».
C'est **un** test dans **un** composant, pas une ramification dans toute
l'interface. Je préfère perdre le terminal en mode navigateur plutôt qu'ouvrir
une voie d'exécution à n'importe quel processus local — c'est précisément le
vecteur du ver ChainDrop décrit dans `rules/common/package-manager.md`.

### B.4 Empaquetage

Un module natif ne peut pas être chargé depuis une archive asar. Configuration
`electron-builder` : `asar.smartUnpack` activé et `asarUnpack` couvrant
explicitement `node_modules/node-pty/**/*.node`. À vérifier sur l'application
empaquetée, pas seulement en développement — c'est le point de rupture classique.

Signature et notarisation : inutiles pour un usage personnel (Gatekeeper se
contourne au premier lancement). Elles deviendront obligatoires le jour d'une
distribution publique, et les modules natifs y sont un piège connu — la
notarisation inspecte les binaires. À traiter le moment venu, pas maintenant.

### B.5 Vérification

- `pnpm dev` dans un navigateur : les cinq onglets fonctionnent, le panneau
  terminal annonce franchement qu'il faut l'application.
- Electron en développement : `claude` démarre dans le dossier du projet
  sélectionné, la frappe, le redimensionnement et le défilement fonctionnent.
- Un clic sur « Carte des pages » écrit réellement dans la session.
- Application empaquetée : elle démarre sans dev server, les cinq onglets se
  remplissent, **le terminal fonctionne** — module natif hors asar compris.
- Vérifier qu'aucun port n'est ouvert : `lsof -i -P | grep -i cockpit` ne doit
  rien rendre.
- Critère du cadrage §7 : Sam ne quitte plus l'application pendant une session.

---

## Ce que ce plan ne fait pas

- **Les captures d'états d'écran** (modale, erreur, liste vide) — reporté en v2
  par le cadrage.
- **Windows et Linux** — macOS seulement pour l'instant.
- **La signature et la notarisation** au-delà de ce qu'exige un usage personnel.
