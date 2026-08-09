---
{
  "status": "open",
  "title": "Onglet Aperçu — la page d'arrivée sur un projet",
  "opened": "2026-08-09",
  "closed": null,
  "commits": []
}
---

# Onglet Aperçu — la page d'arrivée sur un projet

## Contexte

Le cockpit montre cinq facettes d'un projet (Produit, Historique, Tableau,
Données, Stack), mais aucune ne répond à la première question qu'on se pose en
ouvrant un projet inconnu ou oublié : **c'est quoi, ce projet ?**

On tombe aujourd'hui directement sur le graphe de navigation — utile quand on
sait déjà de quoi il s'agit, muet quand on ne le sait pas. Le README du dépôt,
lui, contient exactement cette réponse ; il est simplement invisible depuis
l'application.

Résultat visé : un onglet **Aperçu**, premier de la barre et page d'entrée `/`,
qui pose en cinq secondes le nom du projet, son état chiffré, comment on le
lance, puis déroule son README. Rien d'inventé : chaque chiffre est dérivé du
snapshot déjà chargé, le texte est celui du dépôt.

## Ce qui est ajouté

### 1. Le README entre dans le snapshot

`hooks/snapshot.js` — dans `snapshot(root)`, à côté de `packageJson` :

```js
readme: readText(join(root, 'README.md')),
```

Un helper `readText` frère de `readJson` (même forme : try / catch → `null`),
avec un plafond de lecture (≈ 200 ko) — un README généré ne doit pas faire
gonfler chaque réponse `/api/project`. Absence de README = `null`, et l'onglet
le dit franchement plutôt que d'afficher un cadre vide.

Aucune route nouvelle : `/api/project` porte déjà tout le reste, la lecture est
locale et le chemin vient du registre (liste blanche déjà en place,
`server/api.js:200-205`).

`app/src/data.ts` :
- `Snapshot` gagne `readme: string | null`
- `PackageJson` gagne `name?`, `description?`, `scripts?: Record<string,string>`
  — les scripts sont déjà transmis par le serveur, seul le type les ignorait.

### 2. Un rendu markdown maison — `app/src/markdown.tsx`

Pas de dépendance, pas de `dangerouslySetInnerHTML` : un parseur de blocs qui
rend des éléments React.

Blocs : titres `#`→`####`, blocs de code ```` ``` ````, listes à puces et
numérotées, tableaux GFM, citations `>`, règles `---`, paragraphes.
Inline : `` `code` ``, `**gras**`, `*italique*`, `[texte](url)`.

Deux règles qui ne sont pas du confort :

- **Seuls les liens `http(s)` deviennent des `<a>`**, avec `target="_blank"` :
  ils partent alors dans le navigateur via `setWindowOpenHandler`
  (`electron/main.js:123`). Un lien relatif — `./cadrage-cockpit.md` — reste du
  texte. Sans cette règle il serait deux fois nuisible : `will-navigate` le
  bloquerait dans l'app (`electron/main.js:127`), et surtout le crawl, qui
  découvre les écrans par `a[href]`, l'inscrirait comme une route fantôme du
  cockpit lui-même.
- Le markdown non reconnu est rendu tel quel, jamais avalé.

Réutilise les jetons Nocturne et le helper `s()` de `app/src/style.ts` comme
tous les autres onglets.

### 3. L'onglet — `app/src/tabs/Apercu.tsx`

Signature `{ snapshot }: { snapshot: Snapshot }`, comme `Stack.tsx` (le patron
le plus simple du dossier).

**Bandeau d'identité** — nom (`packageJson.name` ou `basename(root)`),
`packageJson.description`, chemin du projet.

**Chiffres**, tous dérivés d'helpers existants de `data.ts` — aucun calcul neuf :

| Ce qui s'affiche | D'où ça vient |
|---|---|
| pages cartographiées | `snapshot.pages?.pages.length` |
| plans, dont ouverts | `snapshot.plans.length`, `plansOuverts()` |
| tickets restants | `restant(tickets, board)` |
| dépendances | `stackFrom(packageJson, plans).length` |
| dernière activité | `humanAge(snapshot.timeline[0]?.date)` |
| fraîcheur du scan | `lastScan(scans)` + `frDate()` |

**Comment on le lance** : les entrées de `packageJson.scripts` en pastilles
`pnpm <script>` — c'est la réponse à « je reviens après trois semaines, je tape
quoi ? ». Aucun bouton : le cockpit lit, il n'exécute que le terminal qu'on lui
demande. Les scripts sont copiables, pas cliquables.

**README** rendu en dessous, largeur de lecture bornée (~780 px, comme
`Stack.tsx`). Pas de README → une ligne qui le dit et nomme le fichier attendu.

### 4. Câblage — `app/src/App.tsx`

`TABS` (l. 35-41) devient :

```js
['apercu',     'Aperçu',     '/'],
['produit',    'Produit',    '/produit'],
['historique', 'Historique', '/historique'],
['tableau',    'Tableau',    '/tableau'],
['donnees',    'Données',    '/donnees'],
['stack',      'Stack',      '/stack'],
```

`tabForPath` prend `'apercu'` en repli, et le rendu (l. 247-261) gagne
`{tab === 'apercu' && <Apercu snapshot={snapshot} />}`.

Le commentaire de `TABS` explique pourquoi Produit tenait `/` — il faut le
réécrire, pas le supprimer : le raisonnement (pas de redirection, donc pas de
page fantôme ; l'entrée du graphe garde son sens) reste vrai, c'est seulement la
page d'entrée qui change. Aperçu prend `/` sans redirection, Produit prend une
vraie route : la carte gagne un nœud, elle n'en perd aucun.

### 5. Les captures suivent leur page

Conséquence directe du point 4 : `slugOf()` (`crawl/routes.js:96-100`) rend
`accueil` pour `/`. Après la bascule, `cockpit/pages/shots/accueil/` — vingt
captures de l'onglet Produit — serait présenté comme l'historique visuel
d'Aperçu. Des images datées attribuées au mauvais écran, exactement ce que ce
projet existe pour éviter.

Dans le même commit, donc :

```bash
git mv cockpit/pages/shots/accueil cockpit/pages/shots/produit
```

Le prochain crawl recrée `shots/accueil/` avec la vraie première capture
d'Aperçu. `orphanShots` de `pages.json` signalera le décalage entre-temps —
c'est son rôle, et c'est honnête.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `app/src/markdown.tsx` | **nouveau** — parseur + rendu React |
| `app/src/tabs/Apercu.tsx` | **nouveau** — l'onglet |
| `app/src/App.tsx` | `TABS`, `tabForPath`, rendu, commentaire |
| `app/src/data.ts` | `Snapshot.readme`, `PackageJson.scripts/name/description` |
| `hooks/snapshot.js` | `readText()` + champ `readme` |
| `hooks/snapshot.test.js` ou `server/api.test.js` | README lu / absent / plafonné |
| `cockpit/pages/shots/accueil/` | `git mv` vers `produit/` |

## Vérification

1. `pnpm typecheck` — les nouveaux champs de `Snapshot` doivent passer partout.
2. `pnpm test` — suites Node existantes (`hooks/`, `crawl/`, `server/`), plus le
   cas README ajouté.
3. `pnpm dev`, puis :
   - `/` affiche Aperçu ; le README du cockpit s'y lit avec ses titres, son
     tableau d'arborescence et ses blocs `bash` ;
   - les chiffres du bandeau concordent avec ce qu'affichent Produit, Tableau
     et Stack ouverts à côté ;
   - `/produit` affiche le graphe, l'onglet Produit est actif ;
   - précédent / suivant du navigateur rejouent bien les six routes ;
   - un lien externe du README ouvre le navigateur ; `./cadrage-cockpit.md`
     reste du texte inerte.
4. Basculer sur un projet **sans** README dans la barre latérale : ligne
   explicite, pas de cadre vide, pas d'erreur console.
5. `pnpm electron` — même parcours dans l'app empaquetée, terminal compris
   (c'est le seul endroit où `setWindowOpenHandler` s'exerce vraiment).
6. `pnpm cockpit:crawl .` après commit — vérifier que `pages.json` liste six
   pages, que `/produit` en est une, et qu'aucune route ne provient d'un lien du
   README.
7. `pnpm package` en fin de lot.
