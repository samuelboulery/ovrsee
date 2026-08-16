// WHY: l'interface n'est qu'une vue sur des fichiers, et React la rend
// remplaçable — le cadrage pose que si l'application disparaît, rien n'est
// perdu. Un framework qui possède les données irait contre ça.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Le design system Ovrsee (refonte T-0045, remplace Nocturne). Toutes les
// couleurs et tous les espacements du port en viennent — c'est ce qui
// garantit que le rendu reste celui de la maquette.
import '../../_ds/ovrsee/styles.css'

import { App } from './App'
import { MenuBar } from './MenuBarPanel'
import { initializeTheme } from './theme'

// Initialiser le système de thème avant le rendu
initializeTheme()

const container = document.getElementById('root')
if (!container) throw new Error('#root introuvable')

/**
 * Le popover de la barre de menu est un second rendu de la même origine, pas
 * une seconde application : `electron/tray.js` le charge sur cette route. Le
 * branchement est ici plutôt que dans `App` — il n'a ni onglets, ni barre
 * d'état, ni projet courant.
 */
const POPOVER = '/barre-de-menu'

createRoot(container).render(
  <StrictMode>{window.location.pathname === POPOVER ? <MenuBar /> : <App />}</StrictMode>,
)
