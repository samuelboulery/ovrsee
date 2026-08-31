---
{
  "id": "T-0215",
  "titre": "Couleur d'accent par projet",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "multi-projets",
    "issue-48"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-t-0215-couleur-d-accent-par-projet.md",
  "charge": "s"
}
---

## Contexte

Issue #48. Tous les projets se ressemblent : rien à l'écran ne dit lequel est
ouvert, sauf le nom lu dans l'en-tête. Une couleur d'accent propre à chaque
projet règle ça sans rien lire.

Ce qui rend le geste petit : `--color-accent` est **un seul jeton**
(`_ds/ovrsee/styles.css:74`, `#7d76f0`), consommé partout par variable CSS —
`Shell.tsx:326`, `Terminal.tsx:81-118`, `RailLink` (`Shell.tsx:458`), etc. Le
surcharger sur l'élément racine suffit à repeindre l'application entière.

Ce qui n'existe pas : le registre `~/.claude/ovrsee/projects.json` ne porte que
`{path, name, lastOpened}` (`hooks/plans.js:256`, `registerProject` l.282).

## Où ranger la couleur, et pourquoi

**Dans le registre, pas dans `ovrsee.config.json`.** Une couleur est inerte —
elle ne pose pas le risque d'exécution qui a fait retirer `bootstrap` des champs
surchargeables (#70, `hooks/settings.js:229-232`). Mais c'est une préférence de
poste, pas une propriété du dépôt : deux personnes sur le même dépôt n'ont
aucune raison de partager la même couleur, et le fichier est versionné.

Palette **fermée** — une sélection de teintes validées sur le fond sombre —
plutôt qu'un sélecteur libre : `hooks/couleurs.test.js` interdit déjà les
couleurs arbitraires, et un accent choisi au hasard casse le contraste.

## Critères d'acceptation

- [ ] Une entrée du registre peut porter un champ `accent`, validé contre la
      liste fermée ; une valeur inconnue ou absente retombe sur le défaut.
- [ ] La couleur se choisit depuis les préférences, section « Projet ».
- [ ] Changer de projet repeint l'accent sans rechargement.
- [ ] La rampe d'accent (`_ds/ovrsee/styles.css:94-122`) suit, pas seulement
      `--color-accent` seul — sinon les états survolés jurent.
- [ ] Chaque teinte de la palette tient le contraste sur le fond sombre ; le
      test qui en atteste vit avec les autres dans `node:test`.
- [ ] Un projet sans `accent` s'affiche exactement comme aujourd'hui.
- [ ] `hooks/couleurs.test.js` reste vert : la palette est déclarée dans le
      design system, pas en dur dans un composant.
