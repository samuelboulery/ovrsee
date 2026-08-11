---
{
  "status": "open",
  "title": "Thème clair — repasse contraste et cohérence (round 2)",
  "opened": "2026-08-11",
  "closed": null,
  "commits": [
    {
      "sha": "76accb0",
      "date": "2026-08-11",
      "files": [
        "app/src/App.tsx",
        "app/src/ClaudeConfigPanel.tsx",
        "app/src/Garde.tsx",
        "app/src/Illisibles.tsx",
        "app/src/Lightbox.tsx",
        "app/src/PreferencesControls.tsx",
        "app/src/PreferencesIntegrations.tsx",
        "app/src/Terminal.tsx",
        "app/src/data.ts",
        "app/src/highlight.ts",
        "app/src/markdown.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Branches.tsx",
        "app/src/tabs/Deploiements.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Environnements.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Tableau.tsx",
        "app/src/theme.ts",
        "app/src/useTerminal.ts",
        "\"ovrsee/tickets/T-0039-th\\303\\250me-clair-illisible-sidebar-timeline-terminal.md\""
      ]
    },
    {
      "sha": "06dd7cf",
      "date": "2026-08-11",
      "files": []
    }
  ]
}
---

# Thème clair — repasse contraste et cohérence (round 2)

## Contexte

Round 1 (livré, packagé, T-0039 en cours) a corrigé sidebar/PlanBand/terminal-figé-sur-sombre en remplaçant `var(--color-accent-900)` par l'idiome `color-mix(in srgb, var(--color-accent) 22%, transparent)` déjà utilisé ailleurs dans Nocturne. Ça a marché — vérifié en live (Electron + Playwright, clair/sombre/clair) sans régression.

L'utilisateur a testé le paquet reconstruit et remonte 7 nouveaux captures montrant des éléments **encore illisibles**, plus une demande explicite de **cohérence** : « même couleur pour le même composant ». Investigation (3 agents Explore + lecture directe) a trouvé que le premier passage n'a traité que 2 symptômes visibles, alors que le bug sous-jacent est systémique : `--color-accent-200`/`-300` (rampe numérotée, PAS theme-aware — même valeur pâle dans les deux thèmes, contrairement à `--color-neutral-*` qui s'inverse et à `--color-accent`/`--color-accent-2` bruts qui s'adaptent) est utilisé comme **couleur de texte directe sur fond ambiant clair** à ~27 endroits dans 15 fichiers. Résultat : texte lavande pâle sur fond blanc, illisible, partout où ce pattern apparaît — badge de sidebar, gros chiffre de stat, code inline, id de ticket/commit, libellés de statut, etc.

Deux bugs distincts en plus :

- **Palette ANSI du terminal incomplète** : `theme.ts` ne définit que 6 des 16 couleurs ANSI attendues par xterm (`black/white/magenta` + variantes bright). Les 10 manquantes (`red/green/yellow/blue/cyan` + brights) retombent sur les **valeurs par défaut de xterm.js**, calibrées pour un fond noir (ex. `brightGreen: #8ae234`, `brightYellow: #fce94f`) — illisibles sur notre fond clair. C'est la barre de statut du terminal intégré (`ctx`, `5h`, `7d`, jauges vertes) qui en pâtit.
- **HUD sombre volontaire mal assorti** : `Lightbox.tsx` (flèches prev/next) et `tabs/Produit.tsx` (contrôles de zoom du graphe, `−`/`100%`/`+`/`⤢`) ont un fond littéral non-thématisé `rgba(19,20,31,.8x)` — un HUD translucide toujours sombre, choix légitime pour des contrôles flottant sur une image/un canevas variable. Mais le texte à l'intérieur utilise `var(--color-neutral-300/400)`, qui **s'inverse avec le thème** — en clair ça devient un gris foncé quasi invisible sur le fond quasi-noir. C'est le screenshot des « 4 carrés sombres, icône à peine visible » (contrôles de zoom Produit).

## Approche

### 1. Palette ANSI complète du terminal
`app/src/theme.ts` — compléter `darkTheme` et `lightTheme` avec les 10 clés manquantes (`xtermRed/Green/Yellow/Blue/Cyan` + `xtermBright*`), et étendre le type de retour + le corps de `getTerminalTheme()` (lignes ~219-246) pour les exposer (`red, green, yellow, blue, cyan, brightRed, brightGreen, brightYellow, brightBlue, brightCyan`). Pour `lightTheme`, choisir des teintes assombries lisibles sur `#f2f2f3` (palette « terminal clair » classique, ex. rouge ~`#c41a16`, vert ~`#1a7f37`, jaune ~`#9a6700`, bleu ~`#1a4fd6`, cyan ~`#0e7490`, avec variantes bright légèrement plus vives mais toujours lisibles sur blanc). Pour `darkTheme`, fixer explicitement les valeurs actuellement implicites (xterm defaults) pour ne plus dépendre du fallback — reprendre les teintes déjà cohérentes avec Nocturne sombre (proches des `DEFAULT_ANSI_COLORS` de xterm, éventuellement retouchées pour matcher le violet de marque).

### 2. Convergence `accent-200`/`-300` → `var(--color-accent)` (et `accent-2-200` → `var(--color-accent-2)`)
Remplacement mécanique, un seul token cohérent pour « texte accentué sur fond ambiant », dans tous les call sites **standalone** (pas de `background: var(--color-accent-900)` assorti dans le même style). Liste (issue du grep exhaustif) :

- `App.tsx:1165` (badge « à faire »), `App.tsx:1187` (confirmation « retirer ? »)
- `tabs/Apercu.tsx:565` (chiffre de stat « 42 »), `tabs/Apercu.tsx:518`
- `tabs/Navigateur.tsx:601,727` (code inline `pnpm dev`/`pnpm electron`)
- `tabs/Historique.tsx:186,218,369` (déjà fait au round 1 — vérifier, ne pas dupliquer)
- `tabs/Tableau.tsx:291,516`, `tabs/Donnees.tsx:132(EXTRACTED→accent),132(LIVE→accent-2),242`, `tabs/Produit.tsx:379,397,463`, `tabs/Branches.tsx:58`, `tabs/Deploiements.tsx:16,17,166`, `tabs/Environnements.tsx:55`
- `data.ts:1229,1242`, `Illisibles.tsx:26`, `markdown.tsx:175`, `highlight.ts:217` (couleur des mots-clés — le bloc de code parent utilise `--color-neutral-900`, qui s'inverse en clair, donc bien standalone), `Garde.tsx:77`, `PreferencesIntegrations.tsx:210`, `PreferencesControls.tsx:217`, `ClaudeConfigPanel.tsx:267`, `Terminal.tsx:346,384`, `Lightbox.tsx:109`

**Ne pas toucher** (badge auto-cohérent : fond `accent-900` + texte `accent-200` statiques des deux côtés, donc déjà lisible dans les deux thèmes) : `Terminal.tsx:257` (bouton disposition actif), `tabs/Navigateur.tsx:552` (bouton dock actif), `tabs/Historique.tsx:319-323` (encart « alternative écartée »), `tabs/Produit.tsx:100` (encart info).

### 3. HUD sombre volontaire — texte non-thématisé assorti
`Lightbox.tsx` (fonction `Arrow`, ligne ~166-170) et `tabs/Produit.tsx` (`Controls`, ligne ~241) : le fond `rgba(19,20,31,.8x)` reste tel quel (HUD volontairement sombre, cohérent avec la catégorie `unthemedColors` déjà documentée dans `theme.ts:65-73`). Remplacer le texte `var(--color-neutral-300/400/700)` (thématisé, cassé sur fond statique) par une couleur claire **statique**, du même esprit que `unthemedColors` — ex. `rgba(233,233,237,.92)` pour l'état actif/lisible, `rgba(233,233,237,.45)` pour désactivé (`Lightbox.tsx` a un état `disabled` distinct ; `Produit.tsx` Controls n'en a pas, une seule valeur suffit).

## Fichiers touchés
- `app/src/theme.ts` (palette ANSI complète)
- ~20 fichiers pour la convergence de couleur (liste ci-dessus) — édition mécanique d'une ligne chacun
- `app/src/Lightbox.tsx`, `app/src/tabs/Produit.tsx` (texte HUD statique)

## Vérification
- `pnpm test:ui` (219 tests actuels, ne doit pas régresser).
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit` (typecheck).
- Relancer l'app (Electron + Playwright déjà utilisé au round 1), captures d'écran en clair puis en sombre des zones touchées : sidebar (badge), Aperçu (stat), Navigateur (erreur + dock), terminal (jauges de statut colorées), Lightbox (flèches), Produit (contrôles de zoom + éventuel encart info) — confirmer lisibilité en clair et absence de régression en sombre.
- `pnpm package:mac` en fin de travail (déjà la pratique établie).
