---
{
  "status": "open",
  "title": "Liste des déploiements récents (environnement, branche, commit, lien direct)",
  "opened": "2026-08-11",
  "closed": null,
  "commits": [
    {
      "sha": "af718fa",
      "date": "2026-08-11",
      "files": [
        "hooks/ovrsee-tool-edit-gate.js",
        "hooks/ovrsee-tool-edit-gate.test.js"
      ]
    }
  ]
}
---

# Liste des déploiements récents (environnement, branche, commit, lien direct)

## Contexte

La carte Déploiements ne montre qu'un statut agrégé (« actif »/« en erreur »)
tiré du seul dernier déploiement de production. L'utilisateur veut voir ce
que montre le dashboard Vercel : plusieurs déploiements récents, avec leur
environnement (Production/Preview/Branch), leur statut, et un accès en un
clic à chacun — pas juste au dashboard général.

Vérifié contre la doc officielle :

- **Vercel** (`GET /v6|v7/deployments?projectId=…&limit=N`, sans filtre
  `target`) : chaque déploiement expose `target` (`"production"` |
  `"staging"` | `null` pour preview), `url` (domaine `xxx.vercel.app`, sans
  `https://`), `created`/`createdAt` (epoch ms). **Branche et commit ne sont
  pas garantis par la doc de liste** — présents en pratique dans `meta`
  (`githubCommitRef`/`githubCommitSha` pour un repo GitHub, équivalents
  gitlab/bitbucket) mais pas documentés formellement. Les lire en best-effort
  depuis `meta`, sans requête supplémentaire par déploiement (`GET
  /v13/deployments/{id}?withGitRepoInfo=true` donnerait une réponse plus
  fiable mais couterait un appel réseau par ligne affichée — hors de propos
  pour une vérification manuelle et non pollée).
- **Netlify** (`GET /sites/{site_id}/deploys?per_page=N`) : tous les champs
  voulus sont documentés et directs — `context` (`production` |
  `deploy-preview` | `branch-deploy`), `deploy_ssl_url` (HTTPS, cliquable
  directement), `branch`, `commit_ref` (SHA complet), `created_at` (ISO).
- **Supabase** : l'API Management ne modélise pas plusieurs environnements
  pour un même projet (hors Supabase Branching, hors sujet ici) — rien à
  changer côté Supabase. Le lien vers son dashboard est déjà cliquable
  aujourd'hui (`integ.url` de `Deploiements.tsx`), ce qui couvre déjà « un
  clic pour y accéder » pour ce fournisseur.

## Changements

### 1. `app/src/data.ts`
Étendre `IntegrationStatus` (déjà `{state, detail, checkedAt}`) :
```ts
export interface DeploymentInfo {
  id: string
  state: IntegrationState
  environment: string        // 'Production' | 'Preview' | 'Branch' | 'Staging'
  url: string | null         // lien direct vers le déploiement, cliquable
  branch?: string
  commit?: string            // sha court (7 caractères)
  createdAt: string          // ISO
}

export interface IntegrationStatus {
  state: IntegrationState
  detail: string
  checkedAt: string
  deployments?: DeploymentInfo[]   // Vercel/Netlify seulement, absent sinon
}
```

### 2. `hooks/integrationProviders.js`
- `checkVercel` : retirer `&target=production`, passer `limit=5`. Mapper
  chaque élément de `data.deployments` en `DeploymentInfo` : `environment`
  depuis `target` (`'production'` → `'Production'`, `'staging'` →
  `'Staging'`, `null`/absent → `'Preview'`), `url` = `` `https://${d.url}` ``
  si `d.url` existe sinon `null`, `branch`/`commit` best-effort depuis
  `d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? d.meta?.bitbucketCommitRef`
  et l'équivalent `*CommitSha` (7 premiers caractères), `createdAt` depuis
  `d.createdAt ?? d.created`. Le statut agrégé retourné en tête (`state`,
  `detail`) devient celui du **premier élément de la liste** (le plus
  récent, tous environnements confondus) au lieu du seul déploiement de
  production — cohérent avec le fait que la liste elle-même montre déjà le
  détail par environnement.
- `checkNetlify` : `per_page=5` au lieu de `1`, même mapping direct depuis
  `context`/`deploy_ssl_url`/`branch`/`commit_ref`/`created_at` (tous
  documentés, pas de best-effort nécessaire). `context` → label :
  `'production'` → `'Production'`, `'deploy-preview'` → `'Preview'`,
  `'branch-deploy'` → `'Branch'`, autre → tel quel.
- `checkSupabase` : inchangé.
- Mettre à jour `hooks/integrationProviders.test.js` : les fixtures
  existantes (`deployments: [{state, url}]` à un seul élément) restent
  valables pour `state`/`detail` ; ajouter des cas ciblés sur la nouvelle
  liste `deployments` (environnement mappé, url préfixée `https://`, plusieurs
  éléments avec des `target` différents pour Vercel ; `context` pour
  Netlify).

### 3. `app/src/tabs/Deploiements.tsx`
- Élargir la carte (`min-width` plus grand, ex. 320px) quand
  `status?.deployments?.length` existe — la liste a besoin de place, la
  carte compacte actuelle (190px) ne convient qu'à l'état sans détail.
- Sous le bouton « Vérifier », si `status?.deployments` est présent : une
  liste de lignes, chacune cliquable (toute la ligne est un `<a
  href={d.url} target="_blank" rel="noreferrer">` si `d.url` existe, sinon
  un `<div>` non cliquable pour ne pas créer de lien mort) — pastille
  d'état (réutilise `ETAT_STYLE`/`ETAT_LABEL` déjà là), tag environnement
  (`tag-accent` pour Production, `tag-neutral` sinon — classes déjà dans
  `style.css`), commit court en monospace si présent, branche si présente,
  date relative (réutiliser `humanAge`/`frDate` de `../data`, déjà importés
  ailleurs dans l'app pour ce même usage).
- Le badge d'état global en tête de carte reste tel quel — il reflète
  maintenant le déploiement le plus récent tous environnements confondus (cf.
  changement §2), ce qui est le comportement attendu par défaut.

## Non-fait (délibérément)

- Pas d'appel réseau supplémentaire par déploiement pour fiabiliser
  branche/commit Vercel (`withGitRepoInfo=true`) : 5 déploiements affichés
  multiplieraient les requêtes par 5 pour une info secondaire dans une
  vérification manuelle, non pollée. Best-effort depuis `meta` suffit ; si
  absent, la ligne affiche juste l'environnement/statut/date sans branche.
- Pas de support Supabase Branching (environnements multiples côté
  Supabase) : fonctionnalité bêta/payante, hors du besoin exprimé (qui vise
  Vercel en exemple).
- Pas de pagination/« voir plus » : 5 déploiements récents correspond à ce
  qu'un aperçu doit montrer, pas à un remplacement du dashboard du
  fournisseur.

## Vérification

- `pnpm test` (fixtures mises à jour + nouveaux cas `integrationProviders.test.js`)
  et `pnpm typecheck`.
- Avec un vrai projet Vercel multi-environnements configuré : ouvrir
  l'Aperçu, « Vérifier » → la carte affiche plusieurs lignes (Production +
  Preview au minimum), chacune cliquable vers son URL de déploiement propre.
- Idem Netlify si disponible.
- Vérifier qu'un provider sans `deployments` (Supabase, Autre, ou Vercel/Netlify
  avant le premier clic sur Vérifier) garde l'affichage actuel sans la liste.
