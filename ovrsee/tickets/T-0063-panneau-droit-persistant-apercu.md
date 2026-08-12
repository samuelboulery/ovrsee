---
{
  "id": "T-0063",
  "titre": "Panneau droit persistant — Déploiements et README dans Aperçu",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "apercu"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "epic": "T-0062"
}
---

## Contexte

`app/src/tabs/Apercu.tsx:237-283` : `Deploiements` et le bloc README sont rendus dans
la colonne principale (`max-width: 820px`), à la suite de Santé/Branches/
Environnements. La maquette (2b) les regroupe dans une colonne fixe à droite
(~320px) : Déploiements en haut, README avec sommaire en dessous, indépendante du
défilement de la colonne principale. Le `Sommaire` actuel (conditionnel à 3+ titres)
est un pis-aller à remplacer par ce panneau.

Référence de style : `DetailPanel` de Produit (`app/src/tabs/Produit.tsx:422-600`,
déjà résizable à 330px).

## Critères d'acceptation

- [ ] Panneau droit fixe (~300-340px, `border-left`) contenant Déploiements puis
      README+sommaire, à côté d'une colonne principale `flex: 1` (Santé, Branches,
      Environnements, Lancement, Obsidian).
- [ ] Le panneau défile indépendamment de la colonne principale.
- [ ] `pnpm ovrsee:crawl` retrouve toujours les 7 routes (rail `<a href>` non touché,
      mais réorganisation du DOM autour à revérifier).
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle dans Chrome contre `Ovrsee App.dc.html#2b`.
