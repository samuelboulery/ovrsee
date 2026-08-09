---
{
  "status": "open",
  "title": "Aligner la lecture du coffre Obsidian sur le cadrage",
  "opened": "2026-08-09",
  "closed": null,
  "commits": []
}
---

# Aligner la lecture du coffre Obsidian sur le cadrage

## Contexte

La lecture d'un coffre Obsidian comme source de graphe est livrée et fonctionne
(`hooks/vault.js`, `readGraph()` dans `hooks/snapshot.js`, badge de provenance dans
`app/src/tabs/Donnees.tsx`). Elle contredit sur trois points le cadrage arbitré, ce qui
n'a pas été relevé avant de l'écrire :

- `cadrage-cockpit.md:105` — « **Rien ne s'écrit à la main.** Un fichier que Sam devrait
  maintenir lui-même serait faux en trois semaines. » Une note `type: table` est exactement
  ce fichier.
- `cadrage-cockpit.md:48` — construire la vue base de données est **écarté** : « Graphify le
  fait mieux, gratuitement, et à jour à chaque commit ». Or la précédence livrée fait gagner
  le coffre **sur** Graphify.
- `cadrage-cockpit.md:29` — « une documentation fausse est pire que pas de documentation ».
  Une ligne venue du coffre s'affiche aujourd'hui avec le badge `EXTRACTED`, vocabulaire de
  Graphify pour « extrait du code par le parseur ». Elle emprunte une crédibilité qu'elle n'a pas.

Le cadrage laisse une porte, et c'est elle qu'on emprunte — `:101` : « une phrase fausse ment
sans prévenir, une image marquée *il y a trois semaines* est honnête ». **Une donnée
manuscrite est admissible si elle est datée et affichée comme telle.**

État de fait qui cadre l'enjeu : sur ce dépôt, `graphify-out/graph.json` porte 419 nœuds et
680 liens, tous de `file_type: "code"`, et **zéro** passe `isSchemaNode`. Graphify ne remplit
pas l'onglet Données ici — le coffre ne le « remplace » donc pas, il comble un vide. Ailleurs
dans le produit Graphify reste seul et intact : catalogue de skills (`hooks/skills.js:56`) et
bouton « ◈ Graphe → coffre Obsidian » (`app/src/Terminal.tsx:128`).

Objectif : garder la fonctionnalité, mais qu'elle ne puisse plus faire passer une déclaration
manuelle pour un fait dérivé du code.

## Les trois corrections

### 1. Inverser la précédence — `hooks/snapshot.js`

`readGraph()` (ligne 230) fait aujourd'hui gagner le coffre. L'inverser :

1. `graphify-out/graph.json` lisible → `{ graph, graphSource: 'graphify' }`.
2. sinon `obsidianVault` déclaré → `readVault()` → `{ graph, graphSource: 'obsidian' }`.
3. sinon → `{ graph: null, graphSource: null }`.

Le critère est la **présence d'un graphe lisible**, pas le fait qu'il contienne des tables :
Graphify qui ne trouve aucune table énonce un fait vrai (« ce projet n'a pas de base »), et
le recouvrir par des notes manuscrites est précisément la dérive que `:48` écarte.

Réécrire en conséquence le bloc de commentaire lignes 219-221, qui justifie aujourd'hui
l'inverse.

**Le champ ne doit pas devenir un no-op silencieux.** Quand Graphify gagne alors qu'un coffre
est déclaré, l'onglet le dit. Aucun nouveau champ de snapshot : `snapshot.config` est déjà
renvoyé, `App.tsx` en dérive la prop.

### 2. Dater la déclaration au lieu de la créditer — `hooks/vault.js`

- Les nœuds de table portent `declared` : `front.maj ?? front.updated ?? front.date ?? null`.
  Toujours présent sur un nœud de table venu du coffre, jamais posé par Graphify — c'est ce
  qui permet à l'interface de distinguer sans deviner.
- **Retirer `confidence: 'EXTRACTED'` des liens** (ligne 338) et le commentaire qui le défend
  (lignes 280-282). Un wikilink n'est pas une extraction ; omettre vaut mieux que mentir.
  `confidenceOf` retombera sur `INFERRED`, valeur qui ne sera plus affichée pour ces lignes.

### 3. Dire ce que c'est — `app/src/data.ts` et `app/src/tabs/Donnees.tsx`

`data.ts` :
- `TableRow` gagne `declared?: string | null`.
- `tablesFrom()` (ligne 727) le laisse passer depuis le nœud, une ligne. Le reste de la
  fonction, `isSchemaNode` et les types du graphe : inchangés.

`Donnees.tsx` :
- Badge : « **déclaré dans le coffre Obsidian** » plutôt que « lu depuis ». *Lu depuis*
  suggère la lecture d'un fait.
- Colonne 4 : en-tête « Confiance » sous Graphify, « **Déclaré** » sous le coffre. Contenu :
  la pastille `EXTRACTED`/`INFERRED`/`AMBIGUOUS` sous Graphify ; « le 12 mars 2026 » ou
  « **non daté** » sous le coffre. Réutiliser `frDate`/`frDateShort` (`data.ts:691`).
- `PROVENANCE.obsidian.intro` : dire que ces lignes sont déclaratives et peuvent avoir dérivé,
  pas « le cockpit ne recalcule rien » (vrai mais hors sujet ici).
- État vide sous Graphify : mentionner le coffre déclaré et ignoré, quand c'est le cas.
- Convention `maj:` à annoncer dans l'état vide du coffre, à côté de `type:` et `columns:`.

## Tests

- `hooks/snapshot.test.js` — retourner les trois tests de précédence existants : Graphify
  l'emporte sur un coffre déclaré ; le coffre sert quand `graphify-out/` est absent ; coffre
  déclaré, Graphify absent et coffre illisible → `graph: null`, `graphSource: null`.
- `hooks/vault.test.js` — `declared` lu depuis `maj`, `updated`, `date` ; absent → `null` ;
  les liens ne portent plus de `confidence`.
- `app/src/data.test.ts` — `tablesFrom` transporte `declared` ; l'absence de `declared` sur un
  nœud Graphify reste `undefined`.
- `app/src/render.test.tsx` — la nouvelle prop de `Donnees` dans `RENDUS` (ligne 75).

## Vérification

```bash
pnpm test        # hooks/ crawl/ server/ puis scripts/test-ui.js
pnpm typecheck
```

Bout en bout, avec le coffre d'essai déjà écrit dans le scratchpad
(`tables/commandes.md`, `tables/clients.md`, `pages/panier.md`, `pages/facturation.md`) :

1. Ajouter `maj: 2026-03-12` au frontmatter de `commandes.md`, laisser `clients.md` sans date.
2. `obsidianVault` pointé sur ce coffre, `graphify-out/` **en place** → onglet Données :
   badge « lu depuis Graphify », état vide de Graphify, **et** la mention que le coffre
   déclaré est ignoré. C'est le test de la précédence inversée.
3. Déplacer `graphify-out/` hors du dépôt → badge « déclaré dans le coffre Obsidian »,
   colonne « Déclaré » avec « 12 mars 2026 » sur `Commandes` et « non daté » sur `Clients`.
   Aucune pastille `EXTRACTED` nulle part.
4. Remettre `graphify-out/`, retirer `obsidianVault`, restaurer `cockpit.config.json` à
   l'identique (`git diff` doit être vide sur ce fichier).
5. `pnpm electron` avec `COCKPIT_ROUTE="/donnees?p=%2FUsers%2Fsam%2Fcode%2Fcockpit"` pour
   refaire l'étape 3 sous le protocole `cockpit://`.
6. `pnpm package`.

## Hors périmètre

- Amender `cadrage-cockpit.md`. La correction se range sous `:101` (donnée manuscrite datée),
  aucune exception nouvelle à acter.
- Toucher `hooks/skills.js`, `Terminal.tsx`, `hooks/obsidian.js` : la place de Graphify
  ailleurs dans le produit ne change pas.
- Les deux affirmations périmées de `CLAUDE.md` repérées au passage — Stack lirait le graphe
  (il lit `package.json` + `whys`), `app/src` n'aurait pas de tests (`scripts/test-ui.js` en
  lance 79). À corriger séparément.
- Fusionner les deux sources, Dataview, écriture dans le coffre, rechargement à chaud,
  sélecteur de dossier : inchangés depuis la première version.
