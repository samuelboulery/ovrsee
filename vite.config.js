import { randomBytes } from 'node:crypto'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { nodeMiddleware } from './server/api.js'

/**
 * Sert les données de l'ovrsee au dev server.
 *
 * Pas de backend : l'ovrsee lit des fichiers, il n'a rien à exécuter ni à
 * stocker. Les routes elles-mêmes vivent dans `server/api.js`, partagées avec
 * l'application Electron — deux implémentations divergeraient.
 *
 * Le jeton `X-Ovrsee` est tiré au démarrage et posé dans la page servie. Ce
 * n'est pas une authentification : tout processus local qui fait `GET /` le
 * lit. Il ferme une seule porte, celle d'une page web, qui ne peut ni lire ce
 * `<meta>` (pas de CORS) ni deviner une constante comme `'1'`. Le vrai rempart
 * reste `cors: false` et le refus de `Sec-Fetch-Site` cross-site (`server/api.js`).
 * Le build ne le porte pas : sous Electron, `ovrsee://` n'est joignable que par
 * l'interface, et le serveur y attend `'1'`.
 */
const ovrseeData = () => {
  const jeton = randomBytes(24).toString('hex')
  return {
    name: 'ovrsee-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(nodeMiddleware(undefined, { jeton }))
    },
    transformIndexHtml: html =>
      html.replace('</head>', `  <meta name="ovrsee-jeton" content="${jeton}" />\n  </head>`),
  }
}

export default defineConfig({
  root: 'app',
  plugins: [react(), ovrseeData()],
  // Ne pas poser `host` ni élargir `allowedHosts` sans mesurer ce que ça coûte.
  // Ce qui protège ce serveur du DNS rebinding n'est pas notre code : c'est le
  // `hostValidationMiddleware` de Vite, posé AVANT les hooks `configureServer`
  // — donc avant le middleware `/api` ci-dessus. Sans lui, un domaine qui se
  // rebinde sur 127.0.0.1 devient même origine que l'interface, et la garde
  // d'origine de `server/api.js` tombe avec la politique CORS. Les deux
  // réglages le lèvent en silence, sans rien casser de visible. (T-0193)
  //
  // `cors: false` : l'interface est de même origine que `/api`, elle n'en a pas
  // besoin. La politique par défaut de Vite ouvre le serveur à toute origine
  // `localhost` — `/@fs/` et `/__open-in-editor` compris. (T-0274)
  server: { port: 5180, strictPort: true, cors: false },
})
