---
{
  "id": "T-0172",
  "titre": "Un signal « busy » qui porte la demande envoyée",
  "colonne": "backlog",
  "priorite": "haute",
  "charge": "s",
  "tags": ["hooks", "terminal"],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-lire-un-ticket-en-grand-et-rendre-les-terminaux-bavards.md"
}
---

## Contexte

Le canal de signal ne connaît que « a fini » et « attend une réponse ». Il manque
l'état où Claude passe l'essentiel de son temps — au travail — et le texte de la
demande, qui est aussi ce qui nomme l'onglet.

## Critères d'acceptation

- [ ] `UserPromptSubmit` émet un signal de genre `busy` portant le prompt.
- [ ] L'installateur enregistre les trois événements, et `signalInstalle` les
      exige tous les trois — une machine équipée avant ce lot est signalée
      incomplète plutôt que muette.
- [ ] L'entrée de `ovrsee-capture-audit` sur `UserPromptSubmit` survit intacte.
- [ ] `attention.ts` reconnaît `busy` et expose `etiquetteDe(prompt)`, éprouvée.
