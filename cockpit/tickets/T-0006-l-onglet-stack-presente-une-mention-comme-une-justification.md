---
{
  "id": "T-0006",
  "titre": "L'onglet Stack présente une mention comme une justification",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["justesse", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`app/src/data.ts:727-729` attribue une dépendance au plan le plus récent dont le
corps **contient son nom en sous-chaîne**, en minuscules :

```ts
const source = byRecency.find(plan =>
  (plan.body ?? '').toLowerCase().includes(name.toLowerCase()),
)
```

Deux problèmes, et le second est le grave.

**La correspondance est une sous-chaîne.** Un paquet nommé `vite` correspond à
« invite » et à « vitesse ». Aucune limite de mot.

**Une mention n'est pas une raison.** Preuve produite par l'audit lui-même : le
plan d'audit du 9 août 2026 cite `node-pty` dans une phrase sur l'empaquetage.
L'onglet Stack affiche désormais, en face de `node-pty` : « Audit complet de
Cockpit — plan d'exécution — plan ouvert le 9 août 2026 ». C'est faux. Le plan ne
justifie rien du tout ; il parle d'autre chose.

Par-dessus, l'interface promet une source qui n'existe pas. L'en-tête dit
« chaque ligne remonte à un commentaire `# WHY:` ou à un plan », et l'état vide
dit « ni plan, ni commentaire `# WHY:` ». Or `WHY` n'apparaît dans tout le dépôt
qu'à ces deux endroits — **aucun code ne lit jamais un commentaire `# WHY:`**.

Le cadrage nomme cette dérive comme ce qui détruit la confiance dans l'ensemble :
« une phrase fausse ment sans prévenir ». Une ligne « aucune raison tracée » est
honnête ; une fausse raison ne l'est pas.

## La question ouverte

Ce ticket est en « À spécifier » parce qu'il demande un arbitrage, pas une
correction mécanique : **qu'est-ce qui vaut comme raison d'une dépendance ?**

- Une mention explicite dans un plan, avec une marque volontaire ?
- Un vrai commentaire `# WHY:` à côté de l'import, ce que l'interface promet déjà
  et que personne n'a implémenté ?
- Rien du tout — et l'onglet se contente d'afficher la liste, sans colonne
  « pourquoi » ?

La troisième option est la plus honnête pour un coût nul. Trancher avant de coder.

## Critères d'acceptation

- [ ] Une dépendance seulement citée en passant dans un plan n'apparaît plus comme
      justifiée par ce plan.
- [ ] L'interface ne mentionne `# WHY:` que si les commentaires `# WHY:` sont
      réellement lus.
- [ ] Vérifiable sur le cas connu : `node-pty` n'est plus attribué au plan d'audit
      du 9 août 2026.
