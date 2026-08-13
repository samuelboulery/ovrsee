---
{
  "status": "closed",
  "title": "Préférences : cinq sections, et des templates d'interface",
  "opened": "2026-08-10",
  "closed": "2026-08-13",
  "commits": []
}
---

# Préférences : cinq sections, et des templates d'interface

## Contexte

La barre latérale porte **trois** boutons qui ouvrent trois modales concurrentes
(`App.tsx:855-886`) : « Skills », « ⚙ Préférences », « ⌘ Config Claude ». Les trois
règlent la même chose du point de vue de l'utilisateur — comment le cockpit est
configuré — mais chacune a son cadre, sa croix, son `Échap`, et deux d'entre elles
affichent déjà la même `SkillsList` (`ConfigClaudeModal.tsx:125` et `SkillsPanel.tsx:199`).

Dedans, l'écran des préférences refait la semaine dernière compte **sept** sections
(`PreferencesPanel.tsx:58-66`) dont trois ne portent qu'un ou deux contrôles :
« Activité » a un seul `Segmented`, « Avancé » deux `<select>`, « Terminal » un
interrupteur et trois cartes. Sept entrées de navigation pour douze réglages.

Et rien ne permet de partir d'une base : chaque nouvel usage (suivre un ticketing,
relire un produit, coder) demande de cocher et réordonner sept onglets à la main.

**Résultat visé** : un seul écran, cinq sections, les skills et la configuration
Claude Code dedans, et en tête une galerie de **templates** — des bases d'interface
préparamétrées qu'on applique d'un clic, puis qu'on retouche librement.

## Décisions arrêtées

| Point | Choix |
|---|---|
| Fusion | Les **sections des préférences** (7 → 5). Les onglets de l'application ne bougent pas. |
| Templates | Une **constante**, appliquée par un bouton. Pas de champ `profil` persisté, pas d'état « profil actif » à tenir cohérent. |
| Portée d'un template | `onglets.actifs`, `onglets.ordre`, `terminal.visible`, `terminal.disposition`. **Rien d'autre** — thème, langue, densité, actions, démarrage, gestionnaire de paquets restent ceux de l'utilisateur. |
| Templates livrés | Complet · Sobre · Revue produit · Dev |

## La nouvelle navigation

```
┌──────────────┬──────────────────────────────────┐
│  PARAMÈTRES  │  Interface                   [×] │
│  Profils     │                                  │
│  Général     │   ┌────────────────────────┐     │
│  Interface   │   │  maquette miniature    │     │
│  Claude Code │   └────────────────────────┘     │
│  Projet      │   ⠿ Aperçu        ↑ ↓  [●─]      │
│              │   ⠿ Navigateur    ↑ ↓  [─○]      │
│              │   ─────────────────────────      │
│              │   Terminal            [●─]       │
│              │   Disposition   ▭ ▯ ▮            │
└──────────────┴──────────────────────────────────┘
```

| Section | Contenu | Vient de |
|---|---|---|
| **Profils** | 4 cartes de template, chacune avec sa maquette | neuf |
| **Général** | thème, langue, **densité d'activité** | `SectionGeneral` + `SectionActivite` |
| **Interface** | aperçu, liste d'onglets (bascule + réordonnancement), terminal (visible + disposition) | `SectionOnglets` + `SectionTerminal` |
| **Claude Code** | skills (installables), agents, commands, plugins, hooks, env | `SkillsModal` + `ConfigClaudeModal` |
| **Projet** | actions personnalisées, commandes de démarrage, gestionnaire de paquets, source de graphe | `SectionActions` + `SectionDemarrage` + `SectionAvance` |

Les deux en-têtes de groupe disparaissent : cinq entrées visibles d'un coup ne se
regroupent pas, et le groupe « Projet » n'aurait plus qu'un membre. `GroupLabel`
(`PreferencesControls.tsx:78`) n'a plus d'appelant — le supprimer, avec les clés
`pref.group_settings` / `pref.group_project`.

**L'aperçu ne se dédouble pas** : une seule `PreferencesPreview` en tête de la
section Interface, sans prop `highlight` (elle désignait la section courante ;
onglets et terminal sont maintenant dans la même). Garder la prop pour la galerie
de templates, qui ne s'en sert pas non plus — ou la retirer si aucun appelant ne
la passe (`grep` avant de décider).

## Les templates

Une constante et deux fonctions pures, dans **`app/src/PreferencesProfils.tsx`** (neuf) :

```ts
export const PROFILS = [
  { id: 'complet', actifs: [...ORDRE_USINE],
    terminal: { visible: true,  disposition: 'bottom' } },
  { id: 'sobre',   actifs: ['apercu', 'tableau', 'donnees'],
    terminal: { visible: false, disposition: 'bottom' } },
  { id: 'revue',   actifs: ['apercu', 'navigateur', 'produit', 'historique'],
    terminal: { visible: false, disposition: 'bottom' } },
  { id: 'dev',     actifs: ['apercu', 'tableau', 'stack', 'historique'],
    terminal: { visible: true,  disposition: 'side' } },
] as const
```

`appliquerProfil(settings, profil)` — **l'invariant est là** : `onglets.ordre` doit
toujours porter les sept identifiants, sinon `validateSettings`
(`hooks/settings.js:135`) rejette le tableau en silence et l'utilisateur voit son
rangement revenir à l'usine sans explication.

```ts
const ordre = [...new Set([...profil.actifs, ...(settings.onglets?.ordre ?? []), ...ORDRE_USINE])]
return { ...settings, onglets: { ordre, actifs: [...profil.actifs] },
         terminal: { ...settings.terminal, ...profil.terminal } }
```

Le `Set` sur trois sources couvre le cas d'un fichier abîmé : les onglets du
template d'abord, l'ordre existant ensuite, les sept d'usine en dernier recours.
`terminal.hauteur` / `largeur` sont conservées — un template ne redimensionne rien.

`profilCourant(settings)` rend l'`id` du template dont les quatre champs
correspondent exactement, sinon `null` : c'est ce qui met une carte en accent.

**Le rendu** : quatre cartes en grille 2×2, chacune = `<PreferencesPreview
settings={appliquerProfil(settings, profil)} />` (la maquette fait déjà 132 px de
haut et s'élargit toute seule — rien à ajouter), le titre, une phrase, et un bouton
« Appliquer » désactivé quand c'est déjà le template courant. Cliquer passe par le
même `onSettings` que tout le reste : enregistrement automatique, 300 ms de différé,
l'application derrière la modale bascule en direct.

### Suppression de la duplication des sept onglets

`TAB_KEYS` (`PreferencesPreview.tsx:19`) et `tabToKey` (`PreferencesPanel.tsx:38`)
sont deux copies de la même table. **Exporter `TAB_KEYS` et
`ORDRE_USINE = Object.keys(TAB_KEYS)` depuis `PreferencesPreview.tsx`**, supprimer
`tabToKey`, et importer des deux autres fichiers. Pas de cycle : `PreferencesPreview`
n'importe rien des sections.

## Découpage des fichiers

`PreferencesPanel.tsx` fait déjà **902 lignes** — au-delà de la limite de 800 de
`CLAUDE.md` avant même d'ajouter quoi que ce soit. Quatre fichiers plats :

| Fichier | Nature | ~lignes |
|---|---|---|
| `app/src/PreferencesPanel.tsx` | coquille + `SectionGeneral` (thème/langue/densité) + `SectionInterface` (onglets + terminal, `deplacerOnglet`, `basculerOnglet`, `CarteDisposition`) | 520 |
| `app/src/PreferencesProfils.tsx` | **neuf** — `PROFILS`, `appliquerProfil`, `profilCourant`, `SectionProfils` | 180 |
| `app/src/PreferencesProjet.tsx` | **neuf** — `SectionActions`, `SectionDemarrage`, `SectionAvance` déplacées telles quelles | 250 |
| `app/src/ClaudeConfigPanel.tsx` | `ConfigClaudeModal.tsx` renommé : le corps devient `SectionClaude`, le cadre de modale disparaît | 380 |

`SkillsPanel.tsx` : **`SkillsModal` supprimé** (lignes 152-244). `SkillsList` et
`useSkills` restent — `EquipmentPanel.tsx` s'en sert, et `SectionClaude` va s'en
servir aussi.

## La section Claude Code

Le corps de l'ancienne modale, sans son cadre : la bande de six sous-onglets
(`ConfigClaudeModal.tsx:94-118`) et les six vues restent telles quelles. Un seul
changement de fond — **le sous-onglet « Skills » devient actif** :

- aujourd'hui `<SkillsList skills={skills} choisis={[]} onChoisis={() => {}} />`
  (`ConfigClaudeModal.tsx:125`) : les cases sont là, elles ne font rien ;
- demain le `useSkills()` de `SkillsPanel.tsx:112` et le bouton d'installation
  repris de `SkillsModal` (lignes 219-240), qui appelle `installSkills(choisis)`.

C'est le seul endroit qui reste pour installer un skill hors initialisation, et le
rappel de la barre latérale disparaît avec son bouton.

Le `useEffect` d'`Échap` de la modale (`ConfigClaudeModal.tsx:25-32`) part : la
coquille des préférences a déjà le sien (`PreferencesPanel.tsx:769-777`), et deux
gestionnaires fermeraient deux choses d'un coup.

Le chargement (`fetchConfigClaude` + `fetchSkills`) reste dans la section, pas dans
la coquille : ouvrir les préférences pour changer le thème ne doit pas lire
`~/.claude/` au passage.

## `App.tsx`

- `Sidebar` perd `skillsOuverts`, `configOuverte`, les deux boutons (lignes 855-862
  et 876-883) et les deux rendus de modale (885-886).
- Les imports `SkillsModal` et `ConfigClaudeModal` (lignes 25-26) partent.
- Reste le seul bouton « ⚙ Préférences », qui appelle `onOpenPreferences` déjà en place.

## i18n (`hooks/i18n.js`, **fr et en**)

Nouvelles : `pref.profiles` · `pref.profiles_desc` · `pref.profile_apply` ·
`pref.profile_current` · `pref.profile_complet` · `pref.profile_complet_desc` ·
`pref.profile_sobre` · `pref.profile_sobre_desc` · `pref.profile_revue` ·
`pref.profile_revue_desc` · `pref.profile_dev` · `pref.profile_dev_desc` ·
`pref.interface` · `pref.claude` · `pref.project`.

Supprimées : `pref.group_settings` · `pref.group_project` · `sidebar.skills` ·
`sidebar.claude_config` · `skills.title` · `skills.close` (le cadre de modale part).
Vérifier chaque suppression par un `grep` avant de la faire — `skills.*` sert aussi
à `SkillsList`.

`app/src/i18n.test.ts` : la liste des clés est écrite à la main (lignes 9-76) et
c'est elle qui attrape une traduction anglaise oubliée. L'ajuster dans les deux sens.
`hooks/i18n.d.ts` suit.

## Tests (`node:test` / `node:assert`, aucun framework)

**`app/src/prefs.test.tsx`** (existe, 172 lignes) — la liste `SECTIONS` (l. 111-119)
et les imports changent de fichier ; les cas dégradés `DEGRADES` (l. 122-132) valent
tels quels pour les nouvelles sections. Ajouter :

- `appliquerProfil` : les sept identifiants sont toujours dans `ordre`, y compris
  depuis un `ordre` incomplet ou absent ;
- `appliquerProfil` : `actifs` vaut exactement ceux du template, `terminal.hauteur`
  et `largeur` sont **inchangées**, `theme`/`langue`/`customActions` intacts ;
- `profilCourant` : rend `'complet'` sur les réglages d'usine, `null` dès qu'un
  onglet est décoché ;
- rendu de `SectionProfils` sur chaque cas dégradé (les quatre maquettes doivent se
  dessiner sans lever quand `onglets` est absent).

**`app/src/render.test.tsx`** : `SectionClaude` fait un `fetch` au montage — ne pas
l'ajouter au rendu statique, ou lui passer des données déjà chargées. Vérifier ce
que fait le fichier avant.

## Vérification

1. `pnpm test` puis `pnpm typecheck` (ce dernier ne couvre qu'`app/src`).
2. `pnpm dev` (port 5180) : appliquer « Sobre » → trois onglets, terminal disparu
   de la fenêtre **derrière** la modale ; appliquer « Dev » → terminal en colonne ;
   recharger la page, les réglages tiennent. Vérifier
   `~/.claude/cockpit/settings.json` : `onglets.ordre` porte bien **sept**
   identifiants après chaque application (c'est le rejet silencieux qu'on traque).
3. Section Claude Code : cocher un skill, l'installer, vérifier
   `~/.claude/skills/<nom>/SKILL.md`, et que la pastille passe à « à jour ».
4. `pnpm electron` — **le chemin que le navigateur ne teste pas** : le protocole
   `cockpit://` n'a ni CORS ni `Origin`. Revérifier que `POST /api/settings` et
   `POST /api/skills` passent, et `⌘,` depuis le menu.
5. `pnpm package` en fin de lot.

## Avant de commencer

- **L'arbre de travail porte le lot « installation d'un projet en un écran »**, non
  commité (`EquipmentPanel.tsx`, `hooks/i18n.js`, `server/api.js`, `hooks/install.js`…),
  et une autre session travaille dessus en ce moment. Ce plan touche `hooks/i18n.js`
  et `app/src/i18n.test.ts` — les mêmes fichiers. **Commiter ce lot d'abord.**
- Deux plans sont ouverts dans `cockpit/plans/` et `.active-plan` pointe sur celui de
  l'installation : `pnpm cockpit:close` avant d'attaquer, sinon les commits de
  celui-ci se rattachent au précédent.
