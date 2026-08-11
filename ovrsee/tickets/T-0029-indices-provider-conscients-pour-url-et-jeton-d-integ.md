---
{
  "id": "T-0029",
  "titre": "Indices provider-conscients pour URL et jeton d'intégration",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": ["ui", "integrations"],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-corriger-et-clarifier-les-champs-demandes-pour-vercel-netlif.md"
}
---

## Contexte

Le formulaire d'intégration (`PreferencesIntegrations.tsx`) affichait le même
indice statique sous le champ URL quel que soit le fournisseur choisi (« Ex. :
https://vercel.com/<équipe>/<projet> »), même pour Netlify ou Supabase. Rien
n'indiquait où créer le jeton API ni, pour Supabase, que la clé
anon/service_role du projet (très visible dans son dashboard) n'est pas le bon
jeton — seul un jeton Management API (Account → Access Tokens) permet de lire
le statut du projet.

Vérification faite contre `hooks/integrationProviders.js` et la doc officielle
de chaque fournisseur : l'extraction d'identifiant depuis l'URL (nom de projet
Vercel, site Netlify, ref Supabase) est correcte pour les trois — le problème
était uniquement l'indication donnée à l'utilisateur, pas l'appel API.

## Critères d'acceptation

- [x] L'indice sous le champ URL correspond au fournisseur sélectionné
      (exemple d'URL Vercel/Netlify/Supabase/Autre), et change avec le select.
- [x] L'indice sous le champ Jeton indique où le créer, avec un lien direct
      (`Créer un jeton <Fournisseur> →`) vers la bonne page — absent pour
      « Autre ».
- [x] L'indice Supabase précise explicitement qu'il faut un jeton Management
      API, pas la clé anon/service_role du projet.
- [x] En mode édition, l'indice « laisser vide pour garder le jeton » s'ajoute
      à la suite du texte provider-conscient plutôt que de le remplacer.
- [x] `pnpm typecheck` et `pnpm test` passent.
