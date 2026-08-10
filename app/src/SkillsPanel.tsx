import { useEffect, useState } from 'react'

import { fetchSkills, type SkillEntry } from './data'
import { s } from './style'
import { t } from './i18n'

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
 * avec le bouton « Initialiser », et la section « Claude Code » des
 * préférences, qui installe pour elle-même. D'où la sélection remontée plutôt
 * que gardée ici — un composant qui déciderait quand installer ne saurait pas
 * servir les deux.
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
              title={skill.installe ? t('a11y.skill_installed') : t('a11y.skill_to_install')}
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
                    ? t('skills.detected')
                    : t('skills.external')
                  : skill.installe
                    ? skill.aJour
                      ? t('skills.up_to_date')
                      : t('skills.update_available')
                    : t('skills.install_needed')}
              </span>
            </label>

            <div style={s('font-size: 11px; color: var(--color-neutral-500); margin-top: 3px;')}>
              {skill.resume}
            </div>

            {/* Le cockpit n'exécute pas l'installateur de quelqu'un d'autre : la
                commande est là pour être copiée, pas pour être lancée d'ici. */}
            {skill.source === 'externe' && !skill.installe && skill.commande && (
              <div style={s('font-size: 11px; color: var(--color-neutral-600); margin-top: 5px;')}>
                {t('skills.install_yourself')} <code>{skill.commande}</code>
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
