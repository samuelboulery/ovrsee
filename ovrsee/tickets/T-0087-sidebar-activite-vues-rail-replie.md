---
{
  "id": "T-0087",
  "titre": "Sidebar — retirer activité compacte, colonne droite des vues, rail replié 56px + logo",
  "colonne": "fait",
  "priorite": "moyenne",
  "epic": "T-0084",
  "tags": [
    "design",
    "chassis"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-fondations-chassis-aligner-ovrsee-sur-l-audit-design-lots-1.md"
}
---

## Contexte

`App.tsx` : la sidebar embarque encore `<ActivityPanel compact>`, désormais
redondant avec le panneau d'activité complet de l'Historique (300px, posé au
chantier « panneau droit persistant »). Les lignes de vue (`RailLink`) n'ont
pas de colonne de droite (numéro de raccourci, pastille de compte) ni de
ligne « Réordonner, masquer… ». Le rail replié fait 52px (cases 36×31) au
lieu de 56px (34×32) et n'a pas le logo Ovrsee en haut. Dépend de T-0085.

## Critères d'acceptation

- [ ] `<ActivityPanel compact>` et son conteneur `border-top` retirés de la
      sidebar ; mode `compact` d'`ActivityPanel.tsx` retiré si plus utilisé
      ailleurs (vérifié avant de couper).
- [ ] Chaque ligne de vue affiche à droite le numéro de raccourci (mono 10,
      `#4e5158`) et, quand un compte existe, une pastille (17px, fond
      `#24252c`, mono 10, `#9096a0`).
- [ ] Ligne « Réordonner, masquer… » ajoutée en fin de liste (picto
      `DotsSixVertical` 15px `#3f424a`, libellé 12.5px `#4e5158`), ouvre
      Préférences → Interface.
- [ ] Lignes de vue : hauteur 31px, gouttière picto 15px, survol fond
      `#131418`.
- [ ] Rail replié : 56px, cases 34×32 rayon 8, picto 17px, logo Ovrsee en
      haut (réutilise `Logo` de `OnboardingArt.tsx`).
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sidebar
      ouverte et repliée.
