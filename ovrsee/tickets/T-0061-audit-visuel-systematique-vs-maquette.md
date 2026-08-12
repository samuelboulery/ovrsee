---
{
  "id": "T-0061",
  "titre": "Audit visuel systématique de chaque écran contre la maquette",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "qa"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-11",
  "plan": "2026-08-11-repasse-ui-ovrsee-coller-a-la-maquette-ovrsee-app-dc-html.md",
  "epic": "T-0058"
}
---

## Contexte

Les rapports d'exploration texte (code actuel + canvas maquette) suffisent pour
repérer des écarts nommés (police, pictos, palette) mais pas des écarts de mise en
page fine — grille de cartes, panneaux latéraux, largeurs, densité. Seule une
comparaison visuelle directe le permet.

## Critères d'acceptation

- [ ] Pour chacun de : Aperçu, Navigateur, Produit, Historique, Tableau, Données,
      Stack, Préférences (section Interface avec aperçu en direct), Onboarding —
      capture côte à côte de l'écran maquette (`Ovrsee App.dc.html`, `file://`) et
      de l'app (`pnpm dev`), écarts listés.
- [ ] Chaque écart listé est soit corrigé (fichier de `app/src/tabs/` concerné),
      soit explicitement journalisé comme hors-périmètre avec la raison.
- [ ] Aucune fonctionnalité neuve introduite dans ce ticket — présentation
      uniquement.
- [ ] Vérification manuelle en Electron (`pnpm electron`) : le rail `<a href>`
      reste détecté par `pnpm ovrsee:crawl` sur le projet ovrsee lui-même.
