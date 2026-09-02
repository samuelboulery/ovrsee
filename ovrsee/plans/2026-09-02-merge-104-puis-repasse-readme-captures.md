---
{
  "status": "open",
  "title": "Merge #104, puis repasse README + captures",
  "opened": "2026-09-02",
  "closed": null,
  "commits": []
}
---

# Merge #104, puis repasse README + captures

## Contexte

La PR #104 (« Audit complet pré-release 1.2.0 ») est verte sur les trois jobs CI,
`MERGEABLE`, `mergeStateStatus: CLEAN`. Elle solde T-0243 et cinq failles.

Une fois mergée, la 1.2.0 est prête côté code — mais pas côté vitrine du dépôt :

- Les **sept captures** de `docs/screenshots/` datent du 13 août (`5dacb19`).
  Elles précèdent le thème clair (T-0218), l'accent par projet (T-0215), le panneau
  des commandes (T-0224/T-0225), les commentaires de zone (T-0214), la barre du
  terminal en icônes (T-0220) — et elles montrent encore les défauts corrigés par
  T-0250 (« 14 14 plans », « 1 tickets », vignettes cassées de l'onglet Produit).
  Le README affiche donc des bugs déjà réparés.
- Le **README** (EN + FR) n'a pas été touché au fond depuis `ffdcdab` : ni #96, ni
  #98, ni #100, ni #102, ni l'audit. Il annonce `pnpm@10.34.5` quand `package.json`
  dit `pnpm@11.22.0`, cite `electron 43.3.0` (43.4.1), ignore `oxlint`, et ne dit
  rien de l'accord requis avant d'exécuter la commande `dev` — le premier mur que
  rencontre un nouveau venu qui clique « Crawler ».

Rien dans le dépôt ne produit `docs/screenshots/` : les captures ont été prises à la
main. D'où un script, pour que la prochaine release ne repose pas sur la mémoire.

Décisions déjà prises : script de capture **commité**, captures en **thème sombre**
(comme aujourd'hui), repasse README **ciblée** (structure inchangée).

## Étape 1 — merger et solder

```bash
git stash push ovrsee/pages/scans.jsonl ovrsee/plans/*.md   # état écrit par les hooks
gh pr merge 104 --squash --delete-branch
git checkout main && git pull        # post-merge → reconcile
git stash pop
pnpm ovrsee:close                    # le squash-merge n'exécute aucun hook
```

`graphify-out/graph.json` bouge tout seul (hook `post-checkout` du poste) — le laisser
tel que le hook l'écrit, il est versionné volontairement.

Commit de l'état ovrsee (`chore:`) si `ovrsee:close` a daté un plan.

## Étape 2 — `scripts/screenshots.js`

Nouvelle branche `docs-readme-1.2.0`.

Un script Node, sans framework, dans le style de `scripts/build-site-fr.js` :

1. `pnpm build:ui` doit avoir tourné ; le script le vérifie (`dist/index.html`) et
   le dit sinon.
2. Lance l'app **réelle** : `_electron.launch({ args: ['.'] })` depuis
   `playwright-core` — déjà en `dependencies`, `_electron` est exporté (vérifié).
   C'est la seule voie qui donne le terminal intégré et le `<webview>` de l'onglet
   Navigateur : dans un navigateur, `Navigateur.tsx:436` rend `<HorsApplication />`.
3. Fenêtre à 1600×1000, `deviceScaleFactor: 2`.
4. Pour chacun des sept onglets de `TABS` (`app/src/views.ts:32-40`), clic sur le
   lien du rail — `a[href="/produit"]`, etc. : `RailLink` (`app/src/Shell.tsx:455-470`)
   rend une vraie ancre — puis `page.screenshot()` dans un dossier temporaire.
5. Chaque PNG brut passe à screenmat :
   `node $SCREENMAT /tmp/<onglet>.png --frame browser --no-title-bar --seed <fixe>
   --scale 2 --format png --out docs/screenshots/<onglet>.png`.
   `SCREENMAT` par défaut `/Users/sam/code/screenmat/cli/main.ts` ; absent, le script
   garde le PNG brut et le dit. Le `--seed` fixe rend le fond déterministe (pas de
   diff d'image gratuit d'une release à l'autre).
   Le cadre exact (`--frame`, `--padding`, `--background`) se règle sur un onglet
   avant de lancer les sept — la barre de titre de l'app est déjà dans le DOM,
   il ne faut pas en superposer une seconde.

Prérequis notés en tête du fichier et vérifiés au lancement :
`pnpm dev` sur `localhost:5180` (sans quoi l'onglet Navigateur est vide),
le projet ovrsee ouvert en dernier dans le registre, thème sombre.

`package.json` : `"screenshots": "node scripts/screenshots.js"`.

**Le garde-fou** (`scripts/screenshots.test.js`, ramassé par `pnpm test`) : pour chaque
id de `TABS`, `docs/screenshots/<id>.png` existe et est référencé par `README.md`
**et** `README.fr.md`. Un onglet ajouté sans capture casse le test, dans les deux sens.
Portable macOS/Windows (existence de fichier, rien d'autre) — la CI tourne sur les deux.

## Étape 3 — repasse README (EN source, FR pendant)

Structure et sections inchangées. Ce qui change :

**Faux à corriger**
- `README.md:301` / `README.fr.md:307` : `pnpm@10.34.5` → `pnpm@11.22.0`.
- Table dev deps (`README.md:294-299`) : `vite ^8.2.2`, `electron 43.4.1`,
  `@vitejs/plugin-react ^6.1.0`, `@types/react-dom ^19.2.5`, ajout d'`oxlint ^1.80.0`.
- Section Tests (`README.md:409-416`) : `pnpm test` couvre aussi `scripts/` et
  `electron/` ; ajouter `pnpm lint` (oxlint).

**Silences à combler** (source : `CHANGELOG.md:13-95`, déjà écrit)
- Thème clair / sombre / système et accent par projet — une ligne dans « What it
  does » et une dans « First launch ».
- **L'accord sur la commande `dev`** : un paragraphe dans Install (étape « Crawl »)
  et une entrée dans « Known Traps » — l'accord vit dans `~/.claude/ovrsee/trust.json`,
  hors du dépôt observé, et sans humain le crawl refuse au lieu de demander.
- `pnpm ovrsee:close <plan.md> --commit <sha>` à côté du `ovrsee:close` nu.
- Légendes des captures : commentaire de zone (Navigateur), panneau des commandes et
  état des sessions (Aperçu), image collée dans un ticket (Tableau).
- MCP : nommer les onze outils (`mcp/server.js:55-172`), et dire que les réponses
  sont projetées (`full: true` pour l'entier).
- Arborescence : ajouter `site/`.
- « See also » / « Voir aussi » : lien vers `CHANGELOG.md`.

Rien à toucher côté `site/` : la vitrine ne lit aucune image du README et a déjà été
refaite en #91.

## Vérification

```bash
pnpm lint && pnpm typecheck && pnpm test    # dont scripts/screenshots.test.js
pnpm build:ui && pnpm dev &                 # 5180 pour l'onglet Navigateur
pnpm screenshots                            # régénère les sept images
```

Puis à l'œil : les sept PNG ouverts côte à côte (aucun onglet vide, aucune modale
ouverte, thème sombre partout), et le rendu du README sur la PR GitHub — c'est là que
se voient les images cassées.

Enfin `git diff main...HEAD` relu en entier, PR avec plan de test.
