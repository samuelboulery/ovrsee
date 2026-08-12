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
import { Check } from '@phosphor-icons/react'

import type { SettingsType } from './data'
import { t, type TranslationKey } from './i18n'
import { Logo, SchemaBoucle } from './OnboardingArt'
import { apercuReponses, appliquerReponses, reponsesInitiales, type Reponses } from './profilage'
import {
  IconDark,
  IconLight,
  IconSystem,
  Row,
  SectionTitle,
  Segmented,
  Switch,
} from './PreferencesControls'
import { basculerOnglet } from './PreferencesPanel'
import { SectionProfils, profilCourant } from './PreferencesProfils'
import { BlocGitignore } from './PreferencesProjet'
import { s } from './style'
import { applyTheme } from './theme'
import { TAB_ICONS, type TabId } from './views'

const NB_ECRANS = 3

/** Les titres d'étape de la colonne de gauche, dans l'ordre — maquette 2j. */
const ETAPES: TranslationKey[] = ['onboard.what_title', 'onboard.profile_step_label', 'onboard.settings_title']

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
 * Le reste tient volontairement en aplats de gris : IBM Plex Sans est la
 * seule famille du design system pour le texte courant (le mono reste
 * réservé aux chemins/ids/dates), donc la hiérarchie se fait au poids, à la
 * taille et à la couleur, pas au mélange de fontes.
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
              'padding: 2px 8px; border-radius: var(--radius-sm); background: var(--theme-bg-tertiary); font-family: var(--font-mono); font-size: 11.5px; color: var(--color-neutral-400);',
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

/* — Écran 2 : composition d'interface — */

/**
 * Les six vues de la grille — Stack n'y figure pas, la maquette 2j s'arrête
 * à ces six-là et laisse Stack au seul choix du template.
 */
const VUES_GRILLE: Array<{ id: TabId; labelCle: TranslationKey; descCle: TranslationKey; verrouille?: boolean }> = [
  { id: 'apercu', labelCle: 'tabs.apercu', descCle: 'onboard.view_always_on', verrouille: true },
  { id: 'navigateur', labelCle: 'tabs.navigateur', descCle: 'onboard.view_desc_navigateur' },
  { id: 'produit', labelCle: 'tabs.produit', descCle: 'onboard.view_desc_produit' },
  { id: 'historique', labelCle: 'tabs.historique', descCle: 'onboard.view_desc_historique' },
  { id: 'tableau', labelCle: 'tabs.tableau', descCle: 'onboard.view_desc_tableau' },
  { id: 'donnees', labelCle: 'tabs.donnees', descCle: 'onboard.view_desc_donnees' },
]

/**
 * La grille 2×3 de bascules par vue, sous la galerie de préréglages.
 *
 * Un second niveau de réglage, pas une redite : le préréglage choisit un
 * point de départ, la grille l'affine vue par vue. Elle lit et écrit
 * l'aperçu du choix en cours (`apercuReponses`), jamais `settings` brut —
 * sans quoi cocher une vue avant d'avoir choisi de préréglage partirait
 * d'un état qui ne reflète pas encore le préréglage courant.
 */
function GrilleVues({
  settings,
  reponses,
  onReponses,
}: {
  settings: SettingsType
  reponses: Reponses
  onReponses: (r: Reponses) => void
}) {
  const effectif = apercuReponses(settings, reponses)
  const actifs = new Set(effectif.onglets?.actifs ?? [])

  return (
    <div style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;')}>
      {VUES_GRILLE.map(({ id, labelCle, descCle, verrouille }) => {
        const Icon = TAB_ICONS[id]
        const actif = actifs.has(id)
        return (
          <div
            key={id}
            style={s(
              'display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 9px; border: 1px solid var(--color-divider); background: var(--color-surface-card);' +
                (actif ? '' : ' opacity: .65;'),
            )}
          >
            <Icon
              size={16}
              weight={actif ? 'fill' : 'regular'}
              color={actif ? 'var(--color-accent)' : 'var(--color-neutral-600)'}
              aria-hidden="true"
            />
            <div style={s('flex: 1; min-width: 0;')}>
              <div style={s('font-size: 12.5px; font-weight: 500;')}>{t(labelCle)}</div>
              <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 2px;')}>
                {t(descCle)}
              </div>
            </div>
            <Switch
              label={t(labelCle)}
              checked={actif}
              disabled={verrouille}
              onChange={() => onReponses({ ...reponses, vuesActives: basculerOnglet(effectif, id).onglets.actifs })}
            />
          </div>
        )
      })}
    </div>
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
  // La galerie elle-même est la question : un clic sur une carte vaut
  // réponse, sans matrice cachée entre les deux (maquette 2j). Choisir un
  // autre préréglage efface les ajustements de la grille — c'est un nouveau
  // point de départ, pas un correctif du précédent.
  return (
    <>
      <SectionProfils
        settings={settings}
        courant={reponses.profil}
        titreCle="onboard.profile_title"
        descCle="onboard.profile_desc"
        onSettings={next =>
          onReponses({ ...reponses, profil: profilCourant(next) ?? reponses.profil, vuesActives: null })
        }
      />
      <div style={s('margin-top: 20px;')}>
        <GrilleVues settings={settings} reponses={reponses} onReponses={onReponses} />
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
              'display: block; padding: 12px; background: var(--theme-bg-tertiary); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; color: var(--color-accent-500); word-break: break-all;',
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
          // Mêmes proportions que l'écran des préférences côté hauteur, plus
          // large : la colonne de gauche (étapes) et la galerie de l'écran 2
          // (quatre cartes en ligne) ne tiennent pas dans 880px.
          'width: min(1040px, 100%); height: min(700px, 100%); display: flex; overflow: hidden; background: var(--theme-bg-secondary); border: 1px solid var(--color-divider); border-radius: 10px; box-shadow: var(--shadow-lg); color: var(--color-text); font-family: var(--font-body);',
        )}
      >
        {/* Colonne de gauche : logo, les 3 étapes, note d'aide — maquette 2j.
            Remplace l'ancien en-tête à puces, qui ne portait pas les titres
            d'étape. */}
        <div
          style={s(
            'width: 300px; flex: none; background: var(--color-bg); border-right: 1px solid var(--color-divider); padding: 28px 24px; display: flex; flex-direction: column; gap: 26px;',
          )}
        >
          <div style={s('display: flex; align-items: center; gap: 10px;')}>
            <Logo size={26} />
            <div style={s('font-size: 15px; font-weight: 600;')}>Ovrsee</div>
          </div>

          <div style={s('display: flex; flex-direction: column; gap: 14px;')}>
            {ETAPES.map((cle, index) => (
              <div key={cle} style={s('display: flex; align-items: center; gap: 10px;')}>
                <span
                  aria-hidden="true"
                  style={s(
                    'flex: none; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 9px;' +
                      (index < etape
                        ? ' border: 1px solid #2a2660; background: #14132a; color: #a49dfa;'
                        : index === etape
                          ? ' background: var(--color-accent); color: var(--color-bg);'
                          : ' border: 1px solid var(--color-divider); color: var(--color-neutral-600);'),
                  )}
                >
                  {index < etape ? <Check size={10} weight="bold" /> : index + 1}
                </span>
                <span
                  style={s(
                    'font-size: 12.5px;' +
                      (index === etape ? ' font-weight: 500;' : ' color: var(--color-neutral-600);'),
                  )}
                >
                  {t(cle)}
                </span>
              </div>
            ))}
          </div>

          <div style={s('flex: 1;')} />
          <div style={s('font-size: 12px; color: var(--color-neutral-600); line-height: 1.65; text-wrap: pretty;')}>
            {t('onboard.sidebar_note')}
          </div>
        </div>

        <div style={s('flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;')}>
          <div
            ref={corps}
            style={s(
              'flex: 1; overflow-y: auto; padding: 28px 30px; display: flex; flex-direction: column;',
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

          <div
            style={s(
              'flex: none; display: flex; align-items: center; gap: 10px; padding: 16px 30px; border-top: 1px solid var(--color-divider);',
            )}
          >
            <button type="button" className="btn btn-ghost" onClick={terminer}>
              {t('onboard.skip')}
            </button>

            <div style={s('flex: 1;')} />

            <button
              type="button"
              className="btn btn-secondary"
              disabled={etape === 0}
              onClick={() => setEtape(e => Math.max(0, e - 1))}
            >
              {t('onboard.prev')}
            </button>

            {etape < NB_ECRANS - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => setEtape(e => e + 1)}>
                {t('onboard.next')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={terminer}>
                {t('onboard.done')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
