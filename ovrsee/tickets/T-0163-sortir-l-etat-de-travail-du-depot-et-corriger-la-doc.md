---
{
  "id": "T-0163",
  "titre": "Sortir l'état de travail du dépôt, et corriger la doc",
  "colonne": "revue",
  "priorite": "basse",
  "tags": [
    "git",
    "documentation"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "s"
}
---

## Contexte

`ovrsee/.active-ticket` est versionné, ajouté par accident dans `e4a6ce1`. Un état de
travail local n'a rien à faire dans le dépôt : il produit des conflits entre branches et
entre machines, et avec des pointeurs par session ce serait un fichier de plus par session.

`hooks/gitignore-sync.js` ne gère que deux blocs optionnels (`BLOC_SHOTS`, `BLOC_PLANS`) —
sans un troisième bloc, chaque projet observé remettrait ses pointeurs sous suivi.

Et deux entrées de « Pièges connus » de `CLAUDE.md` deviennent fausses : un plan actif ne
capte plus *tous* les commits, seulement ceux de sa session.

## Critères d'acceptation

- [ ] `.gitignore` couvre `ovrsee/.active*` ; `ovrsee/.active-ticket` n'est plus suivi
      (`git rm --cached`, fichier local conservé).
- [ ] `gitignore-sync.js` pose un bloc inconditionnel pour `ovrsee/.active/`.
- [ ] `CLAUDE.md` dit que la portée est la session, et signale le nouveau piège : un commit
      fait hors de Claude Code, sans `T-XXXX` dans son message, ne se rattache à rien quand
      plusieurs plans sont actifs.
- [ ] `README.md`, `README.fr.md` et `skills/ovrsee-tickets/SKILL.md` pointent vers
      `ovrsee/.active/`.
