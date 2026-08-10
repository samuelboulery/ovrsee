---
{
  "status": "closed",
  "title": "Onglet Aperçu — en-tête, médias du README, code coloré, actions rapides",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "c017018",
      "date": "2026-08-10",
      "files": [
        "app/src/App.tsx",
        "app/src/ClaudeConfigPanel.tsx",
        "app/src/ConfigClaudeModal.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/PreferencesPreview.tsx",
        "app/src/PreferencesProfils.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/SkillsPanel.tsx",
        "app/src/i18n.test.ts",
        "app/src/prefs.test.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Onglet Aperçu — en-tête, médias du README, code coloré, actions rapides

## Contexte

L'onglet Aperçu (`app/src/tabs/Apercu.tsx`) est la page d'arrivée : il répond à
« c'est quoi, ce projet ? » avec le README du dépôt. Trois manques :

1. Pas d'en-tête — le nom du projet défile avec le contenu, et les actions
   utiles (Finder, éditeur, terminal) sont soit dans le menu natif, soit nulle part.
2. `app/src/markdown.tsx` ne connaît pas la syntaxe image. Un README qui montre
   une capture ou un GIF de démo affiche `![démo](docs/demo.png)` en clair. Le HTML
   brut (`<details>`, `<p align=center><img>`), très courant en README, aussi.
3. Les blocs de code sont gris uniformes, avec l'étiquette de langage posée
   *dans* le `<pre>` (donc copiée avec le code).

Résultat visé : l'Aperçu se lit comme la page GitHub du projet, sans quitter
l'invariant — **le cockpit lit ; il n'exécute que le terminal qu'on lui demande.**

### Arbitrages déjà pris

- **Images distantes : non.** Seuls les fichiers du dépôt s'affichent. Une image
  distante reste du texte avec son URL. Aucune requête sortante déclenchée par un
  README.
- **« Ouvrir dans l'éditeur » : schéma d'URL** (`vscode://file/…`), via
  `shell.openExternal` — même classe qu'ouvrir un lien web, aucun processus lancé.
- **Coloration : tokeniseur maison**, zéro dépendance (le projet en a trois en
  prod et cette sobriété est un choix — `CLAUDE.md`).

---

## 1. Route média + serveur

**`hooks/snapshot.js`** — ajouter `mediaPath(root, relative)` juste après
`shotPath` (ligne 412), même mécanique de garde mais enracinée sur le dépôt :

```js
const MEDIA_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

export function mediaPath(root, relative) {
  const base = normalize(root)
  const file = normalize(join(base, relative ?? ''))
  const type = MEDIA_TYPES[extname(file).toLowerCase()]
  // L'allowlist d'extensions est la vraie garde : sans elle, la route servirait
  // `.env` à qui le demande. Le préfixe seul n'empêche que la sortie du dépôt.
  if (!type || !file.startsWith(base) || !existsSync(file)) return null
  return { file, type }
}
```

**`server/api.js`** — le contrat de `resolve()` (ligne 305) passe de `{file: string}`
à `{file: string, type?: string}` :

- `/api/shot` (ligne 403) rend `{ file, type: 'image/png' }`.
- nouveau `case '/api/media'` : `asked()` pour la liste blanche du registre, puis
  `mediaPath(root, url.searchParams.get('file'))`, 404 sinon.
- `nodeMiddleware` (ligne 441) et `fetchHandler` (ligne 464) lisent
  `result.type ?? 'image/png'` au lieu du littéral.

**`app/src/data.ts`** — `mediaUrl(root, file)` à côté de `shotUrl` (ligne 635).

> `ponytail:` pas de support des requêtes Range. Une vidéo se lit du début ; le
> déplacement dans la timeline peut hoqueter sur un gros fichier. Ajouter le
> Range si quelqu'un met un screencast de 200 Mo dans son README.

## 2. `app/src/markdown.tsx`

Signature : `Markdown({ text, root })`, `root` optionnel — sans lui, les images
locales retombent sur le rendu texte actuel (aucun autre appelant aujourd'hui,
Aperçu est le seul).

- **Images / vidéos** : ajouter `!\[[^\]]*\]\([^)\s]+\)` au motif de `inlinePattern()`
  (ligne 49). Trois cas dans le nouveau branchement de `inline()` :
  - src relatif + extension vidéo → `<video controls preload="metadata">`,
  - src relatif → `<img>` (`max-width: 100%; border-radius: 8px`), `alt` conservé,
  - `http(s)://` → même rendu gris que les liens relatifs actuels (ligne 106), le
    domaine visible. Rien ne part sur le réseau.
- **Cases à cocher** : dans la branche `BULLET` (ligne 274), détecter `[ ]` / `[x]`
  en tête d'item → `<input type="checkbox" disabled>` + `list-style: none`.
- **HTML `<details>` et `<img>`** : deux reconnaissances ciblées, pas un parseur.
  Un `<details>`…`</details>` au niveau bloc → `<details><summary>` React, corps
  repassé dans `Markdown`. Un `<img src=…>` isolé sur sa ligne → même rendu que
  la syntaxe markdown. Tout autre HTML reste rendu tel quel, comme aujourd'hui —
  le commentaire d'en-tête du fichier (lignes 13-19) reste vrai : aucun
  `dangerouslySetInnerHTML`, aucune balise interprétée.
- **Ancres** : chaque titre reçoit `id={slug(texte)}`, et un export
  `headings(text)` rend `{level, texte, id}[]` en réutilisant `HEADING` (ligne 22),
  pour le sommaire.
- **Blocs de code** : l'étiquette de langage sort du `<pre>` (ligne 170) vers une
  barre au-dessus, avec un bouton copier (`navigator.clipboard.writeText`,
  état « copié » 1,5 s). Le `<code>` reçoit les jetons colorés.

## 3. `app/src/highlight.ts` (nouveau, ~90 lignes)

`highlight(code, language): ReactNode[]` — un seul tokeniseur, paramétré par
langage, pas une grammaire par langage :

- ordre de reconnaissance : commentaire → chaîne (`'` `"` `` ` ``) → nombre →
  mot-clé → identifiant suivi de `(` (appel) → reste,
- table par langage : marqueurs de commentaire (`//`+`/* */`, `#`, `<!-- -->`)
  et jeu de mots-clés. Familles couvertes : `js/jsx/ts/tsx`, `json`, `bash/sh/zsh`,
  `css`, `html/xml`, `python`, `md`, `yaml`. Langage inconnu ou absent → texte brut,
  comme aujourd'hui.
- couleurs sur les rampes Nocturne (`--color-accent-300` mots-clés,
  `--color-accent-2-*` chaînes, `--color-neutral-600` commentaires), pas de
  littéraux hexadécimaux.

> `ponytail:` un tokeniseur par regex, pas un parseur. Il se trompera sur les
> cas tordus (regex littérale JS, chaîne multi-lignes, template imbriqué). Le
> code reste lisible dans tous les cas — c'est le plafond accepté.

## 4. En-tête + actions rapides — `app/src/tabs/Apercu.tsx`

Le haut de l'onglet (lignes 78-135) devient un en-tête **collant**
(`position: sticky; top: 0`, fond `--color-bg`, filet bas) dans le conteneur
défilant existant :

- ligne 1 : nom du projet, chemin en monospace cliquable (copie), description ;
- ligne 2 : la rangée de `Chiffre` actuelle, inchangée — mêmes fonctions
  `plansOuverts` / `lastScan` / `restant` / `stackFrom` de `data.ts` ;
- ligne 3 : les actions rapides.

Actions, toutes déjà permises par le cadrage :

| Action | Mécanique | Existe déjà ? |
|---|---|---|
| Ouvrir dans l'éditeur | nouvel IPC `projects:edit` | non |
| Révéler dans le Finder | `window.cockpit.projects.reveal(root)` | oui (`preload.cjs`) |
| Terminal Claude / shell | `window.cockpit.terminal.open(root, kind)` | oui |
| Copier le chemin | `navigator.clipboard` | — |
| Export Obsidian | `projectAction('export-obsidian')` | oui (ligne 189) |

Les boutons qui dépendent d'Electron disparaissent quand `window.cockpit` est
absent (mode navigateur) — détection déjà employée partout (`App.tsx:147`).

Les pastilles `pnpm <script>` (lignes 137-157) restent du **texte**. Le
commentaire des lignes 142-144 dit pourquoi ; il ne bouge pas.

**Sommaire** : colonne à droite du README (`position: sticky`), alimentée par
`headings(readme)`, masquée sous 1100 px de large et si moins de 3 titres.

## 5. IPC « ouvrir dans l'éditeur »

**`electron/main.js`** — handler `projects:edit` à côté de `projects:reveal`
(lignes 278-385) :

```js
const EDITORS = { vscode: 'vscode://file', cursor: 'cursor://file', zed: 'zed://file' }

ipcMain.handle('projects:edit', (_e, path, editor) => {
  // Même garde que `projects:reveal` : le chemin doit être au registre.
  if (!projects(null).some(p => p.path === path)) return false
  const scheme = EDITORS[editor]
  if (!scheme) return false
  shell.openExternal(`${scheme}${path}`)
  return true
})
```

La liste blanche d'éditeurs et la validation du chemin sont **dans le main**, pas
dans le rendu : le renderer ne doit jamais pouvoir demander l'ouverture d'une URL
arbitraire. **`electron/preload.cjs`** expose `cockpit.projects.edit(path, editor)`.

Choix de l'éditeur : un petit sélecteur à côté du bouton, mémorisé en
`localStorage` (`cockpit.editor`, défaut `vscode`). Pas de nouvelle clé dans
`DEFAULT_SETTINGS` — `hooks/settings.js` et `PreferencesPanel.tsx` sont en cours
de refonte sur cette branche, et une clé de plus s'y télescoperait.

## 6. i18n

Nouvelles clés `apercu.*` (actions, sommaire, copier, éditeur) dans les **deux**
dictionnaires de `hooks/i18n.js`, et ajoutées à la liste de
`app/src/i18n.test.ts` — le test de parité les vérifie explicitement.

---

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `hooks/snapshot.js` | + `mediaPath`, `MEDIA_TYPES` |
| `server/api.js` | + `/api/media`, `type` dans le contrat de `resolve()` et les deux hôtes |
| `app/src/data.ts` | + `mediaUrl` |
| `app/src/markdown.tsx` | images/vidéos, cases à cocher, `<details>`, ancres, `headings()`, barre de code |
| `app/src/highlight.ts` | **nouveau** |
| `app/src/tabs/Apercu.tsx` | en-tête collant, actions rapides, sommaire |
| `electron/main.js` + `preload.cjs` | IPC `projects:edit` |
| `hooks/i18n.js`, `app/src/i18n.test.ts` | clés fr + en |

## Tests

Dans le style du dépôt — `node:test` + `node:assert`, aucun framework (`CLAUDE.md`).

- `hooks/snapshot.test.js` : `mediaPath` refuse `../../.ssh/id_rsa`, refuse
  `.env` (extension hors allowlist), accepte un `.png` du dépôt, rend le bon type.
- `server/api.test.js` : `/api/media` sur un projet hors registre → 404 ;
  sur un projet enregistré → `{file, type}`.
- `app/src/markdown.test.tsx` (nouveau, compilé par `scripts/test-ui.js`) :
  `![x](a.png)` rend une `img`, `![x](a.mp4)` une `video`, `![x](https://…)` ne
  rend **pas** d'`img`, `- [x] fait` rend une case cochée, `headings()` rend les
  bons slugs.
- `app/src/highlight.test.ts` : un mot-clé JS est coloré, un langage inconnu rend
  le texte intact, la concaténation des jetons rend exactement le code d'entrée
  (aucun caractère perdu — la propriété qui compte).

## Vérification

```bash
pnpm typecheck && pnpm test
pnpm electron        # l'app complète : le rendu Electron est le seul qui compte
```

Dans l'app, sur ce dépôt même :

1. L'en-tête reste en haut quand le README défile ; les chiffres ne changent pas.
2. Blocs de code du README colorés, étiquette de langage hors du `<pre>`, le
   bouton copier rend le code **sans** l'étiquette.
3. Ajouter temporairement `![test](cockpit/pages/shots/accueil/2026-08-10-8371369.png)`
   au README → l'image s'affiche. `![x](https://shields.io/…)` → texte, et
   **aucune requête sortante** dans l'onglet Réseau des devtools.
4. `../../../etc/passwd` dans une syntaxe image → 404, rien ne s'affiche.
5. Bouton éditeur → VS Code s'ouvre sur le dossier. Finder, terminal, copie du
   chemin : chacun une fois.
6. `pnpm dev` (navigateur) : les boutons Electron sont absents, le reste marche.

Puis `pnpm package` — `node-pty` casse à l'empaquetage, pas en dev.
