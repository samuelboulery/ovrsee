---
{
  "id": "T-0238",
  "titre": "Trente-deux clés de traduction mortes, et trois qui ne l’étaient pas",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "dette",
    "audit",
    "i18n"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "xs"
}
---

## Contexte

`hooks/i18n.js` porte 738 clés par langue. Vingt-trois n'ont plus aucun
appelant, dans aucun fichier de `app/src` ni dans `electron/menu.js` :
`pref.profile_apply`, `pref.profile_current`, `pref.preview`, `msg.plan`,
`msg.plans`, `onboard.step`, les quatre `equipment.*`, sept `a11y.*`,
`apercu.actions`, `apercu.terminal_claude`, `deploiements.add_deploy`,
`deploiements.add_db`, `historique.subtitle`, `historique.no_tickets`.
Quarante-six lignes avec le pendant anglais.

**Attention au faux positif, il est réel** : les six `pref.accent_*` sortent
d'une recherche naïve mais sont bien appelées — `t(\`pref.accent_${nom}\`)` en
gabarit, `PreferencesProjet.tsx:391`. Elles restent. Toute autre clé construite
dynamiquement doit être cherchée de la même façon avant d'être retirée.

Les sept `a11y.*` méritent un regard avant la suppression : une clé
d'accessibilité orpheline peut signaler un `aria-label` perdu en refactor
plutôt qu'un libellé devenu inutile. Si c'est le cas, c'est l'étiquette qu'il
faut rendre, pas la clé qu'il faut retirer.

## Critères d'acceptation

- [ ] Les clés sans appelant sont retirées des deux dictionnaires, `fr` et `en`.
- [ ] Les six `pref.accent_*` sont toujours là, et le choix d'accent affiche toujours ses six noms.
- [ ] Chaque `a11y.*` retirée l'a été après avoir vérifié que l'élément qu'elle nommait a bien disparu.
- [ ] Le test de parité des dictionnaires reste vert, `pnpm typecheck` aussi.
