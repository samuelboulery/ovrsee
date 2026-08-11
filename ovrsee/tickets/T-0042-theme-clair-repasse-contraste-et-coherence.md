---
{
  "id": "T-0042",
  "titre": "Thème clair : repasse contraste et cohérence des couleurs",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "theme"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-theme-clair-repasse-contraste-et-coherence-round-2.md"
}
---

## Contexte

Après le paquet reconstruit du round 1 (T-0039), l'utilisateur remonte 7 nouvelles captures d'éléments encore illisibles en thème clair, plus une demande explicite de cohérence (« même couleur pour le même composant »).

Root causes identifiées :
- `--color-accent-200`/`-300` (rampe numérotée, pas theme-aware) utilisé comme couleur de texte directe sur fond ambiant clair à ~27 endroits dans ~15 fichiers — badge sidebar, chiffre de stat, code inline, id ticket/commit, libellés de statut.
- Palette ANSI du terminal incomplète dans `theme.ts` (6 couleurs sur 16) : les 10 manquantes retombent sur les défauts de xterm.js, calibrés pour fond noir — illisibles sur le fond clair du terminal intégré (jauges de statut).
- `Lightbox.tsx` et `tabs/Produit.tsx` : HUD volontairement sombre (fond littéral non-thématisé) mais texte assorti avec un token qui s'inverse par thème — devient gris foncé sur fond quasi-noir en clair.

## Critères d'acceptation

- [ ] Tous les textes accent-200/-300 standalone (hors badges auto-cohérents fond+texte statiques) utilisent `var(--color-accent)` / `var(--color-accent-2)`.
- [ ] Terminal intégré : jauges de statut (ctx/5h/7d) et tout texte coloré ANSI lisibles en thème clair, palette ANSI complète (16 couleurs) définie pour les deux thèmes.
- [ ] Flèches Lightbox et contrôles de zoom du graphe (Produit) lisibles en thème clair.
- [ ] Aucune régression visible en thème sombre (captures avant/après).
- [ ] `pnpm test:ui` et typecheck passent.
