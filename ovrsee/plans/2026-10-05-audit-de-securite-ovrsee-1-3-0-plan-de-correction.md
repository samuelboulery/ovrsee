---
{
  "status": "open",
  "title": "Audit de sécurité ovrsee 1.3.0 — plan de correction",
  "opened": "2026-10-05",
  "closed": null,
  "commits": [
    {
      "sha": "4c62d6b",
      "date": "2026-10-05",
      "files": []
    },
    {
      "sha": "aa40d8c",
      "date": "2026-10-05",
      "files": []
    },
    {
      "sha": "ac74ddd",
      "date": "2026-10-05",
      "files": []
    },
    {
      "sha": "7efbf80",
      "date": "2026-10-05",
      "files": []
    },
    {
      "sha": "1b536b6",
      "date": "2026-10-05",
      "files": []
    },
    {
      "sha": "d9994c3",
      "date": "2026-10-05",
      "files": []
    },
    {
      "sha": "72e1a3f",
      "date": "2026-10-05",
      "files": []
    }
  ]
}
---

# Audit de sécurité ovrsee 1.3.0 — plan de correction

## Contexte

Demande : audit de sécurité complet et plan pour corriger toutes les failles, y compris
les 25 alertes Dependabot ouvertes. Trois audits en lecture seule, chacun sur une surface :
Electron/IPC, `/api/*` + MCP + Vite, hooks/crawl/CI/empaquetage. Constat critique vérifié
à la main (`crawl/index.js:57-64,104-111,444-451`).

Repères :
- `pnpm audit --prod` : **0 vulnérabilité**. Les 25 alertes sont toutes en dev et
  transitives (electron-builder, `@electron/get`). Rien n'est livré dans l'app.
- Pas d'auto-updater, pas de deep link, CSP sans `unsafe-inline`, `contextIsolation`/
  `sandbox` partout, CSRF des POST tenu, CI à permissions minimales et actions épinglées
  par SHA : ces gardes tiennent.
- Modèle de menace retenu (CLAUDE.md, T-0244) : **dépôt observé hostile** — clone, zip,
  clé — et **page web tierce** visitée pendant que `pnpm dev` tourne.

Livraison : un epic `E-XXXX « Audit sécurité 1.3 »`, un ticket enfant par lot, une PR par
lot. Chaque lot : test rouge d'abord (`node:test`), puis correctif, puis `pnpm test`, `lint`,
`typecheck`, `build:ui`, puis l'agent `security-reviewer` sur le diff. Patch **1.3.1** après
les lots 1 à 3.

---

## Lot 1 — Critique : un lien symbolique `scans.jsonl` fait exécuter du code (sans accord)

Chaîne : un `ovrsee/pages/scans.jsonl` versionné qui pointe sur `../../.git/hooks/post-commit`,
avec `"baseUrl": "x $(curl …|sh)"` dans la config. `loadConfig()` lève **avant**
`assurerConfiance`, son message cite `baseUrl` en brut, et `recordScan` l'ajoute avec
`appendFileSync`, qui suit le lien. Le commit suivant exécute le `$(…)`.

- Ajouter un helper dans `hooks/plans.js`, à côté de `writeFileNoFollow`, par exemple
  `sousRacine(root, chemin)`. Il vérifie que `realpath` de chaque **ancêtre** reste sous
  `realpath(root)` et ouvre la cible avec `O_NOFOLLOW` (`O_APPEND` pour un ajout).
  `writeFileNoFollow` l'utilise aussi, ce qui ferme les liens sur les dossiers ancêtres
  (`ovrsee` → ailleurs).
- `recordScan` (`crawl/index.js:105`) écrit par ce helper. Le message `baseUrl invalide`
  ne cite plus la valeur.
- `pruneShots` (`crawl/index.js:433`) ne supprime que les noms
  `^\d{4}-\d{2}-\d{2}-[0-9a-f]+\.png$`, et seulement sous la racine réelle.
- Garde unique à l'entrée de `ticketAction`, `exportVault` et `install` : `ovrsee/`,
  `tickets/` et `tickets/images/` ne sont pas des liens (`lstat`).
- Tests : un `scans.jsonl` lien qui sort du dépôt fait lever ; un `ovrsee/` lien fait
  refuser l'écriture d'un ticket ; un PNG au nom libre n'est pas supprimé.

## Lot 2 — Haute : garde git incomplète (`hooks/git.js`)

`SANS_PROGRAMME` ne coupe que `fsmonitor`, `pager`, `diff.external` et `ext::`. Restent
actifs : les hooks (`--no-verify` ne coupe ni `prepare-commit-msg`, ni `post-commit`, ni
`post-index-change`, ni `reference-transaction`), les filtres `.gitattributes`
(`filter.X.clean/process`, au `git status` et au `git add -A`), les programmes gpg (via
`log.showSignature` et `commit.gpgSign`), et au fetch `remote.X.uploadpack` et
`core.gitProxy`.

- Dans `SANS_PROGRAMME`, ajouter : `core.hooksPath=<dossier vide inexistant>`,
  `commit.gpgSign=false`, `tag.gpgSign=false`, `log.showSignature=false`, `gpg.program=`,
  `gpg.ssh.program=`, `gpg.x509.program=`, `core.alternateRefsCommand=`.
  Ajouter aussi `--no-optional-locks` sur les lectures.
- Filtres : lire `git config --local --name-only --get-regexp '^filter\.'` (cette lecture
  n'exécute rien), puis passer `-c filter.X.{clean,smudge,process}=` pour chaque pilote.
- `gitReseau` : `fetch --upload-pack=git-upload-pack`, `-c core.gitProxy=`,
  `-c protocol.file.allow=never`.
- `hooks/ovrsee-tool-stop.js:42` : passer par `git()`. Élargir le test de
  `documentation.test.js:281` à `spawn`, `spawnSync`, `execFile` et `"git"`.
- `hooks/install.js:140` : `chmod 755` seulement sur un fichier créé par ovrsee ; sinon,
  refuser et le dire. Corriger le commentaire faux sur `--no-verify` (`install.js:412`).
- Tests : étendre le dépôt piégé de `git.test.js` à `post-index-change`,
  `prepare-commit-msg`, un filtre `clean`, `log.showSignature` avec `gpg.program`, et
  `uploadpack`.

## Lot 3 — Haute : Electron et collage dans le terminal

- **Sortie du collage encadré** (`app/src/pty.ts:156,176`) : la console et le sélecteur
  d'élément de la page observée finissent dans `submitToClaude` sans filtre. Un
  `\x1b[201~` ferme le collage, et la suite est tapée comme des touches. Correctif : un seul
  point de passage, `injectTo`, qui retire ESC et C0/C1 (sauf `\t` et `\n`) avant
  d'encadrer. Le texte issu de la page passe par `pasteTo`, sans validation automatique.
  Ajouter un test dans `data.test.ts` (fonction pure extraite).
- **Permissions** (`electron/main.js`) : `setPermissionRequestHandler` et
  `setPermissionCheckHandler`. Sur `persist:navigateur`, tout refuser (y compris
  `openExternal`, `clipboard-read`, notifications, média). Sur la session par défaut,
  seulement ce dont `ovrsee://app` a besoin.
- `will-attach-webview` : `params.src` limité à http(s), `params.partition` forcé sur
  `persist:navigateur`. `setWindowOpenHandler` : exiger un geste utilisateur, ou plafonner.
  `tray.js:158` : `preventDefault()` sans condition.
- **`crawl:approve` tacite** (`main.js:479`) : ne plus accorder sans modale quand la valeur
  sur disque égale la valeur saisie, sauf si le principal vient lui-même d'écrire ce
  fichier. Une seule modale à la fois par projet pour `crawl:start` et `crawl:approve`,
  comme pour `pty:open`.
- `devSurDisque` (`crawl.js`) : refuser C0/C1, bidi (U+202A–202E, U+2066–2069) et
  U+2028/2029, comme `devALancer`. Corriger le commentaire de `crawl.js:85`.
- **Fuses** (`electron-builder.yml`, `electronFuses`) :
  `EnableNodeOptionsEnvironmentVariable=false`, `EnableNodeCliInspectArguments=false`,
  `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`.
  **RunAsNode reste actif** : les hooks de `~/.claude/settings.json` et le crawl
  (`crawl.js:183`, `install.js:75`) en dépendent. Le couper demande de passer le crawl en
  `utilityProcess` et les hooks sur un Node externe : ticket séparé.
  Vérification : lancer le DMG construit en local.

## Lot 4 — Moyenne : `/api/*`, MCP, Vite

- **Plantage par GET cross-site** : `createReadStream` sans écouteur `error`, et `existsSync`
  qui accepte un dossier (EISDIR fait tomber `pnpm dev`, reproduit). Correctif :
  `statSync().isFile()` dans `shotPath` et `mediaPath`, `.on('error')` sur le flux, et
  `try/catch` autour de `resolve()` dans les deux adaptateurs (`vite.config.js`,
  `electron/main.js`), avec un 500 générique.
- **Liens symboliques en lecture** : `realpath(f)` sous `realpath(base)` dans `shotPath`,
  `mediaPath`, `readGraph`, `readText`, et avant le `copyFileSync` de l'export Obsidian
  (`obsidian.js:220`). Liste blanche d'extensions sur `/api/shot` ; plafond de taille et
  lecture en flux.
- **ReDoS** (mesuré : 4,3 s pour 2 000 espaces) : `hooks/whys.js:55,58,68` et
  `hooks/vault.js:173`. Ignorer les lignes de plus de 1 000 caractères. Réécrire `WHY`
  (`^\s*(?:\/\/|#|\*|\/\*)\s*WHY:(.*)$`, puis retrait du `*/` en code) et exclure `[`
  de la classe de `WIKILINK`. Tests de durée sur une entrée pathologique.
- **Oracle cross-site** (`api.js:75`) : refuser `/api/*` si `Sec-Fetch-Site` est présent et
  ne vaut ni `same-origin` ni `none`.
- **`X-Ovrsee: 1` constant** : jeton aléatoire tiré au `configureServer`, injecté par
  `transformIndexHtml`, exigé sur les routes d'écriture. Côté Electron : jeton du
  principal, exposé par le preload.
- **Vite** : `server.cors: false`. Garder le commentaire « pas de `host`, pas
  d'`allowedHosts` ».
- **Validation** : `plan` accepte seulement `null` ou `isSafePlanFileName` (`tickets.js:213,397`).
  `mcp/dispatch.js:220` : contrôle `typeof` et refus des champs hors schéma. `readBody` :
  `req.setEncoding('utf8')`, et plafond de 1 Mo côté Electron aussi.

## Lot 5 — Moyenne : ce que le dépôt observé contrôle

- **`obsidianVault`** et **`gitignoreShots`** quittent `ovrsee.config.json` versionné pour
  devenir des préférences de poste (registre, comme `accent`). Une valeur trouvée dans le
  dépôt est ignorée avec un avertissement. `getVaultDate` est borné sur `MAX_FILES` et
  `IGNORES`. Si `auth.storageState` est utilisé, les captures sont toujours ignorées par git.
- **Crawl** : `baseUrl` limité à localhost, `127.0.0.1` ou `::1`. Les `entryRoutes` ne
  sortent pas de cette origine (pas de `file://`, pas de LAN).
- **Session du crawl** : `.ovrsee-auth.json` passe dans `~/.claude/ovrsee/auth/<clé projet>.json`
  (classe 2), avec migration de l'ancien fichier.
- **Redaction** (`hooks/redaction.js`) : ajouter `github_pat_`, `xapp-`,
  `hooks.slack.com/services/`, `SG.`, `Bearer <jeton>` seul, `-u user:pass`,
  `--password x` et `--token x` séparés par une espace, `Cookie:`, les blocs PGP.
  `crawl/index.js:226` : rédiger **avant** de tronquer à 2 000 octets.
- **Divers** :
  - `crawl/auth.js:47` : message passé par `shq`.
  - `check-ignore --` (`crawl/index.js:85`, `auth.js:44`).
  - `brief.js` : une ligne par champ, longueur bornée, caractères de contrôle retirés.
  - `install.js` : refuser l'installation depuis `/Volumes/` ou un chemin `AppTranslocation`.
- **`cleanEnv`** (`hooks/shell.js:134`) : retirer de l'environnement du `dev` une liste
  nommée de jetons de poste (`GITHUB_TOKEN`, `GH_TOKEN`, `NPM_TOKEN`, `ANTHROPIC_API_KEY`,
  `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`). Liste courte et explicite, pas de motif
  large : un `dev` qui lit une variable légitime ne doit pas casser.

## Lot 6 — Dépendances (Dependabot, 25 alertes)

electron-builder est déjà en dernière version (26.15.3) : on corrige par des `overrides` dans
`pnpm-workspace.yaml`, une plage par branche majeure :
`@xmldom/xmldom` ≥ 0.8.15, `fast-uri` ≥ 3.1.8, `js-yaml` ≥ 4.3.2, `undici@6` ≥ 6.29.0,
`undici@7` ≥ 7.30.0, `brace-expansion` 1.1.21, 2.1.7 et 5.0.12,
`http-cache-semantics` ≥ 4.3.0.
Toutes ces versions ont plus de 24 h (quarantaine `minimumReleaseAge` respectée).
Vérification :
- `pnpm why` sur chaque paquet ;
- `pnpm audit` sans `--prod` : 0 ;
- `pnpm package:mac` construit toujours ;
- les alertes se ferment après le merge.

## Lot 7 — CI et release

- **`release.yml`** : le job `build` passe en `contents: read` et dépose ses binaires avec
  `upload-artifact`, sans `GH_TOKEN` pour electron-builder (`--publish never`). Un job
  `publish` en `contents: write` ne lance que `gh release upload`. Ajouter
  `actions/attest-build-provenance` (`id-token: write`, `attestations: write`) et
  `if: startsWith(github.ref, 'refs/tags/v')` sur `build`.
- **`SECURITY.md:68`** : l'empreinte proposée est en base64, alors que `shasum` affiche de
  l'hexadécimal. Publier un `SHA256SUMS` en hexadécimal, et documenter
  `gh attestation verify`.
- **Hors de portée sans toi** : signature et notarisation Apple (T-0192, il faut un
  certificat Developer ID), et activation de CodeQL et du secret scanning dans les réglages
  du dépôt.

## Acceptés en connaissance de cause (documentés dans `SECURITY.md` ou `CLAUDE.md`)

- `trust.json` lie l'accord à un chemin et à la chaîne `dev`, pas à une provenance git.
- `pty:write` vers un shell nu (par conception).
- Le site vitrine sans CSP (GitHub Pages ; `<meta>` possible plus tard).

## Fichiers critiques

`crawl/index.js`, `crawl/auth.js`, `hooks/plans.js` (`writeFileNoFollow`), `hooks/git.js`,
`hooks/install.js`, `hooks/snapshot.js`, `hooks/whys.js`, `hooks/vault.js`, `hooks/obsidian.js`,
`hooks/redaction.js`, `hooks/shell.js`, `hooks/brief.js`, `hooks/tickets.js`, `server/api.js`,
`mcp/dispatch.js`, `vite.config.js`, `electron/main.js`, `electron/crawl.js`, `electron/tray.js`,
`app/src/pty.ts`, `electron-builder.yml`, `pnpm-workspace.yaml`, `.github/workflows/release.yml`,
`SECURITY.md`, `CLAUDE.md`.

## Vérification

- Par lot : un test rouge, puis vert ; `pnpm test`, `lint`, `typecheck`, `build:ui` ; la CI
  sur macOS et Windows ; l'agent `security-reviewer` sur le diff.
- Lot 1 : repro jetable de la chaîne `scans.jsonl` → post-commit, avant et après.
- Lot 2 : dépôt piégé (marqueurs de fichiers écrits par chaque vecteur), que `snapshot()`,
  `init` et `fetch` ne déclenchent plus.
- Lot 3 : dans `pnpm electron`, une page qui fait `console.error('\x1b[201~…')` puis
  l'envoi à Claude (rien ne s'exécute) ; `navigator.clipboard.readText()` refusé dans la
  webview ; le DMG construit en local démarre avec les fuses.
- Lot 4 : `curl` d'un `/api/shot` sur un dossier → 4xx, et le serveur vit ; un
  `Sec-Fetch-Site: cross-site` → 403 ; le ReDoS passe sous 50 ms.
- Lot 6 : `pnpm audit` à 0 et alertes Dependabot fermées.
- Fin : release 1.3.1 avec un CHANGELOG `### Security`.
