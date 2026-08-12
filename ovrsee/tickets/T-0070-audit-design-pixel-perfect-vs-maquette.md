---
{
  "id": "T-0070",
  "titre": "Audit design pixel-perfect vs Ovrsee App.dc.html",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-audit-design-pixel-perfect-vs-ovrsee-app-dc-html.md",
  "type": "epic",
  "charge": "xl"
}
---

## Contexte

Le chantier structurel précédent (T-0062, fait) a corrigé les écarts de *squelette*
(panneaux absents, contenu mal placé). Il n'a pas revérifié au pixel les écrans déjà
jugés « déjà construits » — c'est comme ça que T-0069 (galerie de préréglages) est
passé entre les mailles : contenu validé, mise en page jamais recomparée à la maquette.

L'utilisateur demande maintenant un audit complet — pas seulement de structure, mais
de couleur, typo, hiérarchie et pattern — écran par écran, contre les 13 sections de
`Ovrsee App.dc.html` (`#2a` Système à `#2m` Vides & Données pleine). `Ovrsee
Refonte.dc.html` (direction "Linear-like" écartée) et les captures d'inspiration
(Rox, Chronicle, Linear) sont hors périmètre — tranché avec l'utilisateur.

## Critères d'acceptation

- [x] T-0069, T-0072 en colonne finale.
- [ ] T-0071 (vérification visuelle du panneau Navigateur en Electron) reste en
      backlog — aucun outil de capture de fenêtre native disponible dans cette passe.
- [x] Tout écart net-nouveau trouvé pendant l'audit fin (T-0072) était trivial et
      corrigé directement — aucun ticket supplémentaire nécessaire.
- [x] Comparaison visuelle directe à la maquette (Chrome, `localhost:5180`, dark et
      clair) ne fait plus apparaître d'écart de couleur, typo, hiérarchie ou pattern
      sur les 12 sections vérifiables hors Electron.
