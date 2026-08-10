---
{
  "id": "T-0025",
  "titre": "Badge LIVE et schéma Supabase dans l'onglet Données",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "integrations",
    "frontend",
    "charge-m"
  ],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-integrations-deploiements-base-de-donnees-apercu-donnees.md",
  "epic": "T-0021"
}
---

## Contexte

Superposer, à la demande, le schéma réel d'une base Supabase configurée sur
le graphe existant (Graphify/Obsidian) de l'onglet Données — additif, ne
remplace jamais la source de vérité existante. Dépend de T-0022
(`checkSupabase`, introspection lecture-seule de `information_schema`).

## Critères d'acceptation

- [ ] `confStyle` dans `Donnees.tsx` gagne une valeur `'LIVE'`, visuellement
      distincte de `EXTRACTED`/`INFERRED`/`AMBIGUOUS`.
- [ ] Si une intégration Supabase avec token existe, bouton « Vérifier le
      schéma live » qui fusionne les tables lues en direct par nom de table
      sur le graphe existant.
- [ ] Une table détectée en direct mais absente du graphe est signalée
      comme telle, pas silencieusement ajoutée.
- [ ] `pnpm test` et `pnpm typecheck` verts.
