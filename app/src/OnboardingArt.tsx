/**
 * Les deux visuels de la présentation, dessinés plutôt que photographiés.
 *
 * Aucune image binaire : rien à charger, rien à résoudre sous le protocole
 * `ovrsee://`, rien qui pèse dans le DMG, et un dessin qui suit le thème
 * puisqu'il est peint aux jetons du système Ovrsee.
 *
 * WHY: le logo est transcrit de `build/icon.svg`, qui reste la source
 * d'empaquetage (icône macOS). Il n'est pas importé : `scripts/test-ui.js`
 * compile `app/src` avec `tsc`, qui ne résout pas les suffixes de requête de
 * Vite — un `import '…/icon.svg?raw'` casserait la suite de tests avant même
 * de casser le build. Deux formes à garder d'accord, c'est le prix.
 */

import { t } from './i18n'
import { s } from './style'

/**
 * La grille de pixels de la marque — 7×5 modules carrés, gouttière à 30 %
 * du module (maquette 2a). Un œil : paupières en deux gris (cap haut/bas
 * plus sombre, ailes latérales plus claires), iris de 3 modules en accent
 * au centre de la ligne médiane.
 *
 * Coordonnées partagées avec `build/icon.svg` — la même grille y est écrite en
 * hex littéral (pas de variables CSS dans un SVG rendu hors navigateur). Un
 * changement ici doit s'y répercuter, voir le WHY plus haut. Depuis T-0202,
 * `scripts/make-icon.js` ne redessine plus rien : il décline le SVG.
 */
const MODULE = 90
const GUTTER = 27
const STEP = MODULE + GUTTER
const GRID_W = 7 * MODULE + 6 * GUTTER
const GRID_H = 5 * MODULE + 4 * GUTTER
const OFFSET_X = (1024 - GRID_W) / 2
const OFFSET_Y = (1024 - GRID_H) / 2

type Ton = 'exterieur' | 'milieu' | 'iris'

const PIXELS: Array<[ligne: number, colonne: number, ton: Ton]> = [
  [0, 2, 'exterieur'], [0, 3, 'exterieur'], [0, 4, 'exterieur'],
  [1, 1, 'milieu'], [1, 5, 'milieu'],
  [2, 0, 'milieu'], [2, 2, 'iris'], [2, 3, 'iris'], [2, 4, 'iris'], [2, 6, 'milieu'],
  [3, 1, 'milieu'], [3, 5, 'milieu'],
  [4, 2, 'exterieur'], [4, 3, 'exterieur'], [4, 4, 'exterieur'],
]

const TON_REMPLISSAGE: Record<Ton, string> = {
  exterieur: 'var(--color-neutral-700)',
  milieu: 'var(--color-neutral-500)',
  iris: 'var(--color-accent)',
}

/** Le logo de l'ovrsee : un œil en grille de pixels. */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label={t('onboard.logo_alt')}
    >
      <rect width="1024" height="1024" rx="228" fill="var(--color-surface-card)" />
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
      {PIXELS.map(([ligne, colonne, ton]) => (
        <rect
          key={`${ligne}-${colonne}`}
          x={OFFSET_X + colonne * STEP}
          y={OFFSET_Y + ligne * STEP}
          width={MODULE}
          height={MODULE}
          fill={TON_REMPLISSAGE[ton]}
        />
      ))}
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
              fill={depot ? 'var(--color-plan-bg)' : 'var(--color-surface-panel)'}
              stroke={depot ? 'var(--color-plan-border)' : 'var(--color-divider)'}
            />
            <text
              x={x + LARGEUR / 2}
              y="34"
              textAnchor="middle"
              fill={depot ? 'var(--color-plan)' : 'var(--color-text)'}
              style={s(
                depot
                  ? 'font-size: 12.5px; font-family: var(--font-mono);'
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
