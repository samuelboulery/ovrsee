---
{
  "id": "T-0235",
  "titre": "detect-package-manager n’a jamais été branché",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "dette",
    "audit",
    "code-mort"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "xs"
}
---

## Contexte

`hooks/detect-package-manager.js` (65 l) n'a qu'un appelant dans tout le
dépôt : `hooks/detect-package-manager.test.js` (77 l). Rien d'autre ne
l'importe.

Le gestionnaire de paquets affiché par l'application vient d'ailleurs : c'est
`settings.packageManager`, un menu déroulant dans `PreferencesProjet.tsx`, lu
par `composerCommande()` (`data.ts`). Un réglage manuel, avec `'pnpm'` en
défaut.

Le détail qui tranche : [[T-0205]] a **amélioré** ce module — lire le champ
`packageManager` de `package.json` avant de renifler les lockfiles — sans que
personne remarque qu'aucun appelant n'en profiterait. Un module qu'on corrige
sans jamais l'exécuter est la définition du code mort.

Deux issues possibles, et le ticket n'en impose aucune : le supprimer, ou le
brancher comme défaut du réglage quand l'utilisateur n'a rien choisi. La
seconde est une fonctionnalité, pas un dégraissage — si elle est retenue, elle
sort de cet epic et devient son propre ticket.

## Critères d'acceptation

- [ ] `detect-package-manager.js` et son test sont supprimés, **ou** le module a un appelant en production.
- [ ] Aucun import cassé, `pnpm test` et `pnpm lint` verts.
