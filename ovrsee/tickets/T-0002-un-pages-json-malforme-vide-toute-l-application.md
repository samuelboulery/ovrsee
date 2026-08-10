---
{
  "id": "T-0002",
  "titre": "Un pages.json malformé vide toute l'application",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["bug", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`app/src/Terminal.tsx:372` écrit :

```ts
const pages = snapshot.pages?.pages.length ?? 0
```

Le `?.` protège `pages` d'être nul, pas `pages.pages` d'être absent. Si
`cockpit/pages/pages.json` contient autre chose qu'un objet avec un tableau
`pages` — un tableau nu, par exemple —, le rendu lève
`TypeError: Cannot read properties of undefined (reading 'length')` et, faute de
garde-fou de rendu, React démonte **toute** l'application.

Constaté pendant l'audit du 9 août 2026 sur un projet fabriqué exprès : écran
entièrement noir, sur les sept onglets. Barre latérale comprise — donc impossible
de changer de projet pour s'en sortir. La seule issue est d'éditer le fichier à la
main.

C'est le scénario que le cadrage dit devoir tenir : « le cockpit reste consultable
sur un projet qui ne compile plus ». Un projet dormant dont le crawl a mal fini
est exactement le cas où on l'ouvre.

Les trois autres lectures du même champ (`Terminal.tsx:407`, `tabs/Apercu.tsx:49`,
`tabs/Produit.tsx:29`) écrivent bien `?.pages ?? []`. Cette ligne est la seule
fautive.

Le garde-fou de rendu manquant fait l'objet de [[T-0003]] : les deux se corrigent
séparément, et il faut les deux.

## Critères d'acceptation

- [ ] Avec un `cockpit/pages/pages.json` valant `[]`, l'application s'affiche : les
      sept onglets sont navigables et l'onglet Produit dit qu'aucune page n'est
      cartographiée.
- [ ] Idem avec `pages.json` valant `{}`, `null`, ou un fichier vide.
- [ ] Un test couvre le cas — c'est aujourd'hui la première ligne de test de
      `app/src/`, voir [[T-0013]].
