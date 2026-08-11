/**
 * Vérification lecture-seule du statut Vercel/Netlify/Supabase, à partir
 * d'un token déjà déchiffré et de l'URL de dashboard que l'utilisateur a
 * collée.
 *
 * Module pur côté logique : la seule I/O est `fetchImpl`, injecté pour les
 * tests. Le chiffrement du token et l'appel à `checkX` restent la
 * responsabilité du processus principal Electron (`electron/main.js`) — ce
 * fichier ne stocke ni ne déchiffre rien.
 *
 * Pas d'identifiant de projet demandé séparément : chaque `parseX` l'extrait
 * de l'URL de dashboard déjà stockée dans l'intégration, pour ne pas
 * dupliquer un champ que l'utilisateur a déjà donné.
 */

/**
 * @param {string} detail
 * @returns {{state: 'unknown', detail: string, checkedAt: string}}
 */
const unknown = detail => ({ state: 'unknown', detail, checkedAt: new Date().toISOString() })

/**
 * @param {string} detail
 * @returns {{state: 'error', detail: string, checkedAt: string}}
 */
const error = detail => ({ state: 'error', detail, checkedAt: new Date().toISOString() })

/**
 * Découpe le chemin d'une URL, ou `null` si l'URL est invalide.
 *
 * @param {string} url
 * @param {string} host attendu (suffixe de hostname)
 * @returns {string[] | null}
 */
function pathnameParts(url, host) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!parsed.hostname.endsWith(host)) return null
  return parsed.pathname.split('/').filter(Boolean)
}

/** @param {string} url @returns {string | null} */
export function parseVercelProject(url) {
  const parts = pathnameParts(url, 'vercel.com')
  return parts && parts.length >= 2 ? parts[1] : null
}

/** @param {string} url @returns {string | null} */
export function parseNetlifySite(url) {
  const parts = pathnameParts(url, 'netlify.com')
  return parts && parts.length >= 2 && parts[0] === 'sites' ? parts[1] : null
}

/** @param {string} url @returns {string | null} */
export function parseSupabaseRef(url) {
  const parts = pathnameParts(url, 'supabase.com')
  return parts && parts.length >= 3 && parts[0] === 'dashboard' && parts[1] === 'project'
    ? parts[2]
    : null
}

function mapVercelState(state) {
  if (state === 'READY') return 'ok'
  if (state === 'ERROR' || state === 'CANCELED') return 'error'
  if (['BUILDING', 'QUEUED', 'INITIALIZING'].includes(state)) return 'building'
  return 'unknown'
}

/** @param {string | null | undefined} target */
function vercelEnvironment(target) {
  if (target === 'production') return 'Production'
  if (target === 'staging') return 'Staging'
  return 'Preview'
}

/**
 * Branche/commit ne sont pas documentés pour l'endpoint de liste — seulement
 * observés en pratique dans `meta`, sous des clés qui varient par fournisseur
 * git. Best-effort : une ligne sans ces infos reste utile (environnement,
 * statut, date), pas une raison d'échouer ou de faire une requête de plus.
 *
 * @param {Record<string, string> | undefined} meta
 */
function vercelGitInfo(meta) {
  const branch = meta?.githubCommitRef ?? meta?.gitlabCommitRef ?? meta?.bitbucketCommitRef
  const sha = meta?.githubCommitSha ?? meta?.gitlabCommitSha ?? meta?.bitbucketCommitSha
  return { branch, commit: sha?.slice(0, 7) }
}

/** @param {Record<string, unknown>} deployment */
function toVercelDeployment(deployment) {
  const { branch, commit } = vercelGitInfo(deployment.meta)
  const created = deployment.createdAt ?? deployment.created
  return {
    id: String(deployment.uid ?? deployment.id ?? deployment.url),
    state: mapVercelState(deployment.state),
    environment: vercelEnvironment(deployment.target),
    url: deployment.url ? `https://${deployment.url}` : null,
    branch,
    commit,
    createdAt: created ? new Date(created).toISOString() : new Date().toISOString(),
  }
}

function mapNetlifyState(state) {
  if (state === 'ready') return 'ok'
  if (state === 'error') return 'error'
  if (['building', 'enqueued', 'uploading', 'uploaded', 'preparing', 'processing'].includes(state)) {
    return 'building'
  }
  return 'unknown'
}

/** @param {string | undefined} context */
function netlifyEnvironment(context) {
  if (context === 'production') return 'Production'
  if (context === 'deploy-preview') return 'Preview'
  if (context === 'branch-deploy') return 'Branch'
  return context ?? 'Preview'
}

/** @param {Record<string, unknown>} deploy */
function toNetlifyDeployment(deploy) {
  return {
    id: String(deploy.id ?? deploy.deploy_ssl_url),
    state: mapNetlifyState(deploy.state),
    environment: netlifyEnvironment(deploy.context),
    url: deploy.deploy_ssl_url ?? deploy.deploy_url ?? null,
    branch: deploy.branch ?? undefined,
    commit: deploy.commit_ref?.slice(0, 7),
    createdAt: deploy.created_at ?? new Date().toISOString(),
  }
}

function mapSupabaseState(status) {
  if (status === 'ACTIVE_HEALTHY') return 'ok'
  if (['INACTIVE', 'REMOVED', 'GOING_DOWN'].includes(status)) return 'error'
  if (['COMING_UP', 'RESTORING', 'UPGRADING', 'PAUSING'].includes(status)) return 'building'
  return 'unknown'
}

/**
 * @param {string} token déjà déchiffré
 * @param {string} url dashboard Vercel du projet
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{state: string, detail: string, checkedAt: string}>}
 */
export async function checkVercel(token, url, fetchImpl = fetch) {
  const project = parseVercelProject(url)
  if (!project) return unknown('URL Vercel non reconnue (attendu https://vercel.com/<équipe>/<projet>)')

  let res
  try {
    res = await fetchImpl(
      `https://api.vercel.com/v6/deployments?limit=5&projectId=${encodeURIComponent(project)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
  } catch (err) {
    return unknown(`Vercel injoignable : ${err.message}`)
  }
  if (!res.ok) return error(`Vercel a répondu ${res.status}`)

  const data = await res.json()
  const deployment = data.deployments?.[0]
  if (!deployment) return unknown('Aucun déploiement trouvé')

  return {
    state: mapVercelState(deployment.state),
    detail: deployment.url ?? deployment.state ?? '',
    checkedAt: new Date().toISOString(),
    deployments: data.deployments.map(toVercelDeployment),
  }
}

/**
 * @param {string} token déjà déchiffré
 * @param {string} url dashboard Netlify du site
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{state: string, detail: string, checkedAt: string}>}
 */
export async function checkNetlify(token, url, fetchImpl = fetch) {
  const site = parseNetlifySite(url)
  if (!site) return unknown('URL Netlify non reconnue (attendu https://app.netlify.com/sites/<site>/...)')

  let res
  try {
    res = await fetchImpl(
      `https://api.netlify.com/api/v1/sites/${encodeURIComponent(site)}/deploys?per_page=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
  } catch (err) {
    return unknown(`Netlify injoignable : ${err.message}`)
  }
  if (!res.ok) return error(`Netlify a répondu ${res.status}`)

  const deploys = await res.json()
  const deploy = Array.isArray(deploys) ? deploys[0] : undefined
  if (!deploy) return unknown('Aucun déploiement trouvé')

  return {
    state: mapNetlifyState(deploy.state),
    detail: deploy.deploy_ssl_url ?? deploy.state ?? '',
    checkedAt: new Date().toISOString(),
    deployments: deploys.map(toNetlifyDeployment),
  }
}

/**
 * @param {string} token déjà déchiffré
 * @param {string} url dashboard Supabase du projet
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{state: string, detail: string, checkedAt: string}>}
 */
export async function checkSupabase(token, url, fetchImpl = fetch) {
  const ref = parseSupabaseRef(url)
  if (!ref) return unknown('URL Supabase non reconnue (attendu https://supabase.com/dashboard/project/<ref>)')

  let res
  try {
    res = await fetchImpl(`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    return unknown(`Supabase injoignable : ${err.message}`)
  }
  if (!res.ok) return error(`Supabase a répondu ${res.status}`)

  const data = await res.json()
  return {
    state: mapSupabaseState(data.status),
    detail: data.status ?? '',
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Introspection lecture-seule du schéma public, pour l'onglet Données.
 *
 * Une requête sur `information_schema` — jamais un `select *` sur une table
 * de données — via l'API Management, le même token que `checkSupabase`.
 *
 * @param {string} token déjà déchiffré
 * @param {string} url dashboard Supabase du projet
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{tables: Array<{name: string, columns: string[]}>} | {error: string}>}
 */
export async function fetchSupabaseSchema(token, url, fetchImpl = fetch) {
  const ref = parseSupabaseRef(url)
  if (!ref) return { error: 'URL Supabase non reconnue (attendu https://supabase.com/dashboard/project/<ref>)' }

  let res
  try {
    res = await fetchImpl(`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query:
          "select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
      }),
    })
  } catch (err) {
    return { error: `Supabase injoignable : ${err.message}` }
  }
  if (!res.ok) return { error: `Supabase a répondu ${res.status}` }

  const rows = await res.json()
  const tables = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const table = tables.find(t => t.name === row.table_name)
    if (table) table.columns.push(row.column_name)
    else tables.push({ name: row.table_name, columns: [row.column_name] })
  }
  return { tables }
}
