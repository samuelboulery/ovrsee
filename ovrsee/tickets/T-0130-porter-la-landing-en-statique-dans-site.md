---
{
  "id": "T-0130",
  "titre": "Porter la landing en statique dans site/",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "charge": "xl",
  "epic": "T-0123",
  "tags": [
    "site",
    "contenu"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

La landing est un export Claude Design : balises `<x-dc>`, `<helmet>`, `<sc-if>`,
liaisons `{{ }}` et une classe `DCLogic`, le tout piloté par `support.js` — 69 ko
de runtime tiers sans licence claire, celui-là même que le nettoyage vient de
retirer du dépôt. Plus deux CDN : Google Fonts et unpkg.

Ce qui rend le portage réaliste : aucune image, tout est en DOM et styles inline.
La démo interactive est la pièce maîtresse — elle rend l'interface avec le markup
de l'app, ce que les captures ne montrent pas.

## Critères d'acceptation

- [ ] `site/` ne contient ni `support.js`, ni balise `<x-dc>`, ni liaison `{{ }}`.
- [ ] La page s'affiche sans aucune requête réseau sortante : polices IBM Plex
      vendues localement, 26 icônes Phosphor inlinées en SVG.
- [ ] La démo commute les sept vues et le sélecteur bascule toute la page FR/EN.
- [ ] Les liens de téléchargement pointent sur les assets de la dernière release,
      avec repli sur `/releases/latest` si l'API ne répond pas.
- [ ] `.github/workflows/site.yml` déploie sur Pages, filtré sur `site/**`.
