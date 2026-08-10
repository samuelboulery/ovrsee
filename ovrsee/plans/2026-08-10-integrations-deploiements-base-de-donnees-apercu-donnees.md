---
{
  "status": "closed",
  "title": "Intégrations Déploiements & Base de données (Aperçu + Données)",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "7b704e2",
      "date": "2026-08-10",
      "files": [
        "hooks/ovrsee-capture-audit.js"
      ]
    },
    {
      "sha": "32ed79a",
      "date": "2026-08-10",
      "files": [
        "CLAUDE.md",
        "app/src/App.tsx",
        "app/src/PreferencesIntegrations.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/data.ts",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Deploiements.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/useTerminal.ts",
        "cadrage-ovrsee.md",
        "electron/main.js",
        "electron/preload.cjs",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/integrationProviders.js",
        "hooks/integrationProviders.test.js",
        "hooks/integrations.js",
        "hooks/integrations.test.js",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js",
        "\"ovrsee/tickets/T-0024-panneau-preferences-int\\303\\251grations.md\"",
        "server/api.test.js"
      ]
    }
  ]
}
---

# Intégrations Déploiements & Base de données (Aperçu + Données)

## Contexte

Demande : afficher sur l'onglet Aperçu l'état des services de mise en prod
(Vercel, Netlify, autre) et de la base de données, avec possibilité d'y
connecter un lien et une clé API, et faire remonter un schéma de base de
données réel dans l'onglet Données.

Ça touche directement le cadrage d'ovrsee. `cadrage-ovrsee.md` exclut
explicitement la gestion de credentials (« un gestionnaire de mots de passe
et un fichier `ACCESS.md` suffisent ») et l'invariant central est
« l'ovrsee lit, il n'exécute jamais ». Rien dans le code actuel ne stocke un
secret de façon sûre (pas de keychain/safeStorage, juste des fichiers JSON),
et `ovrsee/` — y compris `ovrsee.config.json` — est versionné en git.

Décision prise avec l'utilisateur : construire la vraie intégration (clés
API, appels aux fournisseurs), pas juste des liens. Ça élargit le périmètre
du cadrage — ce plan inclut donc la mise à jour de `cadrage-ovrsee.md` pour
l'assumer explicitement, avec les garde-fous qui rendent ça sûr.

## Principe de sécurité — le précédent du terminal

Le terminal n'est pas exposé par une socket locale mais par IPC Electron,
parce qu'une socket « s'ouvrirait à tout processus tournant sous le même
compte » (`CLAUDE.md`, corollaire déjà arbitré). `server/api.js` a le même
problème pour du contenu sensible : c'est un serveur HTTP local
non-authentifié (le header `X-Ovrsee: 1` est un marqueur, pas une auth).

Ce plan applique le même corollaire aux secrets d'intégration :

- **Jamais dans `<repo>/ovrsee/`** — stockage dans
  `~/.claude/ovrsee/integrations.json`, hors dépôt, jamais versionné.
- **Chiffrement** via `safeStorage` d'Electron (lié au trousseau OS), quand
  disponible.
- **Écriture, déchiffrement et appel réseau au fournisseur : IPC Electron
  uniquement**, jamais via `/api/*`. Le renderer ne reçoit jamais un token en
  clair, seulement des statuts déjà résolus.
- Seule la liste **non-secrète** (fournisseur, libellé, URL, "a un token ?")
  passe par `/api/integrations`, en lecture seule, sur les trois hôtes — pour
  qu'Aperçu affiche au moins ça en mode `pnpm dev` (navigateur, sans
  Electron). Ajouter/éditer un token et vérifier un statut reste indisponible
  hors Electron, avec un message explicite dans l'UI.
- **Pas de polling automatique.** Un bouton « Vérifier » manuel par
  intégration — pas de minuteur qui tape les API des fournisseurs en tâche de
  fond.
- **Zéro nouvelle dépendance.** `fetch` natif (Node 18+/Electron) suffit pour
  parler aux API Vercel/Netlify/Supabase.

## Portée v1 des fournisseurs

- **Vercel** — token = Personal Access Token, `GET /v6/deployments` /
  `/v9/projects` pour l'état du dernier déploiement prod/preview.
- **Netlify** — token = Personal Access Token, `GET /api/v1/sites/{id}` +
  `/deploys` pour le statut du dernier build.
- **Supabase** — token = access token, statut projet + option
  d'introspection lecture-seule du schéma (`information_schema` via l'API
  Management/PostgREST) pour nourrir l'onglet Données.
- **Autre** — libellé + URL, pas d'appel API (juste un lien, comme demandé
  pour « un autre service » sans sur-construire une intégration bespoke).

## Fichiers

**Nouveau — stockage pur (mirroring `hooks/settings.js`)**
- `hooks/integrations.js` — `readIntegrations(root)` /
  `writeIntegrations(root, list)`, un seul fichier
  `~/.claude/ovrsee/integrations.json` clé par chemin de projet, aucun accès
  réseau ni chiffrement ici (module pur, comme `settings.js`). Chaque entrée :
  `{id, provider, label, url, tokenCipher?}`. `tokenCipher` est un buffer
  base64 opaque pour ce module — il ne sait pas ce qu'il contient.
- `hooks/integrations.test.js` — aller-retour lecture/écriture, validation
  par champ, fichier corrompu → liste vide sans lever (même style que
  `settings.js`).

**Nouveau — chiffrement, réseau, IPC (Electron uniquement)**
- `electron/integrationProviders.js` — fonctions pures
  `checkVercel(token, config)`, `checkNetlify(...)`, `checkSupabase(...)`
  prenant un token déjà déchiffré et retournant un statut normalisé
  `{state, detail, checkedAt}`.
- `electron/main.js` — `ipcMain.handle('integrations:list' | 'save' |
  'remove' | 'checkStatus', ...)`, sur le modèle de `pty:open` etc.
  (`electron/main.js:293-301`). `save` chiffre le token via
  `safeStorage.encryptString` avant d'appeler `writeIntegrations`.
  `checkStatus` déchiffre, appelle `integrationProviders`, ne renvoie que le
  statut.
- `electron/preload.cjs` — `window.ovrsee.integrations = { list, save,
  remove, checkStatus }`, sur le modèle de `window.ovrsee.terminal`
  (`electron/preload.cjs:100-127`).

**Nouveau — route lecture-seule, trois hôtes**
- `server/api.js` — `GET /api/integrations?path=...` dans `resolve()`,
  renvoie `[{id, provider, label, url, hasToken}]` via
  `hooks/integrations.js`, jamais `tokenCipher`.

**Nouveau — UI**
- `app/src/tabs/Deploiements.tsx` — widget Aperçu, calqué sur
  `Environnements.tsx` (`app/src/tabs/Environnements.tsx:13-65`) : une carte
  par intégration (fournisseur, libellé, lien, badge de statut, bouton
  Vérifier). Si `window.ovrsee.integrations` absent (mode `pnpm dev`), le
  bouton Vérifier est désactivé avec un message.
- `app/src/PreferencesIntegrations.tsx` — panneau d'ajout/édition/suppression
  (fournisseur, libellé, URL, champ token write-only — jamais raffiché après
  enregistrement), branché dans la section Projet de Préférences. Dépend de
  la refonte Préférences en cours (deux plans ouverts,
  `2026-08-10-preferences-cinq-sections-et-des-templates-d-interface.md` et
  `2026-08-10-refonte-de-l-ecran-des-preferences.md`) — s'insérer dans celui
  des deux qui atterrit en premier, sous la section "Projet".

**Modifié**
- `app/src/tabs/Apercu.tsx` — importe et rend `<Deploiements />` à côté de
  `<Environnements />`.
- `app/src/tabs/Donnees.tsx` — ajoute la valeur de confiance `'LIVE'` au
  dictionnaire de style (`confStyle`, `Donnees.tsx:116-123`) ; si une
  intégration Supabase avec token existe, bouton « Vérifier le schéma live »
  qui superpose les tables lues en direct sur le graphe existant (fusion par
  nom de table, additive — ne remplace jamais Graphify/Obsidian comme source
  de vérité).
- `app/src/data.ts` — `fetchIntegrations()` (GET, calque
  `fetchSettings`, `data.ts:742-750`), et de fins wrappers autour de
  `window.ovrsee.integrations.*` avec le même garde `pont()` que dans
  `Apercu.tsx:51-55`.
- `cadrage-ovrsee.md` — retire les intégrations du §3 hors-périmètre,
  documente le scope v1 et les garde-fous ci-dessus.
- `CLAUDE.md` — étend le « corollaire déjà arbitré » : les secrets
  d'intégration suivent la même règle IPC-only que le terminal, jamais
  `/api/*`.

## Vérification

- `pnpm test` — vert, y compris `hooks/integrations.test.js`.
- `pnpm typecheck` — vert sur les nouveaux `.tsx`.
- `pnpm electron` : Préférences → Projet → Intégrations → ajouter un token
  Vercel (PAT réel ou de test) → enregistrer → la carte apparaît dans
  Aperçu → « Vérifier » renvoie un statut réel. Idem Supabase → bouton
  « Vérifier le schéma live » dans Données affiche le badge LIVE.
- `pnpm dev` (navigateur, sans Electron) : le widget Déploiements affiche
  les libellés/liens déjà configurés (via `/api/integrations`), mais
  ajouter/éditer un token et le bouton Vérifier sont désactivés avec le
  message explicite.
- Vérifier que `~/.claude/ovrsee/integrations.json` existe et n'apparaît
  jamais dans `git status` du dépôt observé ; vérifier que le champ
  `tokenCipher` n'est pas en clair dans ce fichier.
