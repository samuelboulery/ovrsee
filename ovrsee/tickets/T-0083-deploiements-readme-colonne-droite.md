---
{
  "id": "T-0083",
  "titre": "Déploiements + README : restructurer la colonne droite de l'Aperçu",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "ui"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-integration-structurelle-de-la-maquette-chassis-apercu-chant.md",
  "charge": "l"
}
---

## Contexte

Étape 7 du chantier 3. `Deploiements.tsx:60-202` et la section README d'`Apercu.tsx:229-263`
n'ont pas la structure de la maquette : pas d'en-tête fixe "Déploiements" + lien
"Configurer", cartes verticales au lieu de lignes horizontales (dot statut + 2 lignes +
icône `ArrowUpRight` vers l'URL), 2 boutons distincts en cas vide au lieu d'une ligne
pointillée unique, pas de séparateur avant README, bouton stylé "Afficher/Masquer" au lieu
d'un lien texte, sommaire conditionnel et indentation inégale au lieu d'un sommaire toujours
visible et uniformément indenté.

## Critères d'acceptation

- [ ] En-tête "Déploiements" fixe (38px) + lien "Configurer".
- [ ] Cartes de déploiement en ligne horizontale (dot statut, 2 lignes de contenu, icône
      lien vers l'URL).
- [ ] Cas vide : une seule ligne pointillée "Ajouter Netlify, Railway…" (icône `Plus`).
- [ ] Séparateur 1px avant README.
- [ ] Section README : en-tête + lien texte "Afficher" (pas de bouton stylé), sommaire
      toujours visible ("Ce qu'on y voit"), indentation uniforme.
- [ ] `pnpm typecheck` et `pnpm test` passent.
