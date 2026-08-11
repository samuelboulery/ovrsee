---
{
  "id": "T-0057",
  "titre": "Schéma DB dans Données",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "ui",
    "donnees",
    "integrations",
    "phase-2"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0052"
}
---

## Contexte

Graphify (`graphify-out/graph.json`) est un graphe de code, pas un schéma
DB — ne pas confondre les deux, l'onglet Données ne doit pas mélanger les
sources. L'IPC `integrations:fetchSchema` (Supabase,
`electron/main.js:374-387`) existe déjà mais reste expérimental, jamais
branché sur une vraie vue. Données garde son état vide honnête tant
qu'aucune source (Graphify ou Supabase) n'est déclarée.

## Critères d'acceptation

- [ ] Nouvelle vue Tables/Schéma dans Données, distincte de la vue
      Graphify existante : tables, colonnes, PK/FK, relations.
- [ ] Alimentée par `integrations:fetchSchema` — secrets lus depuis
      `~/.claude/ovrsee/integrations.json`, jamais depuis le dépôt observé
      (invariant du projet, voir CLAUDE.md).
- [ ] État vide honnête inchangé si aucune intégration Supabase n'est
      configurée.
- [ ] Vérifié en Electron : `integrations:fetchSchema` passe par IPC, pas
      par `/api/*` (dev server Vite = HTTP local non-authentifié).
