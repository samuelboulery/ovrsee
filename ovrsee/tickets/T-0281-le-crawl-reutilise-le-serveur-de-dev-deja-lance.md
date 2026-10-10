---
{
  "id": "T-0281",
  "titre": "Le crawl réutilise le serveur de dev déjà lancé",
  "colonne": "backlog",
  "priorite": "haute",
  "tags": [
    "crawl"
  ],
  "cree": "2026-10-10",
  "maj": "2026-10-10",
  "plan": "2026-10-10-correctifs-de-l-audit-lot-crawl-et-correctifs-rapides.md",
  "epic": "E-0280",
  "charge": "m"
}
---

## Contexte

`crawl/index.js:168` refuse de démarrer si `baseUrl` répond, au motif que rien ne distingue son propre serveur de celui d'un autre projet. C'est pourtant le cas normal en travaillant : 38 échecs. Ovrsee sait quand le serveur vient de lui (pty de genre `dev` ouvert par « Lancer le serveur », `devALancer`).

## Critères d'acceptation

- [ ] Un serveur lancé par Ovrsee pour ce projet est réutilisé par le crawl, sans en démarrer un second.
- [ ] Un port occupé par un serveur inconnu, déclenché depuis l'interface, propose « Réutiliser » ou « Annuler » au lieu d'échouer ; au post-commit (sans humain), le refus actuel est conservé.
- [ ] Test : un crawl avec le serveur Ovrsee déjà lancé écrit une ligne `ok: true`.
