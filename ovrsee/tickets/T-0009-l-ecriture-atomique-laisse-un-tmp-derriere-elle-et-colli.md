---
{
  "id": "T-0009",
  "titre": "L'écriture atomique laisse un .tmp derrière elle, et collisionne sur le pid",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["robustesse", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`hooks/plans.js:233-236` — c'est la fonction par laquelle passent toutes les
écritures du projet : plans, tickets, `pages.json`, coffre Obsidian.

```js
const tmp = `${path}.tmp-${process.pid}`
writeFileSync(tmp, content, 'utf8')
renameSync(tmp, path)
```

Le motif temp-puis-rename est le bon : le fichier final n'est jamais à moitié
écrit. Deux défauts autour.

**Pas de nettoyage.** Si `writeFileSync` ou `renameSync` échoue — disque plein,
permissions —, le `.tmp-<pid>` reste. Il s'accumule dans `cockpit/plans/` et
`cockpit/tickets/`, où l'interface liste les fichiers.

**Le nom ne dépend que du pid.** Deux écritures concurrentes du même processus
vers le même chemin — deux requêtes d'API sur le même ticket, ce que produit un
double clic — visent le même fichier temporaire. La seconde écrase le contenu de
la première avant que celle-ci ne renomme.

## Critères d'acceptation

- [ ] Une écriture qui échoue ne laisse aucun fichier `.tmp-*` derrière elle.
- [ ] Deux écritures concurrentes vers le même chemin ne peuvent pas utiliser le
      même fichier temporaire.
- [ ] Un test simule l'échec d'écriture et vérifie qu'aucun `.tmp-*` ne subsiste.
