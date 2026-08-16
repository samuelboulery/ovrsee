---
{
  "id": "T-0144",
  "titre": "Signaux d'indexation de la vitrine : robots, sitemap, JSON-LD, preload",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "site",
    "seo"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-seo-de-la-vitrine-site-constats-et-correctifs.md"
}
---

## Contexte

`https://ovrsee.app/robots.txt` et `/sitemap.xml` répondent 404, et la page ne
déclare aucune donnée structurée. Un moteur — ou un moteur de réponse, qui lit le
JSON-LD en priorité — n'a donc rien pour décrire le produit autrement qu'en devinant
depuis la prose : ni catégorie, ni système d'exploitation, ni prix, ni dépôt.

Le `<title>` ne contient pas non plus « Claude Code », le terme que les gens tapent ;
il n'apparaît que dans la surtitre et la `description`.

Et la police du LCP (`IBMPlexSans.woff2`, portée par le `<h1>`) n'est découverte
qu'après le parse de `styles.css` — un aller-retour évitable.

Le `<h1>` et l'argumentaire ne changent pas : ce ticket ne touche qu'aux signaux.

## Critères d'acceptation

- [ ] `https://ovrsee.app/robots.txt` répond 200 et déclare `Sitemap: https://ovrsee.app/sitemap.xml`.
- [ ] `https://ovrsee.app/sitemap.xml` répond 200 et liste `/` (et `/en/` une fois T-0146 livré).
- [ ] Un `<script type="application/ld+json">` décrit un `SoftwareApplication` et un
      `WebSite` ; la licence déclarée est celle de `LICENSE`, pas une supposée.
- [ ] Le Schema Markup Validator passe l'URL sans erreur.
- [ ] `<link rel="preload">` sur `IBMPlexSans.woff2`, avec `crossorigin`.
- [ ] Le `<title>` contient « Claude Code » et reste sous 60 caractères.
- [ ] `og:image:type` présent.
