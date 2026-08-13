---
{
  "id": "T-0132",
  "titre": "Appliquer les trois correctifs sûrs de l'audit",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "securite",
    "audit"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-audit-final-avant-publication-et-les-trois-correctifs-qu-il.md"
}
---

## Contexte

L'audit d'avant publication n'a trouvé aucune faille critique ni élevée, et rien
à supprimer. Il reste trois écarts réels, tous petits.

Le contrôle d'hôte des intégrations valide par `hostname.endsWith(host)` :
`evilvercel.com` passe. Ce n'est pas une SSRF — l'URL d'API est en dur — mais le
contrôle est faux.

`SECURITY.md` ne dit nulle part que le crawl exécute la commande `dev` du
`ovrsee.config.json` du dépôt observé. C'est le seul endroit où l'application
exécute du code venant du projet observé, et l'omission compte sur un dépôt
public.

Enfin, `app/src` compte quatorze balises `<img>` et aucun `loading="lazy"`,
pour des captures d'environ 100 ko affichées en vignettes.

## Critères d'acceptation

- [ ] `https://evilvercel.com/x/y` rend `null` ; `https://vercel.com/x/y` et
      `https://www.vercel.com/x/y` passent. Le test est écrit **avant** le
      correctif et échoue d'abord.
- [ ] `SECURITY.md` dit que crawler un projet exécute sa commande `dev`.
- [ ] Les `<img>` de captures portent `loading="lazy"`, et les vignettes
      s'affichent toujours dans l'application lancée.
