import { Component, type ErrorInfo, type ReactNode } from 'react'

import { s } from './style'
import { t } from './i18n'

/**
 * Le garde-fou de rendu.
 *
 * Sans lui, une exception levée pendant le rendu d'un onglet démonte l'arbre
 * React entier : on perd la barre latérale et la barre d'onglets en même temps
 * que l'onglet fautif, donc tout moyen de se rabattre sur un autre projet. Ça
 * s'est produit le 9 août 2026 sur un `pages.json` mal formé — écran noir, rien
 * dans l'interface, tout dans la console.
 *
 * L'ovrsee lit des fichiers écrits par des hooks, sur des projets qu'il n'a
 * pas construits. Il lira un jour un fichier que personne n'a prévu. Corriger
 * les champs un par un est sans fin ; le garde-fou tient pour les cas qu'on n'a
 * pas imaginés.
 *
 * Ce qu'il affiche n'est pas « une erreur est survenue » : l'endroit, le
 * message, et de quoi repartir. Un message générique ne vaut pas mieux que
 * l'écran noir — il cache la même chose, en plus poli.
 */
export function messageDe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  return String(error)
}

interface GardeProps {
  /** Ce qui a échoué, nommé comme l'utilisateur le voit : « l'onglet Produit ». */
  quoi: string
  children: ReactNode
}

interface GardeState {
  error: unknown
}

export class Garde extends Component<GardeProps, GardeState> {
  state: GardeState = { error: null }

  static getDerivedStateFromError(error: unknown): GardeState {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // La console garde la trace complète : le panneau ne montre que le
    // message, mais l'enquête doit rester possible.
    console.error(`[ovrsee] rendu impossible — ${this.props.quoi}`, error, info.componentStack)
  }

  render() {
    if (this.state.error === null) return this.props.children
    return <Panne quoi={this.props.quoi} message={messageDe(this.state.error)} />
  }
}

/**
 * Le panneau affiché à la place de l'onglet.
 *
 * Séparé du garde-fou pour être rendu — et donc éprouvé — sans avoir à faire
 * lever une exception à React.
 */
export function Panne({ quoi, message }: { quoi: string; message: string }) {
  return (
    <div
      role="alert"
      style={s(
        'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center;',
      )}
    >
      <div style={s('font-size: 13px; color: var(--color-text);')}>
        {t('garde.render_failed', { quoi })}
      </div>
      <div
        style={s(
          'font-family: var(--font-mono); font-size: 11.5px; color: var(--color-accent); max-width: 72ch; word-break: break-word;',
        )}
      >
        {message}
      </div>
      <div style={s('font-size: 11.5px; color: var(--color-neutral-600); max-width: 56ch;')}>
        {t('garde.file_error')} <code>ovrsee/</code> que l'ovrsee ne
        sait pas lire.
      </div>
    </div>
  )
}
