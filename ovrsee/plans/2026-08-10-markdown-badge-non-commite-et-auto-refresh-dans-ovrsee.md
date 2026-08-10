---
{
  "status": "closed",
  "title": "Markdown, badge \"non commité\" et auto-refresh dans ovrsee",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "a2c1c52",
      "date": "2026-08-10",
      "files": [
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/tabs/Tableau.tsx",
        "hooks/git-status.js",
        "hooks/git-status.test.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    }
  ]
}
---

# Markdown, badge "non commité" et auto-refresh dans ovrsee

## Contexte

Trois problèmes remontés sur l'onglet Tableau / aperçu de ticket :

1. Le corps du ticket (markdown) s'affiche en texte brut dans le panneau de
   lecture — `##`, `- [ ]` etc. restent littéraux au lieu d'être rendus.
2. Rien ne signale qu'un ticket vient d'être créé/modifié mais n'a pas encore
   été commité — l'utilisateur doit deviner via `git status` en dehors de
   l'app.
3. Seul l'onglet Tableau se rafraîchit automatiquement (poll 4s sur
   `board`/`tickets`). Les autres onglets (Aperçu, Données, Historique,
   Produit, Stack…) restent figés sur le snapshot chargé à l'ouverture du
   projet tant qu'on ne clique pas sur reload.

## 1. Rendu markdown du corps de ticket

Un composant `Markdown` existe déjà et fonctionne (`app/src/markdown.tsx:344`,
`Markdown({ text, root? })`), déjà utilisé pour le README dans
`app/src/tabs/Apercu.tsx:270`. Le panneau de lecture de Tableau ne l'utilise
pas encore : `app/src/tabs/Tableau.tsx:1055-1057` affiche `ticket.corps` en
`<div style="white-space: pre-wrap">` brut.

**Changement** :
- `app/src/tabs/Tableau.tsx` : importer `Markdown` depuis `../markdown`.
- Remplacer le contenu des lignes 1055-1057 par `<Markdown text={ticket.corps} root={root} />` (avec le fallback "Aucune description." si `ticket.corps` est vide), `root` étant déjà une prop du composant `Tableau`.

Le mode édition (textarea, ligne 1009-1016) reste inchangé — on édite le
markdown brut, on ne le rend que côté lecture.

## 2. Badge "non commité" sur un ticket

`hooks/git-status.js` calcule déjà `dirty()` via `git status --porcelain=v1`
mais ne garde que des compteurs (`{staged, unstaged, untracked}`), pas les
chemins de fichiers — alors que chaque ligne porcelain est `XY chemin`
(`line.slice(3)` donne le chemin).

**Changements** :
- `hooks/git-status.js` : dans `dirty()`, collecter aussi les chemins
  (`line.slice(3)`) dans un tableau `files: string[]`, en plus des compteurs
  existants. Garder la même logique de comptage, juste ajouter la collecte.
- `app/src/data.ts` : étendre l'interface `GitStatus` (`dirty` field, ligne
  ~192) avec `files: string[]`.
- `app/src/tabs/Tableau.tsx` : ajouter une prop `gitStatus?: GitStatus` au
  composant (signature ligne 97-109). Dans le panneau de lecture, calculer
  `ovrsee/tickets/${ticket.file}` (chemin déjà construit ligne 1063 pour
  l'affichage) et vérifier son appartenance à `gitStatus.dirty.files`. Si
  présent, afficher un petit badge (`tag tag-warning` ou équivalent déjà
  utilisé ailleurs dans ce fichier) à côté du footer métadonnées
  (ligne 1061-1065), ex. "Non commité".
- `app/src/App.tsx` ligne 636-643 : passer `gitStatus={snapshot.gitStatus}`
  au `<Tableau />`.
- `hooks/i18n.js` : ajouter la clé `tableau.uncommitted` en FR (bloc autour de
  la ligne 440, ex. `'tableau.uncommitted': 'Non commité'`) et en EN (bloc
  miroir vers la ligne 1090, ex. `'tableau.uncommitted': 'Uncommitted'`).

Pas de nouvelle dépendance, pas de nouvel appel git — `gitStatus(root)` est
déjà calculé une fois par snapshot (`hooks/snapshot.js:429`).

## 3. Auto-refresh de tous les onglets

Tous les onglets sont des receveurs passifs du `snapshot` (prop), sauf
Tableau qui fusionne son propre poll dedans (`app/src/App.tsx:327-342`).
Le poll existant est volontairement limité à `board`/`tickets` (commentaire
ligne 330-335) pour ne pas rafraîchir captures/historique/graphe toutes les
4 secondes.

**Changement** : ajouter un second `useEffect` dans `app/src/App.tsx`, à côté
de celui des lignes 336-342, avec un intervalle plus long (ex. 15s) qui
recharge le snapshot complet :

```ts
useEffect(() => {
  if (!current) return
  const timer = setInterval(() => {
    fetchSnapshot(current).then(setSnapshot).catch(() => {})
  }, 15000)
  return () => clearInterval(timer)
}, [current])
```

Comme tous les onglets sont déjà pilotés par `snapshot` en prop, aucun autre
fichier n'a besoin d'être touché — le nouvel intervalle propage
automatiquement tickets, plans, historique, graphe, gitStatus, etc. à tous
les onglets montés. Le poll rapide (4s, tickets/board) reste tel quel pour
garder le tableau réactif sans attendre les 15s.

## Vérification

- `pnpm test` et `pnpm typecheck` verts.
- `pnpm dev` : ouvrir un ticket existant avec du markdown (titres, listes à
  cocher) dans le panneau de lecture → vérifier le rendu.
- Modifier un fichier de ticket sans commit (ou en créer un nouveau) →
  vérifier l'apparition du badge "Non commité" dans le panneau, puis sa
  disparition après un commit.
- Laisser l'app ouverte sur un onglet autre que Tableau (ex. Historique),
  modifier un fichier côté disque/terminal, attendre ~15s → vérifier que
  l'onglet se met à jour sans clic sur reload.
