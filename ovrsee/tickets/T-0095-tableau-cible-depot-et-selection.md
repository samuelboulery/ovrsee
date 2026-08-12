---
{
  "id": "T-0095",
  "titre": "Tableau — cible de dépôt neutre + libellé, sélection de carte",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "tableau"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.5 et règle d'or §5.1 : « aucun filet coloré pour signifier
un état ». Vérifié dans `Tableau.tsx` :

- Colonne survolée pendant un glisser de ticket (`ColonneVue`, prop
  `survolee`) : fond `color-mix(accent 22%)` + `outline dashed
  accent-600`. L'audit veut un filet **pointillé** `#383a44`, fond
  `#131418`, et une mention texte « déposer ici » — aucun des deux
  n'existe aujourd'hui.
- Sélection de carte (ticket ouvert) : à vérifier dans le rendu de la
  carte elle-même — l'audit attend filet `#383a44` + fond `#16171d` +
  halo `0 0 0 4px rgba(255,255,255,.045)` (le jeton `--ring-selected`
  posé au Lot 1), jamais un filet accent.

## Critères d'acceptation

- [ ] Colonne cible de dépôt : filet pointillé `#383a44`, fond `#131418`,
      mention « déposer ici » visible pendant le survol d'un glisser.
- [ ] Carte de ticket sélectionnée : filet `#383a44` + fond `#16171d` +
      `var(--ring-selected)` — vérifier l'implémentation actuelle et
      corriger si elle utilise encore l'accent.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome (glisser
      un ticket entre colonnes, sélectionner une carte).
