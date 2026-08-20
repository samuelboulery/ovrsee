---
{
  "id": "T-0187",
  "titre": "Rédiger les traces de la commande dev avant de les committer",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "securite",
    "crawl"
  ],
  "cree": "2026-08-20",
  "maj": "2026-08-20",
  "plan": "2026-08-20-corriger-les-trois-issues-ouvertes.md",
  "charge": "s"
}
---

## Contexte

Issue #26. Le crawl retient jusqu'à 2 ko bruts de stdout/stderr de la commande
`dev` du projet observé (`crawl/index.js`, `DERNIERS_OCTETS`) et les joint au
message d'erreur écrit par `recordScan()` dans `ovrsee/pages/scans.jsonl` — un
fichier tracké par git. Une commande `dev` qui meurt sur une variable
d'environnement manquante imprime parfois sa valeur : le secret part alors dans
l'historique git sans qu'aucun humain n'ait relu la ligne.

La rédaction va dans `recordScan()`, seul point d'écriture : tout chemin d'échec
présent ou futur y passe.

## Critères d'acceptation

- [ ] Une fonction `redige()` exportée masque `NOM=valeur` / `NOM: valeur` quand
      `NOM` contient KEY, TOKEN, SECRET, PASSWORD, PASSWD, PWD, AUTH ou
      CREDENTIAL, les jetons `sk-…`, `gh[pousr]_…`, les JWT `eyJ…`, et le mot de
      passe d'une URL `scheme://user:pass@hôte` — l'hôte restant lisible.
- [ ] `recordScan()` l'applique à `entry.error` avant d'écrire.
- [ ] `pnpm: command not found` ressort **intact** : c'est l'échec le plus
      fréquent et la raison d'être de cette trace.
- [ ] `crawl/redaction.test.js` couvre un cas par motif plus le cas négatif.
