---
{
  "status": "closed",
  "title": "Lire un coffre Obsidian comme source de graphe",
  "opened": "2026-08-09",
  "closed": "2026-08-09",
  "commits": [
    {
      "sha": "26c3446",
      "date": "2026-08-09",
      "files": [
        "README.md",
        "app/src/App.tsx",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Donnees.tsx",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js",
        "hooks/vault.js",
        "hooks/vault.test.js"
      ]
    }
  ]
}
---

# Lire un coffre Obsidian comme source de graphe

## Contexte

Aujourd'hui le flux Obsidian de Cockpit est **unidirectionnel** : `hooks/obsidian.js:111`
`exportVault()` traduit `cockpit/` en coffre (`cockpit/obsidian/`), et rien ne relit jamais
un coffre. La seule entrée de graphe du projet est `graphify-out/graph.json`
(`hooks/snapshot.js:231`), consommée par le seul onglet **Données**
(`app/src/tabs/Donnees.tsx:14` → `tablesFrom()` dans `app/src/data.ts:727`).

Conséquence : quelqu'un qui documente son projet dans un coffre Obsidian plutôt qu'avec
Graphify n'a rien. Son onglet Données affiche « Aucun schéma de base détecté ».

Ce plan ajoute une **seconde source de graphe** : un coffre Obsidian, désigné par un champ
`obsidianVault` dans `cockpit.config.json`. Une note dont le frontmatter porte `type: table`
devient une ligne du tableau ; les notes qui la wikilinkent deviennent sa colonne « utilisée
par ». Le cockpit ne touche jamais au coffre — il le lit, conformément à l'invariant.

### Le pivot qui rend le diff court

`isSchemaNode` (`app/src/data.ts:716`) teste `/sql|table|model/i` sur `node.file_type`.
En émettant les nœuds avec **`file_type: 'table'`**, ils passent le filtre existant :
`tablesFrom()` n'est pas modifié du tout. Seuls le badge et l'état vide de l'onglet changent.

### Note de sécurité, à assumer explicitement

`obsidianVault` vient d'un fichier de config du dépôt observé. Un coffre placé hors du dépôt
est le cas normal (c'est l'intérêt), donc on ne peut pas exiger un confinement dans `root`.
Cela élargit ce que Cockpit lit : un `cockpit.config.json` hostile pourrait pointer vers
`~/Documents` et faire remonter des fragments de `.md` dans la réponse `/api/project`.
Bornes retenues : extension `.md` seule, frontmatter + wikilinks extraits (jamais le corps),
`MAX_FILES`, `MAX_BYTES`, liens symboliques non suivis. C'est du même ordre que ce que
`readWhys()` fait déjà sur le dépôt, avec un périmètre plus large — à dire dans le README.

## Fichiers

### `hooks/vault.js` — nouveau

Module Node pur, `.js` + JSDoc, sur le gabarit de `hooks/whys.js`.

```js
/** Sous-ensemble YAML : scalaires cités/nus, listes bloc `- x`, listes inline `[a, b]`.
 *  Hors périmètre : imbrication, multilignes, ancres, dates. Rend null si illisible. */
export function parseYaml(text)

/** Les cibles des wikilinks `[[chemin]]` / `[[chemin|label]]` d'un markdown.
 *  `[[note#titre]]` → `note` ; l'ancre ne change pas la note visée. */
export function wikilinks(markdown)

/** Le coffre en graphe au format Graphify, ou null si le dossier n'est pas lisible. */
export function readVault(vaultRoot)
```

Réutiliser le découpage de fences de `parsePlan` (`hooks/plans.js:37`) — même logique
(`---\n` … `\n---`), seul le parse du bloc diffère (YAML au lieu de `JSON.parse`).
Reprendre `MAX_FILES` / `MAX_BYTES` et la boucle `readdirSync(withFileTypes)` de
`hooks/whys.js:135` : un lien symbolique n'y est ni dossier ni fichier lu, la protection
est gratuite.

**Mapping note → `GraphNode`** (frontmatter `type: table` uniquement) :

| champ | valeur |
|---|---|
| `id` | chemin relatif au coffre, sans `.md` (`tables/commandes`) |
| `label` | `frontmatter.titre ?? frontmatter.title ?? basename` |
| `file_type` | `'table'` — c'est ce qui fait passer `isSchemaNode` |
| `source_file` | chemin absolu du `.md` |
| `columns` | frontmatter `columns` ; tableau joint par `, ` ; absent → omis |

**Mapping wikilink → `GraphLink`** : chaque `[[cible]]` d'une note vers une note `type: table`
donne `{ source: id de la note citante, target: id de la table, relation: 'mentions',
confidence: 'EXTRACTED' }`. Les liens dont la cible n'est pas une table sont jetés — le seul
consommateur ne lit que les liens entrants d'un nœud de schéma. `EXTRACTED` se lit ici
« littéralement écrit dans le coffre », et le badge dit d'où ça vient.

Les notes citantes doivent aussi être émises comme nœuds (sans `file_type: 'table'`), sinon
`tablesFrom()` ne retrouve pas leur `label` pour la colonne « utilisée par »
(`app/src/data.ts:735` fait `nodes.find(n => n.id === link.source)?.label`).

### `hooks/snapshot.js` — modifié

Remplacer la ligne 231 par un helper local :

```js
/** Graphify, ou le coffre déclaré. Rend { graph, source }. */
function readGraph(root, config)
```

**Précédence : `obsidianVault` gagne s'il est renseigné**, Graphify sinon. Poser le champ est
un geste délibéré ; un `graphify-out/` oublié d'une ancienne exécution ne doit pas
silencieusement l'emporter sur ce que l'utilisateur vient d'écrire. Le chemin est absolu ou
relatif à `root`.

Le snapshot gagne un champ `graphSource: 'graphify' | 'obsidian' | null`. `graph` garde sa
forme et son nom — rien d'autre en aval ne bouge.

### `app/src/data.ts` — modifié

Une ligne : `graphSource: 'graphify' | 'obsidian' | null` dans `interface Snapshot`
(à côté de `graph`, ligne 252). **Pas de wrapper `GraphWithSource`** : le snapshot est déjà
plat, l'envelopper créerait un type pour un seul appelant.

`tablesFrom()`, `isSchemaNode`, `GraphNode`, `GraphLink` : **inchangés**.

### `app/src/tabs/Donnees.tsx` — modifié

Nouvelle prop `source: Snapshot['graphSource']`. Trois retouches de texte :

- Badge ligne 23 : `lu depuis Graphify` / `lu depuis le coffre Obsidian` selon `source`.
- État vide ligne 30 : ne plus nommer Graphify en dur. Trois cas — coffre lu mais aucune
  note `type: table` ; Graphify lu mais aucun schéma ; aucune source, et alors mentionner
  `obsidianVault` dans `cockpit.config.json` comme la façon d'en désigner une.
- Ligne 39 (« Introspection PostgreSQL ») : faux pour un coffre écrit à la main. Adapter
  selon la source.

### `app/src/App.tsx` — modifié

Ligne 419 : `<Donnees graph={snapshot.graph} source={snapshot.graphSource} />`.

### `README.md` — modifié

Une entrée pour `obsidianVault` : ce qu'il attend, la convention `type: table` + `columns`,
et la phrase sur ce que Cockpit lira alors hors du dépôt.

## Tests

`hooks/vault.test.js` — `node:test` + `node:assert`, style de `hooks/obsidian.test.js`,
coffre monté dans un `mkdtempSync`.

- `parseYaml` : scalaire nu, scalaire cité contenant `:`, liste bloc, liste inline.
- `parseYaml` : un bloc illisible rend `null`, pas une exception.
- `wikilinks` : `[[a]]`, `[[a|libellé]]`, `[[a#section]]` → `a` ; ignore le `[[` en bloc code.
- `readVault` : une note `type: table` devient un nœud `file_type: 'table'`.
- `readVault` : une note sans `type: table` n'en devient pas un.
- `readVault` : `[[tables/commandes]]` dans une autre note produit le lien entrant.
- `readVault` : dossier absent → `null` ; note illisible → les autres passent quand même.
- `readVault` : `MAX_FILES` respecté (coffre au-dessus du plafond → lecture bornée).

`hooks/snapshot.test.js` — précédence : coffre déclaré **et** `graphify-out/` présent →
`graphSource === 'obsidian'` ; `obsidianVault` absent → `'graphify'` ; ni l'un ni l'autre →
`graph === null`, `graphSource === null`.

`app/src/data.test.ts` — rien à ajouter : `tablesFrom` ne change pas. Le test existant
`tablesFrom encaisse un graphe absent` (ligne 204) reste vrai.

## Vérification

```bash
pnpm test        # hooks/ crawl/ server/ puis scripts/test-ui.js pour app/src
pnpm typecheck
```

Bout en bout, sur ce dépôt :

1. Créer un coffre jetable hors du dépôt, avec `tables/commandes.md`
   (frontmatter `type: table`, `columns: [id, client_id, total]`) et `pages/panier.md`
   qui contient `[[tables/commandes]]`.
2. Ajouter `"obsidianVault": "<chemin>"` à `cockpit.config.json`.
3. `pnpm dev` → onglet Données : une ligne `commandes`, colonnes `id, client_id, total`,
   « utilisée par » = `panier`, badge « lu depuis le coffre Obsidian ».
   Vérifier que `graphify-out/graph.json` est bien ignoré (il existe dans ce dépôt) —
   c'est le test vivant de la précédence.
4. Retirer le champ → l'onglet revient aux données Graphify, badge « lu depuis Graphify ».
5. `pnpm electron` : refaire l'étape 3. Le protocole `cockpit://` n'a ni CORS ni `Origin` ;
   une route validée dans le navigateur ne prouve rien pour l'application empaquetée.
6. `pnpm package` en fin de lot.

## Hors périmètre

- Fusionner les deux graphes. C'est l'un **ou** l'autre ; dédupliquer deux vocabulaires
  d'identifiants coûterait plus que la fonctionnalité ne rapporte.
- Dataview, embeds, alias, liens de bloc. Frontmatter et wikilinks simples, rien d'autre.
- Écrire dans le coffre. `exportVault()` reste le seul sens d'écriture.
- Rechargement à chaud sur modification du coffre : visible au prochain `/api/project`.
- Sélecteur de dossier dans l'interface. Le champ de config suffit.
- Toucher `hooks/obsidian.js`. L'export et l'import ne se parlent pas.
