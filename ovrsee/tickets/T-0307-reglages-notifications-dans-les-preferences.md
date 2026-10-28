---
{
  "id": "T-0307",
  "titre": "Réglages Notifications dans les préférences",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "notifications",
    "ui"
  ],
  "cree": "2026-10-27",
  "maj": "2026-10-27",
  "plan": "2026-10-27-notifications-ovrsee-facon-cleanmymac-menage-des-copies-d-ov.md",
  "charge": "m",
  "fait": "2026-10-27T23:09:44.127Z"
}
---

## Contexte

Le comportement du point précédent doit se régler depuis l'app, et le seuil de 2 min du mod notif de claude-config (retiré) y devient un réglage.

## Critères d'acceptation

- [ ] `DEFAULT_SETTINGS.notifications` (barreDeMenus, lancerAuDemarrage, finDeTourApresMin, sonFin, sonQuestion, badge) validé par `validateSettings`, testé
- [ ] section Notifications dans PreferencesModal, libellés dans i18n
- [ ] le hook lit ces réglages
