---
{
  "status": "open",
  "title": "Audit design pixel-perfect vs `Ovrsee App.dc.html`",
  "opened": "2026-08-12",
  "closed": null,
  "commits": []
}
---

# Audit design pixel-perfect vs `Ovrsee App.dc.html`

## Contexte

Le dossier `~/Downloads/Redesign UI Ovrsee 2/` contient deux maquettes distinctes :
`Ovrsee App.dc.html` (direction actuelle — icônes Phosphor, dark-only, déjà largement
codée) et `Ovrsee Refonte.dc.html` (direction "Linear-like" écartée — dark+clair,
symboles géométriques, chrome différent). **L'utilisateur a tranché : `Ovrsee
App.dc.html` est la cible.** `Ovrsee Refonte.dc.html` et les captures d'inspiration
dans `uploads/` (Rox, Chronicle, Linear) sortent du périmètre.

Le dernier chantier structurel (`8364d47`, fermé) a déjà posé : panneaux droits
persistants (Aperçu, Historique), colonne d'aperçu en direct dans Préférences, châssis
gauche + grille de vues dans l'onboarding étape 2, boutons Comparer/Crawler en en-tête
de Produit, grille de densité 12×7 dans Historique. Deux écarts connus restent :

- **T-0069** (backlog) : la galerie de préréglages (`Onboarding.tsx` → `SectionProfils`,
  étape 2) est une grille 2×2 de cartes larges avec bouton « Appliquer » séparé, alors
  que la maquette (`#2j`) montre une ligne de 4 cartes compactes à sélection directe
  (cliquer la carte l'applique).
- **Panneau Navigateur (T-0064)** : codé et testé, mais jamais vérifié visuellement —
  la vue navigateur intégré n'existe qu'en Electron (le navigateur Chrome affiche
  « n'existe que dans l'application »), donc aucune capture n'avait pu être prise.

Au-delà de ces deux écarts connus, l'utilisateur demande un audit complet — pas
seulement de structure (déjà fait), mais de **couleur, typo, hiérarchie et pattern**,
écran par écran, contre les 13 sections de `Ovrsee App.dc.html` (`#2a` Système à `#2m`
Vides & Données pleine). C'est un audit fin de token/pixel, pas un nouveau passage
structurel.

## Approche

### Phase 1 — Audit fin, section par section

Pour chaque section de la maquette (`#2a` Système, `#2b` Aperçu, `#2c` Navigateur,
`#2d` Produit, `#2e` Historique, `#2f` Tableau, `#2g` Données vide, `#2h` Stack, `#2i`
Préférences, `#2j` Onboarding, `#2k` États, `#2l` Activité, `#2m` Vides & pleine),
comparer contre l'écran vivant correspondant (dev server `localhost:5180` déjà lancé,
via Chrome ; Electron pour Navigateur — `pnpm electron`) et le code source. Chercher
des écarts fins que la repasse structurelle n'a pas dû attraper : valeurs hex exactes
(fond, texte à 5 niveaux, accent `#7d76f0`, badges succès/alerte/erreur), rayons de
bordure (12px cartes / 6px boutons / 4px tags), tailles/graisses de police IBM Plex
(21/600 titres, 13/400 corps, Mono 11 pour chemins/commits), espacements (gap 72/20/16/
12px, padding carte 24px), icônes Phosphor (contour au repos, plein actif), états hover/
focus/disabled/loading (`#2k`), et les variantes vides/pleines (`#2g`, `#2m`).

Fichiers de référence : `app/src/style.ts` (utilitaire `s()`), `app/src/theme.ts`
(jetons dark/light, `--color-*`), `_ds/ovrsee/styles.css` (rampe de couleurs, échelle
typo), `app/src/App.tsx` (châssis), `app/src/tabs/*.tsx` (7 onglets), `Onboarding.tsx`,
`PreferencesPanel.tsx` + `Preferences*.tsx`.

Produire une liste d'écarts concrets, chacun avec : section maquette, fichier:ligne du
code concerné, valeur attendue vs valeur actuelle.

### Phase 2 — Corriger les écarts connus + ceux trouvés en phase 1

- **T-0069** : refondre `SectionProfils` dans `Onboarding.tsx` — ligne de 4 cartes
  compactes, sélection par clic direct (radio), suppression du bouton « Appliquer »
  séparé et de la miniature large. Réutiliser `PreferencesProfils.tsx` si un pattern de
  carte compacte y existe déjà pour éviter la duplication.
- **Panneau Navigateur** : lancer `pnpm electron`, naviguer vers l'onglet Navigateur,
  vérifier visuellement le panneau droit (détail d'élément sélectionné) contre `#2c`,
  corriger les écarts trouvés.
- Le reste des corrections dépend des écarts remontés en phase 1 — probablement des
  ajustements ciblés dans `style.ts`/`theme.ts` (valeurs de jetons) et dans les
  composants d'onglets (usage de mauvaise variable, mauvais rayon, mauvais poids de
  police).

### Phase 3 — Vérification

- `pnpm typecheck` et `pnpm test`.
- Re-capture Chrome de chaque onglet touché (dark **et** clair) + Electron pour
  Navigateur, comparée à nouveau contre la section maquette correspondante.
- Fermer/mettre à jour T-0069 et créer un ticket pour tout écart net-nouveau trouvé et
  corrigé (skill `ovrsee-tickets`), avec référence à la section `#2x` concernée.

## Vérification end-to-end

1. `pnpm dev` (déjà lancé sur :5180) pour les onglets web-visibles ; `pnpm electron`
   pour Navigateur.
2. `pnpm typecheck && pnpm test`.
3. Comparaison visuelle Chrome/Electron section par section contre
   `Ovrsee App.dc.html#2a`…`#2m`, dark et clair.
