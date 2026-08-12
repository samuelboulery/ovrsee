---
{
  "status": "closed",
  "title": "Repasse UI ovrsee — coller à la maquette « Ovrsee App.dc.html »",
  "opened": "2026-08-11",
  "closed": "2026-08-12",
  "commits": [
    {
      "sha": "a36966b",
      "date": "2026-08-12",
      "files": [
        "_ds/ovrsee/styles.css",
        "app/src/App.tsx",
        "app/src/CommandPalette.tsx",
        "app/src/Onboarding.tsx",
        "app/src/PreferencesProfils.tsx",
        "app/src/assets/fonts/ibm-plex-mono-400.woff2",
        "app/src/assets/fonts/ibm-plex-sans-400.woff2",
        "app/src/assets/fonts/ibm-plex-sans-500.woff2",
        "app/src/assets/fonts/ibm-plex-sans-600.woff2",
        "app/src/data.ts",
        "app/src/onboarding.test.tsx",
        "app/src/profilage.ts",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Sante.tsx",
        "app/src/tabs/Stack.tsx",
        "app/src/views.ts",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/settings.js"
      ]
    },
    {
      "sha": "670e177",
      "date": "2026-08-12",
      "files": []
    },
    {
      "sha": "c9b3401",
      "date": "2026-08-12",
      "files": []
    },
    {
      "sha": "90474b2",
      "date": "2026-08-12",
      "files": []
    },
    {
      "sha": "4b6ec80",
      "date": "2026-08-12",
      "files": []
    }
  ]
}
---

# Repasse UI ovrsee — coller à la maquette « Ovrsee App.dc.html »

## Contexte

Le plan « Refonte UI Ovrsee — mise en œuvre des maquettes » est clos (Phase 0 + Phase 1
livrées, commits `f666ce1` → `05b3a73`). Les tokens de couleur, l'espacement, le châssis
(rail vertical + `<a href>`), 6 des 7 pictos de rail, les 5 sections Préférences et la
structure Onboarding en 3 écrans existent déjà et **collent** à la maquette — vérifié en
comparant `_ds/ovrsee/styles.css` octet pour octet aux tokens extraits du canvas
(`--color-bg: #08090a`, `--color-accent: #7d76f0`, hiérarchie de texte, espacement
4·8·12·16·24 : identiques).

L'utilisateur constate que l'app ne ressemble pas encore à la maquette. L'exploration
directe du code a confirmé plusieurs écarts concrets, pas juste une impression :

1. **Police système, pas IBM Plex** — `_ds/ovrsee/styles.css:68-71` le documente
   explicitement : les tokens `--font-heading`/`--font-body`/`--font-mono` pointent
   vers IBM Plex mais aucun fichier n'est chargé, retombée sur la pile système. C'est
   le plus gros écart visuel — une police différente se voit instantanément, avant
   même les couleurs.
2. **2 pictos de rail sur 7 ne correspondent pas** — `views.ts:46-54` : Aperçu utilise
   `House` (maquette : `SquaresFour`), Produit utilise `Graph` (maquette :
   `TreeStructure`).
3. **Bouton Préférences du rail** — `App.tsx:1008-1016` rend un glyphe littéral `⚙`
   au lieu d'un picto Phosphor `GearSix`, rompant la cohérence du système d'icônes
   partout ailleurs cohérent (contour/plein selon état).
4. **Palette ⌘K incomplète** — `CommandPalette.tsx` a Vues/Tickets/Commandes ; la
   maquette (écran système 2a) ajoute une section Projets en tête, des raccourcis
   numérotés ⌘1-⌘7 affichés à côté de chaque vue, et une ligne utilisateur en pied de
   palette.
5. **Onboarding étape 2 est la mauvaise question** — `Onboarding.tsx:236`
   (`EcranProfil`) demande l'usage de Claude Code (`onboard.usage_*`). La maquette 2j
   veut à cette étape le choix d'un préréglage de composition d'interface (Dev /
   Sobre / Découverte / Complet), qui existe déjà comme `PROFILS`
   (`PreferencesProfils.tsx:37`) mais seulement dans Préférences, jamais montré à
   l'onboarding. Décidé avec l'utilisateur : l'étape 2 devient ce choix de
   préréglage, la question d'usage est retirée de l'onboarding.

Au-delà de ces 5 écarts vérifiés en lisant le code, deux agents d'exploration (un sur
le code actuel, un sur les 280 Ko du canvas `Ovrsee App.dc.html`) ont chacun produit un
rapport texte — utile mais insuffisant pour juger d'écarts de mise en page fine (grille
de cartes, panneaux latéraux, largeurs) écran par écran. La Phase C ci-dessous couvre
ce point par comparaison visuelle directe plutôt que par un résumé textuel de plus.

Hors périmètre (acté dans le plan clos, pas remis en cause ici) : DevTools Réseau,
ticket-depuis-élément, comparaison de dates, graphe d'activité 4 lectures, schéma DB —
ce sont des fonctionnalités neuves, tickets séparés, pas une question de style.

## Phase A — Corrections connues, sans ambiguïté

- **Police IBM Plex auto-hébergée** : télécharger IBM Plex Sans (400/500/600) et IBM
  Plex Mono (400) en `.woff2`, les placer dans `app/src/assets/fonts/`, ajouter les
  règles `@font-face` dans `_ds/ovrsee/styles.css` (remplace le commentaire
  « pas de fichiers auto-hébergés pour l'instant »). Pas de dépendance npm — fichiers
  statiques, cohérent avec la contrainte hors-ligne de l'app packagée.
- **Pictos de rail** (`views.ts:6-14,46-54`) : `House` → `SquaresFour` pour `apercu`,
  `Graph` → `TreeStructure` pour `produit`.
- **Bouton Préférences** (`App.tsx:1008-1016`) : remplacer `⚙` par `<GearSix weight={...} />`
  du même import `@phosphor-icons/react`, même logique contour/plein que `RailLink`.
- **Palette ⌘K** (`CommandPalette.tsx`) : ajouter une section Projets (projet courant +
  badge), afficher le raccourci `⌘1`…`⌘7` à côté de chaque item de la section Vues, et
  une ligne utilisateur/paramètres en pied de liste. Réutilise les données déjà en
  mémoire (`App.tsx`), pas de nouvel endpoint.

## Phase B — Onboarding étape 2

- `Onboarding.tsx` : remplacer `EcranProfil` (question d'usage) par un nouvel écran de
  sélection de préréglage, construit sur `PROFILS` (`PreferencesProfils.tsx:37`) —
  4 cartes radio (Dev/Sobre/Découverte/Complet), sélection = pré-remplissage de
  `settings.onglets` + `settings.terminal` du brouillon (`brouillon` déjà géré par
  `Onboarding.tsx`, pas de nouvel état).
- Retirer `onboard.usage_*` des clés i18n utilisées à l'onboarding si elles ne servent
  plus qu'ici (vérifier dans `i18n.ts`/`i18n.js` avant suppression — elles peuvent être
  référencées ailleurs).
- Le titre d'étape passe de ce que porte `EcranProfil` à « Quelle composition
  d'interface ? » (maquette 2j).

## Phase C — Audit visuel systématique par écran

Les rapports texte des deux agents d'exploration ne suffisent pas à juger des écarts de
mise en page (grille de cartes, panneaux latéraux, largeurs, densité). Pour chaque
écran — Aperçu, Navigateur, Produit, Historique, Tableau, Données, Stack, Préférences
(section Interface avec aperçu en direct), Onboarding — ouvrir côte à côte dans Chrome
(`mcp__claude-in-chrome`) l'écran correspondant de `Ovrsee App.dc.html` (fichier local,
`file://`) et l'app tournant via `pnpm dev`, capturer une comparaison, lister les écarts
concrets restants (pas de nouvelle fonctionnalité — uniquement présentation), et les
corriger un par un dans les fichiers de `app/src/tabs/` concernés.

## Vérification

- `pnpm typecheck` et `pnpm test` après chaque phase.
- Vérification manuelle en Electron (`pnpm electron`), pas seulement `pnpm dev` — le
  rail `<a href>` doit rester détecté par `pnpm ovrsee:crawl` sur le projet ovrsee
  lui-même (contrainte documentée dans `CLAUDE.md`).
- Comparaison visuelle directe à la maquette (Phase C) comme critère de clôture, plutôt
  qu'une relecture de code seule.
