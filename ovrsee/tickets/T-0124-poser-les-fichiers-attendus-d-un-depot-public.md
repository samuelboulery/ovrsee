---
{
  "id": "T-0124",
  "titre": "Poser les fichiers attendus d'un dépôt public",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0123",
  "tags": [
    "infra"
  ],
  "cree": "2026-08-13",
  "maj": "2026-08-13",
  "plan": "2026-08-13-professionnaliser-le-depot-avant-le-passage-en-public.md"
}
---

## Contexte

Sans licence, GitHub affiche « No license » et personne n'a légalement le droit
de réutiliser le code. Manquent aussi la politique de sécurité, le guide de
contribution, les gabarits d'issue et de PR, et les mises à jour de dépendances.

`.npmrc` n'existe pas : la quarantaine de 24 h sur les versions fraîches que
recommandent les règles du projet contre les publications empoisonnées n'est pas
en place.

## Critères d'acceptation

- [ ] `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
      et `CHANGELOG.md` existent à la racine.
- [ ] `.github/` contient les deux gabarits d'issue en YAML, `config.yml` avec
      `blank_issues_enabled: false`, le gabarit de PR, `CODEOWNERS` et
      `dependabot.yml` sur `npm` et `github-actions`.
- [ ] `package.json` déclare `license`, `engines.node`, `repository`, `bugs` et
      `homepage` — et garde `private: true`.
- [ ] `.npmrc` porte `minimum-release-age=1440`.
