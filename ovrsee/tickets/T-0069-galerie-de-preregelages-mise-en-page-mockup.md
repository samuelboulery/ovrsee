---
{
  "id": "T-0069",
  "titre": "Galerie de préréglages (onboarding étape 2) — mise en page ne suit pas la maquette",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "ui",
    "onboarding"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-audit-design-pixel-perfect-vs-ovrsee-app-dc-html.md",
  "epic": "T-0070",
  "charge": "s"
}
---

## Contexte

Trouvé en vérifiant visuellement T-0067 (grille de vues) contre `Ovrsee App.dc.html#2j`.
Le chantier « écarts de structure » (`ovrsee/plans/une-premiere-repasse-ui-linear-mccarthy.md`)
avait classé la galerie de préréglages comme « déjà construite » (chantier précédent,
T-0059/T-0060) et ne l'a pas revérifiée au pixel de mise en page — seul son contenu
(4 profils, textes) avait été validé.

Écart réel, `app/src/Onboarding.tsx` (`SectionProfils`) vs maquette :

- **Maquette** : une ligne de 4 cartes compactes, sélection par bouton radio — cliquer
  la carte l'applique, pas de bouton séparé.
- **Code actuel** : grille 2×2 de cartes larges avec miniature de mise en page, texte
  descriptif plus long, et un bouton « Appliquer » distinct par carte (sauf le profil
  courant qui affiche juste « Profil courant »).

## Critères d'acceptation

- [x] La galerie de préréglages est une ligne de 4 cartes compactes façon maquette,
      sélection directe sans bouton « Appliquer » séparé.
- [x] `pnpm typecheck` et `pnpm test` passent.
- [x] Comparaison visuelle contre `Ovrsee App.dc.html#2j` confirmée dans Chrome —
      `SectionProfils` (`app/src/PreferencesProfils.tsx`, partagée avec l'onboarding)
      refondue en ligne `flex` de 4 cartes cliquables (radio 14px, pastille 6px si
      sélectionné, sans bouton), gap 10px, radius 10px, calé sur `#2j`.
