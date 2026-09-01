---
{
  "id": "T-0231",
  "titre": "La fenêtre Electron et la chrome native suivent le thème",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "electron",
    "issue-64"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": "2026-09-01-theme-clair-complet-issue-64-t-0218.md",
  "epic": "T-0218",
  "charge": "s"
}
---

## Contexte

Deux choses restent sombres quoi que fasse le rendu.

`backgroundColor: '#0e0f18'` est écrit en dur dans `electron/main.js:187` et
`electron/tray.js:130` — c'est ce qu'on voit avant le premier paint, et la
valeur ne correspond à rien : ni `--color-bg` (`#08090a`), ni le fond du body.

`nativeTheme.themeSource` n'est atteint qu'en ouvrant les DevTools de l'onglet
Navigateur (`electron/main.js:587`), alors que son propre commentaire dit que
« le réglage vaut pour toute l'application, pas seulement pour les DevTools ».
Menus natifs, dialogues et ascenseurs de l'OS restent donc sombres dans une
application claire tant que personne n'a ouvert les DevTools.

## Critères d'acceptation

- [ ] Le `backgroundColor` des deux fenêtres suit le thème enregistré, et vaut la
      couleur de fond réelle de l'interface.
- [ ] `nativeTheme.themeSource` est posé par la bascule de thème, hors du chemin
      DevTools ; menus natifs et dialogues suivent.
- [ ] Les DevTools du Navigateur continuent de s'accorder à l'interface.
- [ ] Rien ne transite par `/api/*` : le canal reste l'IPC Electron.
