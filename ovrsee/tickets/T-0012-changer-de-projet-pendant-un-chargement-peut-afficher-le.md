---
{
  "id": "T-0012",
  "titre": "Changer de projet pendant un chargement peut afficher les données du précédent",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["bug", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`app/src/App.tsx:113-124` : le `useEffect` qui suit `current` appelle
`fetchSnapshot()` sans `AbortController` et sans garde au retour. Rien ne vérifie,
au moment du `setSnapshot`, que le projet demandé est toujours celui affiché.

Deux clics rapprochés dans la barre latérale, projet A puis projet B : si A répond
après B, l'écran affiche les données de A sous le nom de B. Aucune erreur, aucun
signe. Sur un gros dépôt — le `readme` est lu jusqu'à 200 ko, les captures sont
`stat`ées une par une — l'écart de réponse est réel.

C'est un cockpit : afficher les plans d'un projet sous le nom d'un autre est le
genre de faux qui ne se remarque pas tout de suite.

## Critères d'acceptation

- [ ] Enchaîner deux projets sans attendre affiche toujours les données du dernier
      sélectionné.
- [ ] La requête abandonnée est réellement annulée, pas seulement ignorée.
- [ ] La même garde s'applique à la requête lancée par `ProjectRow` pour son
      compteur.
