---
{
  "id": "T-0175",
  "titre": "Trois correctifs sur le panneau terminal",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "s",
  "tags": ["ui", "terminal"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-cinq-correctifs-sur-le-panneau-terminal-et-le-panneau-de-tic.md"
}
---

## Contexte

Constats d'usage sur l'état de session posé la veille : une pastille de panneau
qui se lit comme un onglet vide, un nom d'onglet qui survit au `/clear`, et un
`?` qui apparaît sans question — `idle_prompt` arrive une minute après un `Stop`
et transforme la coche verte en point d'interrogation.

## Critères d'acceptation

- [ ] Plus de pastille à gauche de la rangée d'onglets ; l'indisponibilité du
      terminal reste annoncée par le repli existant.
- [ ] `/clear` rend à l'onglet son nom d'origine, sauf s'il a été renommé à la
      main.
- [ ] Le `?` ne paraît que sur une vraie question — permission ou sous-agent en
      attente, jamais sur une session simplement laissée de côté.
