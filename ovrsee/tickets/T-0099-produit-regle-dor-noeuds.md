---
{
  "id": "T-0099",
  "titre": "Produit — règle d'or sur les nœuds (survol, liens, sélection)",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "design",
    "produit"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.3, règle d'or §5.1. Vérifié dans `Produit.tsx` :

- `PageCard` au survol (ligne 435) : `border-color: var(--color-accent-600)`
  — exactement le filet coloré pour signifier un état que l'audit interdit.
- Route de page (ligne 454) et légende « échec de capture » (ligne 472) :
  `color: var(--color-accent)` sur du texte purement informatif — l'accent
  n'est pas réservé à ça.
- Liens entre pages (`Edges`, lignes 396 et 399) : `stroke="#8682cf"` (mauve)
  au lieu du gris neutre `#24252c` de l'audit.
- **Aucun état de sélection** : `PageCard` ne reçoit pas l'information que
  sa page est celle affichée dans le panneau de détail (`selected` existe
  au niveau du parent, ligne 46, mais n'est jamais passé à `PageCard`).
  L'audit attend filet `#383a44` + fond `#16171d` + halo
  `var(--ring-selected)` sur le nœud sélectionné — jamais un filet accent.

## Critères d'acceptation

- [ ] Survol de carte : neutre (filet `#383a44` ou retrait pur et simple de
      l'effet), plus de `var(--color-accent-600)`.
- [ ] Route et « échec de capture » : couleur neutre (`#55585f` /
      `var(--color-neutral-600)`), plus de `var(--color-accent)` décoratif.
- [ ] Liens : `stroke` et `fill` du marqueur en `#24252c`.
- [ ] `PageCard` reçoit l'état sélectionné (route affichée dans le panneau) et
      applique filet `#383a44` + fond `#16171d` + `var(--ring-selected)`.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur le
      graphe Produit, une carte sélectionnée.
