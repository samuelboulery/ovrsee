---
{
  "status": "open",
  "title": "Issue #79 — commandes du terminal : portée, libellés, visibilité, rétraction",
  "opened": "2026-08-31",
  "closed": null,
  "commits": [
    {
      "sha": "40bdb70",
      "date": "2026-08-31",
      "files": [
        "app/src/App.tsx",
        "app/src/PreferencesPanel.tsx",
        "app/src/PreferencesProjet.tsx",
        "app/src/Terminal.tsx",
        "app/src/brief.ts",
        "app/src/data.test.ts",
        "app/src/data.ts",
        "hooks/i18n.js",
        "hooks/settings.js",
        "hooks/settings.test.js"
      ]
    }
  ]
}
---

# Issue #79 — commandes du terminal : portée, libellés, visibilité, rétraction

## Contexte

L'issue #79 (Floriane) remonte trois gênes sur la bande de commandes du panneau
terminal, déjà cadrées dans `ovrsee/tickets/T-0216-*.md` :

1. **Le libellé ment.** Le tri entre « Commandes » et « Contexte pour Claude »
   est purement syntaxique (`decideInjection`, `app/src/brief.ts:134`) : un
   `pnpm run dev` sans `!` se range sous « Contexte pour Claude », ce qu'il
   n'est pas.
2. **La portée ment aussi.** Les actions se saisissent dans les préférences,
   section « Projet », mais `customActions` vit dans
   `~/.claude/ovrsee/settings.json` et est **globale** : `mergeSettings`
   (`hooks/settings.js:221`) ne la recopie pas. Il n'existe aucune action
   propre à un projet.
3. **La fonctionnalité est invisible.** Rien dans le panneau ne dit qu'on peut
   en ajouter.

S'y ajoute une demande de cette session : **pouvoir rétracter la bande de
commandes** (268 px à droite du xterm, `Terminal.tsx:791-912`), rendue
inconditionnellement aujourd'hui.

**Contrainte non négociable** (T-0216, issue #70) : les actions de projet ne
passent **pas** par `ovrsee.config.json`, versionné donc fourni par le dépôt
observé. Elles vivent dans le fichier hors dépôt, indexées par chemin — comme
`trust.json` et `integrations.json`.

## Décisions prises avec l'utilisateur

- **Une seule liste** dans le panneau, plus deux sections. Chaque action porte
  une pastille : `▷` exécutée au clic, `✎` écrite sans envoyer.
- **Deux listes séparées** dans les préférences : « Actions de ce projet » et
  « Actions globales ».
- **Rétraction = un seul booléen** en `localStorage`, comme la barre latérale.

## Le travail

### 1. Modèle : `projectActions` indexé par chemin — `hooks/settings.js`

- `DEFAULT_SETTINGS.projectActions = {}` (l. 33-61) + entrée dans le doc-schéma.
- `validateSettings` (l. 138) : nouveau bloc, une entrée par clé dont la valeur
  est un tableau, chaque action filtrée par **le même prédicat** que
  `customActions` (l. 171-182) — `label`/`text` non vides, pas de `\n`. Extraire
  ce prédicat en `actionValide(action)` plutôt que le dupliquer ; une clé dont
  la valeur n'est pas un tableau est ignorée, comme partout ailleurs ici.
- `mergeSettings` (l. 221) : **ne rien ajouter**. Le laisser tel quel est le
  critère d'acceptation — un test doit le prouver, pas un commentaire.
- Aucune migration : les `customActions` existantes restent lues telles quelles
  et deviennent les actions globales.

### 2. Composition — `app/src/brief.ts`

- `buildActions(snapshot, settings)` (l. 179) : concatène
  `deliveredActions` + `settings.customActions` + `settings.projectActions?.[snapshot.root]`.
  Le refus des multilignes (l. 184-191) reste tel quel et s'applique aux deux.
- Chaque action rendue porte son mode : réutiliser `decideInjection(text).mode`
  au lieu de le recalculer dans le composant. Le type `Action` de
  `app/src/data.ts:231` gagne un `scope?: 'projet' | 'global'` pour la puce des
  préférences ; le panneau, lui, n'affiche que le mode.
- `deliveredActions` (l. 165) ne bouge pas : la palette ⌘K
  (`CommandPalette.tsx:118`) continue de ne proposer que les commandes livrées.

### 3. Panneau : liste unique + bouton créer + rétraction — `app/src/Terminal.tsx`

- **Liste unique** : remplacer les deux blocs (l. 813-882) par une seule liste
  titrée `terminal.actions_section`, chaque bouton précédé d'un glyphe de mode
  (`Play` / `PencilSimple` de `@phosphor-icons/react`, taille 14, couleur
  `--color-text-quaternary` pour ne pas concurrencer l'icône d'accent des
  commandes livrées, cf. `icones` l. 32). Les erreurs (l. 840-856) et le bloc
  « Recharger l'affichage » (l. 885-903) restent où ils sont.
- **Bouton « + Créer une commande »** sous la liste : nouvelle prop
  `onOpenPreferences?: () => void`, câblée dans `App.tsx` comme celle d'`Apercu`
  (`App.tsx:602-605`) — `setPreferencesInitial({ section: 'projet' })` puis
  `setPreferencesOuvertes(true)`.
- **Rétraction** : état local au panneau, lu et écrit en `localStorage` sous
  `ovrsee.terminal.actions`, `try/catch` des deux côtés, défaut « ouverte » —
  copie littérale du motif `sidebarOuverte` d'`App.tsx:127-146`. Le rendu de la
  bande (l. 791-912) devient conditionnel ; le bouton bascule va dans la barre
  d'en-tête, **avant l'épingle** (l. 696-718), en `className="btn-icon"` avec
  `aria-pressed` — mêmes attributs que l'épingle. Icône `SidebarSimple`
  (`weight="fill"` quand la bande est ouverte, `regular` sinon).

### 4. Préférences : deux blocs — `app/src/PreferencesProjet.tsx`

- `BlocActions` (l. 29-183) est déjà un composant autonome : le paramétrer par
  `{ actions, onActions, titre, aide }` et le monter deux fois — une fois sur
  `settings.customActions`, une fois sur
  `settings.projectActions?.[root] ?? []`. `root` est déjà une prop de
  `SectionProjet` (`PreferencesPanel.tsx:474, 606`).
- Le bloc « ce projet » ne s'affiche pas sans `root`.
- Corriger le doc-comment du fichier (l. 1-13) : il affirme que ces réglages
  sont ceux qu'`ovrsee.config.json` peut surcharger, ce qui n'a jamais été vrai
  des actions et le sera encore moins.

### 5. Libellés — `hooks/i18n.js` (FR l. 690-703, EN l. 1470+)

- Retirer `terminal.commands_section` et `terminal.context_section`.
- Ajouter `terminal.actions_section` (« Mes commandes » / « My commands »),
  `terminal.mode_run` / `terminal.mode_paste` (infobulles des pastilles),
  `terminal.create_action`, `terminal.actions_hide` / `terminal.actions_show`.
- Ajouter `pref.actions_project_title` / `_desc` et
  `pref.actions_global_title` / `_desc`, et réécrire `pref.actions_desc`
  (l. 117) qui parle encore de l'onglet Aperçu.
- Les deux tables doivent rester alignées : `hooks/i18n.test.js` le vérifie.

## Tests (`pnpm test` — `node:test`/`node:assert`, aucun framework)

- `hooks/settings.test.js` : `projectActions` valide/invalide (valeur non
  tableau, action multiligne, label vide) ; **`mergeSettings` ignore un
  `projectActions` posé dans `ovrsee.config.json`** — c'est le critère
  d'acceptation qui compte ; les `customActions` d'un profil existant survivent.
- `app/src/data.test.ts` (l. 497-608) : `buildActions` inclut les actions du
  projet ouvert et **pas celles d'un autre chemin** ; le refus multiligne vaut
  pour les deux listes ; le mode rendu est `command` pour `!`/`/` et `context`
  sinon.
- Rétraction : pas de test de rendu — `render.test.tsx` exclut délibérément le
  panneau terminal (xterm n'existe pas hors navigateur). Si la logique de
  lecture/écriture mérite un filet, la sortir dans un module minuscule testable
  au `stubStorage()` de `terminalPins.test.ts:52`.

## Vérification

1. `pnpm lint && pnpm typecheck && pnpm test` — vert.
2. `pnpm electron` (le terminal n'existe pas sous `pnpm dev`) :
   - la bande montre une liste unique, pastilles `▷` / `✎` conformes ;
   - le bouton de la barre d'en-tête rétracte et rouvre la bande ; fermer et
     relancer l'app la retrouve dans le même état ;
   - « + Créer une commande » ouvre les préférences sur la section Projet ;
   - une action créée dans « ce projet » apparaît dans le panneau, **disparaît**
     en changeant de projet ; une action globale suit partout ;
   - vérifier les trois dispositions (`bottom`, `side`, `full`) : en `side` la
     bande est un bandeau bas, la rétraction doit y valoir aussi.
3. `cat ~/.claude/ovrsee/settings.json` : `projectActions` indexé par chemin,
   `customActions` intacte.
4. Poser `"projectActions": {"/": [{"label":"x","text":"x"}]}` dans
   `ovrsee.config.json` du dépôt et recharger : **rien ne doit apparaître**.

## Suites du ticket

`ovrsee/tickets/T-0216-*.md` : `colonne` → `en-cours` au démarrage via le skill
`ovrsee-tickets`, et cocher les critères d'acceptation à la livraison. Commit
citant `T-0216` et `#79`.
