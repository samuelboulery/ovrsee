---
{
  "id": "T-0031",
  "titre": "Liste des déploiements récents par environnement",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "integrations"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-liste-des-deploiements-recents-environnement-branche-commit.md"
}
---

## Contexte

La carte Déploiements de l'Aperçu ne montre qu'un statut agrégé (dernier
déploiement de production) alors que l'utilisateur veut voir, comme sur
Vercel, plusieurs déploiements récents avec leur environnement
(Production/Preview/Branch), leur statut, et un accès en un clic à chacun.

## Critères d'acceptation

- [ ] `IntegrationStatus` porte une liste `deployments` optionnelle
      (Vercel/Netlify) avec environnement, statut, branche/commit
      best-effort, et URL cliquable.
- [ ] `checkVercel`/`checkNetlify` remontent jusqu'à 5 déploiements récents,
      tous environnements confondus (plus de filtre production seul).
- [ ] La carte Déploiements affiche cette liste sous le badge d'état
      existant, chaque ligne cliquable vers son déploiement (nouvel onglet).
- [ ] Supabase/Autre gardent l'affichage actuel (pas de liste).
- [ ] `pnpm typecheck` et `pnpm test` passent, avec des cas de test couvrant
      la nouvelle liste `deployments` (environnements multiples, url
      préfixée `https://`, best-effort branche/commit Vercel).
