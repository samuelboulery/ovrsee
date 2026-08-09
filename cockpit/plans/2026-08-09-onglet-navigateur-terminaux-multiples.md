---
{
  "status": "open",
  "title": "Onglet Navigateur + terminaux multiples",
  "opened": "2026-08-09",
  "closed": null,
  "commits": [
    {
      "sha": "fb4e8ef",
      "date": "2026-08-09",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.ts",
        "app/src/tabs/Navigateur.tsx",
        "app/src/useTerminal.ts",
        "electron/main.js",
        "electron/preload.cjs",
        "electron/pty.js",
        "hooks/snapshot.js"
      ]
    },
    {
      "sha": "c75e4c1",
      "date": "2026-08-09",
      "files": []
    }
  ]
}
---

# Onglet Navigateur + terminaux multiples

## Contexte

Le cockpit montre le projet **au repos** : plans, pages crawlées, historique, tickets. Rien ne
montre le projet **en marche**. Pour voir l'application qu'on développe il faut sortir du cockpit,
ouvrir un navigateur à côté, et faire l'aller-retour à la main entre ce qu'on voit et ce qu'on dit
à Claude dans le panneau du bas.

On veut fermer cette boucle sans rompre le principe du projet : **le cockpit n'exécute jamais**
(`app/src/Terminal.tsx:110-117`). Donc le cockpit ne lance pas le serveur de dev — il en ouvre un
de plus dans le panneau du bas, où c'est l'utilisateur ou Claude qui tape la commande. Le nouvel
onglet **Navigateur** se branche ensuite sur l'URL, affiche l'app, et transforme un clic sur un
élément en contexte injecté dans la session Claude.

Résultat visé : voir l'app tourner, cliquer un bouton qui cloche, et que Claude reçoive
« voici l'élément, voici son HTML, voici la route » sans un seul copier-coller.

## Phase 1 — Plusieurs terminaux dans le panneau du bas

Aujourd'hui : une session par projet, `claude` tapé d'office (`electron/pty.js:25`, `110`).
Objectif : garder cette session-là, et pouvoir en ouvrir d'autres — un shell nu pour `pnpm dev`,
un autre pour des logs.

**`electron/pty.js`** — `openSession(sender, projectPath, kind)` avec `kind ∈ {'claude','shell'}`.
`STARTUP_COMMAND` n'est tapé que pour `'claude'`. Le rendu ne nomme toujours aucun programme : il
envoie un mot d'un ensemble fermé, le shell est choisi ici. Valider `kind` (sinon `'claude'`).

**`electron/preload.cjs`** — `terminal.open(projectPath, kind)`. Rien d'autre à ajouter :
`write` / `resize` / `close` / `listen` sont déjà par identifiant de session.

**`app/src/useTerminal.ts` → `useTerminals(projectPath)`** — le hook gère une liste
`{ id, kind, label }[]` + `active`. Un `XTerm` par session, créé à l'ouverture, disposé à la
fermeture. Le `listen` global existant filtre déjà par `id` : une seule souscription suffit pour
toutes les sessions.

- Les hôtes DOM sont **tous montés**, empilés en `position: absolute; inset: 0`, l'inactif masqué
  par `opacity: 0; pointer-events: none; z-index: 0`. Pas `display: none` : un conteneur de largeur
  nulle fait calculer à `FitAddon` une grille fausse, et `claude` réaffiche de travers.
- `ResizeObserver` par session, comme aujourd'hui (`useTerminal.ts:112-116`).
- Exporter un injecteur de portée module — `injectToClaude(text): boolean` — qui écrit dans la
  session `kind === 'claude'`. C'est ce que l'onglet Navigateur appellera ; faire remonter `inject`
  jusqu'à `App.tsx` obligerait à y remonter aussi le cycle de vie de xterm, et démonter `<Terminal>`
  (`App.tsx:276`) tuerait la session.

**`app/src/Terminal.tsx`** — une barre d'onglets de sessions au-dessus de l'hôte xterm, dans
l'en-tête existant à côté de « Terminal · claude » : pastille par session, `＋` ouvre un shell,
`×` ferme (la session `claude` n'est pas fermable). Reprendre le style d'onglet de `App.tsx:225-233`.
Le panneau latéral d'injections ne change pas.

Le serveur de dev se lance donc dans un onglet shell — à la main ou par Claude. Aucun nouveau
canal d'exécution.

## Phase 2 — Onglet Navigateur

**Rendu : balise `<webview>`.** `webviewTag: true` dans `webPreferences` (`electron/main.js:97-106`).

Pourquoi pas une `<iframe>` : le dev server est une autre origine, le parent ne peut pas toucher
son DOM — la sélection d'élément est impossible. Pourquoi pas `WebContentsView` : c'est une surface
native posée *au-dessus* du DOM, il faut lui synchroniser ses coordonnées à chaque
redimensionnement et elle passerait par-dessus la Lightbox et la barre d'onglets.
`ponytail:` la balise `<webview>` est officiellement déconseillée par Electron ; plafond connu,
la porte de sortie est `WebContentsView` avec synchronisation de bounds.

**`electron/main.js`** — en plus de `webviewTag: true` :
- `window.webContents.on('will-attach-webview', (event, prefs) => { delete prefs.preload; prefs.nodeIntegration = false; prefs.contextIsolation = true })` — sans ça le rendu pourrait attacher un invité privilégié.
- `on('did-attach-webview', (_e, guest) => guest.setWindowOpenHandler(...shell.openExternal))` — un
  `target="_blank"` de l'app inspectée s'ouvre dans le vrai navigateur, jamais dans une fenêtre du
  cockpit. Le garde `will-navigate` de `main.js:127` ne couvre que la fenêtre, pas l'invité.

**`hooks/snapshot.js:186`** — ajouter `config: readJson(join(root, 'cockpit.config.json'))`.
Le fichier existe déjà et porte `baseUrl` (`http://localhost:5180` ici), utilisé par le crawler :
c'est l'URL par défaut de l'aperçu, sans rien redemander à l'utilisateur. Déclarer le champ dans
`Snapshot` (`app/src/data.ts:203`).

**`app/src/tabs/Navigateur.tsx`** (nouveau) — barre d'outils + `<webview>`, mise en forme via `s()`
comme les autres onglets :
- `←` `→` `⟳` (`goBack` / `goForward` / `reload`), champ URL (défaut `snapshot.config?.baseUrl`,
  mémorisé par projet dans `localStorage`, clé `preview.url.<root>`), bouton **Sélectionner**,
  bouton **DevTools** (`webview.openDevTools()`).
- État de chargement via `did-start-loading` / `did-stop-loading`, erreur via `did-fail-load` —
  un serveur éteint doit le dire, pas afficher une page blanche.

**Sélection d'un élément** — pas de preload invité. Au clic sur « Sélectionner » on appelle
`webview.executeJavaScript(PICKER)` où `PICKER` est une IIFE qui rend une `Promise` :
surlignage au survol par un `<div>` d'overlay, `Échap` annule (résout `null`), un clic résout le
descripteur. `executeJavaScript` attend la promesse et rend la valeur — c'est ce qui évite un
fichier de preload, une entrée `will-attach-webview` pour le pinner, et un canal `ipc-message`.

Descripteur rendu : sélecteur CSS (id, sinon chemin `tag.classe:nth-of-type`), texte visible
tronqué, `outerHTML` tronqué (~600 c.), et la route courante. Injecté dans la session Claude via
`injectToClaude()` sous une forme que Claude peut grepper :

```
Élément sélectionné dans l'aperçu (route /panier) :
sélecteur : main > form.checkout > button.btn-primary
texte     : « Valider la commande »
html      : <button class="btn-primary" type="submit" disabled>…</button>
```

Repli presse-papier quand il n'y a pas de session, exactement comme `Terminal.tsx:90-102`.

**Erreurs console** — `webview.addEventListener('console-message')` filtré sur `error` / `warning`,
gardé dans un état plafonné (30 dernières). Un bandeau en bas de l'onglet affiche le compte et la
dernière ligne, dépliable, avec « Envoyer à Claude » qui injecte la liste. Vidé à chaque navigation.

**`app/src/App.tsx`** — `['navigateur', 'Navigateur', '/navigateur']` dans `TABS` (l. 43).
Contrairement aux autres onglets, **monter `<Navigateur>` en permanence** et le masquer quand il
n'est pas actif : un démontage rechargerait l'app inspectée et perdrait son état à chaque
changement d'onglet.

## Fichiers touchés

| Fichier | Ce qui change |
|---|---|
| `electron/pty.js` | `kind` de session, `claude` tapé seulement pour `'claude'` |
| `electron/preload.cjs` | `terminal.open(path, kind)` |
| `electron/main.js` | `webviewTag`, `will-attach-webview`, `did-attach-webview` |
| `hooks/snapshot.js` | `config` dans le snapshot |
| `app/src/data.ts` | champ `config` dans `Snapshot` |
| `app/src/useTerminal.ts` | `useTerminals`, `injectToClaude` |
| `app/src/Terminal.tsx` | barre d'onglets de sessions |
| `app/src/tabs/Navigateur.tsx` | **nouveau** |
| `app/src/App.tsx` | onglet, montage permanent |

## Vérification

1. `pnpm typecheck` puis `pnpm test` (`node --test hooks/*.test.js crawl/*.test.js server/*.test.js`) —
   le snapshot est couvert côté hooks.
2. `pnpm electron`. Panneau du bas : `＋` ouvre un shell, `pnpm dev` y tourne, la session `claude`
   reste vivante et répond ; fermer un shell ne touche pas les autres.
3. Onglet **Navigateur** : l'app apparaît sur `baseUrl`, `←` `→` `⟳` répondent, DevTools s'ouvre.
   **Point à vérifier en premier** : que `<webview>` s'attache bien avec `sandbox: true` sur la
   fenêtre hôte. Si non — bascule sur `WebContentsView`, décidée avant d'écrire l'onglet.
4. « Sélectionner » : survol surligné, `Échap` annule, un clic écrit le bloc d'élément dans le
   terminal Claude. Vérifier sur le cockpit lui-même (`pnpm dev` sur le port 5180).
5. Provoquer une erreur console dans l'app inspectée : le bandeau la compte, « Envoyer à Claude »
   l'injecte, une navigation la vide.
6. Changer d'onglet et revenir : l'app inspectée n'a pas rechargé.
7. `pnpm package` en fin de travail.
