---
{
  "id": "T-0228",
  "titre": "Trois réglages : clair, sombre, système",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "preferences",
    "issue-64"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "epic": "T-0218",
  "charge": "m"
}
---

## Contexte

Le champ `theme` des préférences a été supprimé en T-0200 parce qu'il promettait
un réglage sans effet — `hooks/settings.js:155` le mentionne encore comme
retiré, et `PreferencesPanel.tsx` affiche une ligne « Sombre » inerte. Il
revient, cette fois avec quelque chose derrière.

Il suit le chemin de `langue`, pas celui de l'accent : c'est une préférence de
poste globale, donc `~/.claude/ovrsee/settings.json`, validée par liste fermée,
et **jamais surchargeable par `ovrsee.config.json`** — un dépôt cloné n'a pas à
décider du thème de qui l'ouvre.

Le défaut est `system` : c'est ce que demande l'issue #64. Conséquence assumée,
un poste réglé en clair verra l'application changer d'apparence à la mise à jour.

L'application se fait comme celle de l'accent (`App.tsx:265-273`) : un attribut
sur `<html>`, une passe de style, aucun rechargement. `data-theme` porte toujours
la valeur **résolue** — `appTheme()` (`navigateur-webview.ts:87`) la lit déjà.

## Critères d'acceptation

- [ ] Trois crans dans les préférences, avec le `Segmented` existant.
- [ ] `theme` validé par liste fermée, défaut `system`, valeur inconnue ramenée
      au défaut, non surchargeable par un projet — un test l'atteste.
- [ ] En `système`, changer le thème de l'OS fenêtre ouverte fait suivre
      l'interface, sans rechargement.
- [ ] Le popover de la barre de menu, second rendu de la même origine, suit lui
      aussi.
- [ ] Aucun flash sombre au démarrage à froid en clair.
