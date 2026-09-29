---
{
  "id": "T-0267",
  "titre": "Le navigateur propose de lancer le serveur de dev",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "navigateur",
    "terminal",
    "securite",
    "issue-120"
  ],
  "cree": "2026-09-29",
  "maj": "2026-09-29",
  "plan": "2026-09-29-corrections-des-3-issues-ouvertes-103-120-125.md",
  "charge": "m"
}
---

## Contexte

Issue #120. Quand le serveur du projet observé ne tourne pas, l'onglet Navigateur dit de
lancer `pnpm dev` à la main. Un bouton doit ouvrir un terminal qui le lance. La commande
vient du dépôt observé : elle passe par le même accord que le crawl, et le rendu ne nomme
aucun programme.

## Critères d'acceptation

- [ ] Sur connexion refusée, l'overlay montre « Lancer le serveur » (Electron seulement).
- [ ] Le clic ouvre un terminal `kind: 'dev'` : le principal relit `dev` sur disque et exige l'accord de `trust.json`, modale native sinon.
- [ ] La page se recharge d'elle-même quand le serveur répond.
- [ ] CLAUDE.md et les commentaires « jamais exécutée » mis à jour.
