---
{
  "id": "T-0089",
  "titre": "StatusBar — nouveau composant, câblage complet 4 vues + minimal sur le reste",
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

La barre d'état (26px) de la maquette — faits propres à la vue à gauche,
raccourcis à droite (`⌘K` en dernier) — n'existe pas dans le code. Dépend de
T-0085.

## Critères d'acceptation

- [ ] Composant `StatusBar` créé : hauteur 26, `border-top: 1px solid
      #17181d`, fond `#0b0c0e`, mono 10.5px `#55585f`, `gap: 14px`,
      `padding: 0 14px`. Droite = raccourcis séparés par `|` `#3f424a`, `⌘K`
      en dernier, touches en police système.
- [ ] Contenu complet (gauche + droite) câblé sur Aperçu, Navigateur, Produit,
      Historique — valeurs littérales de l'audit §3.4.
- [ ] Tableau, Données, Stack reçoivent le composant avec au minimum le `⌘K`
      à droite (contenu gauche détaillé = chantier d'écran séparé).
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome.
