---
{
  "status": "open",
  "title": "Réparer le réglage « système » du thème dans Electron",
  "opened": "2026-09-01",
  "closed": null,
  "commits": []
}
---

# Réparer le réglage « système » du thème dans Electron

## Contexte

Vérification demandée : le mode clair/sombre suit-il vraiment le poste quand le
réglage vaut `system` (le défaut de `hooks/settings.js:41`) ?

**Dans le navigateur (`pnpm dev`) : oui.** `useThemeMode` → `applyTheme` résout
par `matchMedia('(prefers-color-scheme: light)')`, `watchSystemTheme` s'abonne à
la même requête, et `window.ovrsee` n'existe pas.

**Dans Electron (`pnpm electron`) : non — le suivi se fige au premier paint.**
La chaîne se mord la queue :

1. `applyTheme` (`app/src/theme.ts:122`) résout `system` → `dark`/`light`, puis
   envoie la valeur **résolue** à `window.ovrsee.app.setTheme(mode)`.
2. `app:theme` (`electron/main.js:683`) fait
   `nativeTheme.themeSource = resolu` — jamais `'system'`.
3. Or `themeSource` forcé **surcharge `prefers-color-scheme` dans tous les
   rendus** (documenté par Electron). La requête média du rendu ne reflète plus
   le poste mais ce que le rendu vient d'y écrire.
4. Conséquence : basculer macOS clair↔sombre pendant que l'app tourne ne fait
   plus rien. L'écouteur de `watchSystemTheme` est bien posé, mais l'événement
   `change` n'arrive jamais. Le thème ne bouge qu'au redémarrage
   (`themeSource` n'est pas persisté).

Second point de blocage, même effet : `preview:devtools`
(`electron/main.js:611`) force lui aussi `themeSource` à la valeur résolue que
lui passe `appTheme()`. Ouvrir les DevTools de l'onglet Navigateur figerait le
suivi même après correction du point 1.

Résultat visé : sous `system`, l'app, sa chrome native et son terminal suivent
le poste à chaud, sans redémarrage.

## Correctif

**Principe : le rendu envoie le RÉGLAGE, plus le thème résolu. Le principal est
l'autorité sur `system` — c'est `nativeTheme` qui sait.** Cela retourne le
contrat documenté dans `CLAUDE.md` (« le rendu envoie une valeur déjà
résolue »), justement parce que sa résolution dépend de ce qu'il vient
d'écrire.

### 1. `app/src/theme.ts`

- Ajouter une fonction pure exportée, testable sans DOM :
  ```ts
  /** Ce qui part à Electron : le réglage, pas le thème résolu. */
  export const themeSourcePour = (pref: string | undefined): ThemePref =>
    pref === 'light' || pref === 'dark' ? pref : 'system'
  ```
- `applyTheme` : `window.ovrsee?.app?.setTheme?.(themeSourcePour(pref))` au lieu
  du `mode` résolu.
- Le rappel de `watchSystemTheme` dans `useThemeMode` (ligne ~160) rappelle
  `setTheme('system')` — inutile pour `themeSource` (déjà `system`), mais c'est
  ce qui fait repeindre le `backgroundColor` de la fenêtre au changement de
  poste. Un commentaire d'une ligne le dit.
- `resolveTheme`, `getTerminalTheme`, `appliquerThemeTerminal`, `data-theme` :
  **inchangés** — le rendu continue de résoudre pour lui-même.

### 2. `app/src/pty.ts:86`

Élargir le type : `setTheme?: (pref: 'dark' | 'light' | 'system') => Promise<void>`.

### 3. `electron/main.js` — `app:theme` (ligne 683)

```js
ipcMain.handle('app:theme', (event, pref) => {
  nativeTheme.themeSource = pref === 'light' || pref === 'dark' ? pref : 'system'
  const fond = FONDS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light']
  for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(fond)
})
```
`shouldUseDarkColors` se lit après l'affectation : sous `system` il rend le
poste, sous un choix explicite il rend le choix. Mettre à jour le commentaire
au-dessus (il affirme aujourd'hui l'inverse).

### 4. `electron/main.js` — `preview:devtools` (ligne 611)

Supprimer `nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'` et le
paragraphe de commentaire qui le justifie : `app:theme` couvre déjà les DevTools
(c'est ce que dit déjà le commentaire « redondant depuis `app:theme` »), et
cette ligne re-fige le suivi. Le paramètre `theme` de l'IPC devient inutilisé :
le retirer aussi du preload (`electron/preload.cjs`), de la signature dans
`app/src/pty.ts`, et de l'appel `appTheme()` dans
`app/src/tabs/Navigateur.tsx:374`. `appTheme()`
(`app/src/tabs/navigateur-webview.ts:87`) n'a alors plus d'appelant —
le supprimer (son commentaire est de toute façon périmé : il dit que l'ovrsee
« n'est aujourd'hui que sombre »).

### 5. Test

Dans `app/src/theme.test.ts`, à la suite des tests de `resolveTheme` :

```ts
test('themeSourcePour : « système » part tel quel, sinon Electron fige le suivi', () => {
  assert.equal(themeSourcePour('system'), 'system')
  assert.equal(themeSourcePour(undefined), 'system')
  assert.equal(themeSourcePour('clair'), 'system')
  assert.equal(themeSourcePour('light'), 'light')
  assert.equal(themeSourcePour('dark'), 'dark')
})
```
Avec le commentaire qui dit *pourquoi* : `themeSource` forcé surcharge
`prefers-color-scheme` dans le rendu, donc envoyer la valeur résolue coupait
`watchSystemTheme`. Pas de test côté `electron/main.js` — aucun harnais n'y
instancie Electron (`electron/*.test.js` ne couvre que `crawl` et
`lien-externe`).

### 6. `CLAUDE.md`

Le piège « Le thème se pose en un attribut » dit que le rendu envoie une valeur
résolue. Remplacer par le nouveau contrat et la raison (le `themeSource` forcé
surcharge `prefers-color-scheme`) — c'est exactement le genre de fait
non déductible que le fichier existe pour retenir.

### Écarté

- `nativeTheme.on('updated')` côté principal pour repeindre le fond : le rendu
  rappelle déjà `setTheme` au changement, un écouteur de plus ne sert à rien.
- Envoyer les deux valeurs (réglage + résolu) : le principal recalcule le résolu
  d'une lecture de `shouldUseDarkColors`.

## Vérification

1. `pnpm test` puis `pnpm typecheck` — le nouveau test passe, rien ne casse.
2. `pnpm electron`, Préférences → thème **Système**, un terminal ouvert :
   basculer macOS Réglages → Apparence clair↔sombre. Attendu, **sans
   redémarrage** : fond et jetons de l'interface basculent, le canvas xterm
   aussi (`appliquerThemeTerminal`), les menus natifs et les ascenseurs aussi.
   Avant correction : rien ne bouge.
3. Même bascule avec l'onglet Navigateur et ses DevTools ouverts — le suivi
   doit tenir (c'est le point 4).
4. Thème **Clair** puis **Sombre** explicites : le poste n'a plus d'effet, la
   chrome native suit le choix, le fond de fenêtre réduite/rétablie est le bon.
5. Popover de la barre de menu (`MenuBarPanel`) ouvert pendant la bascule : il
   suit aussi.
6. `pnpm dev` dans le navigateur : la bascule système marchait déjà, elle doit
   continuer.
