---
{
  "id": "T-0194",
  "titre": "Un raccourci de commande écrit dans l'onglet actif",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["terminal", "issue-49"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-corriger-les-issues-49-51-et-53.md"
}
---

## Contexte

Issue #49. `activate()` (`app/src/Terminal.tsx`) passe par `pasteToClaude`, qui
écrit dans la session `claude` du projet — quel que soit l'onglet regardé — puis
bascule dessus. Avec plusieurs terminaux ouverts, cliquer un raccourci depuis le
deuxième écrit dans le premier et vole l'onglet.

## Critères d'acceptation

- [ ] Un raccourci cliqué depuis un shell nu colle son texte dans ce shell.
- [ ] L'onglet actif ne change pas, et le curseur atterrit dans le terminal visé.
- [ ] Sans terminal (navigateur), le repli presse-papier fonctionne toujours.
- [ ] La palette ⌘K, qui s'ouvre panneau replié, garde la session claude pour cible.
