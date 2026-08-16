---
{
  "status": "open",
  "title": "Barre de menu macOS — les trois défauts du premier jet",
  "opened": "2026-08-14",
  "closed": null,
  "commits": []
}
---

# Barre de menu macOS — les trois défauts du premier jet

## Contexte

La première livraison (T-0137 → T-0140) a posé l'item de barre de menu, le
popover, et la voie retour par touches dans le pty. Le test sur le DMG a montré
trois défauts, dont un de conception :

1. **Le popover ne voit aucune session, même quand une tourne.** Deux causes qui
   se cumulent. La première est bête : le hook `ovrsee-notify.js` n'est toujours
   pas enregistré dans `~/.claude/settings.json`, donc aucun signal ne part. La
   seconde est une erreur de conception de ma part : **l'état publié ne contient
   que les sessions qui ont signalé quelque chose.** Une session ouverte et
   silencieuse n'existe pas pour la barre de menu. J'ai confondu « la liste des
   sessions » et « la liste des attentes » — ce sont deux choses.

2. **Depuis une app en plein écran, le clic sur l'icône bascule vers l'espace
   d'Ovrsee** au lieu d'afficher le popover par-dessus.

3. **Sans session, le popover ne montre rien d'utile** — juste « Aucune session
   ouverte ».

## 1. Lister les sessions, pas seulement les attentes

Une session existe parce que son pty est ouvert, pas parce qu'elle a parlé.

**`app/src/useTerminal.ts`** — l'identifiant de pty vit dans la Map `panes`, une
`useRef` : rien ne re-rend quand il apparaît, et rien ne l'expose. Ajouter un
état `ptyIds: Record<string, string>` posé dans `attach()` après
`bridge.open()` (là où `pane.id = result.id` est déjà écrit), vidé sur
`pty:exit` et sur `closeShell`. C'est ce qui rend la liste réactive.

**`app/src/menubar.ts`** — la fusion change de nature. Aujourd'hui `fusionner()`
range des signaux ; il lui faut composer deux sources :

```ts
composer(
  ouvertes: { key, ptyId, projet, nom }[],     // ce qui tourne
  attentions: Record<string, Attention>,        // ce qui a signalé
): MenuBarSession[]
```

`MenuBarSession.attention` vaut `null` pour une session ouverte et silencieuse —
c'est le cas qui manquait. Tri : les attentes d'abord, puis le signal le plus
récent, puis l'ordre alphabétique pour que deux sessions muettes ne dansent pas.
`estDecidable` lit désormais `session.attention`.

**`app/src/Terminal.tsx`** — garder les attentes dans une référence indexée par
`sessionKey`, et publier à chaque changement de `allSessions` **ou** de
`ptyIds` **ou** d'une attente. Ne publier que les sessions `claude` dont le pty
est réellement ouvert : le popover n'a rien à dire d'un onglet dont le terminal
n'a jamais été monté.

## 2. Le popover par-dessus le plein écran

La cause est nommée dans le source d'Electron : `NativeWindowMac::Show()` fait
`activateIgnoringOtherApps:YES` — **sauf pour une fenêtre panel** :

```cpp
if (!IsPanel()) { [[NSApplication sharedApplication] activateIgnoringOtherApps:YES]; }
```

Activer l'application, c'est basculer sur son espace. D'où, dans
`electron/tray.js` :

- `type: 'panel'` dans les options de la `BrowserWindow` ;
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })` ;
- `setAlwaysOnTop(true, 'pop-up-menu')` — c'est à partir de ce niveau qu'une
  fenêtre passe au-dessus du Dock ;
- `showInactive()` au lieu de `show()`.

`skipTransformProcessType: true` n'est pas décoratif : sans lui, Electron
appelle `DockHide()` pour satisfaire la règle d'Apple (une fenêtre ne flotte
au-dessus du plein écran que si l'app est un `UIElement`), et l'icône du Dock
d'Ovrsee disparaîtrait. Le type `panel` obtient le même résultat sans y toucher.

**À vérifier à la main, parce que rien ne le teste :** si la fenêtre n'est
jamais focalisée, `blur` ne se déclenche pas et le popover ne se referme plus
tout seul. Le repli existe déjà — le clic sur l'icône bascule — et il faut y
ajouter une fermeture après chaque décision.

## 3. Un état vide utile : le projet courant

Le popover est un rendu isolé : il ne connaît ni le projet affiché ni son
instantané. Plutôt que de lui faire refaire un `fetchSnapshot`, **le rendu
principal publie le résumé avec l'état des sessions** — il tient déjà le
`Snapshot`. Une seule source, un seul aller-retour.

La charge publiée devient `{ sessions, projet, signalInstalle }`, où `projet`
porte : nom, plan actif, tickets restants, branche et nombre de fichiers
modifiés, date du dernier scan. Tout se dérive de fonctions qui existent —
`restant()` et `plansOuverts()` dans `app/src/data.ts`, `snapshot.gitStatus`,
`snapshot.scans`. Ne rien recalculer à la main.

## 4. Rendre visible le hook manquant

Le défaut n° 1 a coûté un test pour rien, et rien à l'écran ne le disait. Le
popover doit le dire lui-même.

- **`hooks/install.js`** : exporter un prédicat `signalInstalle()` qui lit
  `~/.claude/settings.json` et vérifie `ovrsee-notify` dans `Stop` **et** dans
  `Notification`. Il vit là parce que `hooks/` est testé, et que l'inverse —
  le même test écrit dans `electron/` — ne le serait pas.
- **`electron/tray.js`** : l'appeler à chaque ouverture du popover, pas au
  démarrage : l'utilisateur peut lancer l'installateur entre-temps.
- **Le popover** : un bandeau nommant la commande, `pnpm ovrsee:install`, quand
  c'est faux. Sans lui, aucune attente ne remontera jamais et rien ne l'explique.

## 5. Finition

Sur la capture, le popover est un rectangle net posé sur la fenêtre : vérifier
`roundedCorners` et l'ombre une fois passé en `type: 'panel'`, et poser une
bordure au niveau des jetons `--color-border-*` si le système ne la donne pas.

## Fichiers

| Fichier | Ce qui change |
|---|---|
| `app/src/useTerminal.ts` | état `ptyIds`, exposé ; vidé sur sortie et fermeture |
| `app/src/menubar.ts` | `composer()` remplace `fusionner()` ; `attention` peut valoir `null` |
| `app/src/Terminal.tsx` | publie sessions ouvertes + attentes + résumé de projet |
| `app/src/MenuBarPanel.tsx` | session muette, bloc projet, bandeau d'installation |
| `electron/tray.js` | `type: 'panel'`, espaces, niveau, `showInactive`, `signalInstalle()` |
| `hooks/install.js` | `signalInstalle()` exporté |
| `hooks/i18n.js` / `.d.ts` | clés du bloc projet et du bandeau, FR et EN |

## Vérification

Automatique — dans le style existant, `node:test` seul, aucun framework :

- `app/src/menubar.test.ts` : `composer()` sur une session ouverte sans
  attention, une avec, deux sessions dont une muette, une attention orpheline
  dont la session s'est fermée, et l'ordre de tri.
- `hooks/install.test.js` : `signalInstalle()` vrai, faux, `settings.json`
  absent, `settings.json` illisible.
- `app/src/render.test.tsx` : la carte d'une session muette n'offre aucune
  décision ; le bloc projet paraît quand rien ne tourne ; le bandeau paraît
  quand le signal manque.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build:ui`.

À la main, ce qu'aucun test ne couvre :

1. `pnpm ovrsee:install`, puis vérifier que le bandeau disparaît.
2. Terminal ouvert sur une session Claude au repos → elle **apparaît** dans le
   popover, sans boutons de décision.
3. Depuis une app en plein écran, clic sur l'icône → le popover s'affiche
   par-dessus, **sans changement d'espace**. Puis vérifier qu'il se referme.
4. L'icône du Dock d'Ovrsee est toujours là après avoir ouvert le popover
   (c'est ce que `skipTransformProcessType` protège).
5. Demander une commande à Claude, passer sur une autre app, « Refuser ».
6. Fermer le terminal → la session quitte le popover.

## Écarté

- Faire refaire un `fetchSnapshot` au popover : deuxième source de vérité pour
  une donnée que le rendu principal tient déjà.
- Lister les shells nus : le popover s'appelle « Sessions Claude », et le bruit
  coûterait plus que l'information.
- Lancer une session depuis le popover : il faudrait monter un terminal dans le
  rendu principal, donc l'ouvrir de toute façon.
