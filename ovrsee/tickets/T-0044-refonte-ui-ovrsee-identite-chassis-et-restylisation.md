---
{
  "id": "T-0044",
  "titre": "Refonte UI Ovrsee — identité, châssis et restylisation",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "refonte",
    "design-system"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "type": "epic"
}
---

## Contexte

Mise en œuvre des maquettes de refonte (`Ovrsee App.dc.html` / `Ovrsee
Refonte.dc.html`) : nouvelle identité visuelle (logo, rampe de couleurs,
typographie IBM Plex, pictos Phosphor), nouveau châssis (rail de navigation
vertical remplaçant la barre d'onglets du haut, palette ⌘K), et
restylisation des écrans existants sur ces nouveaux tokens.

Phase 0 + Phase 1 du plan lié uniquement — les fonctionnalités réseau-neuves
de la maquette (panneau DevTools Réseau, ticket depuis un élément, comparaison
de deux dates, graphe d'activité complet, navigateur de schéma DB) sont
volontairement hors de cet epic : elles partiront en tickets séparés une fois
celui-ci clos, le détail est dans la section « Phase 2 » du plan.

Cet epic remplace T-0039 (thème clair illisible) : le nouveau système de
tokens règle le contraste par construction plutôt qu'au cas par cas — voir
T-0045.

## Critères d'acceptation

- [ ] Les sept tickets enfants (T-0045 à T-0051) sont clos.
- [ ] L'app tourne intégralement sur le nouveau système visuel — plus aucune
      référence à Nocturne (`_ds/nocturne-*`) dans `app/src/`.
- [ ] `pnpm ovrsee:crawl` retrouve toujours les 7 routes après le passage au
      rail de navigation (contrainte `<a href>`, voir plan).
- [ ] `pnpm typecheck` et `pnpm test` passent.
