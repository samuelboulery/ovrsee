## Ce que ça change, et pourquoi

<!-- Le pourquoi compte plus que le quoi : le diff dit déjà le quoi. -->

## Vérifié

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] Lancé dans l'application, pas seulement en test — si le changement touche l'interface

<!--
Deux pièges qui ne se voient pas dans les tests :

- Une route testée dans le navigateur n'est pas une route testée dans Electron.
  Le protocole `ovrsee://` n'a ni CORS, ni `Origin`, ni les mêmes en-têtes.
- Un `console.log` dans hooks/ ou server/ atterrit au milieu du flux JSON-RPC
  du serveur MCP et coupe la conversation. Les traces vont sur stderr.
-->

## Notes

<!-- Arbitrages, alternatives écartées, ce qui reste ouvert. Facultatif. -->
