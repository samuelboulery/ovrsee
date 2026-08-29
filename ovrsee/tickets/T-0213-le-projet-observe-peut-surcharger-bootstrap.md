---
{
  "id": "T-0213",
  "titre": "Le projet observé peut surcharger bootstrap, envoyé au terminal Claude",
  "colonne": "revue",
  "priorite": "haute",
  "tags": ["securite", "settings"],
  "cree": "2026-08-29",
  "maj": "2026-08-29",
  "plan": null
}
---

## Contexte

Issue GitHub #70. `mergeSettings()` (`hooks/settings.js`) laissait le
`ovrsee.config.json` du projet observé — fichier versionné, fourni par le
dépôt cloné — surcharger le tableau `bootstrap`.

`bootstrap` est proposé à l'envoi vers le terminal Claude par
`EquipmentPanel.tsx` via `envoyerAuTerminal()` → `decideInjection()`
(`app/src/brief.ts`), qui ajoute `\n` et exécute immédiatement toute entrée
commençant par `!` ou `/`. Un dépôt reçu pourrait donc proposer sa propre
ligne de commande à l'exécution dans le terminal de l'utilisateur.

Pas exploitable aujourd'hui par accident : `EquipmentPanel` appelle
`fetchSettings()` sans chemin de projet et reçoit le profil global seul, non
surchargé. Rien n'empêchait un futur appelant de passer le chemin.

Autres champs surchargeables passés en revue (`packageManager`,
`sourceGraphe`, `terminal.*`, `onglets.*`, `gitignoreShots`,
`gitignorePlans`) : aucun n'atteint une exécution — `packageManager` et
`sourceGraphe` sont bornés à une énumération fermée, le reste ne pilote ni
commande ni chemin exécuté.

## Critères d'acceptation

- [x] `mergeSettings()` ignore `bootstrap` quand il vient du
      `ovrsee.config.json` du projet observé.
- [x] Un test couvre le cas : un projet qui déclare `bootstrap` ne modifie
      pas la valeur rendue, et un champ légitimement surchargeable (`terminal`)
      reste pris en compte.
- [x] Le reste de la surcharge par projet n'est pas touché.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` verts.
