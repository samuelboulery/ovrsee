---
{
  "status": "open",
  "title": "Audit de cybersécurité complet — findings et correctifs",
  "opened": "2026-08-22",
  "closed": null,
  "commits": []
}
---

# Audit de cybersécurité complet — findings et correctifs

## Contexte

Audit demandé sur toute l'application, mené avec les skills de
`github.com/trilwu/secskills` : `auditing-code-for-vulnerabilities` (+ sa
`bug-class-checklist`), `auditing-mcp-servers`, `auditing-supply-chain`,
`vetting-agent-extensions`, `securing-ai-systems`, `reporting-security-findings`.
Méthode imposée par ces skills : contexte → cartographie des points d'entrée →
chasse par classe de bug le long des chemins tracés → analyse de variantes, puis
une passe qui essaie de **tuer** chaque finding avant qu'il n'entre au rapport.

Un audit précédent (`ovrsee/plans/2026-08-20-…`) avait corrigé F1–F4 (garde
d'origine, `maskSecrets` récursif, plafond de `readBody`, `crawl/auth.js`). Ces
quatre correctifs ont été revérifiés et tiennent. Le présent audit porte donc sur
ce qu'il n'avait pas ouvert : la frontière webview, la chaîne d'approvisionnement
après la migration pnpm 11 en cours, le serveur MCP comme frontière de privilège,
et l'injection indirecte de prompt.

Livrable retenu : rapport en session, correctifs des findings hauts et moyens dans
une PR, tickets ovrsee pour le reste. Rien de nouveau versionné.

**Revalidé contre `587b55c`** (#58, dégraissage repo-wide T-0197), mergé pendant
l'audit. Ce refactor découpe `app/src` (`Shell.tsx`, `api.ts`, `graph.ts`,
`navigateur-webview.ts`, `ProduitDetail.tsx`…) et réécrit `hooks/tickets.js`,
`hooks/settings.js`, `hooks/board.js`. Toutes les gardes ont survécu :
`isSafeTicketFileName` (`hooks/tickets.js:150`, six refus testés),
`validateSettings` toujours par liste blanche fermée (`hooks/settings.js:139`),
`writeFileNoFollow` dans le nouveau `hooks/board.js:96`, `detectPackageManager`
borné à quatre noms. Le nouveau `hooks/principal.js` (garde d'entrée partagée des
hooks) ne compare que des chemins. Aucun sink neuf : le seul shell du dépôt reste
`shellRun(config.dev)`. `electron/main.js`, `hooks/redaction.js`, `crawl/auth.js`
et `mcp/server.js` ne sont pas touchés — F2 à F6 valent tels quels, seules les
lignes d'`app/src` ont bougé et sont à jour ci-dessous.

## Ce que l'audit a trouvé

La posture reste bonne et l'essentiel des gardes tient sous attaque (liste en fin
de document). Six findings neufs, dont deux hauts, et deux trous connus déjà
ticketés dont la priorité doit monter.

### F1 — [HAUTE] La quarantaine de 24 h est morte en silence

`.npmrc` porte `minimum-release-age=1440` — la défense explicite contre le ver
ChainDrop, documentée dans le fichier lui-même. Le diff **non commité** fait passer
`packageManager` de `pnpm@10.34.5` à `pnpm@11.22.0`. Or pnpm 11 ne lit plus que les
réglages d'authentification et de registre depuis `.npmrc` ; tout le reste doit
vivre dans `pnpm-workspace.yaml`, en camelCase.

Preuve locale, depuis la racine du dépôt, sous pnpm 11.22.0 :

```
$ pnpm config get minimum-release-age   → undefined
$ pnpm config list
{ "@jsr:registry": …, "allowBuilds": {…}, "patchedDependencies": {…},
  "registry": "https://registry.npmjs.org/", "userAgent": "pnpm/11.22.0 …" }
```

`minimumReleaseAge` n'apparaît nulle part. Le prochain `pnpm add` ou `pnpm update`
accepte une version publiée il y a cinq minutes. Exactement le piège que le dépôt
avait déjà documenté pour `onlyBuiltDependencies` — le même mécanisme, la même
panne muette, sur le réglage voisin.

La migration `allowBuilds` du même diff est correcte, elle : le config résolu rend
bien `{ node-pty: true, electron-winstaller: false }`.

### F2 — [HAUTE] `shell.openExternal` sans liste blanche de schémas, depuis une page tierce

`electron/main.js:227-230` (invité webview) et `:253-256` (fenêtre) :

```js
guest.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url)
  return { action: 'deny' }
})
```

Aucune validation du schéma. Et l'onglet Navigateur est un **navigateur complet** :
barre d'adresse → `loadURL` (`app/src/tabs/Navigateur.tsx:124` et `:193`),
`allowpopups` activé (`app/src/tabs/navigateur-webview.ts:67`, posé sur la balise en
`Navigateur.tsx:508-517`), et aucun garde `will-navigate` sur l'invité — celui de
`main.js:257` ne couvre que la fenêtre hôte.

Chaîne : une page chargée dans l'onglet (l'app observée, ou n'importe quel site
vers lequel on a navigué) appelle `window.open('file:///Applications/…')`,
`smb://…`, ou un schéma enregistré par une autre application installée →
`shell.openExternal` le remet au système hôte, hors de tout bac à sable. Le
`deny` qui suit ne rattrape rien : l'ouverture a déjà eu lieu.

Contraste utile : `projects:edit` ouvre déjà `openExternal` sur une **liste
blanche** d'éditeurs (`main.js:78-83`). La règle existe dans le fichier, elle n'est
simplement pas appliquée ici.

### F3 — [MOYENNE] `will-attach-webview` ne neutralise que trois clés

`electron/main.js:208-212` remet `preload`, `nodeIntegration` et
`contextIsolation`. Restent tels que l'attribut `webpreferences` du rendu les a
posés : `webSecurity`, `sandbox`, `allowRunningInsecureContent`,
`nodeIntegrationInSubFrames`. Le commentaire au-dessus dit vouloir couvrir « un
rendu compromis » — c'est bien le modèle de menace, et il n'est couvert qu'à
moitié. Défense en profondeur, pas un trou atteignable seul.

### F4 — [MOYENNE] `redige()` ignore les secrets en bloc et plusieurs jetons courants

`hooks/redaction.js:23-53` couvre `*KEY=`, `*TOKEN=`, `*AUTH*`, `sk-…`, AWS,
`AIza…`, `gh[pousr]_…`, JWT, mot de passe d'URL. Ne couvre pas :

- les blocs PEM (`-----BEGIN … PRIVATE KEY-----`) — une commande `dev` qui meurt en
  imprimant une clé privée l'envoie entière dans `scans.jsonl`, versionné ;
- `npm_…`, `xox[abprs]-…`, `glpat-…` ;
- un bearer opaque hors d'un en-tête nommé `Authorization`.

Le filtre est honnêtement documenté comme « défense en profondeur, pas garantie ».
Ces quatre formes-là valent quand même d'être ajoutées : ce sont celles qu'un
message d'erreur imprime réellement.

### F5 — [MOYENNE] Le jeton de session du crawl s'écrit en 0644

`crawl/auth.js:83` : `await context.storageState({ path: join(root, statePath) })`.
Le fichier contient cookies et `localStorage` d'une session authentifiée, et
Playwright l'écrit avec l'umask par défaut. Le script vérifie déjà que git l'ignore
— la bonne garde, sur le mauvais axe : il reste lisible par tout processus tournant
sous un autre compte de la machine.

### F6 — [BASSE] Deux durcissements

- `mcp/server.js` : les schémas d'outils typent les paramètres et exigent `path`,
  mais ne posent aucun `maxLength` sur les chaînes. Un `title` de ticket sans borne
  passe.
- `crawl/index.js:116` et `:145` : les deux `fetch` de disponibilité suivent les
  redirections sans limite. La réponse n'est jamais lue, donc le SSRF est aveugle et
  sans intérêt — mais `redirect: 'manual'` coûte un mot.

### Connus, ticketés, priorité relevée

**T-0190 — [HAUTE] RCE depuis le `ovrsee.config.json` d'un dépôt tiers.**
`hooks/ovrsee-post-commit.js:269` lance `spawnCrawl()` sur tout commit touchant du
code ; `crawl/index.js:179` fait `shellRun(config.dev)`, un `zsh -lic` sur une chaîne
lue telle quelle sur le disque. `validateCrawlConfig()` existe (`server/api.js:180`)
mais ne s'applique qu'à l'écriture par l'API, jamais à la relecture. Ouvrir puis
crawler un dépôt reçu — le geste que l'application encourage — exécute son code.
C'est le seul endroit où l'invariant « l'ovrsee lit ; il n'exécute que le terminal
qu'on lui demande » est enfreint par construction. Le ticket propose une
confirmation qui montre la commande avant le premier crawl : c'est la bonne parade,
elle n'est pas encore posée.

**T-0191 — [MOYENNE] `excerpt` de `pages.json` non rédigé.**
`crawl/index.js:304` prend 400 caractères d'`innerText` de l'app observée, `:424`
les range en `excerpt`, `:450` les écrit dans `pages.json`, **versionné**, sans
passer par `redige()` — alors que `scans.jsonl`, écrit dix lignes plus haut, y
passe. C'est aussi la principale source de contenu d'un tiers qui entre dans le
contexte d'un modèle (skill `ovrsee`, outil MCP `getProjectSummary`).

### Injection indirecte et trifecta létale

Sources de contenu non fiable qui atteignent le contexte d'un modèle : `excerpt` de
`pages.json` (contrôlé par l'app observée), messages de commit venus d'un remote
(`hooks/reconcile.js`), coffre Obsidian tiers (`hooks/vault.js`), markdown d'un
dépôt reçu. Le modèle qui les lit a par ailleurs le terminal (`pty:*`) et le réseau :
**la trifecta se ferme**. Ce n'est pas refermable par du code — la parade est de ne
pas laisser entrer de contenu non rédigé (T-0191) et de garder une confirmation
humaine sur les actions conséquentes (T-0190).

Un cas voisin est déjà arbitré et documenté dans `CLAUDE.md` : `reconcile()` solde
des tickets d'après le `%B` d'un commit distant, à chaque `pull`, sans confirmation.
Portée étroite (tickets déjà en vol, plans ouverts localement) et trace sur stderr.
Je le laisse en « accepté, documenté », pas en finding.

### Ce qui a été attaqué et a tenu

Garde d'origine (`server/api.js:67`) — comparaison stricte par `Set`, insensible ni
au port ni au suffixe ; `Origin: null` littéral refusé ; aucune route GET mutante,
donc l'acceptation volontaire de l'absence d'`Origin` n'ouvre rien. Registre comme
liste blanche sur toutes les routes et tous les canaux IPC. `inside()`,
`usableDirectory()`, `writeFileNoFollow()`, `isSafeTicketFileName()` — traversée,
symlink, octet nul, séparateur Windows tous refusés, et aucun appelant ne les
oublie. `maskSecrets` récursif, `command` repassé par `redige()`. Plafond de corps
à 1 Mo. CSP stricte, `img-src 'self' data:` — pas d'exfiltration par balise image
depuis un markdown tiers. `markdown.tsx` n'accepte que `^https?://`. `hooks/vault.js`
ne suit pas les liens symboliques. Aucune regex à quantificateurs imbriqués. Aucun
`console.log` parasite dans le fil JSON-RPC. Outils MCP d'écriture bornés à
`ovrsee/tickets/` et `ovrsee/board.json`. Les deux `SKILL.md` du dépôt ne portent ni
langage impératif, ni texte caché. CI : actions épinglées au SHA, `permissions: {}`,
`persist-credentials: false`, pas de `pull_request_target`, pas d'interpolation
d'événement dans `run:`, pas d'auto-merge Dependabot. `pnpm audit` : zéro. Aucun
secret dans l'arbre ni dans l'historique.

## Correctifs à appliquer (cette PR)

**1. F1 — déplacer la quarantaine.** Dans `pnpm-workspace.yaml`, ajouter
`minimumReleaseAge: 1440` avec le commentaire qui explique ChainDrop (repris de
`.npmrc`), et retirer la ligne de `.npmrc`. Committer avec le reste du diff pnpm 11,
qui est correct. Ajouter au passage à `CLAUDE.md` la règle générale : en pnpm 11,
`.npmrc` ne porte plus que auth et registre.

**2. F2 — liste blanche de schémas sur `openExternal`.** Une seule fonction dans
`electron/main.js`, appelée par les deux `setWindowOpenHandler` : n'ouvrir que si
`new URL(url).protocol` vaut `http:` ou `https:`, sinon ne rien faire. Même esprit
que `EDITORS` juste au-dessus.

**3. F3 — compléter `will-attach-webview`.** Forcer aussi `sandbox: true`,
`webSecurity: true`, `allowRunningInsecureContent: false`,
`nodeIntegrationInSubFrames: false`.

**4. F4 — étendre `redige()`.** Bloc PEM masqué entier, plus `npm_`, `xox[abprs]-`,
`glpat-`. Tests dans `hooks/redaction.test.js`, style `node:test` existant.

**5. F5 — `chmodSync(join(root, statePath), 0o600)`** après `storageState` dans
`crawl/auth.js`.

**6. F6 — deux lignes.** `maxLength` sur les chaînes des `inputSchema` de
`mcp/server.js` ; `redirect: 'manual'` sur le `fetch` de `crawl/index.js:116`.

## Tickets ovrsee à déposer ou relever

- **T-0190** : passer en haute priorité et l'exécuter — c'est le plus gros trou
  restant, et le seul qui contredit l'invariant du cadrage.
- **T-0191** : passer `excerpt` par `redige()` à l'écriture ; même point d'appel que
  `recordScan()`.
- **T-0192** : signature et notarisation macOS (`electron-builder.yml`,
  `identity: null`) avant toute distribution hors usage personnel. Sans
  auto-updater, ce n'est pas urgent — mais `release.yml` publie déjà des binaires
  non signés sur Releases. Le ticket existait depuis l'audit du 2026-08-20 : il
  passe de basse à moyenne, plutôt qu'un doublon de plus.

## Fichiers touchés

- `pnpm-workspace.yaml`, `.npmrc`, `CLAUDE.md`
- `electron/main.js`
- `hooks/redaction.js` + `hooks/redaction.test.js`
- `crawl/auth.js`, `crawl/index.js`
- `mcp/server.js`

## Vérification

1. `pnpm config get minimumReleaseAge` → `1440` (aujourd'hui : `undefined`).
   `pnpm config list` doit faire apparaître la clé.
2. `pnpm test`, `pnpm lint`, `pnpm typecheck` — verts.
3. F2, dans Electron (`pnpm electron`) : onglet Navigateur sur une page locale qui
   appelle `window.open('smb://exemple/partage')` puis `window.open('https://exemple.com')`.
   Le premier ne doit rien ouvrir, le second doit ouvrir le navigateur système.
   C'est le piège nommé dans `CLAUDE.md` : une route testée dans le navigateur n'est
   pas une route testée dans Electron.
4. F4 : un cas de test qui passe un bloc PEM et un `npm_…` à `redige()`.
5. F5 : `ls -l` sur le fichier `auth.storageState` après `pnpm ovrsee:auth` → `-rw-------`.
6. Non-régression du crawl : `pnpm ovrsee:crawl` sur ce dépôt, un scan doit toujours
   réussir et `pages.json` s'écrire.

## Couverture — ce que l'audit n'a pas fait

Tracé à fond : `electron/`, `server/api.js`, `mcp/`, `hooks/`, `crawl/`, la chaîne
d'approvisionnement et la CI, les sinks de rendu d'`app/src`.
Effleuré : le reste d'`app/src` (état, interactions), `hooks/i18n.js`,
`hooks/git-status.js`, `hooks/integrationProviders.js`, `site/`.
Non ouvert : `legacy/` (hors périmètre par `CLAUDE.md`), `_ds/`, `graphify-out/`.
Aucun test dynamique : tout est lecture de code. F2 en particulier est confirmé par
lecture, pas par exécution — l'étape 3 de la vérification est ce qui le prouvera.
