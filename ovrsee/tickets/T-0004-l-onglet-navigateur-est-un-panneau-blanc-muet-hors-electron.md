---
{
  "id": "T-0004",
  "titre": "L'onglet Navigateur est un panneau blanc muet hors Electron",
  "colonne": "fait",
  "priorite": "haute",
  "tags": ["ux", "audit"],
  "cree": "2026-08-09",
  "maj": "2026-08-09",
  "plan": null
}
---

## Contexte

`<webview>` est une balise Electron. Dans `pnpm dev`, ouvert au navigateur, elle
ne rend rien : l'onglet Navigateur affiche un grand rectangle blanc. La barre
d'URL, le bouton « Sélectionner » et le bouton « DevTools » restent affichés et
cliquables, et ne font rien.

Le terminal, lui, dit exactement ce qu'il faut dans la même situation :
« terminal disponible dans l'application, pas dans le navigateur ». L'onglet
Navigateur devrait dire la même chose et masquer ses contrôles.

Deuxième conséquence, plus sournoise : le crawl tourne dans un navigateur. Il
photographie donc ce rectangle blanc. La vignette de la page `/navigateur` dans
l'onglet Produit est un rectangle blanc, à chaque commit, pour toujours — une
capture qui affirme que la page est vide alors qu'elle ne l'est pas. C'est
précisément la dérive que le cadrage interdit.

Deux décisions séparées : dire la vérité dans le navigateur, et décider si
`/navigateur` doit rester dans le périmètre du crawl (`cockpit.config.json`,
champ `ignore`).

## Critères d'acceptation

- [ ] Ouvert dans un navigateur, l'onglet Navigateur affiche un message expliquant
      qu'il n'existe que dans l'application, et n'affiche aucun contrôle inerte.
- [ ] Dans l'application Electron, le comportement est inchangé.
- [ ] La vignette de `/navigateur` dans l'onglet Produit ne montre plus un
      rectangle blanc : soit la route est exclue du crawl, soit la capture montre
      le message.
