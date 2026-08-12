---
{
  "id": "T-0071",
  "titre": "Vérifier visuellement le panneau droit Navigateur (Electron)",
  "colonne": "backlog",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "navigateur"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-audit-design-pixel-perfect-vs-ovrsee-app-dc-html.md",
  "epic": "T-0070",
  "charge": "s"
}
---

## Contexte

T-0064 (panneau droit persistant Navigateur) a été codé et testé dans le chantier
structurel précédent, mais jamais vérifié visuellement : la vue navigateur intégré
n'existe qu'en Electron (`pnpm electron`) — le dev server Chrome affiche « Le
navigateur intégré n'existe que dans l'application ». Aucun outil de capture n'était
disponible à l'époque.

## Critères d'acceptation

- [ ] `pnpm electron` lancé, onglet Navigateur ouvert, panneau droit (détail
      d'élément sélectionné) comparé visuellement à `Ovrsee App.dc.html#2c`.
- [ ] Écarts trouvés listés et corrigés (ou, si aucun écart, le constat noté dans le
      commit qui ferme ce ticket).

## Note

T-0072 a comparé le panneau au niveau du code (`app/src/tabs/Navigateur.tsx` vs les
styles inline de `#2c`) et corrigé un écart de padding trouvable sans rendu vivant.
Reste : la vérification visuelle en Electron proprement dite, toujours pas faite —
aucun outil de capture de fenêtre native n'était disponible dans cette passe.
