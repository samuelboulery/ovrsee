/**
 * Les deux visuels de la présentation, dessinés plutôt que photographiés.
 *
 * Aucune image binaire : rien à charger, rien à résoudre sous le protocole
 * `ovrsee://`, rien qui pèse dans le DMG, et un dessin qui suit le thème
 * puisqu'il est peint aux jetons Nocturne.
 *
 * WHY: le logo est transcrit de `build/icon.svg`, qui reste la source
 * d'empaquetage (icône macOS). Il n'est pas importé : `scripts/test-ui.js`
 * compile `app/src` avec `tsc`, qui ne résout pas les suffixes de requête de
 * Vite — un `import '…/icon.svg?raw'` casserait la suite de tests avant même
 * de casser le build. Deux formes à garder d'accord, c'est le prix.
 */

import { t } from './i18n'
import { s } from './style'

/** Le logo de l'ovrsee : un nœud qui se ramifie en deux. */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label={t('onboard.logo_alt')}
    >
      <rect width="1024" height="1024" rx="228" fill="var(--theme-bg-tertiary)" />
      <rect
        x="6"
        y="6"
        width="1012"
        height="1012"
        rx="224"
        fill="none"
        stroke="var(--color-divider)"
        strokeWidth="12"
      />
      <g transform="translate(0 66)">
        <g
          stroke="var(--color-accent-700)"
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M 512 358 V 448 H 350 V 536" />
          <path d="M 512 358 V 448 H 674 V 536" />
        </g>
        <circle cx="512" cy="300" r="92" fill="var(--color-accent)" />
        <circle cx="350" cy="606" r="74" fill="var(--color-accent-700)" />
        <circle cx="674" cy="606" r="74" fill="var(--color-accent-700)" />
      </g>
    </svg>
  )
}

/**
 * Les quatre boîtes du schéma, dans l'ordre où la boucle les traverse.
 *
 * Les trois premières sont des gestes, la dernière est l'endroit où ils
 * atterrissent : `depot: true` la peint en plein, seul aplat d'accent de
 * l'écran. Cette différence de traitement dit une différence de nature, elle
 * ne décore pas — sans elle, quatre boîtes identiques laissent croire à quatre
 * étapes équivalentes, et le dossier passe pour une étape de plus.
 */
const ETAPES = [
  { cle: 'onboard.loop_plan', x: 0 },
  { cle: 'onboard.loop_commit', x: 166 },
  { cle: 'onboard.loop_shot', x: 332 },
  { cle: 'onboard.loop_folder', x: 498, depot: true },
] as const

const LARGEUR = 140
const HAUTEUR = 46

/** Le mouvement se coupe quand le système le demande. */
const mouvementPermis = () =>
  typeof window === 'undefined' ||
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * La boucle qui remplit `ovrsee/` : un plan approuvé, un commit qui le clôt,
 * une capture datée, et le dossier qui garde les trois.
 *
 * Le trait de retour est la seule chose animée de la présentation. La légende
 * dit que la boucle tourne toute seule ; le pointillé qui circule le montre, et
 * un seul mouvement se remarque là où trois se seraient annulés.
 *
 * Le dessin est plafonné à sa largeur naturelle et centré : étiré à la largeur
 * de sa plaque, il passait à 1,6× et ses libellés devenaient plus gros que le
 * titre de l'écran. Un schéma n'a pas à crier plus fort que ce qu'il illustre.
 */
export function SchemaBoucle() {
  const anime = mouvementPermis()

  return (
    <svg
      viewBox="0 0 638 122"
      role="img"
      aria-label={t('onboard.loop_alt')}
      style={s(
        'display: block; width: 100%; max-width: 638px; margin: 0 auto; height: auto; color: var(--color-neutral-600);',
      )}
    >
      {ETAPES.map(({ cle, x, ...reste }, index) => {
        const depot = 'depot' in reste && reste.depot
        return (
          <g key={cle}>
            <rect
              x={x}
              y="6"
              width={LARGEUR}
              height={HAUTEUR}
              rx="8"
              fill={depot ? 'var(--color-accent-900)' : 'var(--theme-bg-secondary)'}
              stroke={depot ? 'var(--color-accent-700)' : 'var(--color-divider)'}
            />
            <text
              x={x + LARGEUR / 2}
              y="34"
              textAnchor="middle"
              fill={depot ? 'var(--color-accent-300)' : 'var(--color-text)'}
              style={s(
                depot
                  ? 'font-size: 12.5px; font-family: monospace;'
                  : 'font-size: 12.5px; font-family: var(--font-body);',
              )}
            >
              {t(cle)}
            </text>

            {/* La flèche part de la boîte courante vers la suivante. La dernière
                n'en a pas : c'est le trait de retour qui prend le relais. */}
            {index < ETAPES.length - 1 && (
              <>
                <path
                  d={`M ${x + LARGEUR + 6} 29 H ${x + LARGEUR + 17}`}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d={`M ${x + LARGEUR + 13} 25 L ${x + LARGEUR + 19} 29 L ${x + LARGEUR + 13} 33 Z`}
                  fill="currentColor"
                />
              </>
            )}
          </g>
        )
      })}

      {/* Le retour, par-dessous : ce que le dossier garde nourrit le plan
          suivant. Il part et revient au milieu des boîtes, pas à leurs coins —
          sur un bord, la pointe se lit comme un trait de plus. */}
      <path
        d="M 568 52 V 82 H 70 V 60"
        fill="none"
        stroke="var(--color-accent-600)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      >
        {anime && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-20"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </path>
      <path d="M 65 62 L 70 54 L 75 62 Z" fill="var(--color-accent-600)" />

      <text
        x="319"
        y="108"
        textAnchor="middle"
        fill="currentColor"
        style={s('font-size: 11px; font-family: var(--font-body);')}
      >
        {t('onboard.loop_caption')}
      </text>
    </svg>
  )
}
