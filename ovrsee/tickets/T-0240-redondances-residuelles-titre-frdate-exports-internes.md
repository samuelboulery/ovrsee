---
{
  "id": "T-0240",
  "titre": "Redondances résiduelles : Titre, frDate, exports internes",
  "colonne": "fait",
  "priorite": "basse",
  "tags": [
    "dette",
    "audit"
  ],
  "cree": "2026-09-01",
  "maj": "2026-09-01",
  "plan": null,
  "epic": "T-0232",
  "charge": "xs"
}
---

## Contexte

Trois petits constats, groupés parce qu'aucun ne vaut son propre ticket et que
tous se soldent dans le même passage.

**`Titre` écrit quatre fois.** Même composant, même chaîne de style à un mot
près : `Apercu.tsx:646`, `Branches.tsx:114`, `Environnements.tsx:70` sont
identiques ; `Sante.tsx:163` ajoute `font-family: var(--font-mono)` et prend
`--color-text-discrete` au lieu de `--color-neutral-600`. L'écart de Sante est
peut-être voulu — le vérifier à l'œil avant d'aplatir les quatre.

**`frDate` écrit deux fois.** `hooks/brief.js:86` porte sa propre table de mois
français ; `app/src/data.ts:562` fait la même chose en passant par `getMonth`.
Le brief est FR-seul, l'interface non : la version partagée doit être celle de
`data.ts`, dans un module sans `node:fs` — la contrainte que `density.js` et
`i18n.js` documentent déjà.

**Des `export` sur des symboles à usage interne.** `lightTheme`,
`REQUETE_CLAIR`, `watchSystemTheme` (`theme.ts`), `injectTo` (`pty.ts`),
`BOOTSTRAP_DEFAUT` (`profilage.ts`), `USAGE_CLOSE` (`ovrsee-cli.js`),
`MESSAGE_REFUS` (`crawl/confiance.js`) : aucun appelant hors de leur fichier,
aucun test qui les touche. Zéro ligne à gagner, une surface publique en moins —
c'est la suite de [[T-0203]], et la preuve que ce genre de constat revient si
rien ne le mesure.

Reste aussi `IconDark` (`PreferencesControls.tsx:232`), exporté et appelé nulle
part : une ligne, mort pour de bon.

## Critères d'acceptation

- [ ] Un seul composant `Titre` dans `app/src` ; si Sante garde son style propre, un commentaire dit pourquoi.
- [ ] Une seule implémentation de `frDate`, importable par `hooks/` comme par `app/src`, sans `node:fs`.
- [ ] Les sept symboles listés ne sont plus exportés ; `IconDark` n'existe plus.
- [ ] `pnpm typecheck`, `pnpm lint` et `pnpm test` verts.
