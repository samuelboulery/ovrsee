---
{
  "id": "T-0244",
  "titre": "Un dépôt observé exécute du code au premier regard",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "securite"
  ],
  "cree": "2026-09-02",
  "maj": "2026-09-02",
  "plan": "2026-09-02-audit-complet-pre-release-1-2-0-plan-d-execution.md",
  "epic": "T-0243"
}
---

## Contexte

`git status`, `git log` et `git fetch` honorent le `.git/config` du dépôt sur
lequel ils tournent. `core.fsmonitor` y nomme un programme lancé au premier
`git status` ; `core.pager`, `diff.external`, `core.sshCommand` et
`credential.helper` en nomment d'autres. Un dépôt reçu d'ailleurs — archive,
clé, clone hostile — les apporte avec lui.

L'ovrsee lit un dépôt **avant** que quiconque ait accordé quoi que ce soit :
l'inscrire au registre déclenche `snapshot()`, donc `git status`. L'accord de
[[T-0190]] ne couvre que la ligne `dev` du crawl, et arrive bien plus tard.
Inscrire un projet exécutait donc du code de ce projet.

Démontré sur un dépôt jetable : un script nommé par `core.fsmonitor` s'exécute
au premier `git status`, et se neutralise par `-c core.fsmonitor=false`.

## Critères d'acceptation

- [x] Un module unique porte la garde, et toute commande git visant un dépôt observé y passe.
- [x] Un test pose un dépôt piégé et vérifie qu'aucune lecture ne l'exécute.
- [x] Le test vérifie d'abord que le piège mord sans la garde : un test qui ne peut pas échouer ne prouve rien.
