---
{
  "id": "T-0286",
  "titre": "Un panneau Câblage dit ce qui est branché et le répare",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": [
    "ux",
    "installation"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-audit-produit-et-ux-d-ovrsee-10-oct-2026.md",
  "epic": "E-0285",
  "charge": "l"
}
---

## Contexte

`equipped` vaut `existsSync(ovrsee/)` (`hooks/snapshot.js:424`). Si `~/.claude/settings.json` manque, `install()` ne pose pas les hooks Claude et l'écran affiche quand même « Équipé » (`install.js:225`). Les chemins absolus écrits dans les hooks cassent sans signal quand l'app est déplacée (`install.js:72`). `signalInstalle` ne sert qu'au tray.

## Critères d'acceptation

- [ ] Un panneau (Préférences › Projet ou Aperçu › Santé) montre en vert/rouge : `ovrsee/`, hooks git présents et exécutables pointant vers un binaire existant, hooks Claude, accord `dev`, Chrome, `claude` dans le PATH du shell de connexion.
- [ ] Chaque ligne rouge porte son geste de réparation ; « Réinstaller » rappelle `install()`, idempotent.
- [ ] À l'équipement, les lignes « absent / illisible / non modifié » de `install()` s'affichent en avertissement, pas mêlées aux succès.
