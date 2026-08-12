---
{
  "id": "T-0102",
  "titre": "Fondations — ombre bleutée pré-Lot1 (--shadow-lg)",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "design",
    "fondations"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": null
}
---

## Contexte

Audit design §4.9. Vérifié dans `_ds/ovrsee/styles.css` ligne 153 :
`--shadow-lg: 0 0 0 1px #8799ab, 0 16px 40px rgba(0, 0, 0, 0.65);` —
`#8799ab` est l'ancienne rampe neutre bleutée d'avant le Lot 1, jamais
migrée. Ce jeton alimente `.elev-lg` et l'ombre de la palette ⌘K
(`CommandPalette.tsx` ligne 177, `box-shadow: var(--shadow-lg)`) : leur
ombre porte encore un anneau bleu fantôme. L'audit §4.9 attend
`0 12px 28px rgba(0,0,0,.5)`.

**Correction d'audit** : les `--theme-bg-*` (Préférences, `PreferencesPreview.tsx`,
etc.) soupçonnés « morts » en première lecture ne le sont pas — ils sont
injectés dynamiquement par `initializeTheme()` (`theme.ts`, appelée au
démarrage dans `main.tsx`), un second système de jetons distinct de
`_ds/ovrsee/styles.css`. Fausse alerte, aucun correctif nécessaire là.
Rétroactivement, T-0097 et T-0101 (Lot 5) avaient la même hypothèse
erronée sur `--theme-bg-secondary` (Navigateur, Données) — le fond
n'était jamais transparent, juste `#101114` au lieu de la valeur exacte
de l'audit. Écart cosmétique mineur déjà réglé dans ces tickets, pas de
retour en arrière nécessaire.

## Critères d'acceptation

- [x] `--shadow-lg` : anneau `#8799ab` retiré, valeur alignée sur l'audit
      (`0 12px 28px rgba(0,0,0,.5)`).
- [ ] `pnpm typecheck && pnpm test` passent ; comparaison Chrome sur la
      palette ⌘K et une modale (Préférences ou Onboarding).
