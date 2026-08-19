---
{
  "id": "T-0182",
  "titre": "Lancer le crawl depuis l'interface, avec sa progression",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "l",
  "tags": ["electron", "crawl", "ui"],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-rendre-l-ovrsee-utilisable-sans-cloner-le-depot.md",
  "epic": "T-0180"
}
---

## Contexte

Le bouton « Crawler » copie une commande dans le presse-papier. Le raccourci du
panneau terminal, lui, injecte `!pnpm ovrsee:crawl` **sans chemin de projet**
dans un shell dont le `cwd` est le projet observé — où ce script n'existe pas.
Les deux gestes échouent, l'un poliment, l'autre pas.

Le lancement passe par IPC Electron, jamais par `/api/*` : cette route est aussi
servie par le dev server Vite en HTTP local non authentifié. Même arbitrage que
le terminal et que les secrets d'intégration.

La surface exposée ne reçoit qu'un chemin de projet, vérifié contre le registre
comme le fait déjà `pty:open` — jamais un nom ni un chemin de programme, ni la
commande `dev` de la configuration : le crawler lit ce fichier lui-même.

Les échecs n'ont pas besoin d'un canal : `crawl/index.js` les écrit déjà dans
`ovrsee/pages/scans.jsonl` et sort en code 0, et l'interface sait lire ça.

## Critères d'acceptation

- [ ] Un clic sur « Crawler » lance le crawl du projet affiché, sans terminal.
- [ ] La progression se voit avancer, et survit au démontage de l'onglet.
- [ ] Le crawl s'arrête sur demande, et le serveur de dev qu'il avait démarré
      s'arrête avec lui.
- [ ] Un second clic pendant un crawl n'en lance pas un second.
- [ ] Fermer la fenêtre ne laisse aucun crawl orphelin.
- [ ] Dans un navigateur (`pnpm dev`), le bouton garde son comportement actuel.
- [ ] Le raccourci de crawl du terminal et de la palette a disparu.
