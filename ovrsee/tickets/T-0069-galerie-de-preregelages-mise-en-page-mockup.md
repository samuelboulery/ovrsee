---
{
  "id": "T-0069",
  "titre": "Galerie de préréglages (onboarding étape 2) — mise en page ne suit pas la maquette",
  "colonne": "backlog",
  "priorite": "basse",
  "tags": ["ui", "onboarding"],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
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

- [ ] La galerie de préréglages est une ligne de 4 cartes compactes façon maquette,
      sélection directe sans bouton « Appliquer » séparé.
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle contre `Ovrsee App.dc.html#2j` confirmée dans Chrome.
