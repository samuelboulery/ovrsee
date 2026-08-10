---
{
  "id": "T-0021",
  "titre": "Intégrations déploiements et base de données",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "integrations",
    "epic"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-integrations-deploiements-base-de-donnees-apercu-donnees.md",
  "type": "epic"
}
---

## Contexte

Afficher sur l'onglet Aperçu l'état des services de mise en prod (Vercel,
Netlify, autre) et de la base de données, avec possibilité d'y connecter un
lien et une clé API, et faire remonter un schéma de base de données réel dans
l'onglet Données.

Ça élargit le cadrage d'ovrsee (gestion de credentials, explicitement hors
périmètre jusqu'ici). Le détail — garde-fous de sécurité, portée v1 des
fournisseurs, fichiers touchés — est dans le plan lié.

## Critères d'acceptation

- [ ] Les quatre tickets enfants sont clos.
- [ ] `cadrage-ovrsee.md` et `CLAUDE.md` documentent le nouveau périmètre et
      le corollaire IPC-only.
