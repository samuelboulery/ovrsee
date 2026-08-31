/**
 * La pastille d'état d'une session Claude.
 *
 * Fichier à part, et pas un morceau de `Terminal.tsx` : ce composant est
 * désormais rendu aussi par le sélecteur de projet (`Shell.tsx`), qui est du
 * chargement initial. `Terminal.tsx` charge xterm et vit derrière un `lazy()` —
 * l'importer de là annulerait le découpage du bundle **en silence**, le morceau
 * se recréerait sans que rien n'échoue. Même piège que `pasteToClaude`,
 * documenté dans `CLAUDE.md`. Ce fichier n'importe rien de xterm.
 */

import { Check, Question } from '@phosphor-icons/react'

import type { EtatSession } from './menubar'
import { s } from './style'
import type { TranslationKey } from './i18n'

/** Ce que chaque genre de signal annonce, pour le titre et le lecteur d'écran. */
export const DIT_ATTENTION: Record<EtatSession, TranslationKey> = {
  busy: 'terminal.attention_busy',
  stop: 'terminal.attention_stop',
  question: 'terminal.attention_question',
}

/**
 * L'état d'une session, dans une case de largeur fixe.
 *
 * Fixe pour que passer de trois points à une coche ne fasse pas danser la
 * rangée d'onglets. Trois points qui battent pendant le travail, une coche
 * quand Claude rend la main, un point d'interrogation quand il attend une
 * réponse — l'animation vit dans `_ds/ovrsee/styles.css` (`.battement`), seul
 * endroit où une @keyframes peut être déclarée.
 */
export function Etat({
  kind,
  actif,
  dit,
}: {
  kind?: EtatSession
  actif: boolean
  /** Ce que le signal annonce, ou undefined quand il n'y a rien à annoncer. */
  dit?: string
}) {
  const commun = { role: dit ? 'status' : undefined, 'aria-label': dit, title: dit }
  const boite = 'width: 12px; flex: none; display: flex; align-items: center; justify-content: center; gap: 2px;'

  if (kind === 'busy') {
    return (
      <span {...commun} style={s(boite)}>
        {[0, 160, 320].map(retard => (
          <span
            key={retard}
            className="battement"
            style={s(
              `width: 2px; height: 2px; border-radius: 50%; background: var(--color-accent); animation-delay: ${retard}ms;`,
            )}
          />
        ))}
      </span>
    )
  }

  if (kind === 'stop' || kind === 'question') {
    const Icone = kind === 'stop' ? Check : Question
    return (
      <span {...commun} style={s(boite)}>
        <Icone
          size={11}
          weight="bold"
          aria-hidden="true"
          color={kind === 'stop' ? 'var(--color-ok)' : 'var(--color-accent)'}
        />
      </span>
    )
  }

  return (
    <span style={s(boite)}>
      <span
        style={s(
          `width: 5px; height: 5px; border-radius: 50%; background: ${actif ? 'var(--color-accent)' : 'var(--color-text-ghost)'};`,
        )}
      />
    </span>
  )
}
