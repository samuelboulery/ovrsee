---
{
  "id": "T-0104",
  "titre": "Préférences — rayon de modale, hauteur des rangées, titres de section",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "design",
    "preferences"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.7. Vérifié dans `PreferencesPanel.tsx`/`PreferencesControls.tsx` :

- Modale (ligne 610) : rayon 10px au lieu des 14 de l'audit.
- Rangées de navigation (ligne 629, colonne 220px — Profils/Général/
  Interface/Claude Code/Projet) : hauteur implicite ~28px (`padding: 7px
  10px`) au lieu des 31px fixes, identiques aux lignes de vue de la
  sidebar (`RailLink`, posées au Lot 2).
- `SectionTitle` (`PreferencesControls.tsx` lignes 67-76) : `var(--font-heading)`
  17px — l'audit demande explicitement de le remplacer par le libellé mono
  (comme `.kicker`, posé au Lot 1), cohérent avec le reste des titres de
  section de l'app.

Le segmenté (`.seg`/`.seg-opt`) et le switch 28×16 sont déjà conformes —
rien à faire dessus.

## Critères d'acceptation

- [ ] Modale : rayon 14px.
- [ ] Rangées de navigation : hauteur 31px fixe.
- [ ] `SectionTitle` : libellé mono (`.kicker` ou équivalent) au lieu de
      `--font-heading` 17px.
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur le
      panneau Préférences, section Interface.
