---
{
  "id": "T-0019",
  "titre": "Frontend : dashboard Aperçu (Santé, Branches, Environnements, README repliable)",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "l",
  "tags": ["frontend", "apercu"],
  "cree": "2026-08-10",
  "maj": "2026-08-10",
  "plan": "2026-08-10-dashboard-pour-l-onglet-apercu.md",
  "epic": "T-0017"
}
---

## Contexte

Une fois les données backend disponibles (T-0018), l'onglet Aperçu doit les
afficher sous forme d'indicateurs factuels (pas de score composite — voir le
plan) et rendre le README consultable à la demande plutôt que toujours
visible.

## Critères d'acceptation

- [ ] `app/src/data.ts` porte les types `GitStatus`, `GitBranch`, `Audit`,
      les champs `Snapshot.gitStatus`/`Snapshot.audits`,
      `OvrseeConfig.environments`, et `lastAudit()`.
- [ ] `app/src/tabs/Sante.tsx` affiche : statut du dernier scan, arbre git
      propre/sale, commits non poussés, dernier audit, âge des plans ouverts
      — sans jugement ni score.
- [ ] `app/src/tabs/Branches.tsx` liste les branches locales avec leur
      tracking et ahead/behind, avec un bouton Rafraîchir qui déclenche
      `git-fetch` et affiche la fraîcheur du dernier fetch connu.
- [ ] `app/src/tabs/Environnements.tsx` affiche les environnements déclarés
      dans `ovrsee.config.json` (nom, lien, branche, badge si elle correspond
      à la branche courante) — masqué si aucun n'est déclaré.
- [ ] `app/src/tabs/Apercu.tsx` intègre les trois composants sous le bandeau
      de chiffres, et replie le README par défaut derrière un bouton
      Voir/Masquer, sans casser le Sommaire (qui ouvre le README avant de
      défiler vers l'ancre visée).
- [ ] Testé en `pnpm dev` sur ce dépôt : les données réelles s'affichent, le
      Rafraîchir met à jour ahead/behind, le README bascule sans perdre le
      Sommaire.
