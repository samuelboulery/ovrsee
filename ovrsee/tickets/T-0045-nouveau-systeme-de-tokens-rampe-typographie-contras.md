---
{
  "id": "T-0045",
  "titre": "Nouveau système de tokens : rampe, typographie, contraste",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "theme",
    "design-system"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-11",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0044"
}
---

## Contexte

Remplacer les tokens Nocturne (`_ds/nocturne-16d90168-.../styles.css`) par le
système de la maquette : rampe `#050506` / `#0B0C0E` / `#0C0D10` / `#101114`
/ `#1C1D24`, accent `#7D76F0`, hiérarchie de texte primaire/secondaire/
tertiaire/quaternaire/discret, IBM Plex Sans (`--font-heading`/`--font-body`)
et une famille mono pour chemins/ids/dates/commits, échelle d'espacement
4·8·12·16·24. Les fichiers woff2 sont auto-hébergés dans `app/src/assets/` —
pas de `<link>` Google Fonts au runtime, l'app doit rester utilisable
hors-ligne une fois packagée.

`theme.ts` (dark/light `darkTheme`/`lightTheme`/`nocturneClair`) est
reconstruit sur cette nouvelle rampe. C'est ce qui referme T-0039 (thème
clair illisible : sidebar, timeline, terminal figés sur le sombre) — le
correctif au cas par cas n'a plus lieu d'être une fois la rampe entière
retenue sur des paires contraste-garanties.

Le reste du code n'a pas à changer : `s()` (`style.ts`) traduit du CSS
inline tel quel, tout passe par les variables `--color-*`/`--space-*`/
`--font-*` déjà utilisées partout — c'est un swap de fichier de tokens, pas
un rewrite des composants.

## Critères d'acceptation

- [ ] `main.tsx` pointe vers le nouveau fichier de tokens ; plus aucun import
      de `_ds/nocturne-*`.
- [ ] Les fontes IBM Plex Sans/Mono sont servies localement (assets committés,
      pas de requête réseau au chargement).
- [ ] Thème clair et sombre passent les critères d'acceptation de T-0039
      (ligne de projet sélectionné, onglet de session terminal actif, cartes
      `PLAN` de la frise, terminal réactif au changement de thème en direct).
- [ ] Aucune régression visuelle non voulue en thème sombre (captures
      avant/après sur les 7 vues).
- [ ] T-0039 est déplacé en colonne finale une fois ces critères vérifiés.
- [ ] `pnpm test` (snapshots des 7 onglets) et `pnpm typecheck` passent.
