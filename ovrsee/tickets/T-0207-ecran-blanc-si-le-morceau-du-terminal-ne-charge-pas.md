---
{
  "id": "T-0207",
  "titre": "Écran blanc si le morceau du terminal ne charge pas",
  "colonne": "pret",
  "priorite": "haute",
  "tags": ["ui", "robustesse"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-suites-de-la-revue-de-la-pr-61.md"
}
---

## Contexte

Depuis T-0133, le panneau terminal arrive par `lazy(() => import('./Terminal'))`
(`app/src/App.tsx`). Le `<Suspense fallback={null}>` qui l'entoure attrape la
suspension, pas le rejet : un morceau qui ne charge pas — chunk périmé après un
rebuild en dev, lecture `ovrsee://` en échec dans le paquet — fait remonter
l'erreur jusqu'à la racine React. L'application entière disparaît pour une
fonction optionnelle.

C'est le seul chemin de l'interface où un morceau peut manquer, et il est né
avec le découpage.

## Critères d'acceptation

- [ ] Un `import('./Terminal')` qui rejette laisse l'application debout : les
      onglets restent utilisables.
- [ ] Le panneau affiche un message qui dit que le terminal n'a pas pu être
      chargé, pas un cadre vide.
- [ ] La frontière est locale à ce site d'appel — pas de composant générique
      pour un seul usage.
