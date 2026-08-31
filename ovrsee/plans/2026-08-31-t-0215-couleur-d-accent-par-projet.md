---
{
  "status": "open",
  "title": "T-0215 — Couleur d'accent par projet",
  "opened": "2026-08-31",
  "closed": null,
  "commits": [
    {
      "sha": "f3da750",
      "date": "2026-08-31",
      "files": [
        "CLAUDE.md",
        "_ds/ovrsee/styles.css",
        "app/src/App.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/api.ts",
        "app/src/data.ts",
        "app/src/prefs.test.tsx",
        "hooks/accents.js",
        "hooks/accents.test.js",
        "hooks/i18n.js",
        "hooks/plans.js",
        "hooks/plans.test.js",
        "server/api.js",
        "server/api.test.js"
      ]
    },
    {
      "sha": "1a23f31",
      "date": "2026-08-31",
      "files": []
    }
  ]
}
---

# T-0215 — Couleur d'accent par projet

## Contexte

Issue #48 (Floriane) : tous les projets se ressemblent à l'écran, seul le nom
dans l'en-tête dit lequel est ouvert. Une couleur d'accent propre à chaque
projet règle ça sans rien lire.

Le geste est petit parce que `--color-accent` est **un seul jeton**
(`_ds/ovrsee/styles.css:74`) consommé par variable CSS : 75 usages `var(--color-accent…)`
répartis sur 34 fichiers d'`app/src`, **aucun hex d'accent en dur hors exemptions**.
Surcharger le jeton sur `document.documentElement` repeint donc l'application entière.

Ce qui n'existe pas : le registre `~/.claude/ovrsee/projects.json` ne porte que
`{path, name, lastOpened}` (`hooks/plans.js:256`), et aucune route n'écrit de
préférence **par projet** (POST `/api/settings` n'écrit que le global,
`server/api.js:440`).

Arbitrages déjà tranchés dans le ticket, confirmés par l'exploration :
- **Dans le registre**, pas dans `ovrsee.config.json` : une couleur est inerte
  (pas le risque d'exécution qui a fait retirer `bootstrap` en #70), mais c'est
  une préférence de poste, et `ovrsee.config.json` est versionné.
- **Par `/api/*`**, pas par IPC : le critère du dépôt est le secret ou
  l'exécution (`CLAUDE.md`, `server/api.js:496`). Une couleur n'est ni l'un ni
  l'autre — `projectAction` est déjà le point d'écriture du registre, gardé par
  `known()` et l'en-tête `X-Ovrsee`.
- **Palette fermée de 6 teintes**, déclarée en CSS : un accent libre casse le
  contraste, et `hooks/couleurs.test.js` interdit déjà les hex dans `app/src`.

Arbitrages de cette session : **le terminal xterm reste violet** (curseur et
magenta sont des constantes JS de `theme.ts`, appliquées une fois au montage —
c'est l'obstacle que T-0218 recense) ; branche neuve **depuis `main`**.

## Ce qui est construit

### 1. `hooks/accents.js` — la liste fermée (nouveau, ~20 lignes)

```js
export const ACCENTS = ['violet', 'ambre', 'vert', 'cyan', 'rose', 'orange']
export const ACCENT_DEFAUT = 'violet'
/** Rend l'accent s'il est admis, sinon null — jamais d'exception. */
export const validerAccent = valeur => (ACCENTS.includes(valeur) ? valeur : null)
```

**Aucune valeur hex ici** : les couleurs vivent dans le design system, ce module
ne porte que les identifiants. C'est ce qui garde `hooks/couleurs.test.js` vert
et rend le critère « palette déclarée dans le design system » littéral.

`violet` est le défaut : le stocker revient à ne rien stocker (voir §3).

### 2. `_ds/ovrsee/styles.css` — les 5 blocs de surcharge

Après les rampes (`styles.css:104-122`), un bloc par teinte non-défaut :

```css
/* Accents par projet (T-0215). Sélecteur d'attribut sans `:root` : la même
   règle repeint l'application (attribut sur <html>) et les pastilles de choix
   des préférences (attribut sur un <span>), sans dupliquer les valeurs. */
[data-accent='ambre'] {
  --color-accent: #e3b341;
  --color-accent-100: …; /* … 9 paliers */
}
```

- 9 paliers par teinte, **valeurs hex littérales** — la règle du fichier
  (`styles.css:37-38, 53-55`) interdit `color-mix` dans les jetons. Générés hors
  dépôt par un script jetable qui reproduit le profil de luminosité de la rampe
  violette existante, puis collés ; le script n'est pas commité.
- `violet` n'a **pas** de bloc : c'est l'absence d'attribut, donc le `:root`
  d'origine — un projet sans accent s'affiche exactement comme aujourd'hui, par
  construction et pas par recopie.
- Correction au passage : `.btn-primary` (`styles.css:222-224`) écrit `#7d76f0`
  en dur trois fois. Passage à `var(--color-accent)`, sans quoi les 21 boutons
  primaires de l'interface resteraient violets.

### 3. `hooks/plans.js` — le champ `accent` au registre

Un quatrième mutateur, à côté de `registerProject` / `unregisterProject` /
`touchProject` (l. 282-324), même forme : réécriture du tableau entier, spread
pour préserver les champs voisins, `false` sur un projet inconnu.

```js
export function setProjectAccent(root, accent) { … }
```

- Projet inconnu → `false` (comme `touchProject`).
- Accent invalide → `false` (`validerAccent`).
- `ACCENT_DEFAUT` → **retire** la clé plutôt que d'écrire `"violet"` : le
  registre d'un poste qui n'a rien personnalisé reste identique à aujourd'hui.
- JSDoc de `readRegistry` (`plans.js:256`) mise à jour avec `accent?`.

`touchProject` préserve déjà `accent` par son spread (`plans.js:321`) — à
verrouiller par un test, c'est le chemin qui s'exécute à chaque ouverture.

### 4. `server/api.js` — l'action `accent`

Un `case` de plus dans `projectAction` (`server/api.js:204-284`) :

```js
case 'accent': {
  if (!known()) return { status: 404, json: { error: 'projet inconnu' } }
  if (!setProjectAccent(path, body?.accent)) return { status: 400, json: { error: 'accent inconnu' } }
  return list()
}
```

Rien d'autre à faire côté transport : `projects()` (`hooks/snapshot.js:70-76`)
rend les entrées telles quelles, `accent` ressort donc déjà par
`GET /api/projects`, dans Electron comme dans le navigateur — mêmes octets, une
seule implémentation.

### 5. Interface — appliquer, puis choisir

- `app/src/data.ts:126` : `Project` gagne `accent?: string`.
- `app/src/api.ts:41` : `'accent'` rejoint l'union `ProjectAction` ; le
  paramètre `payload` existe déjà (`api.ts:56-68`), rien à changer d'autre.
- `app/src/App.tsx` : un effet sur `[current, projects]` pose ou retire
  l'attribut — c'est **tout** le repeint, sans rechargement :

  ```tsx
  useEffect(() => {
    const accent = projects.find(p => p.path === current)?.accent
    if (accent && accent !== 'violet') document.documentElement.dataset.accent = accent
    else delete document.documentElement.dataset.accent
  }, [current, projects])
  ```

  Puis deux props vers la modale : `accent={…}` et `onAccent={a => projectAction('accent', current, { accent: a }).then(r => applyProjects(r.projects))}`.
  `applyProjects` (`App.tsx:322`) existe et garde le projet courant sélectionné.
- `app/src/PreferencesPanel.tsx` : les deux props traversent jusqu'à
  `SectionProjet` (`:583-593`), comme `root` et `integrations` aujourd'hui.
- `app/src/PreferencesProjet.tsx` : un sixième bloc, `BlocApparence`, posé en
  tête de la section — six pastilles sur le gabarit `CarteDisposition`
  (`PreferencesPanel.tsx:206-263`) : `role="radio"` / `aria-checked` dans un
  parent `role="radiogroup"`, navigation clavier comprise.

  La pastille se peint **sans hex** : `<span data-accent={id} style={s('background: var(--color-accent);')} />`
  — l'attribut redéfinit le jeton sur le span lui-même. Le garde-fou
  `hooks/couleurs.test.js` reste vert sans nouvelle exemption.
- `hooks/i18n.js` : `pref.accent_title`, `pref.accent_hint` et les six noms de
  teintes, dans les deux blocs `fr:` et `en:`.

## Tests (`node:test` et `node:assert`, aucun framework)

| Fichier | Ce qui est verrouillé |
|---|---|
| `hooks/accents.test.js` **(nouveau)** | Pour chaque id d'`ACCENTS` hors défaut : un bloc `[data-accent='id']` existe dans `_ds/ovrsee/styles.css` et définit `--color-accent` + les 9 paliers ; réciproque (aucun bloc orphelin) ; **contraste ≥ 4.5:1** de chaque accent sur `--color-surface-card` (#131519, la surface la plus claire où l'accent sert de texte) **et** du texte `#0a0a12` posé sur l'accent (`.btn-primary`). Repères mesurés : le violet actuel tient 5.06 et 5.37. |
| `hooks/plans.test.js` | `setProjectAccent` écrit / refuse un accent inconnu / refuse un projet inconnu / retire la clé sur le défaut / préserve `lastOpened` ; `touchProject` préserve `accent`. Sous `withRegistry()` (`plans.test.js:571`). |
| `server/api.test.js` | POST `action: 'accent'` sur un projet connu rend la liste avec l'accent ; 404 sur un chemin hors registre ; 400 sur une valeur inconnue. |
| `app/src/prefs.test.tsx` | `SectionProjet` rendue avec accent, sans accent, et avec un accent inconnu venu du disque — le rendu ne lève pas (matrice `SECTIONS × DEGRADES`, `prefs.test.tsx:107`). |
| `hooks/couleurs.test.js` | Inchangé, doit rester vert : c'est le critère d'acceptation qui atteste qu'aucun hex n'a fui dans un composant. |

## Vérification

1. `pnpm test` (dont `test:ui`, qui compile `app/src`), `pnpm lint`, `pnpm typecheck`.
2. `pnpm electron` : Préférences → Projet → choisir *ambre* → le rail, les
   boutons primaires, les onglets actifs et les liens changent **sans
   rechargement** ; basculer sur un autre projet du rail → l'accent redevient
   celui de l'autre projet, aussi sans rechargement.
3. Vérifier `~/.claude/ovrsee/projects.json` : le champ `accent` est présent sur
   la seule entrée modifiée, `lastOpened` et `name` intacts.
4. Repasser la teinte sur *violet* → la clé disparaît du registre et
   l'application est pixel pour pixel celle d'avant.
5. `pnpm dev` (navigateur) : même parcours — la route est la même, mais
   `CLAUDE.md` rappelle qu'un chemin testé dans Electron ne l'est pas dans le
   navigateur.

## Hors périmètre, dit explicitement

- **Curseur et magenta xterm** (`app/src/theme.ts:25,31-32`) : constantes JS
  appliquées au montage, réappliquer le thème du terminal à chaud est le
  chantier de T-0218. Le châssis du terminal, lui, suit (il passe par `var()`).
- **`--color-accent-2` et sa rampe** : servent la coloration syntaxique
  (`app/src/highlight.ts:215-219`), pas l'identité du projet. Inchangés.
- **`app/src/tabs/navigateur-webview.ts:125`** : `#7d76f0` injecté **dans le
  webview invité**, où les variables de l'hôte n'existent pas. Reste violet.
- Aucun sélecteur de couleur libre, aucune couleur par epic ou par ticket.

## Livraison

Branche `t0215-accent-projet` depuis `main`. Ticket déplacé en `en-cours` au
départ puis `revue` à la PR (skill `ovrsee-tickets`). Commits en Conventional
Commits français, message final citant `T-0215` et `#48` pour que le
rattachement du plan se fasse.
