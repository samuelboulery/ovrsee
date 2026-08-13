---
{
  "status": "closed",
  "title": "Refonte de l'écran des préférences",
  "opened": "2026-08-10",
  "closed": "2026-08-13",
  "commits": []
}
---

# Refonte de l'écran des préférences

## Contexte

`app/src/PreferencesPanel.tsx` (684 lignes) est une colonne de 560 px qui empile cinq
sections sans hiérarchie : cases à cocher pour les onglets, boutons radio pour le thème,
`<select>` pour la disposition du terminal, `<details>` pour l'avancé. On ne voit pas
l'effet d'un réglage avant d'avoir cliqué « Enregistrer » et fermé la modale.

Trois manques concrets, en plus de la forme :

- **`langue` n'a aucun contrôle.** Le champ existe dans `hooks/settings.js:33`, il est
  validé (`fr`/`en`), `electron/menu.js:12-15` documente même que « l'écran des
  préférences le dit à l'utilisateur » — mais rien ne permet de le changer.
- **`onglets.ordre` n'a aucun contrôle.** Le champ est lu par `activeTabsInOrder()`
  (`app/src/App.tsx:93`) et validé (`hooks/settings.js:131`), mais l'interface ne sait
  que cocher/décocher, jamais réordonner.
- **Pas d'entrée « Préférences » dans le menu natif.** `electron/menu.js` n'en a pas, et
  l'état d'ouverture de la modale est enfermé dans `Sidebar` (`App.tsx:771`), hors de
  portée du gestionnaire `menu.on(...)` qui vit dans `App` (`App.tsx:329-359`).

Un bug silencieux au passage : `packageManager` est un champ texte libre
(`PreferencesPanel.tsx:522`) alors que `validateSettings` n'accepte que
`pnpm|npm|yarn|bun` (`hooks/settings.js:100`) — toute autre saisie est écrite, refusée à
la relecture, et retombe au défaut sans le dire.

**Résultat visé** : un vrai écran de paramètres à barre latérale, calqué sur les réglages
de Claude Desktop, avec enregistrement automatique, un sélecteur d'onglets qui bascule
*et* réordonne, une maquette miniature qui montre le résultat en direct, un interrupteur
de thème à trois états iconique, et l'entrée `Préférences… ⌘,` dans le menu natif macOS.

## Décisions arrêtées

| Point | Choix |
|---|---|
| Enregistrement | **Automatique**, debounce 300 ms. Plus de boutons Enregistrer/Annuler — une croix de fermeture. |
| Sélecteur d'onglets | **Bascules + réordonnancement** : glisser-déposer HTML5 natif *et* boutons ↑↓ pour le clavier. |
| Aperçu en direct | **Maquette miniature de la fenêtre** (barre de titre, sidebar, onglets, terminal), partagée par les sections Onglets et Terminal. |

## Architecture

### Découpage des fichiers

`PreferencesPanel.tsx` fait déjà 684 lignes ; avec la maquette et le réordonnancement il
dépasserait la limite de 800 de `CLAUDE.md`. Trois fichiers plats, dans le style existant
d'`app/src` (pas de sous-dossier — `tabs/` est le seul, et il regroupe des onglets) :

- **`app/src/PreferencesControls.tsx`** (~170 l.) — les primitives réutilisables :
  `Switch` (`<button role="switch" aria-checked>`), `Segmented` (enveloppe des classes
  Nocturne `.seg` / `.seg-opt`, déjà thémées avec l'accent et `:focus-visible`),
  `Row` (libellé à gauche / contrôle à droite, filet `--color-divider` entre les lignes,
  exactement la grammaire de la capture Claude Desktop), `SectionTitle`, et les trois
  icônes de thème en SVG inline (Phosphor `monitor` / `sun` / `moon`, `currentColor`,
  16 px — pas de dépendance, cf. `readme.md` du DS qui prescrit Phosphor).
- **`app/src/PreferencesPreview.tsx`** (~130 l.) — la maquette miniature. Des `div` sur
  les jetons du thème courant : barre de titre 6 px, sidebar, barre d'onglets rendue à
  partir de `ordre` × `actifs` (l'onglet actif porte le même
  `box-shadow: inset 0 -2px 0 var(--color-accent)` que la vraie nav, `App.tsx:464`),
  zone de contenu, et le terminal placé selon `disposition` (`bottom` / `side` / `full`)
  ou absent si `visible` est faux. Prop `highlight?: 'tabs' | 'terminal'` pour souligner
  la zone que la section courante manipule.
- **`app/src/PreferencesPanel.tsx`** (réécrit, ~450 l.) — la coquille (barre latérale de
  navigation + panneau) et le corps de chaque section.

### La coquille

```
┌──────────────┬──────────────────────────────────┐
│  PARAMÈTRES  │  Apparence                   [×] │
│  Général     │                                  │
│  Apparence   │  Thème            [🖵][☀][☾]     │
│  Onglets     │  ───────────────────────────────  │
│  Terminal    │  Langue           Français   ▾   │
│  Activité    │                                  │
│              │                                  │
│  PROJET      │                                  │
│  Actions     │                                  │
│  Démarrage   │                                  │
│  Avancé      │                                  │
└──────────────┴──────────────────────────────────┘
```

- Boîte `width: min(860px, 100%); height: min(600px, 100%)`, sur le fond estompé déjà
  utilisé (`rgba(6,7,14,.88)` + `backdrop-filter: blur(3px)`, `PreferencesPanel.tsx:610`).
- Barre latérale ~200 px, `--theme-bg-tertiary`, deux groupes titrés en capitales
  espacées (même traitement que `sidebar.projects`, `App.tsx:788`). L'item actif prend un
  fond `--color-neutral-900` et le texte `--color-text`.
- Navigation clavier : `role="tablist"` / `role="tab"` sur la barre latérale, ↑↓ pour
  changer de section, `aria-controls` vers le panneau.
- Fermeture : `Échap` (garder l'effet existant, l. 583-591), clic sur le fond, croix.
  Pas de bouton Annuler — il mentirait sur un écran qui enregistre tout seul.

### Enregistrement automatique

```
onChange → setDraft(next)          // état local, immédiat
         → onSettings(next)        // remonte à App : thème, langue, onglets, terminal
                                   // s'appliquent à l'écran derrière la modale
         → debounce 300 ms → updateSettings(next)   // écriture disque
```

- Le motif du debounce existe déjà pour la taille du terminal (`App.tsx:252-268`) — le
  reprendre tel quel (`useEffect` + `setTimeout` + nettoyage).
- `onSettings` est déjà branché : `App.tsx:414-417` fait `setSettings` +
  `setCurrentLanguage`, et l'effet `App.tsx:236-240` rappelle `applyTheme` quand
  `settings.theme` change. Le thème bascule donc en direct, sans code neuf.
- Un indicateur discret « Enregistré » en pied de panneau (`--color-neutral-600`,
  s'efface après 2 s) — sinon rien ne dit que l'écriture a eu lieu. En cas d'échec,
  l'encart d'erreur existant (bordure `--color-accent-700`) reste affiché tant que la
  dernière écriture a échoué.
- Attention à la boucle : n'écrire que si `draft` diffère de ce que le serveur a rendu.
  `updateSettings` renvoie l'objet validé — le comparer par `JSON.stringify` avant de
  reprogrammer une écriture, comme le fait déjà l'effet de taille du terminal.

## Les sections

### 1. Général
- **Langue** — `Segmented` Français / English. Sous le contrôle, une note grise :
  « Le menu natif suit au prochain lancement. » (c'est exactement ce que documente
  `electron/menu.js:12-15`.)
- **Thème** — `Segmented` à trois options **icône seule**, `aria-label` sur chacune,
  ordre Système / Clair / Sombre (celui de la capture Claude Desktop) : moniteur, soleil,
  lune. Valeurs `auto` / `light` / `dark`, celles que valide `hooks/settings.js:97`.

### 2. Onglets
- `PreferencesPreview` en tête, `highlight="tabs"`.
- Sous la maquette, la liste des sept onglets dans l'ordre de `onglets.ordre` :
  poignée `⠿` (`draggable`, `onDragStart` / `onDragOver` / `onDrop` — API HTML5 native,
  zéro dépendance), libellé via `tabToKey` (déjà écrit, l. 7-15), boutons ↑↓ pour le
  clavier, `Switch` à droite.
- Deux invariants à tenir : au moins un onglet actif (garde déjà présente, l. 122) — le
  `Switch` du dernier actif passe `disabled` avec un `title` explicatif plutôt que d'être
  cliquable sans effet ; et `ordre` doit toujours contenir les sept identifiants, sinon
  `validateSettings` (`hooks/settings.js:135`) rejette le tableau en silence.
- Extraire deux fonctions pures, `deplacerOnglet(ordre, de, vers)` et
  `basculerOnglet(settings, id)` — ce sont elles que le test couvrira.

### 3. Terminal
- `PreferencesPreview`, `highlight="terminal"`.
- **Afficher le terminal** — `Switch`.
- **Disposition** — trois cartes cliquables plutôt qu'un `<select>` : chacune dessine un
  rectangle schématique (barre en bas / colonne à droite / plein cadre), libellé dessous
  (`pref.terminal_bottom` / `_side` / `_full`, clés déjà présentes). `role="radiogroup"`.
  Grisées quand le terminal est masqué.

### 4. Activité
- Les cinq crans de `PreferencesDensity` (logique inchangée, l. 30-54), rendus en
  `Segmented` au lieu de boutons `.btn`.

### 5. Actions
- `PreferencesActions` conservé tel quel côté logique (validation, édition, suppression —
  l. 241-304), reposé sur `Row` / `Field`. Les libellés en dur (`'Mes actions'`,
  `'Libellé'`, `'Saisissez un libellé'`…) passent par `t()`.

### 6. Démarrage
- `PreferencesBootstrap` inchangé côté logique (l. 446-499), libellés `BOOTSTRAP_STRINGS`
  déplacés dans `hooks/i18n.js`.

### 7. Avancé
- **Gestionnaire de paquets** — `<select>` `pnpm` / `npm` / `yarn` / `bun` au lieu du
  champ texte : c'est ce que `validateSettings` accepte, et la saisie libre actuelle
  perd silencieusement toute autre valeur.
- **Source de graphe** — `<select>` inchangé, libellés via `t()`.

## Le menu natif

**`electron/menu.js`** — un item, dans le menu applicatif macOS entre « À propos » et
« Services » (position HIG), et sous « Fichier » ailleurs :

```js
{ label: m('menu.preferences'), accelerator: 'CmdOrCtrl+,', click: send('preferences:open') }
```

Rien d'autre : le menu n'exécute pas, il envoie un mot — c'est la règle écrite en tête du
fichier (l. 7-10). Aucun canal IPC neuf, `menu:command` porte déjà tout.

**`app/src/App.tsx`** — remonter l'état :
- `const [preferencesOuverts, setPreferencesOuverts] = useState(false)` passe de `Sidebar`
  (l. 771) à `App`. `Sidebar` reçoit une prop `onOpenPreferences`.
- `<PreferencesModal>` est rendu au niveau d'`App`, plus dans l'`<aside>` (l. 859-861) :
  une modale `position: fixed` dans la barre latérale marche par accident, pas par
  conception.
- Dans `menu.on(...)` (l. 333) : `if (command === 'preferences:open') return setPreferencesOuverts(true)`.
- Raccourci ⌘, aussi hors Electron : un `keydown` global dans `App`, comme celui de la
  modale pour `Échap`.

## i18n

Nouvelles clés dans `hooks/i18n.js`, **fr et en** (le test `i18n.test.ts` vérifie que les
deux dictionnaires ont les mêmes clés — y ajouter la liste) :

`menu.preferences` · `pref.title` · `pref.group_settings` · `pref.group_project` ·
`pref.general` · `pref.appearance` · `pref.activity` · `pref.actions` · `pref.startup` ·
`pref.advanced` · `pref.language` · `pref.language_note` · `pref.tabs_hidden` ·
`pref.tabs_last_active` · `pref.move_up` · `pref.move_down` · `pref.saved` ·
`pref.package_manager` · `pref.graph_source` · `pref.graph_auto` · `pref.graph_graphify` ·
`pref.graph_obsidian` · `pref.actions_title` · `pref.actions_label` · `pref.actions_text` ·
`pref.actions_add` · `pref.actions_update` · `pref.actions_cancel` · `pref.actions_edit` ·
`pref.actions_delete` · `pref.bootstrap_title` · `pref.bootstrap_desc` ·
`pref.bootstrap_add` · les messages de validation des actions.

## Ce qui est délibérément laissé de côté

- **Champ de recherche** dans la barre latérale (Claude Desktop en a un) : sept sections
  toutes visibles d'un coup, il ne trouverait rien qu'on ne voie déjà. À ajouter si la
  liste dépasse la douzaine.
- **Aperçu du thème dans la maquette** : avec l'enregistrement automatique, l'application
  entière derrière la modale *est* l'aperçu du thème. Faire vivre un thème différent dans
  un `<div>` imbriqué demanderait d'élargir les sélecteurs `:root[data-theme=…]` de
  `app/src/theme.ts` — du travail pour montrer deux fois la même chose.
- **Reconstruction à chaud du menu natif** au changement de langue : arbitré non dans
  `electron/menu.js:12-15`, l'écran le dit maintenant explicitement.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `app/src/PreferencesPanel.tsx` | réécrit (coquille + sections) |
| `app/src/PreferencesControls.tsx` | neuf (Switch, Segmented, Row, icônes) |
| `app/src/PreferencesPreview.tsx` | neuf (maquette miniature) |
| `app/src/App.tsx` | état de la modale remonté, `preferences:open`, ⌘, |
| `electron/menu.js` | item Préférences |
| `hooks/i18n.js` | clés fr + en |
| `app/src/i18n.test.ts` | clés ajoutées à la liste vérifiée |
| `app/src/prefs.test.tsx` | neuf |

## Vérification

Pas de framework — `node:test` et `node:assert`, comme le reste (`CLAUDE.md`).

1. **`app/src/prefs.test.tsx`** (neuf), sur le modèle de `render.test.tsx` :
   - `deplacerOnglet` : déplacement vers le haut, vers le bas, aux deux bornes, et
     l'invariant « les sept identifiants sont toujours là ».
   - `basculerOnglet` : activation, désactivation, refus de désactiver le dernier actif.
   - `renderToStaticMarkup` de chaque section sur un `SettingsType` complet, plus les cas
     dégradés qui cassent aujourd'hui : `customActions` absent, `bootstrap` absent,
     `onglets.ordre` incomplet.
   - `PreferencesPreview` rendu pour les trois dispositions et pour `visible: false`.
2. **`app/src/i18n.test.ts`** : les nouvelles clés ajoutées à la liste — c'est le test qui
   attrape une traduction anglaise oubliée.
3. `pnpm test` puis `pnpm typecheck` (celui-ci ne couvre qu'`app/src`, donc `menu.js`
   n'est vérifié qu'à l'exécution).
4. `pnpm dev` (port 5180) — la modale, l'enregistrement automatique, la maquette qui suit
   le glisser-déposer, la bascule de thème. Recharger la page : les réglages sont
   toujours là.
5. `pnpm electron` — **le chemin qui n'est pas testé par le navigateur** : le protocole
   `cockpit://` n'a ni CORS ni `Origin`, donc revérifier que le `POST /api/settings`
   passe. Puis ⌘, depuis le menu **Cockpit → Préférences…**, et l'entrée présente et
   traduite quand `langue` vaut `en` (après relance).
6. Vérifier `~/.claude/cockpit/settings.json` après coup : `langue`, `theme`,
   `onglets.ordre` réordonné, `packageManager` — et qu'aucun champ n'est retombé au défaut
   (signe d'un rejet silencieux de `validateSettings`).
7. `pnpm package` en fin de lot, comme d'habitude.
