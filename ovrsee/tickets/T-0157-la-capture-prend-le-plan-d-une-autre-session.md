---
{
  "id": "T-0157",
  "titre": "La capture prend le plan d'une autre session",
  "colonne": "revue",
  "priorite": "haute",
  "tags": [
    "hooks",
    "multi-session",
    "bug"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-rendre-l-etat-plan-actif-ticket-actif-propre-a-chaque-sessio.md",
  "epic": "T-0156",
  "charge": "s"
}
---

## Contexte

`planFrom()` (`hooks/ovrsee-capture-plan.js:104-118`) retombe sur **le fichier le plus
récent de `~/.claude/plans/`** quand `tool_input.plan` et `planFilePath` sont absents du
payload — ce qui est le cas depuis Claude Code 2.1.226.

Ce repli ignore la session **et le projet**. Constaté le 16 août 2026 : l'approbation d'un
plan sur ce dépôt a capturé le plan « shotframe — audit d'optimisation » d'une session
voisine travaillant sur un autre dépôt, et `.active-plan` a pointé dessus. La fenêtre de
fraîcheur de 10 minutes ne borne rien quand planifier en parallèle est le cas nominal.

Le payload porte `transcript_path`, et le transcript d'une session nomme son fichier de
plan — une seule correspondance `~/.claude/plans/*.md`, vérifié sur la session courante.

## Critères d'acceptation

- [ ] `planFrom()` essaie dans l'ordre : `tool_input.plan`, `planFilePath`, le plan cité
      par `transcript_path`, puis seulement le fichier le plus récent.
- [ ] Le dernier repli écrit un avertissement sur stderr — à ce stade, il devine.
- [ ] Test : un transcript citant un plan, un autre fichier plus récent dans le dossier,
      et c'est bien celui du transcript qui est retenu.
