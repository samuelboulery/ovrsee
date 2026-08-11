import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  parseVercelProject,
  parseNetlifySite,
  parseSupabaseRef,
  checkVercel,
  checkNetlify,
  checkSupabase,
  fetchSupabaseSchema,
} from './integrationProviders.js'

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
})

test('parseVercelProject : URL valide', () => {
  assert.equal(parseVercelProject('https://vercel.com/mon-equipe/mon-projet'), 'mon-projet')
})

test('parseVercelProject : mauvais hôte → null', () => {
  assert.equal(parseVercelProject('https://example.com/mon-equipe/mon-projet'), null)
})

test('parseVercelProject : chemin incomplet → null', () => {
  assert.equal(parseVercelProject('https://vercel.com/mon-equipe'), null)
})

test('parseVercelProject : URL invalide → null', () => {
  assert.equal(parseVercelProject('pas une url'), null)
})

test('parseNetlifySite : URL valide', () => {
  assert.equal(
    parseNetlifySite('https://app.netlify.com/sites/mon-site/overview'),
    'mon-site',
  )
})

test('parseNetlifySite : mauvais chemin → null', () => {
  assert.equal(parseNetlifySite('https://app.netlify.com/teams/x'), null)
})

test('parseSupabaseRef : URL valide', () => {
  assert.equal(
    parseSupabaseRef('https://supabase.com/dashboard/project/abcdefgh'),
    'abcdefgh',
  )
})

test('parseSupabaseRef : mauvais chemin → null', () => {
  assert.equal(parseSupabaseRef('https://supabase.com/dashboard/org/abcdefgh'), null)
})

test('checkVercel : URL non reconnue ne fait aucun appel réseau', async () => {
  let appelé = false
  const fetchImpl = async () => {
    appelé = true
    return jsonResponse({})
  }
  const status = await checkVercel('token', 'https://example.com/x', fetchImpl)
  assert.equal(status.state, 'unknown')
  assert.equal(appelé, false)
})

test('checkVercel : déploiement prêt → ok', async () => {
  const fetchImpl = async () =>
    jsonResponse({ deployments: [{ state: 'READY', url: 'mon-projet.vercel.app' }] })
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.state, 'ok')
  assert.equal(status.detail, 'mon-projet.vercel.app')
  assert(status.checkedAt)
})

test('checkVercel : déploiement en erreur → error', async () => {
  const fetchImpl = async () => jsonResponse({ deployments: [{ state: 'ERROR' }] })
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.state, 'error')
})

test('checkVercel : déploiement en cours → building', async () => {
  const fetchImpl = async () => jsonResponse({ deployments: [{ state: 'BUILDING' }] })
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.state, 'building')
})

test('checkVercel : réponse HTTP en erreur → error avec le code', async () => {
  const fetchImpl = async () => jsonResponse({}, false, 401)
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.state, 'error')
  assert.match(status.detail, /401/)
})

test('checkVercel : aucun déploiement trouvé → unknown', async () => {
  const fetchImpl = async () => jsonResponse({ deployments: [] })
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.state, 'unknown')
})

test('checkVercel : fetch qui lève → unknown', async () => {
  const fetchImpl = async () => {
    throw new Error('offline')
  }
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.state, 'unknown')
  assert.match(status.detail, /offline/)
})

test('checkVercel : liste des déploiements avec environnement, branche et commit', async () => {
  const fetchImpl = async () =>
    jsonResponse({
      deployments: [
        {
          uid: 'dpl_1',
          state: 'READY',
          target: 'production',
          url: 'mon-projet.vercel.app',
          createdAt: 1700000000000,
          meta: { githubCommitRef: 'main', githubCommitSha: '0123456789abcdef' },
        },
        {
          uid: 'dpl_2',
          state: 'BUILDING',
          target: null,
          url: 'mon-projet-git-preview.vercel.app',
          createdAt: 1700000100000,
        },
      ],
    })
  const status = await checkVercel('token', 'https://vercel.com/equipe/mon-projet', fetchImpl)
  assert.equal(status.deployments.length, 2)
  assert.deepEqual(status.deployments[0], {
    id: 'dpl_1',
    state: 'ok',
    environment: 'Production',
    url: 'https://mon-projet.vercel.app',
    branch: 'main',
    commit: '0123456',
    createdAt: new Date(1700000000000).toISOString(),
  })
  assert.equal(status.deployments[1].environment, 'Preview')
  assert.equal(status.deployments[1].branch, undefined)
})

test('checkNetlify : dernier déploiement prêt → ok', async () => {
  const fetchImpl = async () => jsonResponse([{ state: 'ready', deploy_ssl_url: 'https://mon-site.netlify.app' }])
  const status = await checkNetlify('token', 'https://app.netlify.com/sites/mon-site/overview', fetchImpl)
  assert.equal(status.state, 'ok')
  assert.equal(status.detail, 'https://mon-site.netlify.app')
})

test('checkNetlify : dernier déploiement en erreur → error', async () => {
  const fetchImpl = async () => jsonResponse([{ state: 'error' }])
  const status = await checkNetlify('token', 'https://app.netlify.com/sites/mon-site/overview', fetchImpl)
  assert.equal(status.state, 'error')
})

test('checkNetlify : liste des déploiements avec contexte, branche et commit', async () => {
  const fetchImpl = async () =>
    jsonResponse([
      {
        id: 'dep_1',
        state: 'ready',
        context: 'production',
        deploy_ssl_url: 'https://mon-site.netlify.app',
        branch: 'main',
        commit_ref: '0123456789abcdef',
        created_at: '2026-08-11T12:00:00.000Z',
      },
      {
        id: 'dep_2',
        state: 'ready',
        context: 'deploy-preview',
        deploy_ssl_url: 'https://deploy-preview-3--mon-site.netlify.app',
        branch: 'feature/x',
        commit_ref: 'fedcba9876543210',
        created_at: '2026-08-11T11:00:00.000Z',
      },
    ])
  const status = await checkNetlify('token', 'https://app.netlify.com/sites/mon-site/overview', fetchImpl)
  assert.equal(status.deployments.length, 2)
  assert.deepEqual(status.deployments[0], {
    id: 'dep_1',
    state: 'ok',
    environment: 'Production',
    url: 'https://mon-site.netlify.app',
    branch: 'main',
    commit: '0123456',
    createdAt: '2026-08-11T12:00:00.000Z',
  })
  assert.equal(status.deployments[1].environment, 'Preview')
})

test('checkSupabase : projet actif et sain → ok', async () => {
  const fetchImpl = async () => jsonResponse({ status: 'ACTIVE_HEALTHY' })
  const status = await checkSupabase('token', 'https://supabase.com/dashboard/project/abcdefgh', fetchImpl)
  assert.equal(status.state, 'ok')
})

test('checkSupabase : projet inactif → error', async () => {
  const fetchImpl = async () => jsonResponse({ status: 'INACTIVE' })
  const status = await checkSupabase('token', 'https://supabase.com/dashboard/project/abcdefgh', fetchImpl)
  assert.equal(status.state, 'error')
})

test('checkSupabase : statut inconnu → unknown', async () => {
  const fetchImpl = async () => jsonResponse({ status: 'ON_NE_SAIT_PAS' })
  const status = await checkSupabase('token', 'https://supabase.com/dashboard/project/abcdefgh', fetchImpl)
  assert.equal(status.state, 'unknown')
})

test('fetchSupabaseSchema : URL non reconnue rend une erreur sans appel réseau', async () => {
  let appelé = false
  const fetchImpl = async () => {
    appelé = true
    return jsonResponse([])
  }
  const result = await fetchSupabaseSchema('token', 'https://example.com/x', fetchImpl)
  assert.ok('error' in result)
  assert.equal(appelé, false)
})

test('fetchSupabaseSchema : regroupe les colonnes par table', async () => {
  const fetchImpl = async () =>
    jsonResponse([
      { table_name: 'users', column_name: 'id' },
      { table_name: 'users', column_name: 'email' },
      { table_name: 'posts', column_name: 'id' },
    ])
  const result = await fetchSupabaseSchema('token', 'https://supabase.com/dashboard/project/abcdefgh', fetchImpl)
  assert.ok('tables' in result)
  assert.deepEqual(result.tables, [
    { name: 'users', columns: ['id', 'email'] },
    { name: 'posts', columns: ['id'] },
  ])
})

test('fetchSupabaseSchema : réponse HTTP en erreur rend une erreur avec le code', async () => {
  const fetchImpl = async () => jsonResponse({}, false, 401)
  const result = await fetchSupabaseSchema('token', 'https://supabase.com/dashboard/project/abcdefgh', fetchImpl)
  assert.ok('error' in result)
  assert.match(result.error, /401/)
})

test('fetchSupabaseSchema : fetch qui lève rend une erreur', async () => {
  const fetchImpl = async () => {
    throw new Error('offline')
  }
  const result = await fetchSupabaseSchema('token', 'https://supabase.com/dashboard/project/abcdefgh', fetchImpl)
  assert.ok('error' in result)
  assert.match(result.error, /offline/)
})
