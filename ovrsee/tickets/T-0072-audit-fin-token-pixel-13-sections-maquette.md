---
{
  "id": "T-0072",
  "titre": "Audit fin token/pixel — 13 sections de la maquette",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system",
    "audit"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-audit-design-pixel-perfect-vs-ovrsee-app-dc-html.md",
  "epic": "T-0070",
  "charge": "l"
}
---

## Contexte

Comparer chaque section de `Ovrsee App.dc.html` (`#2a` Système, `#2b` Aperçu, `#2c`
Navigateur, `#2d` Produit, `#2e` Historique, `#2f` Tableau, `#2g` Données vide, `#2h`
Stack, `#2i` Préférences, `#2j` Onboarding, `#2k` États, `#2l` Activité, `#2m` Vides &amp;
Données pleine) contre l'écran vivant correspondant (`localhost:5180` en Chrome,
Electron pour Navigateur) et le code source — `app/src/style.ts`, `app/src/theme.ts`,
`_ds/ovrsee/styles.css`, `app/src/App.tsx`, `app/src/tabs/*.tsx`, `Onboarding.tsx`,
`Preferences*.tsx`.

Chercher des écarts fins que la repasse structurelle (T-0062) n'a pas dû attraper :
valeurs hex exactes (fond, texte à 5 niveaux, accent `#7d76f0`, badges succès/alerte/
erreur), rayons de bordure (12px cartes / 6px boutons / 4px tags), tailles/graisses de
police IBM Plex (21/600 titres, 13/400 corps, Mono 11 chemins/commits), espacements
(gap 72/20/16/12px, padding carte 24px), icônes Phosphor (contour au repos, plein
actif), états hover/focus/disabled/loading (`#2k`), variantes vides/pleines (`#2g`,
`#2m`).

## Critères d'acceptation

- [x] Les 13 sections comparées (12 en Chrome ; `#2c` Navigateur en lecture de code
      seule — le panneau vivant n'existe qu'en Electron, voir T-0071).
- [x] Liste d'écarts produite : section maquette, fichier:ligne du code concerné,
      valeur attendue vs valeur actuelle.
- [x] Chaque écart trouvé était trivial (valeur de jeton isolée) et corrigé
      directement — aucun nouveau ticket net-nouveau nécessaire.

## Écarts trouvés et corrigés

- `#2a` bouton : rayon 8px (`--radius-md`) → 6px — `_ds/ovrsee/styles.css` `.btn`.
- `#2a` tag/badge : rayon 6px → 4px — `_ds/ovrsee/styles.css` `.tag`.
- `#2a` case radio : 16px → 14px — `_ds/ovrsee/styles.css` `.radio .dot`.
- `#2a`/`#2i` interrupteur : 38×22px rayon 11px → 28×16px rayon 999px, pastille
  16px → 12px — `app/src/PreferencesControls.tsx` (`Switch`).
- `#2d` carte du graphe Produit : rayon 8px → 10px — `app/src/tabs/Produit.tsx`.
- `#2h` cartes Stack : colonnes 150px uniformes → 190px (production) / 170px
  (développement), gap 16→18px, padding 12/14→13/15px, rayon `--radius-md`→9px —
  `app/src/tabs/Stack.tsx`.
- `#2c` en-tête panneau Navigateur : padding `0 14px` → `0 12px` —
  `app/src/tabs/Navigateur.tsx` (code seul, non vérifié à l'écran — T-0071).
- `#2g` état vide Données : titre `font-weight: 500`→600, détail `12px`→12.5px —
  `app/src/tabs/Donnees.tsx`.
- `#2j` galerie de préréglages : voir T-0069 (ticket séparé, déjà connu).

`pnpm typecheck` et `pnpm test` (216/216) passent après ces corrections.
