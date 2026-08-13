---
{
  "status": "open",
  "title": "Professionnaliser le dépôt avant le passage en public",
  "opened": "2026-08-13",
  "closed": null,
  "commits": [
    {
      "sha": "f7b5ae8",
      "date": "2026-08-13",
      "files": [
        ".github/CODEOWNERS",
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        ".github/ISSUE_TEMPLATE/config.yml",
        ".github/ISSUE_TEMPLATE/feature_request.yml",
        ".github/dependabot.yml",
        ".github/pull_request_template.md",
        ".npmrc",
        "CHANGELOG.md",
        "CODE_OF_CONDUCT.md",
        "CONTRIBUTING.md",
        "LICENSE",
        "README.en.md",
        "README.md",
        "SECURITY.md",
        "package.json"
      ]
    }
  ]
}
---

# Professionnaliser le dépôt avant le passage en public

## Contexte

La release `v1.0.0-beta` est prête, en brouillon, sur un dépôt **privé** dont
l'historique deviendra intégralement visible au passage en public. Aujourd'hui le
dépôt n'a **aucune CI** — le seul workflow se déclenche sur tag. La conséquence
s'est vue il y a une heure : cinq tests cassaient sous Windows depuis des semaines,
et rien ne pouvait le révéler avant le premier `git push --tags`. Une fois le dépôt
public et le tag téléchargeable, ce genre de découverte coûte une release.

Il manque par ailleurs tout ce qu'un dépôt public suppose : licence, politique de
sécurité, guide de contribution, mises à jour de dépendances, et une barrière qui
empêche de pousser n'importe quoi sur `main`.

Une landing page existe déjà (`~/Downloads/Landing Ovrsee/Ovrsee Site.dc.html`),
écrite avec Claude Design. Elle porte un discours plus net que celui de l'app et
des READMEs — c'est elle qui devient la référence, une fois ses erreurs corrigées.

**Résultat visé** : `main` inatteignable sans PR verte ; secrets et vulnérabilités
détectés automatiquement ; le dépôt se présente correctement ; un site vitrine
expose les téléchargements ; et app, READMEs et site racontent la même chose.

## Décisions arrêtées

| Sujet | Choix |
|---|---|
| Licence | **MIT** |
| Barrière sur `main` | **PR obligatoire, 0 relecteur**, historique linéaire, force-push et suppression bloqués |
| Site vitrine | **Même dépôt**, dossier `site/`, GitHub Pages |
| Landing | **Portage complet en statique** — sans `support.js`, sans CDN |
| Linter | **oxlint** seul, pas de formateur |
| `ovrsee/` (plans, tickets) | **Reste public** — la démonstration du produit sur lui-même |
| Nombre de dépendances | **Dire 4**, pas 3 — corriger le discours, pas le code |
| Ordre | Préparer → re-tag → publier → porter le site → passer public |

## Ce que l'audit a établi

**Aucun secret**, ni à HEAD ni dans l'historique — vérifié sur les motifs de clés
Anthropic, GitHub, npm, Vercel, Netlify, Supabase, clés privées et chaînes de
connexion. `.ovrsee-auth.json` (cookies du crawl) n'a jamais été commité.

Deux affirmations des rapports d'audit sont **écartées** : `private: true` dans
`package.json` doit rester (il empêche un `npm publish` accidentel, sans rapport
avec la visibilité GitHub), et l'URL `github.com/samuelboulery/ovrsee` dans le
README n'est pas une fuite — le dépôt est à cette adresse.

Les `/Users/sam/...` de 11 plans et de `graph.json` restent : les nettoyer à HEAD
pendant que l'historique les conserve serait cosmétique.

`checkJs` sur les dossiers JS est **écarté, mesuré** : 1338 erreurs en strict, 865
sans `noImplicitAny`. C'est un chantier, pas une étape de mise au propre.

---

## Phase 1 — Fichiers du dépôt public

À la racine :

- **`LICENSE`** — texte MIT intégral, `Copyright (c) 2026 Samuel Boulery`.
- **`SECURITY.md`** — Ovrsee n'a aucun service en ligne ; la surface est locale
  (écriture dans `<repo>/ovrsee/`, secrets d'intégration dans
  `~/.claude/ovrsee/integrations.json`, terminal PTY via IPC). Dire où signaler en
  privé (GitHub Security Advisories, jamais une issue publique), quelle version est
  suivie, et rappeler l'invariant du cadrage — l'app lit, elle n'exécute que le
  terminal demandé.
- **`CONTRIBUTING.md`** — `pnpm` exclusivement ; `node:test` sans framework, avec
  l'interdiction explicite d'introduire vitest/jest ; Conventional Commits en
  français ; français pour les commentaires et l'interface, anglais pour les
  identifiants ; demander avant toute nouvelle dépendance ; zones à ne pas éditer
  (`ovrsee/` hors tickets, `legacy/`, `_ds/`). Reprendre la substance de
  `CLAUDE.md`, pas le fichier.
- **`CODE_OF_CONDUCT.md`** — Contributor Covenant 2.1.
- **`CHANGELOG.md`** — Keep a Changelog, amorcé avec `1.0.0-beta`.

Dans `.github/` : `ISSUE_TEMPLATE/bug_report.yml` et `feature_request.yml`
(formulaires YAML, champs OS et version obligatoires), `ISSUE_TEMPLATE/config.yml`
avec `blank_issues_enabled: false`, `pull_request_template.md`, `CODEOWNERS`
(`* @samuelboulery`), et `dependabot.yml` sur `npm` + `github-actions`,
hebdomadaire, préfixe `chore:`. L'écosystème `github-actions` maintiendra aussi
les SHA épinglés de la phase 3.

`package.json` : ajouter `"license": "MIT"`, `"engines": { "node": ">=22" }`,
`repository`, `bugs`, `homepage`. **Ne pas toucher `private: true`.**

Nouveau **`.npmrc`** avec `minimum-release-age=1440` — la quarantaine de 24 h que
recommande `rules/common/package-manager.md` contre les publications empoisonnées,
absente de ce dépôt.

## Phase 2 — CI sur chaque PR

`.github/workflows/ci.yml`, sur `pull_request` et `push` vers `main`.

| Job | Runner | Contenu | Ce qu'il attrape |
|---|---|---|---|
| `checks` | ubuntu | `pnpm typecheck`, `pnpm lint`, `pnpm build:ui` | Types d'`app/src`, lint, casse du bundle |
| `test-mac` | macos | `pnpm test` | Régressions sur la plateforme de référence |
| `test-win` | windows | `pnpm test` | **Portabilité** — la classe de bug qui vient de casser la release |

Ces trois noms deviennent les status checks requis du ruleset (phase 8) : les figer
maintenant.

**L'empaquetage n'entre pas dans la CI de PR.** Six minutes sur Windows pour
avancer de quelques heures une détection que la release en brouillon fait déjà.

**Pas de couverture de tests.** Sans seuil c'est décoratif ; avec seuil, le chiffre
serait faux vu que l'UI n'est testée qu'en « aucun onglet ne lève ».

`ci.yml` et `release.yml` partageront `pnpm install --frozen-lockfile` puis
`pnpm test`. **La duplication est assumée** — deux étapes, contre l'indirection
d'un `workflow_call` et un fichier de plus.

## Phase 3 — Durcir les workflows

Sur les trois workflows :

- **Épingler chaque action tierce à son SHA**, tag en commentaire de fin de ligne.
  SHA résolus par `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`. Dependabot les
  maintiendra.
- **`permissions` par job**, jamais au niveau du workflow. `{}` partout sauf
  `contents: write` sur `draft`, et `contents: read` / `pages: write` /
  `id-token: write` sur le déploiement Pages. Retirer le `contents: write` global
  actuel de `release.yml`.
- **`concurrency`** avec `cancel-in-progress: true` sur `ci.yml` seulement —
  **jamais sur la release** : annuler un build à mi-envoi laisse une release à
  moitié remplie, l'accident déjà vu ce soir.
- **`timeout-minutes`** : 15 sur les tests, 30 sur les builds.
- **`persist-credentials: false`** sur chaque `checkout`.

## Phase 4 — oxlint

`pnpm add -D oxlint`, script `"lint": "oxlint hooks crawl server mcp electron app/src"`,
`.oxlintrc.json` minimal.

**Mesure avant de brancher la CI** : premier passage, compte des signalements,
remonté avant d'aller plus loin. Si le bruit est important, la correction fait un
commit séparé — sinon le job `checks` naîtrait rouge.

## Phase 5 — Aligner le discours

La landing devient la référence : « Gestion de projet pour Claude Code »,
« Vibecoder vite, sans perdre le fil du projet », et les trois principes — *un plan,
ses commits, ses tickets* / *le projet vit dans le dépôt* / *Claude Code y lit et y
écrit*. Aujourd'hui l'app et les READMEs disent « vue en lecture seule », ce qui
décrit l'invariant technique, pas la promesse.

**Corriger d'abord les erreurs factuelles de la landing** — l'alignement va de l'app
vers la landing, jamais l'inverse :

| Où | Erreur | Correction |
|---|---|---|
| Landing, hero + pied de page | « 3 dépendances de prod » | **4** |
| Landing, pied de page | « dépôt privé, l'accès aux releases demande une invitation » | Supprimer |
| `README.md:215`, `README.en.md:210` | « Dépôt **privé** — visible qu'aux collaborateurs invités » | Supprimer |
| Badges des deux READMEs | `dépendances prod-3` | `-4` |
| `CLAUDE.md` | « le projet en a trois en production » | Quatre, `@phosphor-icons/react` compris |

Puis réviser la copie de l'app. Elle est **centralisée dans `hooks/i18n.js`** — 53
clés `welcome.*` et `onboard.*`, en français et en anglais. Aucun composant à
toucher : `Welcome.tsx`, `Onboarding.tsx` et `OnboardingArt.tsx` lisent ces clés.

Le dictionnaire FR→EN de la landing (déjà écrit, dans la classe `DCLogic`) sert de
source pour les tournures anglaises — les deux surfaces diront mot pour mot la
même chose.

Enfin, réviser l'accroche et la section « Ce qu'on y voit » des deux READMEs sur le
même vocabulaire.

## Phase 6 — Re-tag et publication

1. Tout ce qui précède est poussé sur `main` — le push direct est **encore permis**,
   c'est pourquoi cette phase précède la phase 8.
2. Vérifier `ci.yml` au vert sur ce push.
3. Supprimer le tag `v1.0.0-beta` local et distant, le recréer sur le nouveau
   `main`, le pousser. **Le brouillon de release est conservé** : le job `draft` le
   retrouve par son tag et n'en crée pas un second, donc les notes écrites
   survivent. Ses six assets sont remplacés.
4. Attendre le vert des trois jobs (~8 min, Windows le plus lent).
5. `gh release edit v1.0.0-beta --draft=false`.

## Phase 7 — Porter la landing dans `site/`

Le fichier source est un export Claude Design : balises `<x-dc>`, `<helmet>`,
`<sc-if>`, liaisons `{{ }}` et une classe `DCLogic`, le tout piloté par
`support.js` (69 ko de runtime tiers — celui-là même que la phase de nettoyage
vient de retirer du dépôt). Plus deux CDN : Google Fonts et unpkg.

Ce qui rend le portage réaliste : **aucune image**, tout est en DOM et styles
inline. La structure se reprend quasi telle quelle.

Travail à faire :

- **Résoudre le gabarit** : retirer `<x-dc>`/`<helmet>`, remplacer les 9 `<sc-if>`
  et les liaisons `{{ }}` par leur valeur ou par du DOM engendré en JS.
  `{{ repoUrl }}`, `{{ releasesUrl }}`, `{{ readmeUrl }}` prennent leurs vraies
  valeurs.
- **La démo interactive** (~150 lignes de JS vanille) : commutation des sept vues
  depuis la colonne de gauche. C'est la pièce maîtresse de la page — elle rend
  l'interface avec le markup de l'app, ce que les captures ne montrent pas.
- **Le sélecteur FR/EN** : le dictionnaire de la classe `DCLogic` se reprend tel
  quel, appliqué nœud de texte par nœud de texte comme dans l'original.
- **Polices** : IBM Plex Sans (400/500/600) et Mono (400/500) vendues en `.woff2`
  sous-ensemble latin, licence OFL — plus de Google Fonts.
- **Icônes** : 26 glyphes Phosphor distincts, inlinés en `<symbol>` SVG depuis
  `@phosphor-icons/react`, déjà présent dans les dépendances — plus d'unpkg.
- **Liens de téléchargement** remplis côté client depuis
  `api.github.com/repos/samuelboulery/ovrsee/releases/latest`, avec repli sur
  `/releases/latest` si l'appel échoue (l'API anonyme est limitée à 60 requêtes par
  heure et par IP).

`.github/workflows/site.yml` déploie sur Pages, filtré `paths: [site/**]`.
Symétriquement, `ci.yml` ignore `site/**` et les markdown de racine via
`paths-ignore`. **Le déploiement n'aboutira qu'après le passage en public** : Pages
sur dépôt privé demande un compte Pro.

## Phase 8 — Passage en public et protections

Immédiatement après le passage en public, dans cet ordre. Les rulesets répondent
`403` tant que le dépôt est privé sur le plan gratuit — la seule raison pour
laquelle cette phase n'est pas la première.

1. `gh repo edit --visibility public`
2. **Sécurité** (gratuite sur dépôt public) :
   - Secret scanning **et push protection** — la barrière littérale contre « pusher
     n'importe quoi » : un secret dans un commit est refusé au push.
   - Dependabot alerts + security updates
   - Code scanning, **default setup** (CodeQL géré par GitHub, aucun workflow à
     maintenir)
3. **Ruleset sur `main`** via `gh api -X POST /repos/samuelboulery/ovrsee/rulesets`,
   `enforcement: active`, condition `refs/heads/main`, quatre règles :
   `pull_request` avec `required_approving_review_count: 0` ;
   `required_status_checks` avec `strict_required_status_checks_policy: true` et
   les contextes `checks`, `test-mac`, `test-win` ; `required_linear_history` ;
   `non_fast_forward` et `deletion`.

   **Aucun `bypass_actors`.** L'échappatoire en cas de blocage est de désactiver le
   ruleset depuis les réglages — plus lisible qu'une dérogation permanente.
4. **Actions** : `GITHUB_TOKEN` en lecture seule par défaut ; actions autorisées
   restreintes au dépôt plus `actions/*` et `pnpm/*` ; approbation requise pour les
   workflows lancés par des PR de forks.
5. **Dépôt** : squash-merge seul (cohérent avec l'historique linéaire), suppression
   automatique de la branche après fusion, `homepage` vers le site, topics
   (`electron`, `react`, `typescript`, `claude-code`, `developer-tools`).
6. **Pages** : source « GitHub Actions », puis lancer `site.yml`.

## Vérification

1. `pnpm test`, `pnpm typecheck` et `pnpm lint` verts en local.
2. **Vérifier sur un export propre, pas sur le répertoire de travail** :
   `git archive HEAD` dans un dossier vierge, puis `pnpm install` et `pnpm test`.
   C'est ce qui a révélé que les tests dépendaient de captures non versionnées — le
   test local seul ne pouvait pas le voir.
3. `gh run list` : les trois jobs verts sur le push de `main`.
4. Après le ruleset : tenter `git push origin main` et **vérifier que GitHub
   refuse**. Le plan n'est pas fini tant que ce refus n'a pas été observé.
5. Ouvrir une PR d'un caractère, vérifier que la fusion est bloquée tant que les
   trois checks ne sont pas verts, fusionner, vérifier la suppression automatique
   de la branche.
6. **Site** : ouvrir `site/index.html` en local et vérifier qu'il s'affiche
   **sans réseau** (aucune requête sortante dans l'onglet Réseau), que la démo
   commute les sept vues, que FR/EN bascule toute la page, et que les deux liens de
   téléchargement pointent sur les assets de `v1.0.0-beta`.
7. Relire l'onboarding dans l'app lancée (`pnpm electron`), en français et en
   anglais, et vérifier qu'il dit la même chose que la landing.
8. `github.com/samuelboulery/ovrsee/community` : profil communautaire complet.

## Écarté délibérément

| Écarté | Pourquoi |
|---|---|
| `checkJs` sur les dossiers JS | 1338 erreurs mesurées. Chantier séparé. |
| Prettier | Reformaterait tout le dépôt et noierait un historique lisible. |
| Couverture de tests | Sans seuil c'est décoratif ; avec seuil, le chiffre serait faux. |
| Empaquetage dans la CI de PR | 6 min par PR pour avancer une détection que la release en brouillon fait déjà. |
| Workflow réutilisable `workflow_call` | Deux étapes partagées ne justifient pas un troisième fichier. |
| Embarquer `support.js` | 69 ko de runtime tiers sans licence claire dans un dépôt MIT public. |
| Nettoyage des `/Users/sam/...` | Cosmétique tant que l'historique les conserve. |
| Réécriture d'historique | Casserait le tag et tout clone ; aucun secret ne la justifie. |
| Signature et notarisation | 99 €/an chez Apple. Les notes de release documentent le contournement. |
