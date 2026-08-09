---
{
  "id": "T-0011",
  "titre": "L'installation peut tronquer le hook post-commit",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["robustesse", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`hooks/install.js:87-92` remplace le bloc cockpit d'un `.git/hooks/post-commit`
existant :

```js
const start = existing.indexOf(START)
if (start !== -1) {
  const end = existing.indexOf(END, start)
  const cut = end === -1 ? existing.length : end + END.length
  existing = existing.slice(0, start) + block + existing.slice(cut)
}
```

Quand le marqueur d'ouverture est là mais pas celui de fermeture, `cut` vaut la
fin du fichier : **tout ce qui suit le début du bloc cockpit est effacé.** Sur ce
dépôt-ci, le hook graphify est avant le bloc cockpit et survivrait ; un hook
installé après ne survivrait pas.

Le marqueur non fermé n'est pas hypothétique : l'écriture du hook, elle, n'est pas
atomique. `writeFileSync(hookPath, …)` écrit en place, alors que tout le reste du
projet passe par temp-puis-rename ([[T-0009]]). Une interruption au mauvais moment
laisse exactement ce fichier-là.

Un marqueur non fermé signale un fichier abîmé. La bonne réponse est de refuser et
de le dire, pas de deviner.

## Critères d'acceptation

- [ ] Un `post-commit` contenant `# cockpit-hook-start` sans `# cockpit-hook-end`
      fait échouer l'installation avec un message qui nomme le fichier, sans rien
      écrire.
- [ ] Réinstaller sur un `post-commit` qui contient déjà le bloc graphify **et** le
      bloc cockpit laisse le bloc graphify intact, quel que soit leur ordre.
- [ ] L'écriture du hook passe par un fichier temporaire renommé.
