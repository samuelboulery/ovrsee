---
{
  "status": "open",
  "title": "Rendre visible et clair l'ajout de services de déploiement/DB sur l'Aperçu",
  "opened": "2026-08-11",
  "closed": null,
  "commits": []
}
---

# Rendre visible et clair l'ajout de services de déploiement/DB sur l'Aperçu

## Contexte

L'utilisateur a essayé d'ajouter Vercel et n'a pas compris comment faire. Cause
racine : la carte « Déploiements » de l'onglet Aperçu (`Deploiements.tsx:50`)
fait `return null` tant qu'aucune intégration n'est configurée — donc rien
n'indique, depuis la page d'accueil, que cette fonctionnalité existe ni où
aller pour l'activer (elle est enfouie dans Préférences → Projet →
Intégrations). Objectif : rendre la section visible même vide, avec deux CTA
explicites (« ajouter un déploiement » / « ajouter une base de données ») qui
amènent directement au bon formulaire, provider présélectionné. Garder un
bouton pour la masquer si l'utilisateur ne s'en sert pas — mais elle
réapparaît automatiquement dès qu'un service est configuré, pas besoin de
réglage à retrouver.

## Changements

### 1. `app/src/tabs/Deploiements.tsx`
- Retirer `if (integrations.length === 0) return null` (ligne 50).
- Ajouter un état masqué persisté en `localStorage`, même pattern que
  `ovrsee.editor` / `ovrsee.sidebar` (`Apercu.tsx:304`, `App.tsx`) :
  `localStorage.getItem('ovrsee.deploiements.hidden') === '1'`.
- Logique de rendu :
  - `integrations.length > 0` → carte actuelle inchangée (ignore l'état masqué :
    dès qu'un service existe, la section redevient utile et se réaffiche).
  - vide + masqué → `return null`.
  - vide + non masqué → nouvel état vide : titre, courte description, deux
    boutons CTA (`onOpenPreferences({ provider: 'vercel' })` et
    `onOpenPreferences({ provider: 'supabase' })`), et un petit bouton ghost
    « Masquer » qui pose le flag `localStorage` et masque immédiatement.
- Nouvelle prop : `onOpenPreferences: (opts?: { provider?: IntegrationProvider }) => void`.

### 2. `app/src/tabs/Apercu.tsx`
- Nouvelle prop `onOpenPreferences` sur `Apercu`, transmise telle quelle à
  `<Deploiements root={root} integrations={...} onOpenPreferences={onOpenPreferences} />`
  (ligne 240).

### 3. `app/src/App.tsx`
- `Apercu` est monté ligne 625. Ajouter :
  `onOpenPreferences={opts => { setPreferencesInitial({ section: 'projet', provider: opts?.provider }); setPreferencesOuvertes(true) }}`
- Nouvel état `preferencesInitial` (section + provider optionnel à préremplir),
  remis à `null` à la fermeture de la modale.
- `<PreferencesModal>` (ligne 736) reçoit `initialSection={preferencesInitial?.section}`
  et `initialProvider={preferencesInitial?.provider}`.

### 4. `app/src/PreferencesPanel.tsx`
- `PreferencesModal` accepte `initialSection?: SectionId` et
  `initialProvider?: IntegrationProvider`.
- `useState<SectionId>('profils')` (ligne 465) devient
  `useState<SectionId>(initialSection ?? 'profils')`.
- `initialProvider` est transmis à `SectionProjet` (ligne 559).

### 5. `app/src/PreferencesProjet.tsx`
- `SectionProjet` accepte `initialProvider?: IntegrationProvider` et le
  transmet à `BlocIntegrations` (ligne 318).

### 6. `app/src/PreferencesIntegrations.tsx`
- `BlocIntegrations` accepte `initialProvider?: IntegrationProvider`.
- `useState<IntegrationProvider>('vercel')` (ligne 41) devient
  `useState<IntegrationProvider>(initialProvider ?? 'vercel')`.

### 7. `hooks/i18n.js`
Ajouter (fr + en), à côté des clés `deploiements.*` existantes :
- `deploiements.empty_desc` — ex. FR : « Suivez l'état de vos déploiements
  (Vercel, Netlify…) et de votre base de données (Supabase) directement
  depuis l'app. »
- `deploiements.add_deploy` — « Ajouter un service de déploiement »
- `deploiements.add_db` — « Ajouter une base de données »
- `deploiements.hide` — « Masquer »
- La clé `deploiements.no_integration` existante devient inutile (remplacée
  par `empty_desc`) — la supprimer si inutilisée ailleurs.

## Non-fait (délibérément)

- Pas de réglage global « réafficher la section » dans Préférences : le
  masquage ne concerne que l'état vide et se lève tout seul dès qu'une
  intégration existe, donc pas de piège où l'utilisateur ne retrouve plus le
  bouton.
- Pas de défilement/ancre automatique vers le bloc Intégrations dans la
  section Projet des Préférences (elle est déjà le seul bloc visible en
  ouvrant sur `section='projet'`) — inutile d'ajouter un `scrollIntoView`.

## Vérification

- `pnpm test` (ou équivalent dans `app/`) — s'assurer qu'aucun test existant
  ne présume `Deploiements` retourne `null` à vide (recherche faite : aucun
  test ne cible directement ce composant).
- Lancer l'app (`pnpm dev` / Electron), ouvrir un projet sans intégration :
  - la carte Déploiements est visible sur l'Aperçu avec les deux CTA,
  - cliquer « Ajouter un service de déploiement » ouvre Préférences sur la
    section Projet, provider = Vercel présélectionné,
  - cliquer « Ajouter une base de données » ouvre sur provider = Supabase,
  - enregistrer une intégration → retour sur Aperçu, la carte affiche la
    liste normale (comportement existant inchangé),
  - supprimer la dernière intégration → l'état vide + CTA réapparaît,
  - cliquer « Masquer » sur l'état vide → carte disparaît, recharger l'app →
    reste masquée,
  - ajouter une intégration après masquage → carte réapparaît automatiquement.
