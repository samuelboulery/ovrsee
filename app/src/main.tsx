import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Le design system Nocturne, importé sans modification. Toutes les couleurs et
// tous les espacements du port en viennent — c'est ce qui garantit que le
// rendu reste celui de la maquette.
import '../../_ds/nocturne-16d90168-f621-47c2-b3bb-29511cfd6dd0/styles.css'

import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root introuvable')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
