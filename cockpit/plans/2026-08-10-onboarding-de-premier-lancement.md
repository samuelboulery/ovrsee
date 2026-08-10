---
{
  "status": "open",
  "title": "Onboarding de premier lancement",
  "opened": "2026-08-10",
  "closed": null,
  "commits": []
}
---

# Onboarding de premier lancement

## Contexte

Aujourd'hui, un clone frais du dépôt s'ouvre déjà sur lui-même : `projects()`
(`hooks/snapshot.js:75-78`) ajoute le répertoire courant à la liste dès qu'il porte
un dossier `cockpit/`. L'app n'est donc jamais vide, et le seul accueil existant
(`app/src/Welcome.tsx`, 62 lignes) est un mur de texte sans un seul bouton : il
explique et donne une commande à recopier.

Résultat : quelqu'un qui télécharge le DMG n'a aucune idée de ce que fait le
cockpit, de ce qu'il n'exécute pas, ni de la façon de l'adapter à son usage. Tous
les leviers de personnalisation existent pourtant déjà — quatre templates
d'interface, thème, langue, disposition du terminal — mais ils vivent derrière un
bouton des préférences que personne n'ouvre au premier lancement.

L'objectif : démarrage réellement vide, puis un onboarding de **trois écrans**,
skipable à tout moment, qui explique le cockpit, adapte l'interface à l'usage réel
de Claude Code de la personne, et se termine sur l'ajout d'un premier projet.

**Invariant respecté** : l'onboarding n'écrit que dans
`~/.claude/cockpit/settings.json` et le registre `~/.claude/cockpit/projects.json`.
Il n'exécute rien, ne lit aucun code du projet observé.

---

## 1. Démarrage vide (`hooks/snapshot.js`)

Supprimer le repli sur le répertoire courant, lignes 75-78 :

```js
if (!cwd || !existsSync(join(cwd, 'cockpit'))) return ordered
if (ordered.some(p => p.path === cwd)) return ordered
return [{ path: cwd, name: basename(cwd) }, ...ordered]
```

`projects()` ne rend plus que le registre trié. Conséquences à traiter dans le
même lot :

- Le paramètre `cwd` devient inutilisé → signature `export function projects()`.
  Mettre à jour les appelants : `server/api.js:171,172,194,227,313,367,393` et
  `electron/main.js:294,397,417` (tous passent `cwd` ou `null`, mécanique).
- Vérifier au grep si `cwd` sert encore ailleurs dans `resolve()` de
  `server/api.js` ; s'il devient orphelin, le retirer aussi — sinon le laisser.
- **Effet de bord bénéfique** : `projects()` sert de liste blanche
  (`known()` en `server/api.js:171`, gardes d'`electron/main.js`). L'allowlist
  devient purement le registre, plus rien d'implicite.
- Réécrire le test `hooks/plans.test.js:576-588` (« ajoute le dépôt courant en
  tête ») en son inverse : registre vide ⇒ liste vide, même avec un `cockpit/`
  sur place. Ajuster aussi le commentaire de doc `hooks/snapshot.js:60-64`.
- Coût assumé : au dev server, il faudra ajouter le dépôt cockpit à son propre
  registre une fois (bouton « Ajouter un projet »), puis plus jamais.

## 2. Deux nouvelles clés de préférences (`hooks/settings.js`)

Dans `DEFAULT_SETTINGS` (l. 32) :

```js
onboardingVu: false,
claude: { niveau: 'intermediaire', usage: 'terminal' },
```

Dans `validateSettings()`, sur le modèle champ-par-champ existant :

```js
if (typeof partial.onboardingVu === 'boolean') out.onboardingVu = partial.onboardingVu
if (partial.claude && typeof partial.claude === 'object') {
  if (['debutant','intermediaire','avance','expert'].includes(partial.claude.niveau)) …
  if (['terminal','ide','desktop','autre'].includes(partial.claude.usage)) …
}
```

Ne **pas** les ajouter à `mergeSettings()` : ce sont des champs personnels, un
`cockpit.config.json` de dépôt n'a pas à les surcharger (même traitement que
`langue`, `theme`, `densiteActivite`).

Pourquoi persister `claude` alors que le profil d'interface, lui, ne l'est pas
(doctrine de `PreferencesProfils.tsx:1-13`) : le profil est une **action**
appliquée une fois ; le niveau et l'usage sont une **préférence** qui continue à
servir après l'onboarding — au pré-cochage des skills à l'équipement, et à la
réouverture de l'onboarding.

## 3. Déclenchement (`app/src/App.tsx`)

Sortie anticipée avant tout le chrome (barre latérale + barre d'onglets), après
les hooks — un premier lancement ne doit pas afficher une barre d'onglets vide :

```tsx
if (settings && !settings.onboardingVu && projects.length === 0 && !error) {
  return <Onboarding settings={settings} onFini={…} onProjets={applyProjects} />
}
```

La double condition règle la migration sans code de migration : un utilisateur
existant a déjà des projets au registre, il ne rejouera jamais l'onboarding même
si sa clé `onboardingVu` est absente. Un `settings.json` corrompu retombe sur
`DEFAULT_SETTINGS` (`readSettings()` l. 69-77), donc `onboardingVu: false` — ce
qui est le bon défaut.

Rentrée volontaire : bouton « Revoir la présentation » dans la section Général de
`PreferencesPanel.tsx`, qui remet `onboardingVu: false` et ferme la modale. Un
état local `revoirOnboarding` dans `App.tsx` permet de l'afficher même avec des
projets enregistrés.

## 4. Le flow — trois écrans

Fichier : **`app/src/Onboarding.tsx`** (~280 l.) — coquille + les trois écrans.
Bandeau commun en haut : logo, trois pastilles d'étape, et « Passer » en haut à
droite, présent partout. Bas d'écran : « Précédent » / « Suivant ».

### Écran 1 — Ce qu'est le cockpit

Aucune question. Logo, titre, puis trois affirmations courtes reprises du texte
de `Welcome.tsx` et de l'invariant :

- La vérité vit dans `cockpit/`, en markdown et en images versionnées par git.
- L'application n'est qu'une vue : si elle disparaît, rien n'est perdu.
- Elle lit ; elle n'exécute que le terminal qu'on lui demande.

Illustration : `<SchemaBoucle />` — un schéma SVG inline, quatre nœuds reliés
(*plan approuvé → commit → capture → `cockpit/`*), dessiné en `currentColor` et
`var(--color-accent)` pour suivre le thème.

Sous le schéma, les prérequis honnêtes déjà listés dans `Welcome.tsx` : `claude`,
`git`, `node` — et la phrase qui dit que rien ne les installe à votre place.

### Écran 2 — Vous et Claude Code

Deux questions, une maquette qui réagit en direct.

| Question | Contrôle | Valeurs |
|---|---|---|
| Comment lancez-vous Claude Code ? | cartes radio | `terminal` · `ide` · `desktop` · `autre` |
| Quel est votre niveau ? | `<Segmented>` (existant) | `debutant` · `intermediaire` · `avance` · `expert` |

À droite (ou dessous sous 900 px), `<PreferencesPreview settings={apercu} />` —
la maquette miniature déjà écrite (`PreferencesPreview.tsx`) — se recalcule à
chaque réponse. Sous elle, une ligne en clair qui dit ce que le choix a changé :
*« Onglets Aperçu, Tableau, Stack, Historique. Terminal à droite. Modifiable à
tout moment dans les Préférences. »*

Puis la rangée des quatre templates (`PROFILS` de `PreferencesProfils.tsx`), celui
qui est déduit étant présélectionné : la déduction est un point de départ, pas une
décision imposée. Réutiliser `CarteProfil` — l'extraire de `PreferencesProfils.tsx`
en export nommé plutôt que d'en écrire une seconde.

### Écran 3 — Réglages et premier projet

- **Langue** — `<Segmented>` fr / en (applique `setCurrentLanguage` en direct).
- **Thème** — les trois icônes SVG de `PreferencesControls.tsx` (clair / sombre / auto).
- **Commande de démarrage** — un `<Switch>` unique : « Proposer `/project-setup`
  à l'ouverture d'un projet neuf », pré-réglé par le niveau (voir §5).
- Bouton principal **« Ajouter un projet »** → `openProject()` (`App.tsx:143`,
  sélecteur de dossier natif). Succès ⇒ écrit les préférences, `onboardingVu: true`,
  et sort du flow ; l'écran d'équipement (`EquipmentPanel`) prend le relais si le
  projet n'est pas équipé. **Pas de duplication de l'équipement dans l'onboarding.**
- Lien discret « Plus tard » ⇒ même écriture, atterrissage sur `Welcome`.
- **Dégradé navigateur** : `window.cockpit?.projects` n'existe qu'en Electron. Sans
  lui, remplacer le bouton par la commande CLI, comme le fait `Welcome.tsx`
  aujourd'hui.

Skip depuis n'importe quel écran : écrit `onboardingVu: true` et ce qui a déjà été
répondu. On ne redemande jamais — un skip qui rejoue est un skip qui ment.

## 5. Ce que chaque réponse règle (`app/src/onboarding.ts`, ~80 l.)

Module pur, testable sans React.

```ts
export function profilSuggere(niveau: Niveau, usage: Usage): string
export function appliquerReponses(settings: SettingsType, r: Reponses): SettingsType
```

**Profil suggéré** — `usage` décide de la place du terminal, `niveau` de la surface montrée :

| | `terminal` / `ide` | `desktop` / `autre` |
|---|---|---|
| `debutant` · `intermediaire` | `complet` | `sobre` |
| `avance` · `expert` | `dev` | `revue` |

**Puis surcharge du terminal depuis l'usage**, appliquée après `appliquerProfil()` :

- `terminal` → `{ visible: true, disposition: 'side' }`
- `ide` → `{ visible: true, disposition: 'bottom' }`
- `desktop` · `autre` → `{ visible: false }`

**Commandes de démarrage** : `debutant` · `intermediaire` → `bootstrap: ['/project-setup']` ;
`avance` · `expert` → `bootstrap: []`. Le `<Switch>` de l'écran 3 laisse le
dernier mot.

**Skills pré-cochés à l'équipement** : `useSkills()` (`SkillsPanel.tsx:113-143`)
présélectionne aujourd'hui tout ce que `aProposer()` retient. Lui passer
`settings.claude.niveau` et, pour `expert`, ne retenir que `cockpit` et
`cockpit-tickets` — un expert n'a pas besoin qu'on lui coche graphify. `EquipmentPanel`
reçoit `settings` en prop depuis `App.tsx` pour le transmettre. ~15 lignes.

Réutiliser sans les réécrire : `appliquerProfil()` et `PROFILS`
(`PreferencesProfils.tsx:37,84`), `updateSettings()` (`data.ts:666`),
`openProject()` (`App.tsx:143`), `applyTheme()` (`theme.ts`).

## 6. Visuels (`app/src/OnboardingArt.tsx`, ~90 l.)

- `<Logo size={n} />` — le dessin de `build/icon.svg` (1,2 ko) transcrit en JSX,
  couleurs remplacées par les jetons Nocturne. Commentaire `// WHY:` renvoyant à
  `build/icon.svg` comme source d'empaquetage. Pourquoi transcrire plutôt
  qu'importer en `?raw` : `scripts/test-ui.js` compile `app/src` avec `tsc`, qui
  ne résout pas les suffixes de requête Vite — un import `?raw` casserait la
  suite de tests avant de casser le build.
- `<SchemaBoucle />` — le schéma de l'écran 1, `<rect>` + `<path>` + `<text>`,
  aucune image binaire, aucun octet ajouté au bundle.

Aucun nouveau dossier d'assets, aucune plomberie de chemins sous le protocole
`cockpit://`.

## 7. `Welcome.tsx` gagne un bouton

Tant qu'on y est : l'écran d'après-onboarding (aucun projet) doit offrir le même
bouton « Ajouter un projet » que l'écran 3, avec le même repli CLI hors Electron.
~15 lignes, et il cesse d'être un cul-de-sac.

## 8. i18n (`hooks/i18n.js`)

~40 clés `onboard.*` en paire FR/EN : navigation (`skip`, `next`, `prev`,
`step`), écran 1 (titre, trois affirmations, légendes du schéma, prérequis),
écran 2 (les deux questions, 4 + 4 libellés avec leur description d'une ligne,
phrase d'effet), écran 3 (langue, thème, commande de démarrage, ajouter/plus
tard), plus `pref.replay_onboarding`. Aucune chaîne en dur dans les nouveaux
fichiers.

---

## Fichiers

| Fichier | Nature | ~lignes |
|---|---|---|
| `hooks/snapshot.js` | suppression du repli cwd | −6 |
| `hooks/settings.js` | 2 clés + validation | +18 |
| `hooks/i18n.js` | ~40 clés × 2 | +85 |
| `hooks/plans.test.js` | test inversé | ~±15 |
| `hooks/settings.test.js` | validation des 2 clés | +35 |
| `server/api.js`, `electron/main.js` | `projects()` sans argument | mécanique |
| `app/src/onboarding.ts` | **neuf** — logique pure | ~80 |
| `app/src/OnboardingArt.tsx` | **neuf** — logo + schéma SVG | ~90 |
| `app/src/Onboarding.tsx` | **neuf** — coquille + 3 écrans | ~280 |
| `app/src/onboarding.test.tsx` | **neuf** — tests | ~160 |
| `app/src/App.tsx` | sortie anticipée + rentrée | +30 |
| `app/src/PreferencesPanel.tsx` | « Revoir la présentation » | +15 |
| `app/src/PreferencesProfils.tsx` | export de `CarteProfil` | +2 |
| `app/src/SkillsPanel.tsx`, `EquipmentPanel.tsx` | niveau → pré-cochage | +15 |
| `app/src/Welcome.tsx` | bouton d'ajout | +15 |

## Ordre d'exécution

1. `hooks/settings.js` + son test (les clés existent avant qu'on s'en serve).
2. `hooks/snapshot.js` + réécriture du test + appelants `projects()`.
3. `app/src/onboarding.ts` + `onboarding.test.tsx` (logique pure d'abord, TDD).
4. `OnboardingArt.tsx`, puis `Onboarding.tsx` écran par écran.
5. Câblage `App.tsx`, rentrée par les préférences, bouton de `Welcome.tsx`.
6. i18n FR + EN, relecture qu'aucune chaîne n'est en dur.
7. Pré-cochage des skills par le niveau.

## Vérification

```bash
pnpm test          # node --test : hooks/ crawl/ server/ mcp/ + app/src compilé
pnpm typecheck     # tsc sur app/src
```

Puis les deux hôtes — une route testée au navigateur n'est pas une route testée
dans Electron :

```bash
# 1. Premier lancement simulé, registre et préférences neufs
mkdir -p /tmp/cockpit-neuf
COCKPIT_REGISTRY=/tmp/cockpit-neuf/projects.json \
COCKPIT_SETTINGS=/tmp/cockpit-neuf/settings.json pnpm dev
# → attendu : les 3 écrans, pas de barre d'onglets, bouton d'ajout remplacé
#   par la commande CLI (pas de sélecteur natif au navigateur)

# 2. Le vrai chemin, avec sélecteur de dossier
COCKPIT_REGISTRY=/tmp/cockpit-neuf/projects.json \
COCKPIT_SETTINGS=/tmp/cockpit-neuf/settings.json pnpm electron
```

À vérifier à la main dans Electron :

- Le flow s'ouvre plein écran, sans chrome ; « Passer » marche depuis les trois écrans.
- Chaque réponse de l'écran 2 modifie la maquette **et** la phrase qui la décrit.
- Choisir un template écrase la suggestion.
- « Ajouter un projet » ouvre le sélecteur natif, puis enchaîne sur `EquipmentPanel`
  si le projet n'est pas équipé.
- `cat /tmp/cockpit-neuf/settings.json` : `onboardingVu: true`, `claude`, `onglets`,
  `terminal`, `bootstrap` conformes aux réponses.
- Relancer : l'onboarding ne revient pas. « Revoir la présentation » dans les
  préférences le ramène.
- Thème clair **et** sombre sur les trois écrans (le schéma SVG suit les jetons).
- Avec son registre habituel : rien ne change, aucun onboarding rejoué.

Enfin `pnpm package` pour reconstruire le DMG.
