---
{
  "id": "T-0282",
  "titre": "L'accord de la commande dev se donne à l'équipement, et son absence se voit partout",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "crawl",
    "ux"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0280",
  "charge": "m",
  "fait": "2026-10-10T15:09:14.756Z"
}
---

## Contexte

29 échecs « commande dev non approuvée » : le crawl au commit n'a pas d'humain pour approuver (`crawl/confiance.js:168`). `approuverCrawl` est appelé en `void` à l'équipement (`useCrawl.ts:46`) : une annulation ne dit rien. L'échec ne se lit que dans le bandeau de l'onglet Produit (`Produit.tsx:140`).

## Critères d'acceptation

- [ ] Annuler la modale d'accord affiche que le crawl restera bloqué tant que la commande n'est pas approuvée.
- [ ] Un dernier scan en échec pour « non approuvée » se signale hors de l'onglet Produit (barre d'état ou pastille de scan), avec un bouton qui ouvre la modale d'accord.
