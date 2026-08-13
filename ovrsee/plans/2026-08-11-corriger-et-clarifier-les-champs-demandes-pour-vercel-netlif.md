---
{
  "status": "closed",
  "title": "Corriger et clarifier les champs demandés pour Vercel/Netlify/Supabase",
  "opened": "2026-08-11",
  "closed": "2026-08-13",
  "commits": []
}
---

# Corriger et clarifier les champs demandés pour Vercel/Netlify/Supabase

## Contexte

Le formulaire d'intégration (`PreferencesIntegrations.tsx`) demande la même
paire « URL du tableau de bord » + « Jeton API » quel que soit le fournisseur
choisi, avec un seul indice statique (`pref.integrations_url_hint` : « Ex. :
https://vercel.com/<équipe>/<projet> ») qui ne colle qu'au cas Vercel. Un
utilisateur qui choisit Netlify ou Supabase voit un exemple Vercel, et rien ne
dit où trouver le jeton ni quel type de jeton coller.

Vérification faite contre le code d'appel API (`hooks/integrationProviders.js`)
et la documentation officielle de chaque fournisseur :

- **Vercel** (`GET /v6/deployments?projectId=…`, doc REST API deployments) :
  le champ `url` sert à extraire le nom du projet (2ᵉ segment de
  `vercel.com/<équipe>/<projet>`) — correct et suffisant. Le seul risque réel
  est un projet appartenant à une équipe : si le jeton n'est pas scoped à ce
  projet/cette équipe à sa création, l'appel échoue. La doc Vercel confirme
  qu'un jeton peut être scoped à une équipe et à un projet précis dès sa
  création (page `/account/tokens`) — donc pas besoin d'un champ `teamId`
  séparé, juste d'un conseil au bon endroit.
- **Netlify** (`GET /api/v1/sites/{site_id}/deploys`) : le `site_id` accepté
  par l'API est soit l'ID interne, soit le nom du site — celui qui apparaît
  déjà dans `app.netlify.com/sites/<site>/…`. L'extraction actuelle est donc
  correcte ; il manque juste l'exemple d'URL Netlify (actuellement absent) et
  le lien vers la page de création de jeton.
- **Supabase** (`GET /v1/projects/{ref}`, Management API) : le `ref` extrait
  de `supabase.com/dashboard/project/<ref>` est correct. Le vrai risque de
  confusion est le **type de jeton** : l'utilisateur peut coller la clé
  `anon`/`service_role` du projet (très visible dans Project Settings → API)
  au lieu du jeton **Management API** (Account → Access Tokens, seul capable
  de lire le statut du projet). Ce point doit être dit explicitement.

Donc : ne rien changer à l'extraction ni à l'appel API (déjà corrects), mais
rendre les deux champs existants provider-conscients — bon exemple d'URL, bon
indice de jeton, lien direct vers la page où le créer.

## Changements

### 1. `hooks/i18n.js` + `hooks/i18n.d.ts` (fr + en)
Remplacer la clé unique `pref.integrations_url_hint` par une par fournisseur,
et ajouter l'équivalent côté jeton :

- `pref.integrations_url_hint_vercel` — « Ouvrez le projet dans Vercel et
  copiez l'URL de son tableau de bord — ex. https://vercel.com/<équipe>/<projet>. »
- `pref.integrations_url_hint_netlify` — « Ouvrez le site dans Netlify et
  copiez l'URL de son tableau de bord — ex.
  https://app.netlify.com/sites/<site>/overview. »
- `pref.integrations_url_hint_supabase` — « Ouvrez le projet dans Supabase et
  copiez l'URL de son tableau de bord — ex.
  https://supabase.com/dashboard/project/<ref>. »
- `pref.integrations_url_hint_autre` — « Lien affiché tel quel sur la carte —
  aucune vérification automatique pour ce fournisseur. »
- `pref.integrations_token_hint_vercel` — « Depuis Vercel : Account Settings
  → Tokens. Limitez-le au projet (et à l'équipe) concernés — inutile de
  renseigner un identifiant d'équipe séparé. »
- `pref.integrations_token_hint_netlify` — « Depuis Netlify : User settings →
  Applications → Personal access tokens. Ce jeton donne accès à tous les
  sites du compte, Netlify ne propose pas de portée plus fine. »
- `pref.integrations_token_hint_supabase` — « Un jeton de l'API Management
  (Compte → Access Tokens) — pas la clé anon/service_role du projet, qui ne
  donne pas accès à son statut. »
- `pref.integrations_token_hint_autre` — « Optionnel, non utilisé — ce
  fournisseur n'a pas de vérification automatique. »
- `pref.integrations_token_create_link` — « Créer un jeton ${provider} → »
  (interpolation `${provider}`, motif déjà utilisé ailleurs, ex. `App.tsx`
  avec `t('garde.tab', { name: … })`)

Retirer `pref.integrations_url_hint` (un seul usage, remplacé).

### 2. `app/src/PreferencesIntegrations.tsx`
- Deux tables à côté de `PROVIDERS` (ligne 32) :
  ```ts
  const URL_HINT: Record<IntegrationProvider, TranslationKey> = { vercel: …, netlify: …, supabase: …, autre: … }
  const TOKEN_HINT: Record<IntegrationProvider, TranslationKey> = { … }
  const TOKEN_HELP_URL: Record<IntegrationProvider, string | null> = {
    vercel: 'https://vercel.com/account/tokens',
    netlify: 'https://app.netlify.com/user/applications#personal-access-tokens',
    supabase: 'https://supabase.com/dashboard/account/tokens',
    autre: null,
  }
  ```
- Champ URL (ligne ~154) : `hint={t(URL_HINT[provider])}` au lieu de la clé
  statique.
- Champ Jeton (ligne ~166) : composer le hint avec le texte provider-conscient
  + un lien externe (`<a target="_blank" rel="noreferrer">`, même style que
  les liens d'intégration dans `Deploiements.tsx`) quand `TOKEN_HELP_URL[provider]`
  existe, + l'indice « laisser vide pour garder le jeton » déjà présent en
  mode édition, à la suite plutôt qu'à la place.
- Le hint dépend de `provider` (déjà en state), donc se met à jour tout seul
  au changement de select.

## Non-fait (délibérément)

- Pas de champ `teamId`/`site_id`/`ref` séparé : les URLs actuelles suffisent
  à en extraire l'identifiant, ajouter un champ dupliquerait l'information et
  contredirait le choix déjà fait par l'app de tout tirer d'une seule URL.
- Pas de changement de version d'API Vercel (`v6` → `v7`) : `v6` répond
  toujours, `projectId` accepte nom ou ID dans les deux versions — pas un bug
  à corriger dans cette passe, seulement un risque de dérive à surveiller
  séparément si `v6` est un jour retiré.

## Vérification

- `pnpm typecheck` et `pnpm test`.
- Ouvrir Préférences → Projet → Intégrations, changer le select Fournisseur
  entre Vercel/Netlify/Supabase/Autre : l'indice sous l'URL et sous le jeton
  changent en conséquence, le lien « Créer un jeton … → » pointe vers la
  bonne page (ou disparaît pour Autre).
- Vérifier visuellement en mode édition que l'indice « laisser vide pour
  garder le jeton » s'ajoute toujours à la suite du texte provider-conscient,
  pas à sa place.
