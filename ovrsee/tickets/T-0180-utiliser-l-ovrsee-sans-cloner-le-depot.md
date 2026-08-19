---
{
  "id": "T-0180",
  "titre": "Utiliser l'ovrsee sans cloner le dépôt",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "xl",
  "tags": ["electron", "crawl", "packaging", "docs"],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": "2026-08-19-rendre-l-ovrsee-utilisable-sans-cloner-le-depot.md",
  "type": "epic"
}
---

## Contexte

L'application packagée n'embarque pas `crawl/` : cartographier un projet oblige
donc à cloner le dépôt et à y lancer `pnpm ovrsee:crawl /chemin/du/projet`. Tout
le reste en découle — le README enseigne le clone comme mode normal, le bouton
« Crawler » ne sait que copier une commande dans le presse-papier, et le
raccourci du terminal injecte une commande sans chemin de projet dans un shell
où elle n'existe pas.

S'y ajoute une impasse : `EquipmentPanel` sait écrire `ovrsee.config.json`, mais
ne s'affiche que sur un projet non équipé. Un projet qui a un `ovrsee/` sans
config n'a plus aucun chemin pour en obtenir un — d'où le « configuration
absente » que le crawl réécrit dans `scans.jsonl` à chaque tentative.

Visé : on télécharge le DMG, on désigne un projet, on remplit deux champs, on
clique sur Crawler, on voit le scan avancer. Le dépôt cloné ne sert plus qu'à
contribuer.

## Critères d'acceptation

- [ ] Depuis le DMG installé, sans aucun dépôt cloné ni aucun `pnpm` : équiper
      un projet, écrire sa config, le crawler, et voir le graphe se peupler.
- [ ] Aucune commande de crawl n'est plus à taper nulle part.
- [ ] Le README fait de l'installation par les Releases le chemin par défaut.
