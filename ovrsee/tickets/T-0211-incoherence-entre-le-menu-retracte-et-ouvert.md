---
{
  "id": "T-0211",
  "titre": "Incohérence entre le menu rétracté et ouvert",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": ["ui", "sidebar"],
  "cree": "2026-08-29",
  "maj": "2026-08-29",
  "plan": null
}
---

## Contexte

Issue GitHub #50. Quand on replie la sidebar (`app/src/Shell.tsx`, `Sidebar`) :

1. La recherche (bouton ⌘K) disparaît complètement — la branche `collapsed`
   ne la rend pas du tout.
2. Le logo (`<Logo size={28} />`) apparaît en haut du rail replié, alors qu'il
   n'est visible nulle part en mode ouvert (confirmé par grep : seul usage
   hors `Onboarding.tsx`).
3. Petit décalage de layout au basculement : `Divider` (largeur nette 1px,
   via marges négatives, `useResizable.tsx`) n'est monté que si
   `sidebarOuverte` (`App.tsx`) — sa disparition retire 1px non réservé au
   contenu.

## Critères d'acceptation

- [x] Un contrôle de recherche (icône seule) reste accessible en mode replié.
- [x] Aucune icône propre au mode replié n'apparaît sans équivalent en mode
      ouvert (le logo est retiré du rail).
- [x] Le basculement ouvert/replié ne décale plus le contenu de 1px — la
      largeur du Divider reste réservée.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` verts (280 tests).
