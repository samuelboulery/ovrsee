---
{
  "id": "T-0305",
  "titre": "Barre de menus permanente, façon CleanMyMac",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "electron"
  ],
  "cree": "2026-10-27",
  "maj": "2026-10-27",
  "plan": "2026-10-27-notifications-ovrsee-facon-cleanmymac-menage-des-copies-d-ov.md",
  "charge": "l"
}
---

## Contexte

Fermer l'app tue tout signal. Sam veut le modèle CleanMyMac : l'app complète quand on l'ouvre, l'item de barre de menus toujours là sinon.

## Critères d'acceptation

- [ ] Cmd+Q ou fermeture de la fenêtre : fenêtre détruite, Dock caché, tray présent (si le réglage est actif)
- [ ] « Quitter Ovrsee » du tray quitte vraiment
- [ ] rouvrir depuis le Dock, Launchpad ou le tray recrée la fenêtre et le Dock
- [ ] une LaunchAgent lance l'app en `--barre-de-menus` à l'ouverture de session, écrite ou retirée selon le réglage
- [ ] `menubar.pid` existe tant que le processus vit
