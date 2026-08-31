---
{
  "id": "T-0223",
  "titre": "Un commit s'inscrit dans tous les plans qu'il réalise",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "hooks",
    "plans"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-un-plan-ne-doit-plus-pouvoir-rester-ouvert-sans-commit.md",
  "charge": "s"
}
---



## Contexte

Un plan de cette session est resté ouvert, à zéro commit, donc inclosable : il
a fallu un script jetable appelant `updatePlanMeta` puis une PR (#88) pour le
solder.

**La cause.** `planPourCommit` (`hooks/ovrsee-post-commit.js`) s'arrête au
premier de ses quatre étages qui répond. Un commit citant `T-0216` est parti au
plan de ce ticket, et le plan actif de la session — celui des préférences, tout
aussi réalisé par ce commit — n'a rien reçu.

**L'aggravation.** `closeOpenPlans` (`hooks/plans.js`) refuse de dater la
clôture d'un plan sans commit, et passe son tour **en silence** : un `continue`
sans un mot. Le plan serait resté ouvert indéfiniment, en captant au passage
tout commit de la session.

## Ce qui est arbitré

Un commit s'inscrit dans **tous** les plans qu'il réalise — les plans des
tickets cités *et* le plan actif de la session. Mais seuls les tickets du plan
**désigné par la citation** avancent en colonne finale : le plan de session
reçoit la trace, pas le pouvoir de solder ce que personne n'a désigné.

Le repli sur l'unique plan actif reste un dernier recours, jamais un ajout.

## Critères d'acceptation

- [x] Un commit citant un ticket du plan A, fait pendant que la session pointe
      le plan B, est inscrit dans **les deux** — et un test le vérifie, rouge
      avant la correction.
- [x] Seuls les tickets du plan cité passent en colonne finale.
- [x] `closeOpenPlans` journalise le plan ouvert sans commit qu'il laisse en
      l'état, avec le geste pour le réparer.
- [x] `ovrsee:close <plan.md>` ne clôt que ce plan-là.
- [x] `ovrsee:close --commit <sha>` rattache un commit au plan visé — le geste
      que ce dépannage a demandé, sans script jetable.
- [x] `ovrsee:close --help` affiche l'usage **sans rien clore**.
- [x] `ovrsee:status` liste les plans ouverts à zéro commit.
