---
{
  "id": "T-0101",
  "titre": "Données — schéma live : jeton cassé, teinte plan, cardinalités FK",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "design",
    "donnees"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.6, partie Données. Vérifié dans `Donnees.tsx` :

- En-tête de table (`LiveSchema`, ligne 392) : `background:
  var(--theme-bg-secondary)` — même jeton mort que dans `Navigateur.tsx`
  (T-0097), inexistant dans `_ds/ovrsee/styles.css`. Fond transparent, pas
  juste la mauvaise couleur.
- Contour de table (ligne 389) : `var(--color-divider)` au lieu de
  `var(--color-border-card)` (= `#1c1d22`, la valeur exacte de l'audit).
- Badge PK (ligne 414) : `color: var(--color-accent)` + filet
  `var(--color-accent-700)` — l'audit demande une teinte plan
  (`--color-plan`/`--color-plan-border`), pas l'accent.
- FK (lignes 420-423) : affichée `→ table.colonne` sans cardinalité. Une
  clé étrangère est *toujours* du côté « n » vers le « 1 » de la clé
  primaire référencée — convention relationnelle universelle, pas une
  donnée à extraire. Préfixer `n → 1` en mono 10 `#55585f` avant le nom de
  la table cible, comme demandé par l'audit.
- `EtatVide` (lignes 140-179) : titre en `--font-heading` 600/15 au lieu de
  l'échelle typo du Lot 1 (poids 500) ; pas de cadre pointillé autour du
  bloc — l'audit veut « cadre pointillé + explication + action primaire
  unique » (l'action unique est déjà le cas, il manque le cadre).

## Critères d'acceptation

- [ ] En-tête de table : fond `var(--color-surface)`, plus de jeton mort.
- [ ] Contour de table : `var(--color-border-card)`.
- [ ] Badge PK : couleur/filet en teinte plan (`--color-plan`,
      `--color-plan-border`).
- [ ] FK : cardinalité `n → 1` affichée en mono 10 `#55585f` avant le nom de
      la table référencée.
- [ ] `EtatVide` : titre en poids 500 (échelle Lot 1), cadre pointillé
      `#24252b` autour du bloc.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur
      l'onglet Données, schéma live avec au moins une FK.
