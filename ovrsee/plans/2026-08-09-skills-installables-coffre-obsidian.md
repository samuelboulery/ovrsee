---
{
  "status": "closed",
  "title": "Skills installables + coffre Obsidian",
  "opened": "2026-08-09",
  "closed": "2026-08-09",
  "commits": [
    {
      "sha": "11470b6",
      "date": "2026-08-09",
      "files": [
        ".gitignore",
        "README.md",
        "app/src/App.tsx",
        "app/src/SkillsPanel.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.ts",
        "app/src/tabs/Apercu.tsx",
        "electron-builder.yml",
        "hooks/cockpit-cli.js",
        "hooks/install.js",
        "hooks/obsidian.js",
        "hooks/obsidian.test.js",
        "hooks/skills.js",
        "hooks/skills.test.js",
        "package.json",
        "server/api.js",
        "server/api.test.js",
        "skills/cockpit-tickets/SKILL.md",
        "skills/cockpit/SKILL.md"
      ]
    },
    {
      "sha": "6e2a2c0",
      "date": "2026-08-09",
      "files": []
    }
  ]
}
---

# Skills installables + coffre Obsidian

## Contexte

Deux manques apparaissent dès qu'on donne Cockpit à quelqu'un d'autre.

**1. Les skills ne s'installent pas.** Le dépôt contient déjà `skills/cockpit/SKILL.md`,
qui explique à Claude Code comment lire `cockpit/` et comment écrire des tickets. Mais
`hooks/install.js` ne le copie nulle part : il crée `cockpit/plans/`, `cockpit/tickets/`,
`cockpit/board.json`, pose le hook `post-commit` et les deux hooks Claude Code — et
s'arrête là. Le skill n'existe donc que pour qui a cloné le dépôt et l'a copié à la main.
Résultat : Claude Code voit un dossier `cockpit/` sans savoir qu'il peut y déposer des
tickets. La boucle « je décris une tâche → un ticket apparaît dans le Tableau » est
écrite mais jamais branchée.

**2. Cockpit ne parle qu'à Graphify.** L'onglet Données lit `graphify-out/graph.json`
(`hooks/snapshot.js:194`), et le bouton « ◆ Regénérer le graphe » injecte `/graphify`
dans la session Claude (`app/src/Terminal.tsx:120`). Quelqu'un qui vit dans Obsidian n'a
aucun moyen d'y retrouver plans, tickets et pages — alors que ce sont exactement des
notes markdown avec des liens entre elles. Graphify sait déjà écrire un coffre
(`--obsidian --obsidian-dir`) ; Cockpit, non.

Résultat visé : à l'initialisation d'un projet, un écran propose de cocher les skills à
installer ; et un bouton exporte `cockpit/` en coffre Obsidian, dans lequel Graphify
dépose son graphe sans se marcher dessus.

---

## Partie 1 — Catalogue de skills

### `hooks/skills.js` (nouveau)

Le catalogue est une constante, pas un registre distant. Deux natures d'entrées :

- **`bundled`** — un skill livré dans `skills/<nom>/SKILL.md` du dépôt Cockpit.
  Installable : copié vers `~/.claude/skills/<nom>/SKILL.md`.
- **`externe`** — un skill que Cockpit ne possède pas (Graphify). **Détecté, jamais
  installé** : on regarde si `~/.claude/skills/<nom>/SKILL.md` existe, et sinon on affiche
  la commande à lancer. Cockpit n'exécute pas d'installateur tiers.

```js
export const CATALOGUE = [
  { nom: 'cockpit',         source: 'bundled', titre: 'Cockpit — lire le projet',
    resume: 'Plans, pages, scans : comment les lire sans ouvrir le code.' },
  { nom: 'cockpit-tickets', source: 'bundled', titre: 'Cockpit — ticketing',
    resume: 'Créer et déplacer les tickets du Tableau depuis la conversation.' },
  { nom: 'graphify',        source: 'externe', titre: 'Graphify — graphe de code',
    resume: "Alimente l'onglet Données et le coffre Obsidian.",
    commande: 'pip install graphifyy', url: 'https://github.com/…' },
]
```

Trois fonctions exportées :

- `readSkills()` → pour chaque entrée : `{ ...entrée, installe, aJour }`.
  `installe` = le fichier existe dans `~/.claude/skills/<nom>/`. `aJour` (bundled
  seulement) = le contenu installé est identique à celui du dépôt — c'est ce qui permet
  de proposer « mettre à jour » après une nouvelle version de Cockpit.
- `bundledPath(nom)` → chemin dans le dépôt, résolu depuis `import.meta.url` comme
  `install.js` le fait déjà pour ses scripts.
- `installSkills(noms)` → écrit les skills demandés, rend un `string[]` de lignes faites,
  même forme de retour que `install()` — l'interface affiche déjà ce tableau.

Contraintes de sécurité, non négociables :

- **Seuls les noms présents dans `CATALOGUE` avec `source: 'bundled'` sont acceptés.**
  Un nom hors liste est refusé. La liste blanche rend la traversée de chemin impossible :
  aucun segment ne vient de l'appelant.
- Écriture via `writeFileNoFollow` (`hooks/plans.js:217`), déjà en place contre les
  liens symboliques — `~/.claude/skills/` est un dossier que l'utilisateur peut avoir
  bricolé.
- **Un skill livré = un seul `SKILL.md`.** Pas de copie récursive : `readFileSync` +
  `writeFileNoFollow`. C'est ce qui permet aussi de lire depuis `app.asar` dans
  l'application empaquetée, où `copyFileSync` est piégeux.
- Aucun réseau, aucun sous-processus.

### `skills/cockpit-tickets/SKILL.md` (nouveau)

Le skill `cockpit` actuel documente les tickets, mais renvoie au CLI
`node hooks/cockpit-cli.js` — **qui n'existe pas dans les projets équipés** (le SKILL.md
le dit lui-même, l. 85). Dans un projet équipé, Claude n'a donc aucun chemin praticable.

Ce skill-ci est ce chemin : écrire directement le fichier. Il contient

- le format exact d'un ticket (frontmatter JSON, mêmes champs que `hooks/tickets.js`) ;
- **lire `cockpit/board.json` avant d'écrire une `colonne`** — les colonnes sont
  configurables par projet ;
- le calcul de l'`id` (max existant + 1, jamais réutilisé) et du nom de fichier
  (`T-0012-slug.md`, miroir de `ticketFileName`) ;
- les gestes courants : créer depuis une demande, déplacer en `en-cours` quand le travail
  démarre, en colonne finale quand il est commité, lier à un plan via `plan` ;
- la retenue déjà écrite dans le skill `cockpit` : un ticket vaut par son critère
  d'acceptation, pas par son existence.

Le skill `cockpit` existant garde sa section Tickets mais renvoie à celui-ci pour
l'écriture, au lieu de renvoyer à un CLI absent.

### API — `server/api.js`

Un nouveau chemin dans le `switch` de `fetchHandler` (l. 173) :

- `GET /api/skills` → `readSkills()`
- `POST /api/skills` avec `{ noms: string[] }` et l'en-tête `X-Cockpit: 1` (même garde
  anti-CSRF que les autres écritures) → `{ done: installSkills(noms) }`

`installSkills` filtre lui-même : la route ne fait pas de validation propre, il n'y en a
qu'une, dans le module.

### `hooks/install.js`

`install(target, { skills = [] } = {})` — les skills demandés sont installés après le
reste, et leurs lignes s'ajoutent à `done`. Sans argument, comportement inchangé : le CLI
`pnpm cockpit:install` continue de marcher tel quel. Ajouter un drapeau
`--skills a,b` au bloc d'exécution directe.

### Interface

**`SkillsPanel`** (nouveau, `app/src/SkillsPanel.tsx`) — la liste, réutilisée aux deux
endroits. Une ligne par entrée du catalogue :

- `bundled` non installé ou périmé → case à cocher, cochée par défaut ;
- `bundled` à jour → « installé », pas de case ;
- `externe` installé → « détecté » ;
- `externe` absent → la commande en `<code>`, sélectionnable, **aucun bouton qui la
  lance**. Le libellé le dit : « à installer vous-même ».

**Dans l'écran d'initialisation** (`Unequipped`, `App.tsx:361`) : le panneau s'insère
entre le texte explicatif et le bouton. Le bouton passe la sélection :
`projectAction('init', root, { skills })` — `projectAction` dans `app/src/data.ts:388`
gagne un troisième paramètre optionnel étalé dans le corps de la requête.

**Rappel après coup** (barre latérale, `App.tsx:493`, dans le pied déjà bordé au-dessus
de « Densité d'activité ») : un bouton `btn-ghost` « Skills » ouvre le même panneau en
modale. Modale calquée sur `Lightbox.tsx` : `position: fixed; inset: 0`, fermeture à
Échap et au clic sur le fond. Elle poste sur `/api/skills`, indépendamment de tout projet.

### Empaquetage

`electron-builder.yml` : ajouter `- skills/**` à `files:`. Sans ça, l'application livrée
n'a rien à copier et le panneau ne proposerait que des entrées externes.

---

## Partie 2 — Coffre Obsidian

### Disposition du coffre — le point à ne pas rater

Un seul coffre par projet : `<repo>/cockpit/obsidian/`. Deux producteurs y écrivent, et
**ils entrent en collision si on n'y prend pas garde** : Graphify écrit `index.md`,
`graph.canvas` et un fichier par nœud à la racine du dossier qu'on lui donne. D'où la
séparation :

```
<repo>/cockpit/obsidian/
  index.md            écrit par Cockpit — porte d'entrée du coffre
  plans/*.md          écrit par Cockpit
  tickets/*.md        écrit par Cockpit
  pages/*.md          écrit par Cockpit
  shots/*.png         écrit par Cockpit — la dernière capture de chaque page
  graphe/             écrit par Graphify (--obsidian-dir …/obsidian/graphe)
    index.md, graph.canvas, <nœud>.md, _COMMUNITY_*.md
```

`cockpit/obsidian/index.md` renvoie vers `[[graphe/index|Graphe du code]]`. Aucun des deux
outils n'écrase l'autre, et le coffre s'ouvre d'un seul geste dans Obsidian.

Rien à faire côté versionnement : `cockpit-post-commit.js` traite déjà `cockpit/` comme
dérivé.

### `hooks/obsidian.js` (nouveau)

`exportVault(root, dir = join(root, 'cockpit', 'obsidian'))` → `string[]` de lignes faites.

Source unique : `snapshot(root)` (`hooks/snapshot.js:175`), qui assemble déjà plans,
tickets, board, pages, scans, timeline et captures. Aucune relecture de disque en propre.

Ce qui est écrit :

- **`index.md`** — nom du projet, ce que disent les compteurs (plans ouverts, tickets
  restants, date du dernier scan), puis les listes de wikilinks vers les trois sections et
  vers `graphe/index`.
- **`plans/<slug>.md`** — corps du plan tel qu'approuvé, inchangé. Frontmatter YAML :
  `type: plan`, `status`, `opened`, `closed`, `commits` (nombre), `fichiers` (liste).
  Lien vers les tickets qui le citent.
- **`tickets/T-0012-slug.md`** — corps inchangé. Frontmatter YAML : `type: ticket`, `id`,
  `colonne`, `priorite`, `tags` (vraie liste YAML, donc requêtable en Dataview), `cree`,
  `maj`. `[[plans/…]]` si `plan` est renseigné.
- **`pages/<slug>.md`** — route, extrait, liens sortants en wikilinks vers les autres
  pages, et `![[shots/<slug>.png]]` pour la dernière capture. **La capture est copiée dans
  le coffre** : Obsidian n'affiche pas une image hors du coffre. Une seule par page, la
  plus récente — l'historique complet reste dans `cockpit/pages/shots/`.
  Si le dernier scan a échoué (`scans`, dernière ligne `ok: false`), la note le dit et
  date la capture. C'est la règle du projet : jamais une capture périmée présentée comme
  fraîche.

Deux détails de format :

- Le frontmatter sur disque est du **JSON** ; Obsidian et Dataview veulent du **YAML**.
  L'export convertit. Petit émetteur maison — chaînes, nombres, booléens, listes de
  chaînes, c'est tout ce que portent ces objets. Pas de dépendance.
- Slugs de fichiers repris de `slugify` (`hooks/plans.js:187`), pour que les wikilinks
  se calculent des deux côtés sans table de correspondance.

Réexécutable : le dossier est réécrit, jamais empilé. `graphe/` n'est jamais touché.

### Déclenchement

**Depuis l'interface**, sans passer par Claude — l'export lit `cockpit/` et écrit dans
`cockpit/`, exactement comme `init`. Nouvelle action sur `/api/projects` :
`{ action: 'export-obsidian', path }` → `{ done: exportVault(path) }`. Mêmes gardes que
`init` : projet déjà au registre, en-tête `X-Cockpit`.

Le bouton vit dans l'onglet **Aperçu** (`app/src/tabs/Apercu.tsx`), la page qui répond
« c'est quoi, ce projet ? » : « Exporter en coffre Obsidian », puis le chemin obtenu.

**Depuis le terminal**, pour la part Graphify, qui elle a besoin de Claude. Dans
`app/src/Terminal.tsx:118`, l'action existante devient deux :

```js
{ label: '◆ Regénérer le graphe',   text: '/graphify' },
{ label: '◈ Graphe → coffre Obsidian', text: '/graphify . --obsidian --obsidian-dir cockpit/obsidian/graphe' },
```

**CLI** : `node hooks/cockpit-cli.js obsidian [--dir <chemin>]`, plus le script
`cockpit:obsidian` dans `package.json`. Même raison que pour `install.js` : une seconde
implémentation finirait par diverger.

---

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `hooks/skills.js` | nouveau — catalogue, détection, installation |
| `hooks/skills.test.js` | nouveau |
| `hooks/obsidian.js` | nouveau — export du coffre |
| `hooks/obsidian.test.js` | nouveau |
| `skills/cockpit-tickets/SKILL.md` | nouveau |
| `skills/cockpit/SKILL.md` | renvoie au skill ticketing au lieu d'un CLI absent |
| `hooks/install.js` | option `skills`, drapeau `--skills` |
| `hooks/cockpit-cli.js` | commande `obsidian` |
| `server/api.js` | route `/api/skills`, action `export-obsidian` |
| `app/src/SkillsPanel.tsx` | nouveau — liste + modale |
| `app/src/App.tsx` | panneau dans `Unequipped`, bouton dans la barre latérale |
| `app/src/tabs/Apercu.tsx` | bouton d'export |
| `app/src/Terminal.tsx` | seconde action Graphify |
| `app/src/data.ts` | types + appels `/api/skills`, `export-obsidian`, `projectAction` à trois arguments |
| `electron-builder.yml` | `skills/**` dans `files` |
| `package.json` | script `cockpit:obsidian` |
| `README.md` | les deux nouveaux gestes |

---

## Vérification

Tests (`node --test`, déjà le harnais du dépôt — `pnpm test`) :

- `skills.test.js` : un nom hors catalogue est refusé ; un nom contenant `..` ou `/` est
  refusé ; `readSkills` distingue absent / installé / périmé ; `installSkills` écrit le
  bon contenu et est réexécutable sans doublon.
- `obsidian.test.js` : sur un `cockpit/` de fixture, l'export produit les quatre dossiers ;
  le frontmatter est du YAML valide ; les wikilinks pointent vers des fichiers existants ;
  `graphe/` déposé au préalable survit à un second export ; un scan `ok: false` produit
  bien la mention de péremption.

À la main, dans l'ordre :

1. `pnpm test` puis `pnpm typecheck`.
2. `pnpm dev` — ouvrir un projet **non équipé** : le panneau de skills apparaît avec
   `cockpit` et `cockpit-tickets` cochés, `graphify` détecté ou non. Initialiser, puis
   vérifier `~/.claude/skills/cockpit-tickets/SKILL.md`.
3. Rouvrir le panneau depuis la barre latérale : les deux skills sont « à jour », plus
   de case à cocher.
4. Onglet Aperçu → « Exporter en coffre Obsidian ». Ouvrir `cockpit/obsidian/` comme
   coffre dans Obsidian : `index.md` s'ouvre, les wikilinks vers plans, tickets et pages
   résolvent, la capture s'affiche dans une note de page.
5. Dans le terminal intégré, lancer l'action « Graphe → coffre Obsidian ». Réexporter
   depuis Aperçu, puis vérifier que `cockpit/obsidian/graphe/` est intact et que
   `[[graphe/index]]` résout.
6. `pnpm package`, relancer le DMG, refaire l'étape 2 — c'est là que se voit l'oubli de
   `skills/**` dans `electron-builder.yml`.
