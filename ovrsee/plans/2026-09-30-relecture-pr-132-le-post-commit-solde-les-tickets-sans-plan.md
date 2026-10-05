---
{
  "status": "closed",
  "title": "Relecture PR #132 — « le post-commit solde les tickets sans plan cités »",
  "opened": "2026-09-30",
  "closed": "2026-10-05",
  "commits": [
    {
      "sha": "8e28d14",
      "date": "2026-10-05",
      "files": []
    }
  ]
}
---

# Relecture PR #132 — « le post-commit solde les tickets sans plan cités »

Autrice : Floriane-ju · 1 commit · +83/−1 · 2 fichiers · CI verte (checks, test-mac, test-win).

## Verdict

**Bon correctif, à merger après une retouche de doc.** Le diagnostic est juste : un
ticket `plan: null` ne passait ni par `plansPourCommit` (refusé par
`isSafePlanFileName`) ni par `avancerTicketsDuPlan`. Le correctif est étroit : il faut
une citation explicite, le ticket doit être en vol, et un ticket lié à un plan reste à
la règle du plan. Les trois tests couvrent le nominal, le non cité, le jamais commencé
et le ticket lié. Bon choix aussi : `reconcile` (post-merge) n'est **pas** élargi, donc
aucun message venu d'un remote ne solde de ticket ad hoc.

## À corriger avant merge

1. **La doc du skill devient fausse.** `skills/ovrsee-tickets/SKILL.md:115-117` dit :
   « `moveTicket` à la main […] pour un ticket sans `plan` renseigné — ces hooks ne
   suivent que les tickets liés au plan actif ». Il faut ajouter : un commit qui cite
   un ticket sans plan le solde. Le skill est installé chez les utilisateurs, et c'est
   lui qui guide le modèle.
2. **Effet de bord non annoncé : l'interaction avec le gate.**
   `ticketActifManquant` (`hooks/ovrsee-tool-edit-gate.js:55-63`) compte un ticket
   actif en colonne finale comme manquant. Désormais, un commit intermédiaire qui cite
   le ticket ad hoc (`wip: … (T-0258)`) le solde. **L'édition suivante est alors
   bloquée**, avec un message trompeur : « ni plan actif ni ticket actif ». Côté plan,
   rien de tel : `ticketManquant` accepte un ticket soldé. C'est défendable (citer =
   clore), mais il faut l'écrire. Deux retouches minimales :
   - dans la PR, une ligne dans CLAUDE.md (section « Un commit s'inscrit dans tous les
     plans… », qui ne parle que des plans) et dans le skill : « citer un ticket ad hoc
     le clôt ; pour un commit intermédiaire, ne pas le citer » ;
   - en suivi (ticket séparé) : un message du gate qui dit « T-XXXX soldé par le
     dernier commit — le rouvrir (`moveTicket` → en-cours) ou en créer un ».

## Remarques mineures (non bloquantes)

- **Triple copie de la règle « en vol ».** La garde `colonne !== finale && rang >=
  iEnCours`, avec `colonnes`, `finale`, `iEnCours` et `rangDe`, existe maintenant dans
  `avancerTicketsDuPlan`, `avancerTicketsClos` (`tickets.js:666`) et
  `avancerTicketsCites`. Un prédicat `enVol(colonnes)` dans `tickets.js` les unifierait
  (−15 lignes environ). Ça peut attendre un refactor dédié.
- **Regex `T-\d{4}`**, recopiée pour la troisième fois. `active.js` utilise `T-\d+`.
  À partir de T-10000, `T-10000` sera lu comme `T-1000` et soldera le mauvais ticket.
  Le problème existait avant la PR ; une constante partagée `/T-\d{4,}/g` le règle
  partout.
- **Trou résiduel, déjà présent avant la PR.** Un ticket dont `plan` pointe vers un
  plan inexistant ou jamais capturé n'est soldé par aucune règle : il est exclu
  d'`avancerTicketsCites` (plan non vide) et absent de `rattaches`. Le commentaire
  « reste à la règle du plan » suppose que ce plan existe.
- **Trace absente.** Le retour `soldes` est ignoré. Une ligne stdout
  `[ovrsee] ticket soldé : T-XXXX` rendrait visible un mouvement automatique, dans
  l'esprit de ce que `reconcile` fait sur stderr. Optionnel, par cohérence.
- **Tests manquants, faibles.** Aucun test pour un ticket cité déjà en finale
  (idempotence) ni pour un board sans `en-cours`. Le code les garde, mais aucun test
  ne l'épingle.
- La description de la PR est bonne : problème, chiffres, plan de test, hors périmètre.

## Suite proposée (si approuvé)

- Publier cette relecture sur la PR #132 en **request changes**
  (`gh pr review 132 --request-changes --body-file <scratchpad>/review-132.md`) :
  points 1 et 2 demandés, mineures en suggestions. Corps en français, sans mention
  « Generated with ».
- Aucune modification de code de ma part sur la branche de l'autrice.

## Vérification

- CI verte sur la tête `9c15457` (3 jobs).
- Le point 2 se reproduit en lisant le code (`ticketActifManquant` + `moveTicket` vers
  la finale). Un test d'intégration local est possible : créer un ticket ad hoc, faire
  un commit qui le cite, puis appeler `ticketActifManquant`, qui doit rendre `true`.
