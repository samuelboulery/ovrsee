---
{
  "id": "T-0279",
  "titre": "Les captures du README montrent des données personnelles",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "docs"
  ],
  "cree": "2026-10-05",
  "maj": "2026-10-05",
  "plan": null
}
---

## Contexte

Les sept captures régénérées en T-0278 montrent le nom d'utilisateur du poste
(pied de la barre latérale), le chemin absolu du dépôt (`/Users/<nom>/…`, dans
Aperçu et dans le Navigateur) et le forfait Claude du compte (« Claude Max », dans
la bannière de `claude` du terminal intégré).

## Critères d'acceptation

- [x] `scripts/screenshots.js` neutralise avant chaque capture : dossier personnel
      → `~`, nom d'utilisateur → `demo`, forfait Claude retiré — dans la fenêtre,
      le terminal intégré et le `<webview>` du Navigateur.
- [x] Les sept captures sont régénérées et relues : ni nom, ni `/Users/`, ni forfait,
      ni autre projet que l'ovrsee.
- [x] `pnpm lint`, `pnpm typecheck` et `pnpm test` passent.
