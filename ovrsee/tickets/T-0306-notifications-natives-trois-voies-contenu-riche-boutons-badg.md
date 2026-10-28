---
{
  "id": "T-0306",
  "titre": "Notifications natives : trois voies, contenu riche, boutons, badge et son",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "notifications",
    "hooks"
  ],
  "cree": "2026-10-27",
  "maj": "2026-10-27",
  "plan": "2026-10-27-notifications-ovrsee-facon-cleanmymac-menage-des-copies-d-ov.md",
  "charge": "l",
  "fait": "2026-10-27T23:09:54.028Z"
}
---

## Contexte

Les notifications ne naissent que dans le rendu (Notification web sans bouton, badge ni son) et se perdent hors du terminal de l'app.

## Critères d'acceptation

- [ ] terminal de l'app : Notification Electron avec Autoriser/Refuser qui débloquent la session
- [ ] autre terminal, app en barre de menus : le hook dépose un fichier inbox, l'app l'affiche ; un fichier malformé est ignoré sans planter
- [ ] Ovrsee quittée : notification osascript
- [ ] titre = projet, corps = dernière phrase de Claude + durée ; fins de tour sous le seuil non notifiées, questions toujours
- [ ] badge du Dock (ou titre du tray) = sessions en attente ; son par type
- [ ] UserPromptSubmit et SessionStart ne lancent plus node hors de l'app
