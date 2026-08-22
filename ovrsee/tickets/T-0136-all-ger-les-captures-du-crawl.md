---
{
  "id": "T-0136",
  "titre": "Alléger les captures du crawl",
  "colonne": "revue",
  "priorite": "basse",
  "charge": "m",
  "tags": [
    "perf"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-22",
  "plan": "2026-08-13-audit-final-avant-publication-et-les-trois-correctifs-qu-il.md"
}
---

## Contexte

62 Mo de PNG sur le disque, environ 100 ko pièce en 1280×800, affichés en vignettes d'à peu près 300×200. Playwright les écrit sans option de compression.

## Critères d'acceptation

- [ ] Le poids d'une capture baisse de façon mesurable.
- [ ] La lisibilité des captures est préservée — elles sont le produit, pas un détail.

## Ce qui a été fait, et l'écart avec le premier critère

La compression est un cul-de-sac, mesuré plutôt que supposé. Chrome écrit déjà
un PNG serré sur une interface à plats, et Playwright n'offre pas d'autre levier
que le JPEG : sur une capture de l'ovrsee, `type: 'jpeg', quality: 85` sort à
97 ko contre 96 ko en PNG — **plus gros**. Baisser le `deviceScaleFactor` marche
(0,75 → −25 %, 0,5 → −61 %) mais paie en netteté du texte, c'est-à-dire dans le
produit lui-même. Le premier critère est donc resté sur la table, sciemment.

La masse était ailleurs : **879 fichiers pour huit pages en treize jours**, soit
douze photographies du même écran par jour, toutes gardées parce que la règle de
rétention disait « tout garder sur trente jours » — écrite avant qu'un crawl
tourne à chaque commit. `retainable()` a donc un étage de plus : deux jours
pleins, puis une capture par jour, puis une par semaine. Sur ce dépôt, cela
ramène ~130 captures par page à ~12, à lisibilité inchangée.

Le ménage ne s'applique qu'au prochain crawl : les 879 fichiers déjà versionnés
attendent, la suppression d'un fichier versionné n'étant pas un geste à faire
sans qu'on le demande.
