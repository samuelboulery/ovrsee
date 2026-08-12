---
{
  "id": "T-0109",
  "titre": "ErrorBox — jetons err littéraux légèrement décalés du Lot 1",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "design",
    "erreur"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit §6, Lot 7 : « états de chargement/erreur, absents de la maquette —
demander avant d'inventer ». Demandé à l'utilisateur, réponse : traitement
minimal, pas de nouvelle UI.

Vérifié : l'app a déjà tout ce qu'il faut. `Message` (`App.tsx` ligne 825,
chargement/erreur au niveau app) est déjà sur jetons propres. `ErrorBox`
(`PreferencesControls.tsx` ligne 210-221) existe pour les erreurs de
formulaire, mais ses trois couleurs sont en littéral et légèrement
décalées des jetons `--color-err`/`--color-err-bg`/`--color-err-border`
posés au Lot 1 (`#e5677a`/`#170b0e`/`#3d1c22`) : le code a `#e5677a`
(identique), `#1c0d10` (proche, pas exact) et `#3a1c22` (proche, pas
exact).

**Pas d'autre changement** : aucun spinner, aucun état de chargement par
onglet, aucune icône d'erreur nouvelle — l'audit prévient explicitement de
ne rien inventer sans maquette, et le texte centré existant
(`Message`) suffit déjà à la fonction.

## Critères d'acceptation

- [ ] `ErrorBox` : couleur/fond/filet remplacés par
      `var(--color-err)`/`var(--color-err-bg)`/`var(--color-err-border)`.
- [ ] `pnpm typecheck && pnpm test` passent.
