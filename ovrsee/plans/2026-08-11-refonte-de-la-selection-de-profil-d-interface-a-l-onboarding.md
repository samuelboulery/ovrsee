---
{
  "status": "open",
  "title": "Refonte de la sélection de profil d'interface à l'onboarding",
  "opened": "2026-08-11",
  "closed": null,
  "commits": [
    {
      "sha": "c0b34f7",
      "date": "2026-08-11",
      "files": [
        "app/src/App.tsx",
        "app/src/Onboarding.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/data.ts",
        "app/src/onboarding.test.tsx",
        "app/src/prefs.test.tsx",
        "app/src/profilage.ts",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/settings.js"
      ]
    }
  ]
}
---

# Refonte de la sélection de profil d'interface à l'onboarding

## Contexte

L'écran 2 de l'onboarding (`EcranProfil` dans `app/src/Onboarding.tsx:238-324`) pose
deux questions — « Comment lancez-vous Claude Code ? » (usage) et « Depuis combien de
temps ? » (niveau) — puis les combine via une matrice cachée
(`profilSuggere(niveau, usage)` dans `app/src/profilage.ts:41-46`) pour choisir un des
quatre profils nommés (`complet`/`sobre`/`revue`/`dev`, définis dans
`app/src/PreferencesProfils.tsx:37-66`). Le résultat s'affiche ensuite dans une galerie
de profils (`SectionProfils`) sous les deux questions, comme filet de rattrapage pour
écraser la suggestion.

Le problème signalé : rien ne relie visiblement la réponse « Depuis combien de temps ? »
au nombre d'onglets montrés — le niveau d'expérience Claude Code sert de proxy opaque à
un choix de surface d'interface. L'utilisateur ne comprend pas pourquoi tel niveau donne
tel profil.

Décision retenue (validée avec l'utilisateur) : garder la question usage — elle pilote
déjà directement et visiblement la place du terminal, c'est une question logique — et
remplacer la question niveau par la galerie de profils elle-même, promue au rang de
question 2. On clique une carte, c'est le profil : plus de matrice à deviner.

Second volet : les gens sans usage de terminal (réponse `desktop` ou `autre`) doivent
avoir le terminal **complètement désactivé**, pas juste masqué. Aujourd'hui, masquer le
terminal (`terminal.visible = false`) laisse une pastille « Terminal · claude » cliquable
en bas de l'app (`app/src/App.tsx:734-751`) avec une session `node-pty` qui tourne déjà en
fond — ce filet doit disparaître entièrement pour ce cas, réactivable seulement depuis
Préférences.

## Ce qui change

### 1. `app/src/profilage.ts` — simplifier la logique de suggestion

- Supprimer `Niveau`, `NIVEAUX`, `bootstrapPourNiveau`.
- `Reponses` perd `niveau` :
  ```ts
  export type Reponses = { usage: Usage; profil: string; bootstrap: boolean }
  ```
- `profilSuggere` ne dépend plus que de l'usage (règle simple, la galerie fait le reste) :
  ```ts
  export function profilSuggere(usage: Usage): string {
    const avecTerminal = usage === 'terminal' || usage === 'ide'
    return avecTerminal ? 'complet' : 'sobre'
  }
  ```
- `terminalPourUsage` gagne `disabled` — c'est la seule source du vrai disable :
  ```ts
  export function terminalPourUsage(usage: Usage): { visible: boolean; disposition?: string; disabled: boolean } {
    if (usage === 'terminal') return { visible: true, disposition: 'side', disabled: false }
    if (usage === 'ide') return { visible: true, disposition: 'bottom', disabled: false }
    return { visible: false, disabled: true }
  }
  ```
  `appliquerReponses` spread déjà tout l'objet retourné dans `settings.terminal`
  (`profilage.ts:93`) — `disabled` traverse sans autre changement à cette fonction.
- `reponsesInitiales` : reprend le profil courant s'il matche un des 4 (réutiliser
  `profilCourant` déjà importé côté `Onboarding.tsx`, ou l'importer ici), sinon
  `profilSuggere(usage)`. `bootstrap` devient une valeur statique (`true`) — le réglage
  reste un switch explicite et indépendant à l'écran 3 (`Onboarding.tsx:380-386`,
  inchangé), il n'a plus besoin d'un niveau pour se pré-cocher.
- `claude.niveau` dans les settings n'est plus écrit par l'onboarding (retiré de l'objet
  `claude: {...}` en profilage.ts:95, ne garder que `usage`). Le champ reste défini côté
  `hooks/settings.js` (défaut + validation inchangés) : il devient inerte mais son
  retrait de `DEFAULT_SETTINGS`/`validateSettings` n'est pas nécessaire pour cette
  demande — hors périmètre.

### 2. `app/src/Onboarding.tsx` — `EcranProfil` redessiné

- Retirer le bloc `Segmented` niveau (lignes 283-303) et l'import `NIVEAUX`/`Niveau`.
- Le clic sur une carte usage (lignes 262-279) ne recalcule plus le profil via
  `profilSuggere(reponses.niveau, usage)` mais `profilSuggere(usage)`.
- La galerie `SectionProfils` (actuellement lignes 312-321, sous les deux questions)
  devient la question 2 à part entière : lui donner un intitulé
  (`onboard.profile_question`, nouvelle clé) au même niveau visuel que
  `onboard.usage_question`, et la positionner comme le pendant direct de la colonne
  usage — pas comme un rattrapage après coup.
- Garder `PreferencesPreview` + `Consequence` (lignes 305-308) : aperçu live toujours
  utile, indépendamment de la disparition du niveau.
- Layout : la grille 2 colonnes actuelle (usage à gauche, niveau+preview à droite) devient
  usage + preview/consequence en haut, galerie de profils en pleine largeur en dessous
  (la galerie a besoin de largeur pour ses cartes avec aperçu — cf. déjà le commentaire
  `Onboarding.tsx:476-478` sur la hauteur de la modale prévue pour elle).

### 3. i18n — `hooks/i18n.js`

- Supprimer (FR bloc ~`hooks/i18n.js:222-226`, EN bloc ~`904-908`) :
  `onboard.level_question`, `onboard.level_debutant`, `onboard.level_intermediaire`,
  `onboard.level_avance`, `onboard.level_expert`.
- Ajouter `onboard.profile_question` : FR « Quelle vue voulez-vous ? », EN « Which view
  do you want? » (à côté de `onboard.usage_question`, ligne ~213 FR / ~895 EN).

### 4. Terminal réellement désactivable

**`app/src/data.ts:329`** — ajouter `disabled: boolean` au type `terminal` de
`SettingsType`.

**`hooks/settings.js`** :
- `DEFAULT_SETTINGS.terminal` (ligne ~... voir bloc terminal) : ajouter `disabled: false`.
- `validateSettings` (bloc terminal, lignes 164-177) : ajouter la coercition
  `if (typeof partial.terminal.disabled === 'boolean') out.terminal.disabled = partial.terminal.disabled`.

**`app/src/App.tsx`** — gater tout le bloc terminal (panneau monté ET pastille réduite)
derrière `!settings.terminal?.disabled` :
- Ligne 718 : `{terminal && !settings.terminal?.disabled && (<Terminal .../>)}`
- Ligne 734 : `{!terminal && !settings.terminal?.disabled && (<div>...pastille...</div>)}`

Effet : si `disabled`, ni le panneau ni la pastille ne s'affichent — aucun appel à
`setTerminal(true)` n'est jamais possible depuis l'app, donc `useTerminal`/`bridge.open()`
n'est jamais déclenché et aucune session `node-pty` ne démarre. Pas besoin de gater l'IPC
côté `electron/pty.js` : l'absence d'UI suffit puisque c'est le seul point d'entrée.

**`app/src/PreferencesPanel.tsx` (`SectionInterface`, lignes ~276-446)** — quand
`terminal.disabled === true`, remplacer le switch + les 3 cartes de disposition par un
bloc compact : texte expliquant que le terminal a été désactivé à la présentation, et un
bouton/switch « Activer le terminal » qui écrit
`{ ...terminal, disabled: false, visible: true }`. Sinon (cas actuel, `disabled` absent ou
`false`), UI inchangée — le switch « Afficher le terminal » existant continue de piloter
seulement `visible` (comportement « réduit, session vivante » préservé pour qui l'utilise
ponctuellement).

### 5. Tests à mettre à jour

- `app/src/onboarding.test.tsx` : seul fichier de test référençant
  `profilage`/`profilSuggere`/`NIVEAUX`/`bootstrapPourNiveau`/`reponses.niveau` — adapter
  les scénarios au flow à 2 questions (usage + galerie), ajouter un cas vérifiant que
  répondre `usage: 'desktop'` ou `'autre'` produit `terminal.disabled === true` (au lieu
  de seulement `visible === false`, déjà couvert lignes 108/120).
- `app/src/prefs.test.tsx` : ajouter un cas pour l'état désactivé de `SectionInterface`
  (bouton « Activer » remet `disabled: false, visible: true`), garder l'assertion
  existante sur `terminal.visible` (ligne ~212) pour le cas non désactivé.

## Vérification

1. `pnpm typecheck` — le retrait de `Niveau`/`NIVEAUX` et l'ajout de `disabled` sur
   `SettingsType.terminal` doivent passer sans erreur résiduelle dans `app/src`.
2. `pnpm test` — couvre `hooks/settings.js` (validation `terminal.disabled`),
   `onboarding.test.tsx`, `prefs.test.tsx`.
3. `pnpm electron` — parcourir l'onboarding : répondre `desktop`/`autre` à la question
   usage, vérifier qu'aucune pastille terminal n'apparaît en bas de l'app une fois
   l'onboarding terminé ; répondre `terminal`/`ide`, vérifier que le terminal s'ouvre
   normalement. Puis Préférences → Interface : vérifier que le cas désactivé montre le
   bouton « Activer le terminal » et que l'activer restaure le switch normal.
