---
{
  "status": "open",
  "title": "Choix utilisateur : gitignorer captures et plans/tickets",
  "opened": "2026-08-10",
  "closed": null,
  "commits": [
    {
      "sha": "f837d74",
      "date": "2026-08-10",
      "files": [
        "app/src/Onboarding.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/data.ts",
        "hooks/gitignore-sync.js",
        "hooks/gitignore-sync.test.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/settings.js",
        "hooks/settings.test.js"
      ]
    },
    {
      "sha": "fc49c92",
      "date": "2026-08-10",
      "files": []
    },
    {
      "sha": "a4e411f",
      "date": "2026-08-10",
      "files": [
        "hooks/ovrsee-capture-audit.js",
        "hooks/ovrsee-capture-plan.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/ovrsee-post-commit.test.js",
        "hooks/ovrsee-tool-edit.js",
        "hooks/ovrsee-tool-edit.test.js",
        "hooks/ovrsee-tool-stop.js",
        "hooks/ovrsee-tool-stop.test.js"
      ]
    }
  ]
}
---

# Choix utilisateur : gitignorer captures et plans/tickets

## Contexte

On vient de gitignorer manuellement `ovrsee/pages/shots/` et de garder `ovrsee/plans/`
et `ovrsee/tickets/` versionnés (précédent : commit `cb13656`). Ce choix est actuellement
câblé en dur dans `.gitignore`. Le besoin : deux interrupteurs indépendants, exposés à la
fois dans les Préférences et dans l'onboarding, pour que chaque utilisateur décide :
- s'il gitignore les captures d'écran (`ovrsee/pages/shots/`)
- s'il gitignore les plans et tickets (`ovrsee/plans/`, `ovrsee/tickets/`)

Défauts alignés sur l'état actuel du dépôt : captures ignorées = **oui**, plans/tickets
ignorés = **non** (ils sont versionnés aujourd'hui).

## Où vivent les réglages (existant, réutilisé)

- `app/src/data.ts` (`SettingsType`, ligne ~306) : forme du réglage.
- `hooks/settings.js` : `DEFAULT_SETTINGS`, `validateSettings()`, `mergeSettings()` — déjà le
  mécanisme "préférence globale (`~/.claude/ovrsee/settings.json`) + surcharge par projet
  (`ovrsee.config.json`, versionné dans le dépôt)" utilisé par `bootstrap`, `packageManager`,
  `sourceGraphe`. On suit exactement ce pattern, pas besoin d'un nouveau mécanisme de fusion.
- `app/src/PreferencesProjet.tsx` (`SectionProjet`) : section "Projet" des Préférences —
  c'est là que vivent déjà `BlocDemarrage`, `BlocAvance`. On y ajoute un `BlocGitignore`.
- `app/src/Onboarding.tsx` (`EcranReglages`, ligne 327) : écran 2 de l'onboarding, affiche
  déjà langue/thème/bootstrap via `Row` + `Switch`/`Segmented`.
- `app/src/PreferencesControls.tsx` : `Row`, `Switch`, `GroupLabel` — composants à réutiliser
  tels quels, aucun nouveau composant UI de base nécessaire.
- `hooks/ovrsee-post-commit.js` : hook git déjà exécuté à chaque commit dans le repo cible,
  connaît déjà `root` et `ovrseeDir`, spawn déjà le crawl en s'appuyant sur
  `ovrsee.config.json`. C'est le point d'exécution naturel pour appliquer le réglage au
  `.gitignore` du projet — pas besoin de faire transiter `root` par l'API `/api/settings`
  (qui aujourd'hui n'écrit que le profil global, jamais un `.gitignore` de projet).

## Changements

### 1. Schéma des réglages
- `app/src/data.ts` : ajouter à `SettingsType` : `gitignoreShots?: boolean`,
  `gitignorePlans?: boolean`.
- `hooks/settings.js` :
  - `DEFAULT_SETTINGS` : `gitignoreShots: true`, `gitignorePlans: false`.
  - `validateSettings()` : deux `if (typeof partial.x === 'boolean') out.x = partial.x`,
    au même endroit que `onboardingVu`.
  - `mergeSettings()` : même traitement booléen que `terminal.visible`, pour permettre à un
    `ovrsee.config.json` de projet de surcharger le défaut personnel — cohérent avec le fait
    que "gitignorer ou non" est fondamentalement une décision par dépôt.

### 2. Application au `.gitignore` du projet
Nouveau fichier `hooks/gitignore-sync.js` (module pur, testable comme ses voisins
`*.test.js`) :

```js
export function syncGitignore(root, settings) { ... }
```

- Gère deux blocs à contenu fixe et connu (mêmes lignes que celles déjà écrites à la main
  aujourd'hui dans `.gitignore` pour les shots, pour que le premier passage sur ce dépôt
  soit un no-op) :
  - bloc « shots » : commentaire + `ovrsee/pages/shots/`
  - bloc « plans/tickets » : commentaire + `ovrsee/plans/` + `ovrsee/tickets/`
- Idempotent : relire `.gitignore`, retirer tout bloc géré existant (match exact sur le
  contenu), puis ré-ajouter le bloc seulement si le réglage correspondant est `true`.
  N'écrit le fichier que si le contenu a changé (pas de bruit de mtime).
- Ne touche à rien d'autre dans le fichier (respecte les blocs manuels existants :
  `.ovrsee-auth.json`, `graphify-out/`, etc.).

### 3. Déclenchement
`hooks/ovrsee-post-commit.js` : juste après avoir calculé `root` et vérifié
`existsSync(ovrseeDir)`, appeler :

```js
syncGitignore(root, mergeSettings(readSettings(), readJson(join(root, 'ovrsee.config.json')) ?? {}))
```

dans le même bloc `try/catch` existant (exit 0 toujours, un souci de sync ne doit jamais
faire échouer le commit). Ainsi le `.gitignore` du projet reflète le réglage courant à
chaque commit, avant même que le crawl ne (re)crée des captures.

### 4. UI
- `app/src/PreferencesProjet.tsx` : nouveau composant exporté
  `BlocGitignore({ settings, onSettings })` — deux `Row` + `Switch`, sur le modèle de
  `BlocAvance`. Ajouté à `SectionProjet` sous un nouveau `<GroupLabel>{t('pref.gitignore_title')}</GroupLabel>`.
- `app/src/Onboarding.tsx` (`EcranReglages`) : importer `BlocGitignore` depuis
  `PreferencesProjet.tsx` et l'insérer entre la ligne bootstrap et le bloc "premier projet"
  — mêmes `settings`/`onSettings` déjà disponibles dans cet écran, aucune nouvelle prop.
- `hooks/i18n.js` (fr + en) : `pref.gitignore_title`, `pref.gitignore_shots`,
  `pref.gitignore_shots_hint`, `pref.gitignore_plans`, `pref.gitignore_plans_hint`. Le hint
  précise que désactiver n'efface pas l'historique déjà commité, et activer ne retire pas
  du suivi git ce qui est déjà suivi (même nuance que celle donnée à l'utilisateur plus tôt
  dans cette conversation).

## Hors périmètre
- Pas de untrack automatique des fichiers déjà commités (`git rm --cached`) quand on active
  un toggle après coup — comportement risqué, à faire à la main si voulu.
- Pas de nouveau paramètre sur `/api/settings` : le mécanisme global + surcharge par
  `ovrsee.config.json` existant suffit, la synchronisation se fait côté hook git.

## Vérification
- `hooks/gitignore-sync.test.js` (nouveau, même style que `ovrsee-post-commit.test.js`) :
  toggle → bloc ajouté ; toggle inverse → bloc retiré ; deux appels de suite avec le même
  réglage → fichier inchangé (idempotence) ; ne touche pas aux autres blocs du fichier.
  Tester aussi `validateSettings`/`mergeSettings` pour les deux nouveaux booléens.
- `pnpm test` (suite complète) passe.
- Manuel dans ce dépôt : couper le switch "captures" dans Préférences → commit de test →
  `.gitignore` perd la ligne `ovrsee/pages/shots/`, `git status` remontre les PNG. Remettre
  le switch → nouveau commit → la ligne revient.
- Onboarding : lancer le flow (ou re-rendre `EcranReglages` isolément) et vérifier que les
  deux interrupteurs s'affichent et écrivent bien `gitignoreShots`/`gitignorePlans` via
  `onSettings`.
