---
{
  "id": "T-0183",
  "titre": "Écrire la config de crawl sur un projet déjà équipé",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": ["ui", "crawl"],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-rendre-l-ovrsee-utilisable-sans-cloner-le-depot.md",
  "epic": "T-0180"
}
---

## Contexte

`EquipmentPanel` sait écrire `ovrsee.config.json`, mais il ne s'affiche que si
le projet n'est pas équipé. Un projet qui a un `ovrsee/` sans configuration n'a
donc plus aucun chemin dans l'interface, et le crawl répète « configuration
absente » à chaque tentative sans que rien ne propose d'y remédier.

`snapshot.config` porte déjà le fichier parsé, ou `null` : rien à ajouter côté
API pour savoir qu'il manque. `install()` est idempotent et n'écrase jamais une
configuration existante, donc l'action `init` se rappelle sans danger sur un
projet équipé.

## Critères d'acceptation

- [ ] Sur un projet sans `ovrsee.config.json`, le bouton propose de le
      configurer plutôt que de lancer un crawl voué à échouer.
- [ ] Deux champs, `dev` et `baseUrl`, pré-remplis par la détection existante.
- [ ] Après écriture, le bouton redevient « Crawler » sans recharger l'app.
- [ ] Ni les hooks ni `board.json` ne sont réécrits au passage.
