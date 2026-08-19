/**
 * Le popover de la barre de menu : l'état des sessions Claude, sans la fenêtre.
 *
 * Un rendu à part, sur la même origine que l'application — donc le même build
 * et le même design system. Il ne calcule rien : le processus principal lui
 * pousse ce que la fenêtre principale publie (`electron/tray.js`), et les
 * règles qui décident de ce qu'on peut cliquer vivent, testées, dans
 * `menubar.ts`.
 */

import { useEffect, useState } from 'react'

import { fetchSettings } from './data'
import { setCurrentLanguage, t } from './i18n'
import {
  PEREMPTION_MS,
  estDecidable,
  estPerime,
  type MenuBarDecision,
  type MenuBarProjet,
  type MenuBarSession,
  type MenuBarVue,
} from './menubar'
import { s } from './style'
import { applyTheme } from './theme'

/**
 * Cadence de rafraîchissement de l'horloge.
 *
 * La péremption dépend du temps qui passe, pas d'un signal : sans ce battement,
 * une carte resterait décidable à l'écran alors qu'elle ne l'est plus. Dix
 * secondes suffisent pour une limite de deux minutes.
 */
const BATTEMENT_MS = 10_000

/** Âge lisible d'un signal. */
function age(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1) return t('menubar.just_now')
  if (minutes < 60) return t('menubar.minutes_ago', { n: minutes })
  return t('menubar.hours_ago', { n: Math.floor(minutes / 60) })
}

const CARTE =
  'display:flex;flex-direction:column;gap:6px;padding:12px 14px;list-style:none;' +
  'border:1px solid var(--color-border-card);border-radius:var(--radius-md);' +
  'background:var(--color-surface-card)'

const BOUTON =
  'flex:1;padding:7px 10px;border-radius:var(--radius-sm);' +
  'border:1px solid var(--color-border-control);background:var(--color-surface);' +
  'color:var(--color-text);font-size:12px;font-weight:500;cursor:pointer;' +
  'font-family:inherit'

const BOUTON_INERTE = BOUTON + ';opacity:0.4;cursor:default'

const TITRE_SECTION =
  'padding:12px 14px 6px;font-size:10px;font-weight:600;letter-spacing:0.08em;' +
  'text-transform:uppercase;color:var(--color-text-tertiary)'

const LIGNE = 'display:flex;justify-content:space-between;gap:10px;font-size:12px'

/**
 * Une session dans le popover.
 *
 * Exportée pour `render.test.tsx` : c'est ici que les règles de `menubar.ts`
 * deviennent des boutons cliquables ou grisés, et c'est ce branchement-là que
 * le test vérifie — `MenuBar` lui-même n'a pas de props par où l'atteindre.
 */
export function SessionCard({
  session,
  now,
  onAnswer,
}: {
  session: MenuBarSession
  now: number
  onAnswer: (ptyId: string, decision: MenuBarDecision) => void
}) {
  const decidable = estDecidable(session, now)
  const attente = session.attention?.kind === 'question'
  // Une session muette est le cas normal : elle tourne, elle n'a rien demandé.
  // Une session au travail dit la même chose, mais elle, on le sait.
  const etat =
    session.attention === null || session.attention.kind === 'busy'
      ? 'menubar.running'
      : attente
        ? 'menubar.waiting'
        : 'menubar.idle'

  return (
    <li style={s(CARTE)}>
      <div style={s('display:flex;align-items:baseline;justify-content:space-between;gap:8px')}>
        <span style={s('font-size:13px;font-weight:600;color:var(--color-text)')}>{session.nom}</span>
        {session.attention ? (
          <span style={s('font-size:11px;color:var(--color-text-tertiary);white-space:nowrap')}>
            {age(session.attention.at, now)}
          </span>
        ) : null}
      </div>

      <div
        style={s(
          'font-size:11px;color:' + (attente ? 'var(--color-accent)' : 'var(--color-text-tertiary)'),
        )}
      >
        {t(etat)}
      </div>

      {session.attention?.detail ? (
        <p style={s('margin:0;font-size:12px;color:var(--color-text-secondary);line-height:1.4')}>
          {session.attention.detail}
        </p>
      ) : null}

      {attente && estPerime(session, now) ? (
        <div style={s('font-size:11px;color:var(--color-text-tertiary)')}>{t('menubar.stale')}</div>
      ) : null}

      <div style={s('display:flex;gap:6px;margin-top:2px')}>
        {attente ? (
          <>
            <button
              type="button"
              disabled={!decidable}
              onClick={() => onAnswer(session.ptyId, 'allow')}
              style={s(decidable ? BOUTON : BOUTON_INERTE)}
            >
              {t('menubar.allow')}
            </button>
            <button
              type="button"
              disabled={!decidable}
              onClick={() => onAnswer(session.ptyId, 'deny')}
              style={s(decidable ? BOUTON : BOUTON_INERTE)}
            >
              {t('menubar.deny')}
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => void window.ovrsee?.menubar?.reveal(session.sessionKey)}
          style={s(BOUTON)}
        >
          {t('menubar.open')}
        </button>
      </div>
    </li>
  )
}

/**
 * Le projet affiché, quand aucune session ne tourne.
 *
 * Un popover vide n'apprend rien. Celui-ci dit au moins où en est le projet
 * sans qu'il faille ouvrir la fenêtre — c'est le seul contenu qui justifie
 * d'aller regarder la barre de menu quand rien ne réclame de réponse.
 */
export function ProjetCard({ projet }: { projet: MenuBarProjet }) {
  return (
    <div style={s('padding:0 10px 10px')}>
      <div style={s(CARTE.replace('list-style:none;', ''))}>
        <span style={s('font-size:13px;font-weight:600;color:var(--color-text)')}>{projet.nom}</span>

        {projet.planActif ? (
          <div style={s('display:flex;flex-direction:column;gap:2px')}>
            <span style={s('font-size:11px;color:var(--color-text-tertiary)')}>
              {t('menubar.active_plan')}
            </span>
            <span style={s('font-size:12px;color:var(--color-text-secondary);line-height:1.35')}>
              {projet.planActif}
            </span>
          </div>
        ) : null}

        <div style={s(LIGNE)}>
          <span style={s('color:var(--color-text-tertiary)')}>{t('menubar.tickets')}</span>
          <span style={s('color:var(--color-text-secondary)')}>
            {t('menubar.tickets_left', { n: projet.ticketsRestants })}
          </span>
        </div>

        {projet.branche ? (
          <div style={s(LIGNE)}>
            <span style={s('font-family:var(--font-mono);color:var(--color-text-tertiary)')}>
              {projet.branche}
            </span>
            <span style={s('color:var(--color-text-secondary)')}>
              {t('menubar.dirty', { n: projet.fichiersModifies })}
            </span>
          </div>
        ) : null}

        {projet.dernierScan ? (
          <div style={s(LIGNE)}>
            <span style={s('color:var(--color-text-tertiary)')}>{t('menubar.last_scan')}</span>
            <span style={s('color:var(--color-text-secondary)')}>{projet.dernierScan}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Le bandeau du signal manquant.
 *
 * `hooks/ovrsee-notify.js` s'enregistre dans `~/.claude/settings.json`, pas
 * dans le dépôt : une machine équipée avant son arrivée n'a aucun signal,
 * aucune notification, et un popover qui ne dira jamais qu'une session attend.
 * Cette panne est parfaitement silencieuse — d'où ce bandeau, qui la nomme et
 * donne la commande.
 */
export function BandeauSignal() {
  return (
    <div
      role="alert"
      style={s(
        'margin:10px 10px 0;padding:10px 12px;display:flex;flex-direction:column;gap:4px;' +
          'border:1px solid var(--color-warn-border);border-radius:var(--radius-sm);' +
          'background:var(--color-warn-bg)',
      )}
    >
      <span style={s('font-size:12px;font-weight:600;color:var(--color-warn)')}>
        {t('menubar.signal_missing')}
      </span>
      <code style={s('font-family:var(--font-mono);font-size:11px;color:var(--color-text-secondary)')}>
        pnpm ovrsee:install
      </code>
    </div>
  )
}

const VIDE: MenuBarVue = { sessions: [], projet: null, signalInstalle: true }

export function MenuBar() {
  const [vue, setVue] = useState<MenuBarVue>(VIDE)
  const [now, setNow] = useState(() => Date.now())
  // La langue et le thème arrivent après coup : ce rendu n'a pas de props par
  // où les recevoir, et sans ce compteur il resterait figé sur la détection
  // navigateur — c'est-à-dire en anglais sur une machine en français.
  const [reglages, setReglages] = useState(0)

  useEffect(() => window.ovrsee?.menubar?.listen(setVue), [])

  useEffect(() => {
    // Mêmes réglages que la fenêtre principale, lus par la même route. Un
    // popover en anglais à côté d'une application en français serait un défaut
    // visible tout de suite.
    fetchSettings()
      .then(settings => {
        setCurrentLanguage(settings.langue)
        applyTheme(settings.theme)
        setReglages(n => n + 1)
      })
      .catch(() => {
        // Sans réglages, la détection navigateur et le thème par défaut font
        // l'affaire : un popover est trop peu pour justifier un écran d'erreur.
      })
  }, [])

  useEffect(() => {
    const battement = setInterval(() => setNow(Date.now()), BATTEMENT_MS)
    return () => clearInterval(battement)
  }, [])

  const repondre = (ptyId: string, decision: MenuBarDecision) => {
    // Optimiste, et pas par confort : le principal éteint l'attente de son
    // côté dès la touche écrite, mais le popover doit cesser d'offrir un
    // second clic tout de suite — c'est lui qui a le doigt dessus.
    setVue(courant => ({
      ...courant,
      sessions: courant.sessions.map(session =>
        session.ptyId === ptyId ? { ...session, attention: null } : session,
      ),
    }))
    void window.ovrsee?.menubar?.answer(ptyId, decision)
  }

  return (
    <div
      key={reglages}
      style={s(
        'display:flex;flex-direction:column;height:100vh;overflow:hidden;' +
          'background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)',
      )}
    >
      <header
        style={s(
          'padding:12px 14px;border-bottom:1px solid var(--color-divider);' +
            'font-size:11px;font-weight:600;letter-spacing:0.06em;' +
            'text-transform:uppercase;color:var(--color-text-secondary)',
        )}
      >
        {t('menubar.title')}
      </header>

      <div style={s('overflow-y:auto;flex:1')}>
        {vue.signalInstalle ? null : <BandeauSignal />}

        {vue.sessions.length === 0 ? (
          <>
            <div style={s('padding:16px 14px 4px;font-size:13px;color:var(--color-text-secondary)')}>
              {t('menubar.empty')}
            </div>
            {vue.projet ? (
              <>
                <div style={s(TITRE_SECTION)}>{t('menubar.project')}</div>
                <ProjetCard projet={vue.projet} />
              </>
            ) : (
              <div style={s('padding:0 14px 16px;font-size:11px;color:var(--color-text-tertiary)')}>
                {t('menubar.empty_hint')}
              </div>
            )}
          </>
        ) : (
          <ul style={s('margin:0;padding:10px;display:flex;flex-direction:column;gap:8px')}>
            {vue.sessions.map(session => (
              <SessionCard
                key={session.sessionKey}
                session={session}
                now={now}
                onAnswer={repondre}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Réexporté pour le test de rendu, qui a besoin de la limite. */
export { PEREMPTION_MS }
