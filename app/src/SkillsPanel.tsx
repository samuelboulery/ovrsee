import { useEffect, useState } from 'react'

import { fetchSkills, installSkills, type SkillEntry } from './data'
import { s } from './style'

/**
 * Un skill installé ne sert à rien s'il ne l'est pas au bon endroit : Claude
 * Code ne lit que `~/.claude/skills/`. Le cockpit connaît ce chemin, l'utilisateur
 * n'a pas à le connaître.
 *
 * Un skill est à proposer quand il est absent, ou quand la version livrée avec
 * cette copie du cockpit a changé depuis l'installation. Un skill à jour ne
 * porte pas de case : il n'y a rien à décider.
 */
const aProposer = (skill: SkillEntry): boolean => skill.source === 'bundled' && !skill.aJour

/**
 * La liste des skills, sans son cadre.
 *
 * Deux usages, deux cadres : l'écran d'initialisation, où la sélection part
 * avec le bouton « Initialiser », et la modale de la barre latérale, qui
 * installe pour elle-même. D'où la sélection remontée plutôt que gardée ici —
 * un composant qui déciderait quand installer ne saurait pas servir les deux.
 */
export function SkillsList({
  skills,
  choisis,
  onChoisis,
}: {
  skills: SkillEntry[]
  choisis: string[]
  onChoisis: (noms: string[]) => void
}) {
  const bascule = (nom: string) =>
    onChoisis(choisis.includes(nom) ? choisis.filter(n => n !== nom) : [...choisis, nom])

  return (
    <div style={s('display: flex; flex-direction: column; gap: 10px; text-align: left;')}>
      {skills.map(skill => (
        <div
          key={skill.nom}
          style={s(
            'display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: 6px;',
          )}
        >
          {aProposer(skill) ? (
            <input
              type="checkbox"
              id={`skill-${skill.nom}`}
              checked={choisis.includes(skill.nom)}
              onChange={() => bascule(skill.nom)}
              style={s('margin-top: 3px;')}
            />
          ) : (
            <span
              title={skill.installe ? 'déjà en place' : 'à installer vous-même'}
              style={s('margin-top: 1px; font-size: 12px; color: var(--color-neutral-600);')}
            >
              {skill.installe ? '✓' : '·'}
            </span>
          )}

          <div style={s('flex: 1; min-width: 0;')}>
            <label
              htmlFor={aProposer(skill) ? `skill-${skill.nom}` : undefined}
              style={s(
                'display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; cursor: default;',
              )}
            >
              {skill.titre}
              <span
                className={skill.installe ? 'tag tag-accent' : 'tag'}
                style={s('font-size: 10px;')}
              >
                {skill.source === 'externe'
                  ? skill.installe
                    ? 'détecté'
                    : 'externe'
                  : skill.installe
                    ? skill.aJour
                      ? 'à jour'
                      : 'mise à jour'
                    : 'à installer'}
              </span>
            </label>

            <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;')}>
              {skill.resume}
            </div>

            {/* Le cockpit n'exécute pas l'installateur de quelqu'un d'autre : la
                commande est là pour être copiée, pas pour être lancée d'ici. */}
            {skill.source === 'externe' && !skill.installe && skill.commande && (
              <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 5px;')}>
                À installer vous-même : <code>{skill.commande}</code>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Charge le catalogue et tient la sélection.
 *
 * Tout ce qui est à proposer est coché d'entrée : c'est le geste attendu dans
 * la quasi-totalité des cas, et décocher est plus rapide que cocher trois fois.
 */
export function useSkills(): {
  skills: SkillEntry[]
  choisis: string[]
  setChoisis: (noms: string[]) => void
  setSkills: (skills: SkillEntry[]) => void
} {
  const [skills, setSkills] = useState<SkillEntry[]>([])
  const [choisis, setChoisis] = useState<string[]>([])

  useEffect(() => {
    let vivant = true
    fetchSkills()
      .then(list => {
        if (!vivant) return
        setSkills(list)
        setChoisis(list.filter(aProposer).map(skill => skill.nom))
      })
      // Le catalogue absent n'empêche pas d'initialiser un projet : la liste
      // reste vide, et le reste de l'écran marche.
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  const remplace = (list: SkillEntry[]) => {
    setSkills(list)
    setChoisis(list.filter(aProposer).map(skill => skill.nom))
  }

  return { skills, choisis, setChoisis, setSkills: remplace }
}

/**
 * La même liste, en modale, pour un projet déjà équipé.
 *
 * Elle ne dépend d'aucun projet : les skills vivent dans `~/.claude/`, et une
 * mise à jour du cockpit peut les rendre périmés longtemps après
 * l'initialisation.
 */
export function SkillsModal({ onClose }: { onClose: () => void }) {
  const { skills, choisis, setChoisis, setSkills } = useSkills()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={s(
        'position: fixed; inset: 0; z-index: 50; background: rgba(6,7,14,.88); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 24px;',
      )}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={s(
          'width: min(560px, 100%); max-height: 100%; overflow: auto; background: #13141f; border: 1px solid var(--color-divider); border-radius: 8px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;',
        )}
      >
        <div style={s('display: flex; align-items: baseline; gap: 10px;')}>
          <h2
            style={s(
              'font-family: var(--font-heading); font-weight: 500; font-size: 16px; margin: 0;',
            )}
          >
            Skills Claude Code
          </h2>
          <div style={s('flex: 1;')} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div style={s('font-size: 11.5px; color: var(--color-neutral-600);')}>
          Installés dans <code>~/.claude/skills/</code>, hors de tout projet. Ce sont eux qui
          apprennent à Claude Code à lire le cockpit et à y déposer des tickets.
        </div>

        <SkillsList skills={skills} choisis={choisis} onChoisis={setChoisis} />

        {erreur && (
          <div
            style={s(
              'font-size: 12px; color: var(--color-accent-300); border: 1px solid var(--color-accent-700); border-radius: 6px; padding: 7px 10px;',
            )}
          >
            {erreur}
          </div>
        )}

        {done && (
          <div style={s('font-size: 11px; color: var(--color-neutral-500);')}>
            {done.map(line => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || choisis.length === 0}
          onClick={() => {
            setBusy(true)
            setErreur(null)
            installSkills(choisis)
              .then(result => {
                setDone(result.done)
                setSkills(result.skills)
              })
              .catch(err => setErreur(String(err.message ?? err)))
              .finally(() => setBusy(false))
          }}
        >
          {busy
            ? 'Installation…'
            : choisis.length === 0
              ? 'Rien à installer'
              : `Installer ${choisis.length} skill(s)`}
        </button>
      </div>
    </div>
  )
}
