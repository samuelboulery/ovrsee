/**
 * La présentation de premier lancement — trois écrans, passables à tout moment.
 *
 * Elle ne s'ouvre que sur un ovrsee réellement vide : `projects()` ne rend plus
 * que le registre, donc un dépôt fraîchement cloné n'a rien à montrer tant que
 * personne n'a désigné un projet. C'est le seul moment où l'on peut expliquer ce
 * que fait cette application — et surtout ce qu'elle ne fait pas.
 *
 * Une modale posée sur l'application, comme l'écran des préférences, et non un
 * plein écran : ce qu'elle explique se voit derrière elle, et la fermer ne fait
 * pas basculer d'un monde à l'autre.
 *
 * Ce qu'elle écrit : `~/.claude/ovrsee/settings.json`, par `onFini`. Rien
 * d'autre. L'ajout d'un projet passe par le sélecteur natif que la coquille lui
 * prête ; elle n'équipe rien elle-même — `EquipmentPanel` prend le relais après.
 */

import { useEffect, useRef, useState } from 'react'

import type { SettingsType } from './data'
import { t } from './i18n'
import { Logo, SchemaBoucle } from './OnboardingArt'
import {
  USAGES,
  apercuReponses,
  appliquerReponses,
  profilSuggere,
  reponsesInitiales,
  type Reponses,
  type Usage,
} from './profilage'
import {
  IconDark,
  IconLight,
  IconSystem,
  Row,
  SectionTitle,
  Segmented,
  Switch,
} from './PreferencesControls'
import { PreferencesPreview, ongletsVisibles } from './PreferencesPreview'
import { SectionProfils, profilCourant } from './PreferencesProfils'
import { BlocGitignore } from './PreferencesProjet'
import { s } from './style'
import { applyTheme } from './theme'

const NB_ECRANS = 3

export type OnboardingProps = {
  settings: SettingsType
  /** Point d'entrée, pour les tests. En usage réel, on commence au début. */
  etapeInitiale?: number
  /** Reçoit les préférences finales, `onboardingVu` compris. */
  onFini: (settings: SettingsType) => void
  /**
   * Ouvre le sélecteur de dossier. Absent hors Electron : l'écran bascule alors
   * sur la commande en ligne, comme le fait `Welcome`.
   */
  onAjouterProjet?: () => void
}

/** Une réponse à choisir : un titre, une phrase, et l'état sélectionné. */
function Carte({
  titre,
  detail,
  choisi,
  onChoisir,
}: {
  titre: string
  detail: string
  choisi: boolean
  onChoisir: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={choisi}
      style={s(
        // Fond tertiaire, pas secondaire : la modale est déjà secondaire, et
        // une carte de la même teinte ne tient que par sa bordure.
        'display: block; width: 100%; text-align: left; padding: 10px 12px; border-radius: 9px; cursor: pointer; background: var(--theme-bg-tertiary);' +
          (choisi
            ? ' border: 1px solid var(--color-accent);'
            : ' border: 1px solid var(--color-divider);'),
      )}
    >
      <div style={s('font-size: 13px; color: var(--color-text);')}>{titre}</div>
      <div style={s('margin-top: 2px; font-size: 11.5px; line-height: 1.4; color: var(--color-neutral-500);')}>
        {detail}
      </div>
    </button>
  )
}

/* — Écran 1 : ce qu'est l'ovrsee — */

/** Les trois affirmations, chacune en deux temps : ce qu'on retient, puis pourquoi. */
const AFFIRMATIONS = [
  { tete: 'onboard.what_truth_lead', suite: 'onboard.what_truth_rest' },
  { tete: 'onboard.what_view_lead', suite: 'onboard.what_view_rest' },
  { tete: 'onboard.what_reads_lead', suite: 'onboard.what_reads_rest' },
] as const

/**
 * Les prérequis en pastilles, sous le nom qu'on tape.
 *
 * `welcome.prerequisites_*` est une phrase, pas une commande : en pastille
 * monospace elle déborderait et prétendrait qu'on tape « Claude Code (agent
 * Claude en ligne de commande) ». Ce que la phrase apprenait passe dans la note.
 */
const PREREQUIS = ['onboard.req_claude', 'onboard.req_git', 'onboard.req_node'] as const

/**
 * Écran 1 — quatre niveaux, dans cet ordre : le titre, la plaque du schéma,
 * les trois affirmations, la bande des prérequis.
 *
 * La plaque est le pivot. Le schéma traînait sous trois paragraphes gris de
 * même poids, dans une colonne étroite qui laissait la moitié droite de la
 * modale vide : rien n'accrochait l'œil et tout se lisait au même niveau.
 * Posé sur son propre fond, pleine largeur, il devient l'objet solide autour
 * duquel le texte s'organise — et il porte à lui seul ce que l'écran a à dire.
 *
 * Le reste tient volontairement en aplats de gris : Inter est la seule famille
 * du design system, donc la hiérarchie se fait au poids, à la taille et à la
 * couleur, pas au mélange de fontes.
 */
function EcranPresentation() {
  return (
    <>
      <SectionTitle>{t('onboard.what_title')}</SectionTitle>
      <p
        style={s(
          'margin: 6px 0 24px; font-size: 13.5px; line-height: 1.55; color: var(--color-neutral-300); max-width: 58ch;',
        )}
      >
        {t('onboard.what_desc')}
      </p>

      <div
        style={s(
          'padding: 26px 20px 18px; border-radius: var(--radius-lg); background: var(--theme-bg-tertiary); border: 1px solid var(--color-divider);',
        )}
      >
        <SchemaBoucle />
      </div>

      {/* Trois colonnes, séparées par des filets et rien d'autre : encadrer
          chacune ferait trois plaques de plus et volerait la vedette à celle
          du schéma. */}
      <div
        style={s(
          'margin-top: 20px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px;',
        )}
      >
        {AFFIRMATIONS.map(({ tete, suite }, index) => (
          <div
            key={tete}
            style={s(
              index === 0
                ? ''
                : 'padding-left: 18px; border-left: 1px solid var(--color-divider);',
            )}
          >
            <div style={s('font-size: 12.5px; font-weight: 500; color: var(--color-text);')}>
              {t(tete)}
            </div>
            <div
              style={s(
                'margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--color-neutral-500);',
              )}
            >
              {t(suite)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={s(
          'margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--color-divider); display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 14px;',
        )}
      >
        <span
          style={s(
            'font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--color-neutral-600);',
          )}
        >
          {t('welcome.prerequisites_title')}
        </span>

        {PREREQUIS.map(cle => (
          <span
            key={cle}
            style={s(
              'padding: 2px 8px; border-radius: var(--radius-sm); background: var(--theme-bg-tertiary); font-family: monospace; font-size: 11.5px; color: var(--color-neutral-400);',
            )}
          >
            {t(cle)}
          </span>
        ))}

        <span style={s('flex-basis: 100%;')} />
        <span style={s('font-size: 11.5px; line-height: 1.5; color: var(--color-neutral-600);')}>
          {t('onboard.prerequisites_note')}
        </span>
      </div>
    </>
  )
}

/* — Écran 2 : vous et Claude Code — */

/**
 * La phrase qui dit ce que le choix vient de changer.
 *
 * Sans elle, les deux questions seraient un sondage : on répond, il ne se passe
 * rien de visible, et rien ne dit que c'était utile.
 */
function Consequence({ apercu }: { apercu: SettingsType }) {
  const onglets = ongletsVisibles(apercu).length
  const place = !apercu.terminal?.visible
    ? t('onboard.effect_terminal_hidden')
    : apercu.terminal.disposition === 'side'
      ? t('onboard.effect_terminal_side')
      : t('onboard.effect_terminal_bottom')

  return (
    <p style={s('margin: 10px 0 0; font-size: 11.5px; line-height: 1.5; color: var(--color-neutral-500);')}>
      {t('onboard.effect', { onglets: String(onglets), terminal: place })}
    </p>
  )
}

function EcranProfil({
  settings,
  reponses,
  onReponses,
}: {
  settings: SettingsType
  reponses: Reponses
  onReponses: (r: Reponses) => void
}) {
  const apercu = apercuReponses(settings, reponses)

  return (
    <>
      <SectionTitle>{t('onboard.you_title')}</SectionTitle>
      <p style={s('margin: 0 0 16px; font-size: 12.5px; line-height: 1.5; color: var(--color-neutral-500); max-width: 62ch;')}>
        {t('onboard.you_desc')}
      </p>

      <div style={s('display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: start;')}>
        <div>
          <div style={s('font-size: 12px; color: var(--color-text); margin-bottom: 8px;')}>
            {t('onboard.usage_question')}
          </div>
          <div style={s('display: flex; flex-direction: column; gap: 7px;')}>
            {USAGES.map(usage => (
              <Carte
                key={usage}
                titre={t(`onboard.usage_${usage}`)}
                detail={t(`onboard.usage_${usage}_desc`)}
                choisi={reponses.usage === usage}
                onChoisir={() =>
                  // Réponse changée : la suggestion repart de zéro. Garder le
                  // template précédent ferait mentir la question qu'on vient
                  // de poser.
                  onReponses({
                    ...reponses,
                    usage: usage as Usage,
                    profil: profilSuggere(usage as Usage),
                  })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <PreferencesPreview settings={apercu} />
          <Consequence apercu={apercu} />
        </div>
      </div>

      <div style={s('margin-top: 22px;')}>
        <div style={s('font-size: 12px; color: var(--color-text); margin-bottom: 8px;')}>
          {t('onboard.profile_question')}
        </div>
        {/* La galerie elle-même est la question : un clic sur une carte vaut
            réponse, sans matrice cachée entre les deux. */}
        <SectionProfils
          settings={apercu}
          courant={reponses.profil}
          onSettings={next => onReponses({ ...reponses, profil: profilCourant(next) ?? reponses.profil })}
        />
      </div>
    </>
  )
}

/* — Écran 3 : réglages et premier projet — */

function EcranReglages({
  settings,
  onSettings,
  reponses,
  onReponses,
  onAjouterProjet,
}: {
  settings: SettingsType
  onSettings: (s: SettingsType) => void
  reponses: Reponses
  onReponses: (r: Reponses) => void
  onAjouterProjet?: () => void
}) {
  return (
    <>
      <SectionTitle>{t('onboard.settings_title')}</SectionTitle>
      <p style={s('margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; color: var(--color-neutral-500); max-width: 62ch;')}>
        {t('onboard.settings_desc')}
      </p>

      <Row label={t('pref.language')}>
        <Segmented
          name="onboard-langue"
          ariaLabel={t('pref.language')}
          value={settings.langue ?? 'fr'}
          onChange={langue => onSettings({ ...settings, langue })}
          options={[
            { value: 'fr', label: t('pref.language_fr') },
            { value: 'en', label: t('pref.language_en') },
          ]}
        />
      </Row>

      <Row label={t('pref.theme')}>
        <Segmented
          name="onboard-theme"
          ariaLabel={t('pref.theme')}
          value={settings.theme ?? 'auto'}
          onChange={theme => {
            // Appliqué tout de suite : choisir un thème sans le voir changer
            // serait un réglage à l'aveugle.
            applyTheme(theme)
            onSettings({ ...settings, theme })
          }}
          options={[
            { value: 'auto', label: t('pref.theme_system'), icon: <IconSystem /> },
            { value: 'light', label: t('pref.theme_light'), icon: <IconLight /> },
            { value: 'dark', label: t('pref.theme_dark'), icon: <IconDark /> },
          ]}
        />
      </Row>

      <Row label={t('onboard.bootstrap_label')} hint={t('onboard.bootstrap_hint')}>
        <Switch
          checked={reponses.bootstrap}
          onChange={bootstrap => onReponses({ ...reponses, bootstrap })}
          label={t('onboard.bootstrap_label')}
        />
      </Row>

      <BlocGitignore settings={settings} onSettings={onSettings} />

      <div style={s('margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--color-divider);')}>
        <div style={s('font-size: 13px; color: var(--color-text);')}>{t('onboard.first_project')}</div>
        <p style={s('margin: 4px 0 12px; font-size: 12px; line-height: 1.5; color: var(--color-neutral-500); max-width: 62ch;')}>
          {t('onboard.first_project_desc')}
        </p>

        {onAjouterProjet ? (
          <button type="button" className="btn btn-primary" onClick={onAjouterProjet}>
            {t('onboard.add_project')}
          </button>
        ) : (
          // Hors Electron il n'y a pas de sélecteur de dossier : on donne la
          // commande plutôt qu'un bouton qui ne ferait rien.
          <code
            style={s(
              'display: block; padding: 12px; background: var(--theme-bg-tertiary); border-radius: var(--radius-sm); font-family: monospace; font-size: 11.5px; color: var(--color-accent-500); word-break: break-all;',
            )}
          >
            {t('welcome.install_command')}
          </code>
        )}
      </div>
    </>
  )
}

/* — La coquille — */

export function Onboarding({ settings, etapeInitiale = 0, onFini, onAjouterProjet }: OnboardingProps) {
  const [etape, setEtape] = useState(etapeInitiale)
  const [brouillon, setBrouillon] = useState(settings)
  const [reponses, setReponses] = useState<Reponses>(() => reponsesInitiales(settings))

  // Tant que rien n'a été répondu, passer ne doit pas remanier l'interface de
  // quelqu'un : on n'écrit alors que « vu ». Répondre, même pour revenir en
  // arrière ensuite, vaut consentement à ce que le choix s'applique.
  const [touche, setTouche] = useState(false)

  const repondre = (r: Reponses) => {
    setTouche(true)
    setReponses(r)
  }

  const finaliser = () =>
    touche ? appliquerReponses(brouillon, reponses) : { ...brouillon, onboardingVu: true }

  const terminer = () => onFini(finaliser())

  const ajouter = () => {
    // Les préférences partent avant l'ouverture du projet : le sélecteur natif
    // change l'écran, et un réglage perdu à ce moment-là ne se rattraperait pas.
    onFini(finaliser())
    onAjouterProjet?.()
  }

  // Le défilement repart en haut à chaque écran : l'écran 2 se déroule sur deux
  // hauteurs, et arriver au suivant par son milieu ferait manquer son titre.
  const corps = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (corps.current) corps.current.scrollTop = 0
  }, [etape])

  // Échap vaut « Passer » : c'est le geste qu'on essaie devant une modale, et le
  // refuser ferait chercher une croix qui n'existe pas. Le fond, lui, ne ferme
  // pas — un clic à côté écrirait des préférences sans qu'on l'ait demandé.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      terminer()
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      style={s(
        'position: fixed; inset: 0; z-index: 60; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 24px;',
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('onboard.header')}
        style={s(
          // Mêmes proportions que l'écran des préférences, en un peu plus haut :
          // la galerie des templates de l'écran 2 ne tient pas en 600 px.
          'width: min(880px, 100%); height: min(680px, 100%); display: flex; flex-direction: column; overflow: hidden; background: var(--theme-bg-secondary); border: 1px solid var(--color-divider); border-radius: 10px; box-shadow: var(--shadow-lg); color: var(--color-text); font-family: var(--font-body);',
        )}
      >
        <header
          style={s(
            'flex: none; display: flex; align-items: center; gap: 12px; padding: 13px 18px; background: var(--theme-bg-tertiary); border-bottom: 1px solid var(--color-divider);',
          )}
        >
          <Logo size={24} />
          <div style={s('font-size: 13px;')}>{t('onboard.header')}</div>

          <div style={s('flex: 1;')} />

          <div aria-hidden="true" style={s('display: flex; gap: 5px; margin-right: 6px;')}>
            {Array.from({ length: NB_ECRANS }, (_, index) => (
              <span
                key={index}
                style={s(
                  'width: 6px; height: 6px; border-radius: 50%;' +
                    (index === etape
                      ? ' background: var(--color-accent);'
                      : ' background: var(--color-divider);'),
                )}
              />
            ))}
          </div>

          <button type="button" className="btn btn-ghost" onClick={terminer}>
            {t('onboard.skip')}
          </button>
        </header>

        <div
          ref={corps}
          style={s(
            'flex: 1; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column;',
          )}
        >
          {/* `margin: auto 0` centre un écran plus court que la modale et ne
              fait rien quand il est plus long — contrairement à
              `justify-content: center`, qui couperait le haut de l'écran 2 au
              lieu de le laisser défiler. */}
          <div style={s('margin: auto 0; width: 100%;')}>
            {etape === 0 && <EcranPresentation />}
            {etape === 1 && (
              <EcranProfil settings={brouillon} reponses={reponses} onReponses={repondre} />
            )}
            {etape === 2 && (
              <EcranReglages
                settings={brouillon}
                onSettings={setBrouillon}
                reponses={reponses}
                onReponses={repondre}
                onAjouterProjet={onAjouterProjet && ajouter}
              />
            )}
          </div>
        </div>

        <footer
          style={s(
            'flex: none; display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--color-divider);',
          )}
        >
          <button
            type="button"
            className="btn btn-ghost"
            disabled={etape === 0}
            onClick={() => setEtape(e => Math.max(0, e - 1))}
          >
            {t('onboard.prev')}
          </button>

          <div style={s('flex: 1;')} />

          <span style={s('font-size: 11.5px; color: var(--color-neutral-600);')}>
            {t('onboard.step', { n: String(etape + 1), total: String(NB_ECRANS) })}
          </span>

          {etape < NB_ECRANS - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setEtape(e => e + 1)}>
              {t('onboard.next')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={terminer}>
              {t('onboard.done')}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
