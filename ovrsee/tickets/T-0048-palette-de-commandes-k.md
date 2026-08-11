---
{
  "id": "T-0048",
  "titre": "Palette de commandes ⌘K",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "chassis"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

Aucune infrastructure de palette de commandes n'existe aujourd'hui (aucun
raccourci ⌘K, aucun registre de commandes). Construire le composant en deux
temps, dans ce même ticket :

1. **Minimal** — navigation entre les 7 vues + ouverture des Préférences.
2. **Complet** — recherche de tickets (données déjà en mémoire côté
   `Tableau.tsx`/`data.ts`, pas de nouvel endpoint requis pour une recherche
   texte simple) et un registre statique des commandes terminal déjà
   existantes (Crawler le projet, Graphe complet, Graphe → Obsidian — ⌘K les
   rend seulement découvrables, il n'invoque rien de nouveau).

## Critères d'acceptation

- [ ] ⌘K ouvre la palette depuis n'importe quelle vue.
- [ ] Navigation vers les 7 vues et vers Préférences.
- [ ] Recherche de tickets par titre (résultats limités à un nombre
      raisonnable, pas de pagination requise).
- [ ] Les commandes terminal existantes (Crawler le projet, Graphe complet,
      Graphe → Obsidian) apparaissent et s'exécutent depuis la palette.
- [ ] Échap ferme la palette sans effet de bord.
- [ ] `pnpm test` et `pnpm typecheck` passent.
