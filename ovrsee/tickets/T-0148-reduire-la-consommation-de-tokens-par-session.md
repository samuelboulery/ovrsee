---
{
  "id": "T-0148",
  "titre": "Réduire la consommation de tokens par session",
  "type": "epic",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "perf",
    "config"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-de-consommation-de-tokens-constats-et-correctifs.md"
}
---

## Contexte

Un audit mesuré sur les dix dernières sessions du projet a chiffré ce que coûte
une session Claude Code ici. Le résultat contredit l'intuition de départ :
l'ovrsee n'est pas le poste de dépense. Son brief de démarrage pèse 881 octets
(~220 tokens), ses onze outils MCP ~615 tokens.

Le coût réel est ailleurs, et il est simple : `cache_read` représente 65 à 98 %
du total, c'est-à-dire `taille du contexte × nombre de tours`. Une session
(be60f5f2, 13 août) a payé 403 M de tokens de relecture sur 1019 tours, soit un
contexte moyen de 396 k tokens à chaque tour.

Deux variables commandent donc tout : jusqu'où le contexte a le droit de
gonfler, et combien de tours on lui fait relire. Cet epic regroupe les quatre
leviers, du plus rentable au plus marginal, plus les deux mines à désamorcer
dans le code du dépôt.

Écarté d'emblée, parce que mesuré à zéro : la statusline (elle s'affiche dans
le terminal, elle n'entre jamais dans le contexte du modèle) et les 66 Mo de
captures de `ovrsee/pages/shots` (le brief n'en lit qu'un compteur).

## Critères d'acceptation

- [ ] Le premier message d'une session neuve dans ovrsee passe de ~43 000 à
      ~35 000 tokens (`input_tokens + cache_creation_input_tokens` du premier
      message assistant du JSONL).
- [ ] Aucun appel au MCP de l'ovrsee ne peut renvoyer plus de ~5 000 tokens sans
      un drapeau explicite.
- [ ] `pnpm test` passe.
- [ ] Les skills et agents réellement utilisés restent tous invocables.
