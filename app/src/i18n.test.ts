import assert from 'node:assert/strict'
import test from 'node:test'
import { t, setCurrentLanguage, currentLanguage } from './i18n'

test('i18n: tous les dictionnaires ont les mêmes clés', () => {
  // Récupère les clés de chaque dictionnaire en testant chaque clé
  // Si une clé manque, t() lève une erreur

  const keys: Array<string> = [
    // Onglets
    'tabs.apercu', 'tabs.navigateur', 'tabs.produit', 'tabs.historique',
    'tabs.tableau', 'tabs.donnees', 'tabs.stack',
    // Préférences
    'pref.density', 'pref.density_day', 'pref.density_week', 'pref.density_month',
    'pref.density_month3', 'pref.density_year', 'pref.tabs', 'pref.terminal',
    'pref.terminal_visible', 'pref.terminal_layout', 'pref.terminal_bottom',
    'pref.terminal_side', 'pref.terminal_full', 'pref.theme', 'pref.theme_system',
    'pref.theme_light', 'pref.theme_dark',
    // Messages
    'msg.never', 'msg.today', 'msg.yesterday', 'msg.days_ago', 'msg.week_ago',
    'msg.weeks_ago', 'msg.month_ago', 'msg.months_ago', 'msg.no_intention',
    'msg.plan', 'msg.plans', 'msg.loading', 'msg.read_error',
    // Welcome
    'welcome.title', 'welcome.description', 'welcome.what_is_cockpit_part1',
    'welcome.what_is_cockpit_folder', 'welcome.what_is_cockpit_part2',
    'welcome.no_execution', 'welcome.prerequisites_title', 'welcome.prerequisites_claude',
    'welcome.prerequisites_git', 'welcome.prerequisites_node', 'welcome.add_project',
    'welcome.install_command', 'welcome.install_description',
    // Equipment
    'equipment.not_equipped', 'equipment.no_plans', 'equipment.description',
    'equipment.skills_title', 'equipment.not_git', 'equipment.bootstrap_title',
    'equipment.bootstrap_desc', 'equipment.send_to_terminal', 'equipment.prerequisites_title',
    'equipment.missing_git', 'equipment.missing_lockfile', 'equipment.missing_config',
    'equipment.initialize_btn', 'equipment.initializing',
    // Mois
    'months.jan', 'months.feb', 'months.mar', 'months.apr', 'months.may', 'months.jun',
    'months.jul', 'months.aug', 'months.sep', 'months.oct', 'months.nov', 'months.dec',
    // Accessibilité
    'a11y.tabs', 'a11y.projects', 'a11y.open_project', 'a11y.older_shot',
    'a11y.newer_shot', 'a11y.skill_installed', 'a11y.skill_to_install', 'a11y.edit',
    'a11y.delete', 'a11y.resize', 'a11y.session_active', 'a11y.terminal_available',
    'a11y.remove_from_list', 'a11y.last_plan',
    // Menus
    'menu.file', 'menu.open_project', 'menu.reload_project', 'menu.reveal_cockpit',
    'menu.close_window', 'menu.edit', 'menu.undo', 'menu.redo', 'menu.cut', 'menu.copy',
    'menu.paste', 'menu.select_all', 'menu.view', 'menu.toggle_terminal', 'menu.terminal_bottom',
    'menu.terminal_side', 'menu.terminal_full', 'menu.actual_size', 'menu.zoom_in',
    'menu.zoom_out', 'menu.fullscreen', 'menu.reload_ui', 'menu.dev_tools', 'menu.window',
    'menu.about', 'menu.services', 'menu.hide', 'menu.hide_others', 'menu.show_all',
    'menu.quit', 'menu.minimize', 'menu.zoom', 'menu.front',
  ] as const

  // Teste que chaque clé existe en FR
  setCurrentLanguage('fr')
  for (const key of keys) {
    const result = t(key as any)
    assert(result, `Clé manquante en FR: ${key}`)
    assert(typeof result === 'string', `Valeur non-string en FR pour ${key}`)
    assert(result.length > 0, `Valeur vide en FR pour ${key}`)
  }

  // Teste que chaque clé existe en EN
  setCurrentLanguage('en')
  for (const key of keys) {
    const result = t(key as any)
    assert(result, `Clé manquante en EN: ${key}`)
    assert(typeof result === 'string', `Valeur non-string en EN pour ${key}`)
    assert(result.length > 0, `Valeur vide en EN pour ${key}`)
  }
})

test('i18n: substitution de paramètres', () => {
  setCurrentLanguage('fr')
  const result = t('msg.days_ago', { n: 3 })
  assert.match(result, /il y a 3 jours/)

  setCurrentLanguage('en')
  const resultEn = t('msg.days_ago', { n: 3 })
  assert.match(resultEn, /3 days ago/)
})

test('i18n: langue courante par défaut', () => {
  // Réinitialise
  setCurrentLanguage(null)
  const lang = currentLanguage()
  assert(['fr', 'en'].includes(lang), `Langue invalide: ${lang}`)
})
