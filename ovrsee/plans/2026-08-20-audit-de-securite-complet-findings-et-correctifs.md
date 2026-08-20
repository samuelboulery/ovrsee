---
{
  "status": "open",
  "title": "Audit de sécurité complet — findings et correctifs",
  "opened": "2026-08-20",
  "closed": null,
  "commits": [
    {
      "sha": "c8db5a6",
      "date": "2026-08-20",
      "files": [
        "crawl/auth.js",
        "hooks/config-claude.js",
        "hooks/config-claude.test.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "8b3955a",
      "date": "2026-08-20",
      "files": []
    },
    {
      "sha": "da94b9f",
      "date": "2026-08-20",
      "files": []
    },
    {
      "sha": "0ce8e04",
      "date": "2026-08-20",
      "files": [
        "CHANGELOG.fr.md",
        "CHANGELOG.md",
        "package.json"
      ]
    }
  ]
}
---

# Audit de sécurité complet — findings et correctifs

## Contexte

Audit demandé sur les quatre périmètres : code du dépôt (`electron/`, `server/`,
`mcp/`, `hooks/`, `crawl/`, `app/src`), chaîne d'approvisionnement et CI, données
versionnées (`ovrsee/`, `graphify-out/`), vitrine `site/`.

Exploration terminée (3 agents + vérifications directes). Livrable retenu : **rapport
en session**, correctifs immédiats des findings critiques/hauts en PR, tickets ovrsee
pour le reste. Aucun fichier de rapport versionné.

## Ce que l'audit a trouvé

La posture est bonne. Electron : `contextIsolation`/`sandbox`/`nodeIntegration:false`
partout, `will-attach-webview` qui reprend les privilèges des invités
(`electron/main.js:208`), CSP stricte sur `ovrsee://` (`main.js:113`), `will-navigate`
borné à l'origine, `shell.openExternal` sur liste blanche d'éditeurs. Chemins : registre
comme liste blanche sur **tous** les canaux IPC et toutes les routes, `usableDirectory()`
(refus des symlinks), `inside()` avec séparateur final, `writeFileNoFollow()` anti-TOCTOU,
frontmatter en JSON (pas d'injection YAML). Rendu : pas de `dangerouslySetInnerHTML`,
`markdown.tsx` refuse `data:`/`//`/liens non http. Secrets : `safeStorage`, jamais rendus
au renderer, hors dépôt. Supply chain : `minimum-release-age=1440`, scripts d'install
bloqués sauf `node-pty`, actions CI épinglées au SHA, `permissions: {}` par défaut,
`persist-credentials: false`. Rien de sensible dans le contenu versionné (un seul hit :
un faux secret d'exemple dans un plan).

Les quatre findings qui restent :

### F1 — `X-Ovrsee` ne tient pas une page servie par localhost (haute, dev server)

`server/api.js:349` protège les écritures par l'en-tête `X-Ovrsee: 1`, en comptant sur le
préflight CORS. Vérifié : la CORS par défaut de Vite 8 autorise **toute** origine
`localhost`/`127.0.0.1`, quel que soit le port (`defaultAllowedOrigins`, node.js:692), et
le paquet `cors` reflète les en-têtes demandés au préflight. Une page servie par le projet
observé — exactement ce que l'onglet Navigateur affiche et ce que le crawl visite — peut
donc poster sur `http://localhost:5180/api/projects` avec l'en-tête.

Chaîne complète : page localhost hostile → `POST /api/projects {action:'init', config:{dev}}`
→ écrit `ovrsee.config.json` → le prochain crawl exécute `dev` dans un shell
(`crawl/index.js:221`, `crawl/auth.js:53`) → exécution de code. Les lectures partent aussi :
`GET /api/config-claude` n'exige aucun en-tête et rend agents, commandes, plugins et
**commandes de hooks** de `~/.claude/`.

Portée : dev server uniquement. Sous Electron le protocole `ovrsee://` ne répond pas au
préflight, donc l'en-tête tient — le raisonnement du commentaire de `api.js:346` est juste
pour Electron, faux pour le dev server. Le DNS rebinding, lui, est bloqué, mais par Vite,
pas par nous : `hostValidationMiddleware` est posé avant les hooks `configureServer`
(node.js:26556 vs 26562). Protection héritée, non possédée.

### F2 — `maskSecrets` laisse passer les scalaires dans un tableau (moyenne)

`hooks/config-claude.js:52-56` : un objet est parcouru en profondeur, mais les scalaires
d'un tableau sont recopiés tels quels. `{"x": ["sk-live-…"]}` dans `~/.claude/settings.json`
ressort en clair par `GET /api/config-claude`. `command` est en outre en liste blanche :
un hook qui porte un jeton dans sa ligne de commande est rendu intégralement.

### F3 — `readBody` n'a pas de plafond (basse)

`server/api.js:491` accumule le corps sans limite. Un POST local sans fin fait grossir la
mémoire du dev server jusqu'à l'OOM.

### F4 — `crawl/auth.js` a divergé de `crawl/index.js` (basse)

`crawl/auth.js:53` : `spawn(config.dev, { shell: true, stdio: 'ignore' })`. `index.js` passe
par `shellRun()` (`hooks/shell.js`) — le shell `-lic` qui donne le PATH de pnpm — et retient
la sortie pour la joindre à l'erreur. Les deux bugs déjà corrigés dans `index.js` sont
intacts ici : `pnpm: command not found` invisible, PATH minimal.

## Correctifs à appliquer (cette PR)

**1. Garde d'origine dans `resolve()` — `server/api.js`.** Une fonction `originAutorisee(headers)` :
pas d'en-tête `origin` → accepté (client non navigateur : Electron, MCP, curl) ; `origin`
présent → doit valoir `ovrsee://app` ou l'origine du dev server (`http://localhost:5180`,
`http://127.0.0.1:5180`). Sinon 403. Appliquée à **toutes** les routes, lectures comprises —
c'est ce qui ferme aussi la fuite de `/api/config-claude`. L'en-tête `X-Ovrsee` reste, en
seconde barrière. Tests dans `server/api.test.js`, style `node:test` existant.

**2. `maskSecrets` — `hooks/config-claude.js`.** Un seul chemin récursif : les scalaires d'un
tableau passent par la même règle de liste blanche que ceux d'un objet. Test avec un tableau
de chaînes.

**3. Plafond de corps — `server/api.js:491`.** Rejet au-delà de ~1 Mo (`req.destroy()`, corps
`null`). Un ticket markdown n'approche pas ce seuil.

**4. `crawl/auth.js:53`.** Utiliser `shellRun(config.dev)` comme `crawl/index.js:221`, et
remonter la sortie de la commande en cas d'échec au lieu de `stdio: 'ignore'`.

## Tickets ovrsee à déposer (hors PR)

- **Confiance d'espace de travail** : ouvrir un dépôt cloné met son `ovrsee.config.json` en
  position d'exécuter `dev` au premier crawl. Proposer une confirmation qui montre la
  commande avant le premier crawl d'un projet. Arbitré comme « voulu » dans `CLAUDE.md`, mais
  l'arbitrage vaut pour un dépôt qu'on écrit, pas pour un dépôt qu'on reçoit.
- **`redige()` ne couvre pas `pages.json`** : `excerpt` porte 400 caractères d'`innerText` de
  l'app observée, versionnés, sans filtre. Une page de debug qui affiche un jeton part dans git.
- **Signature et notarisation macOS** (`electron-builder.yml`, `identity: null`) avant toute
  distribution hors usage personnel — pas d'auto-updater, donc pas d'urgence.
- **Documenter la dépendance à `hostValidationMiddleware`** dans `CLAUDE.md` : notre middleware
  est posé avant les internes de Vite, `allowedHosts` est notre seule protection anti-rebinding,
  et `server: { host: … }` dans `vite.config.js` la lèverait en silence.

## Fichiers touchés

- `server/api.js` (garde d'origine, plafond de corps) + `server/api.test.js`
- `hooks/config-claude.js` + `hooks/config-claude.test.js`
- `crawl/auth.js`

## Vérification

1. `pnpm test` (277 tests actuels + les nouveaux), `pnpm lint`, `pnpm typecheck`.
2. Dev server : `pnpm dev`, puis vérifier à la main —
   - `curl -s -o /dev/null -w '%{http_code}' http://localhost:5180/api/config-claude` → 200 (pas d'`Origin`)
   - même appel avec `-H 'Origin: http://localhost:3000'` → 403
   - `curl -X POST -H 'X-Ovrsee: 1' -H 'Origin: http://localhost:3000' -d '{"action":"touch"}' http://localhost:5180/api/projects` → 403
   - l'interface sur `http://localhost:5180` continue de charger et d'écrire un ticket (elle envoie `Origin: http://localhost:5180`).
3. Electron : `pnpm electron` — le protocole `ovrsee://` n'envoie pas d'`Origin` sur ses propres
   requêtes ; vérifier qu'un onglet écrit toujours (création de ticket, `init`, skills). C'est le
   piège nommé dans `CLAUDE.md` : une route testée dans le navigateur n'est pas testée dans Electron.
4. Crawl : `pnpm ovrsee:crawl` sur ce dépôt, et un `ovrsee:auth` à blanc sur un projet dont la
   commande `dev` est fausse — l'erreur doit maintenant citer ce qu'a dit la commande.
