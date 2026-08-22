---
{
  "id": "T-0201",
  "titre": "Supprimer settings.claude, jamais lu",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "xs",
  "tags": ["dette"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null,
  "epic": "T-0197"
}
---

## Contexte

`DEFAULT_SETTINGS.claude = { niveau, usage }` porte son propre acte de décès en
commentaire : « Ni `niveau` ni `usage` ne sont plus posés par l'accueil (la
galerie de profils remplace les deux questions) — le champ reste pour
compatibilité mais retombe toujours sur son défaut. »

Personne ne le lit non plus : ni l'interface, ni les hooks, ni le serveur MCP.
Restent le défaut, deux `validerEnum`, les listes `NIVEAUX_CLAUDE` et
`USAGES_CLAUDE` exportées pour elles seules, le champ dans `SettingsType`, et
les tests qui vérifient cette validation.

La compatibilité invoquée ne coûte rien à abandonner : un fichier de profil qui
porte encore `claude` verra simplement la clé ignorée, et `readSettings()` ne
lève jamais sur un champ inconnu.

## Critères d'acceptation

- [ ] `claude`, `NIVEAUX_CLAUDE` et `USAGES_CLAUDE` sont retirés de `hooks/settings.js`.
- [ ] Le champ sort de `SettingsType` dans `app/src/data.ts`.
- [ ] Les cas de test qui ne portaient que sur cette validation sont retirés.
- [ ] Un `settings.json` existant contenant encore `claude` se lit sans erreur.
