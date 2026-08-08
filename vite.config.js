import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { nodeMiddleware } from './server/api.js'

/**
 * Sert les données du cockpit au dev server.
 *
 * Pas de backend : le cockpit lit des fichiers, il n'a rien à exécuter ni à
 * stocker. Les routes elles-mêmes vivent dans `server/api.js`, partagées avec
 * l'application Electron — deux implémentations divergeraient.
 */
const cockpitData = () => ({
  name: 'cockpit-data',
  configureServer(server) {
    server.middlewares.use(nodeMiddleware())
  },
})

export default defineConfig({
  root: 'app',
  plugins: [react(), cockpitData()],
  server: { port: 5180, strictPort: true },
})
