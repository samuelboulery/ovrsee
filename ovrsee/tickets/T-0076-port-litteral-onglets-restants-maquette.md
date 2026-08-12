---
{
  "id": "T-0076",
  "titre": "Port littéral des onglets restants + Préférences + Onboarding",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["ui", "design-system"],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null,
  "charge": "l"
}
---

## Contexte

Chantier 2, suite de [[T-0074]]/[[T-0075]] (châssis + Aperçu, déjà portés). Le même
bug de jetons — `--color-accent-800`/`--color-accent-900` (indigo saturé, quasi noir)
utilisés comme fond, et des `box-shadow` de type glow — existe encore dans les fichiers
non touchés par le premier chantier :

`Illisibles.tsx`, `Onboarding.tsx`, `OnboardingArt.tsx`, `PreferencesControls.tsx`,
`PreferencesProfils.tsx`, `PreferencesPanel.tsx`, `Lightbox.tsx`,
`tabs/Navigateur.tsx`, `tabs/Historique.tsx`, `tabs/Produit.tsx`, `tabs/Donnees.tsx`,
`tabs/Tableau.tsx`, `tabs/Stack.tsx`, `tabs/Environnements.tsx`.

Même traitement que T-0074 : remplacer les fonds `--color-accent-800/900` et les glow
par des valeurs littérales cohérentes avec la palette déjà établie (badges/pastilles
sémantiques vert/ambre/rouge, boîte accent violette mate `#14132a`/`#2a2660`/`#a49dfa`
sans glow, bordures neutres `#22232a`/`#101114`).

## Critères d'acceptation

- [x] Aucun fond `--color-accent-800`/`--color-accent-900` ni `box-shadow` de type glow
      restant dans les fichiers listés ci-dessus (grep de contrôle).
- [x] `pnpm typecheck` et `pnpm test` passent (guard `hooks/couleurs.test.js` mis à jour
      si de nouveaux fichiers sont portés littéralement).
- [x] Vérification visuelle Chrome des écrans touchés (Aperçu, Produit, Historique,
      Tableau, Données).

## Note de périmètre

La classe `.tag-accent` (même bug, `background: var(--color-accent-800)`) a aussi été
trouvée et corrigée dans `SkillsPanel.tsx`, `Deploiements.tsx` (déjà partiellement porté
par T-0074) — hors de la liste initiale mais du même bug, donc dans le périmètre réel.

`PreferencesPanel.tsx`, `PreferencesProfils.tsx`, `PreferencesIntegrations.tsx`,
`PreferencesProjet.tsx`, `PreferencesPreview.tsx` : vérifiés, aucun fond
`--color-accent-800/900` ni glow — rien à porter. Le portage complet de l'écran
Préférences (structure, layout vs maquette) reste hors périmètre de ce ticket, qui ne
visait que ce bug de jetons précis.
