---
{
  "id": "T-0152",
  "titre": "Dédoublonner caveman et retirer le MCP fantôme",
  "epic": "T-0148",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "xs",
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

Deux résidus de configuration, tous deux visibles dans le transcript de la
session où l'audit a été mené.

**Caveman s'active deux fois.** Une entrée `SessionStart` de
`~/.claude/settings.json` lance `node "$HOME/.claude/hooks/caveman-activate.js"`,
et le plugin `caveman@caveman` déclare son propre hook `SessionStart`. Résultat :
deux blocs de règles identiques à chaque démarrage, et deux rappels identiques à
chaque prompt. Le plugin suffit ; l'entrée de `settings.json` précède son
installation et n'a jamais été retirée.

**Un serveur MCP pointe dans le vide.** `~/.claude.json` déclare un serveur
`cockpit` sur `/Users/sam/code/cockpit/mcp/server.js` — le répertoire n'existe
plus depuis le renommage du projet. Il échoue au démarrage de chaque session.

Au passage : le serveur MCP de l'ovrsee n'est déclaré nulle part. Si l'usage est
voulu, l'inscrire sous son vrai nom vers `/Users/sam/code/ovrsee/mcp/server.js` ;
sinon ne rien remettre — une entrée morte de plus ne vaut pas mieux.

Gain modeste (~300 tokens par session, ~50 par prompt), mais le geste est d'une
minute et supprime une erreur récurrente au démarrage.

## Critères d'acceptation

- [ ] Un démarrage de session n'injecte plus qu'un seul bloc d'activation
      caveman, et un seul rappel par prompt.
- [ ] `~/.claude.json` ne déclare plus de serveur MCP `cockpit`.
- [ ] Aucune erreur MCP au démarrage d'une session neuve.
- [ ] Le serveur MCP de l'ovrsee est soit correctement déclaré, soit absent —
      pas déclaré sur un chemin invalide.
- [ ] Les changements sont répercutés dans `/Users/sam/code/claude-config/claude/`.
