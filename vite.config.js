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
  server: { port: 5180, strictPort: true },
})
