---
{
  "id": "T-0111",
  "titre": "Placer la barre d'état sous le panneau de terminal",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["ui", "layout"],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": null
}
---

## Contexte

`StatusBar` (`app/src/StatusBar.tsx`) est rendue par chaque onglet comme
dernier enfant de son propre arbre. En layout `bottom`, `main` (onglet +
barre) et `Terminal` sont des frères dans le même conteneur flex colonne
(`App.tsx`) — l'onglet précède le terminal en DOM, donc la barre d'état se
retrouve visuellement coincée entre le contenu de l'onglet et le panneau de
terminal, au lieu d'être le pied de page tout en bas de l'app.

Capture utilisateur : la barre (`main · <sha> · arbre git propre`, onglet
Aperçu) apparaît juste au-dessus du terminal, pas en dessous.

## Critères d'acceptation

- [ ] Terminal ouvert (layout `bottom`) : la barre d'état s'affiche sous le
      panneau de terminal, pas au-dessus.
- [ ] Terminal fermé : la barre d'état reste visible normalement (pas de
      régression sur les onglets qui ne l'utilisaient pas déjà tel quel).
- [ ] Les 7 onglets continuent d'afficher leur propre contenu de barre
      (aucun n'en perd ni n'en gagne un autre).
- [ ] `pnpm test` toujours vert (les rendus SSR de `render.test.tsx` ne
      passent pas par un DOM réel).
