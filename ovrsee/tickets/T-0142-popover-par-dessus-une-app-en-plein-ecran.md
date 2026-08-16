---
{
  "id": "T-0142",
  "titre": "Popover par-dessus une app en plein écran, sans changer d'espace",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "electron",
    "macos",
    "ux"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-16",
  "plan": "2026-08-14-barre-de-menu-macos-les-trois-defauts-du-premier-jet.md"
}
---

## Contexte

Depuis une application en plein écran, cliquer l'icône bascule sur l'espace
d'Ovrsee au lieu d'afficher le popover par-dessus. Or c'est précisément le
moment où la barre de menu sert : ne pas quitter ce qu'on fait.

La cause est nommée dans le source d'Electron — `NativeWindowMac::Show()` fait
`activateIgnoringOtherApps:YES`, **sauf pour une fenêtre panel** :

```cpp
if (!IsPanel()) { [[NSApplication sharedApplication] activateIgnoringOtherApps:YES]; }
```

Activer l'application, c'est basculer sur son espace.

Le piège à côté : `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
appelle `DockHide()` — Apple n'autorise une fenêtre à flotter au-dessus du plein
écran que si l'application est un `UIElement`. L'icône du Dock d'Ovrsee
disparaîtrait. Le type `panel` obtient le même résultat sans y toucher, à
condition de passer `skipTransformProcessType: true`.

## Critères d'acceptation

- [ ] La fenêtre du popover est créée avec `type: 'panel'`.
- [ ] `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true,
      skipTransformProcessType: true })`.
- [ ] `setAlwaysOnTop(true, 'pop-up-menu')` — le premier niveau qui passe
      au-dessus du Dock.
- [ ] `showInactive()` remplace `show()`.
- [ ] Le popover se referme encore tout seul : si `blur` ne se déclenche plus
      faute de focus, le clic sur l'icône bascule (déjà là) et une décision
      referme.
- [ ] Le commentaire du code dit pourquoi `skipTransformProcessType` est là —
      sans lui, l'icône du Dock disparaît, et personne ne devinerait le lien.
- [ ] Vérifié à la main depuis une app en plein écran : le popover s'affiche
      par-dessus, **aucun changement d'espace**, et l'icône du Dock d'Ovrsee est
      toujours là ensuite.
- [ ] Coins arrondis et ombre vérifiés une fois le type changé.
