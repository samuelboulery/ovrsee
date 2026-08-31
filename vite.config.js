import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { nodeMiddleware } from './server/api.js'

/**
 * Sert les données de l'ovrsee au dev server.
 *
 * Pas de backend : l'ovrsee lit des fichiers, il n'a rien à exécuter ni à
 * stocker. Les routes elles-mêmes vivent dans `server/api.js`, partagées avec
 * l'application Electron — deux implémentations divergeraient.
 */
const ovrseeData = () => ({
  name: 'ovrsee-data',
  configureServer(server) {
    server.middlewares.use(nodeMiddleware())
  },
})

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
  server: { port: 5180, strictPort: true },
})
