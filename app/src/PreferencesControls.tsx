/**
 * Les commandes élémentaires de l'écran des préférences.
 *
 * Elles vivent à part parce qu'elles n'ont rien de propre aux préférences :
 * un interrupteur, un contrôle segmenté, une ligne libellé/valeur. Les garder
 * dans `PreferencesPanel.tsx` aurait poussé ce fichier au-delà des 800 lignes
 * que `CLAUDE.md` fixe comme plafond.
 *
 * Rien ici n'invente de style : le contrôle segmenté enveloppe les classes
 * `.seg` / `.seg-opt` du design system, qui portent déjà l'accent, le survol
 * et l'anneau `:focus-visible`. La règle du DS est de bâtir avec ses classes
 * plutôt que d'en inventer de parallèles.
 */

import type { ReactNode } from 'react'

import { DotsSixVertical, Monitor, Moon, Sun } from '@phosphor-icons/react'

import { s } from './style'

/**
 * Une ligne de réglage : libellé à gauche, contrôle à droite.
 *
 * C'est la grammaire des écrans de paramètres du système — un filet entre
 * chaque ligne, jamais autour. `last` retire le filet du bas pour que le
 * dernier réglage d'un bloc ne traîne pas un trait vers le vide.
 */
export function Row({
  label,
  hint,
  children,
  last = false,
  stacked = false,
}: {
  label: string
  /** Précision sous le libellé — la raison du réglage, pas sa répétition. */
  hint?: ReactNode
  children?: ReactNode
  last?: boolean
  /** Contrôle sous le libellé plutôt qu'en face : pour les contrôles larges. */
  stacked?: boolean
}) {
  return (
    <div
      style={s(
        (stacked
          ? 'display: flex; flex-direction: column; align-items: stretch; gap: 10px;'
          : 'display: flex; align-items: center; gap: 20px;') +
          ' padding: 14px 0;' +
          (last ? '' : ' border-bottom: 1px solid var(--color-divider);'),
      )}
    >
      <div style={s('flex: 1; min-width: 0;')}>
        <div style={s('font-size: 13px; color: var(--color-text);')}>{label}</div>
        {hint && (
          <div style={s('margin-top: 3px; font-size: 11.5px; color: var(--color-neutral-500);')}>
            {hint}
          </div>
        )}
      </div>
      {children && <div style={s('flex: none;')}>{children}</div>}
    </div>
  )
}

/** Le titre d'une section, au-dessus de ses lignes. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="kicker" style={s('margin: 0 0 8px; font-size: 11px;')}>
      {children}
    </h3>
  )
}

/** L'intitulé d'un sous-bloc à l'intérieur d'une section. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={s(
        'margin: 18px 0 2px; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);',
      )}
    >
      {children}
    </div>
  )
}

/**
 * Un interrupteur à deux états.
 *
 * `role="switch"` plutôt qu'une case à cocher : c'est ce que les lecteurs
 * d'écran annoncent comme « activé / désactivé », et ça évite d'avoir à
 * restyler la case native, qu'aucun navigateur ne laisse vraiment thémer.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  title,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Nom accessible : l'interrupteur n'a pas de texte à lui. */
  label: string
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={s(
        'width: 28px; height: 16px; flex: none; padding: 2px; border-radius: 999px; position: relative;' +
          ' transition: background .14s ease, border-color .14s ease;' +
          (disabled ? ' opacity: .45; cursor: not-allowed;' : ' cursor: pointer;') +
          (checked
            ? ' background: color-mix(in srgb, var(--color-accent) 34%, transparent); border: 1px solid var(--color-accent);'
            : ' background: transparent; border: 1px solid var(--color-divider);'),
      )}
    >
      <span
        style={s(
          'display: block; width: 12px; height: 12px; border-radius: 50%; transition: transform .14s ease;' +
            (checked
              ? ' background: var(--color-accent); transform: translateX(12px);'
              : ' background: var(--color-neutral-500); transform: translateX(0);'),
        )}
      />
    </button>
  )
}

/**
 * Un contrôle segmenté sur les classes `.seg` / `.seg-opt` du design system.
 *
 * Chaque option est un `<label>` contenant un `<input type="radio">` masqué :
 * c'est ce que la feuille attend (`.seg-opt:has(input:checked)`), et ça donne
 * gratuitement la navigation clavier d'un groupe de boutons radio.
 *
 * `name` doit être unique dans la page, sinon deux contrôles segmentés
 * partagent le même groupe et se désélectionnent l'un l'autre.
 */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  name: string
  value: T
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => (
        <label
          key={option.value}
          className="seg-opt"
          title={option.icon ? option.label : undefined}
          style={s(option.icon ? 'padding: 7px 11px;' : 'padding: 6px 11px; font-size: 12.5px;')}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            aria-label={option.icon ? option.label : undefined}
          />
          {option.icon ?? option.label}
        </label>
      ))}
    </div>
  )
}

/** Un champ de saisie sur la classe `.input` du design system. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="field">
      <label style={s('display: block; font-size: 11.5px; margin-bottom: 5px;')}>{label}</label>
      {children}
      {hint && (
        <div style={s('margin-top: 3px; font-size: 10.5px; color: var(--color-neutral-600);')}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** L'encart d'erreur, repris tel quel de l'ancien écran. */
export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      style={s(
        'font-size: 11.5px; color: #e5677a; background: #1c0d10; border: 1px solid #3a1c22; border-radius: 6px; padding: 7px 10px;',
      )}
    >
      {children}
    </div>
  )
}

/*
 * Les icônes — Phosphor (regular), importées depuis @phosphor-icons/react
 * (T-0046). Avant la refonte, trois glyphes étaient tracés à la main pour
 * éviter une quatrième dépendance de production ; la maquette en utilise
 * ~20 (rail de navigation compris), au-delà de quoi les dessiner à la main
 * coûte plus cher que le paquet.
 */

/** Moniteur — le thème suit le système. */
export const IconSystem = () => <Monitor size={16} aria-hidden="true" />

/** Soleil — thème clair. */
export const IconLight = () => <Sun size={16} aria-hidden="true" />

/** Lune — thème sombre. */
export const IconDark = () => <Moon size={16} aria-hidden="true" />

/** Poignée de préhension — six points, la convention du glisser-déposer. */
export const IconGrip = () => <DotsSixVertical size={14} aria-hidden="true" />
