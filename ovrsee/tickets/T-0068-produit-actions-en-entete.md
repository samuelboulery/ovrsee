---
{
  "id": "T-0068",
  "titre": "Produit — Comparer deux dates et Crawler déplacés vers l'en-tête",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "ui",
    "produit"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-repasse-ui-ovrsee-ecarts-de-structure-pas-seulement-de-style.md",
  "epic": "T-0062"
}
---

## Contexte

`app/src/tabs/Produit.tsx` : « Comparer deux dates » (`CompareModal`, lignes 609-649)
et l'action Crawler existent déjà et fonctionnent — seul leur emplacement diffère de
la maquette (2d), qui les met dans la barre d'en-tête à côté du fil « ovrsee /
Produit · 7 pages... ». Aujourd'hui, comparer ne se déclenche que depuis
`DetailPanel` (page sélectionnée) ; Crawler n'apparaît pas dans Produit.tsx (seulement
dans le panneau de commandes du terminal). Pur déplacement/ajout de bouton, pas de
nouvelle logique.

Écarté explicitement (décidé avec l'utilisateur) : la bascule Graphe/Liste de la
maquette — nouvelle fonctionnalité, hors périmètre de ce ticket.

## Critères d'acceptation

- [ ] Bouton « Comparer deux dates » dans l'en-tête de Produit (désactivé si aucune
      page sélectionnée ou une seule capture), déclenche le `CompareModal` existant.
- [ ] Bouton « Crawler » dans l'en-tête, déclenche l'action crawl existante.
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle dans Chrome contre `Ovrsee App.dc.html#2d`.
