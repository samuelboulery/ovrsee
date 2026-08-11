---
{
  "status": "open",
  "title": "Corriger le thème clair : liste projets, timeline plan, terminal",
  "opened": "2026-08-11",
  "closed": null,
  "commits": []
}
---

# Corriger le thème clair : liste projets, timeline plan, terminal

## Contexte

Trois zones du thème clair de l'app Ovrsee restent illisibles ou incohérentes :

1. **Liste PROJETS (sidebar)** : la ligne du projet sélectionné garde un fond violet foncé (`--color-accent-900` = `#352d64`), pensé pour le thème sombre. Sur fond clair ça détonne.
2. **Frise historique, cartes PLAN** : le dégradé de fond des cartes `PLAN` utilise le même `--color-accent-900`, trop sombre pour le clair.
3. **Terminal** : reste noir/bleu nuit même en thème clair. Root cause identifiée — `getTerminalTheme()` (theme.ts:219-246) est correcte et retourne bien la palette claire selon `data-theme`, mais elle n'est appliquée **qu'une fois, à la création du xterm** (`useTerminal.ts:248`, `theme: getTerminalTheme()`). Aucun code ne réapplique le thème à un xterm déjà monté quand `applyTheme()` change l'attribut `data-theme` plus tard (confirmé : aucun `MutationObserver`/listener ne relie `data-theme` aux instances xterm existantes). Résultat : un terminal ouvert avant ou pendant un changement de thème reste figé sur la palette du moment de sa création — d'où le noir persistant même quand le reste de l'UI est passé au clair.

Le terminal peut légitimement garder une couleur différente du reste de l'UI (c'est un terminal), mais elle doit être **claire et lisible**, pas figée sur le sombre par bug.

## Approche

### 1. Sidebar — ligne de projet sélectionnée
`app/src/App.tsx:1142-1146` : remplacer le fond `var(--color-accent-900)` par un ton clair de la rampe accent (ex. `var(--color-accent-100)` ou `var(--color-accent-200)`, fond clair violacé cohérent avec Nocturne clair) et ajuster `color` si besoin pour rester lisible. Garder `box-shadow: inset 2px 0 0 var(--color-accent)` (déjà correct, `#5f52a8` lisible sur clair).

Vérifier aussi l'onglet de session terminal actif (`Terminal.tsx:193-196`, même pattern `--color-accent-900`) — même correctif à appliquer par cohérence.

### 2. Frise historique — cartes PLAN
`app/src/tabs/Historique.tsx:357-360` : le dégradé `linear-gradient(90deg, var(--color-accent-900) 0%, transparent 60%)` doit utiliser un ton clair (ex. `--color-accent-100`/`-200`) en thème clair. Comme ce fichier n'a pas de branche conditionnelle par thème, préférer un token qui a déjà une valeur adaptée par thème plutôt que coder un `if (theme)` — vérifier si `--color-accent-900` est bien redéfini côté clair (il l'est, `#352d64`, mais reste trop sombre pour un dégradé de fond). Remplacer par `--color-accent-100`/`-200` (clair des deux côtés) ou par une variable dédiée si l'intention day/night doit diverger. Garder `border-left: var(--color-accent-700)` (`#5f52a8`, lisible sur clair).

### 3. Terminal — réapplication du thème au changement
`app/src/useTerminal.ts` (hook `useTerminals`, autour de `panes` ref ligne 164 et création xterm ligne 239-250) :
- Ajouter un `useEffect` qui observe les changements de thème effectif et réapplique `xterm.options.theme = getTerminalTheme()` à **tous les panes existants** (`panes.current`) :
  - `MutationObserver` sur `document.documentElement` (attribut `data-theme`), pour les changements explicites (`applyTheme('light'|'dark')`).
  - `window.matchMedia('(prefers-color-scheme: dark)')` + listener `change`, pour le mode `'auto'` où l'attribut est absent.
- Nettoyer observer/listener au démontage du hook.
- Ce correctif est autonome (pas besoin de passer `settings.theme` en prop) puisque `getTerminalTheme()` lit déjà `document.documentElement.dataset.theme` dynamiquement — il ne manque que le déclencheur de réapplication.

## Fichiers touchés
- `app/src/App.tsx` (ligne ~1142-1146)
- `app/src/Terminal.tsx` (ligne ~193-196)
- `app/src/tabs/Historique.tsx` (ligne ~357-360)
- `app/src/useTerminal.ts` (hook `useTerminals`)

## Exécution
Demande explicite : passer par un skill/agent expert UI plutôt qu'éditer à l'aveugle. Charger le skill `frontend-design` avant de toucher aux couleurs (choix des tons clairs, cohérence avec la rampe Nocturne existante) puis appliquer les correctifs ci-dessus.

## Vérification
- `pnpm --filter app test` (ou équivalent racine) pour les tests existants (`theme.test.ts`, `render.test.tsx`, `prefs.test.tsx` ne doivent pas régresser).
- Lancer l'app (`pnpm package` ou dev electron), passer en thème clair depuis Préférences, vérifier :
  - ligne projet sélectionné lisible (texte foncé sur fond clair, pas de violet foncé résiduel)
  - cartes PLAN de la frise historique lisibles en clair
  - ouvrir un terminal, il doit être clair par défaut en thème clair
  - **basculer thème clair → sombre → clair avec un terminal déjà ouvert** : le terminal doit suivre le changement en direct (test du vrai bug corrigé), pas seulement à la prochaine ouverture d'onglet.
- Capture d'écran avant/après des trois zones pour comparaison visuelle.
