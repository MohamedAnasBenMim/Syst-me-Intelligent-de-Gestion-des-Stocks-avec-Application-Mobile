// ── URLs de base (une par microservice) ─────────────────────
const AUTH_URL      = 'http://127.0.0.1:8001/api/v1'
const WAREHOUSE_URL = 'http://127.0.0.1:8002/api/v1'
const STOCK_URL     = 'http://127.0.0.1:8003/api/v1'
const MOUVEMENT_URL = 'http://127.0.0.1:8004/api/v1'
const ALERTES_URL   = 'http://127.0.0.1:8005/api/v1'
const NOTIF_URL     = 'http://127.0.0.1:8006/api/v1'
const REPORTING_URL = 'http://127.0.0.1:8007/api/v1'
const IA_URL        = 'http://127.0.0.1:8008/api/v1'

// ── Helpers ──────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('sgs_token')
}

function authHeader() {
  return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
}

function bearerHeader() {
  return { 'Authorization': `Bearer ${getToken()}` }
}

/** Construit une query string à partir d'un objet (ignore null/undefined) */
function qs(params = {}) {
  const p = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString()
  return p ? '?' + p : ''
}

async function handleResponse(res) {
  const data = await res.json()
  if (!res.ok) {
    let message
    if (typeof data.detail === 'string') {
      message = data.detail
    } else if (Array.isArray(data.detail)) {
      // Erreur de validation Pydantic (422) → extraire les messages lisibles
      message = data.detail.map(e => e.msg || JSON.stringify(e)).join(' | ')
    } else {
      message = JSON.stringify(data.detail)
    }
    throw new Error(message)
  }
  return data
}

// ════════════════════════════════════════════════════════════
// AUTH — port 8001
// ════════════════════════════════════════════════════════════

/** POST /auth/login → { access_token, token_type, expires_in, user_id, role } */
export async function login(data) {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email, password: data.password }),
  })
  return handleResponse(res)
}

/** POST /auth/register → UtilisateurResponse (public, rôle admin interdit) */
export async function register(data) {
  const res = await fetch(`${AUTH_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: data.prenom, nom: data.nom,
      email: data.email, password: data.password,
      role: data.role || 'operateur',
    }),
  })
  return handleResponse(res)
}

/** GET /auth/me → UtilisateurResponse */
export async function getMe() {
  const res = await fetch(`${AUTH_URL}/auth/me`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** POST /auth/forgot-password → { message } */
export async function forgotPassword(email) {
  const res = await fetch(`${AUTH_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return handleResponse(res)
}

/** POST /auth/clerk-login → TokenResponse (connexion via Google/Clerk) */
export async function clerkLogin({ clerk_user_id, clerk_token, email, prenom, nom }) {
  const res = await fetch(`${AUTH_URL}/auth/clerk-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clerk_user_id, clerk_token, email, prenom, nom }),
  })
  return handleResponse(res)
}

/** POST /auth/reset-password → { message } */
export async function resetPassword(session_token, otp_code, nouveau_password) {
  const res = await fetch(`${AUTH_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_token, otp_code, nouveau_password }),
  })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// UTILISATEURS — port 8001 (admin uniquement sauf change_password)
// ════════════════════════════════════════════════════════════

/** GET /utilisateurs → List[UtilisateurResponse]  (admin) */
export async function getUtilisateurs() {
  const res = await fetch(`${AUTH_URL}/utilisateurs`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** GET /utilisateurs/{id} → UtilisateurResponse  (admin) */
export async function getUtilisateur(id) {
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}`, { headers: bearerHeader() })
  return handleResponse(res)
}

/**
 * POST /utilisateurs → UtilisateurResponse  (admin)
 * @param {{ nom, prenom, email, password, role }} data
 */
export async function createUtilisateur(data) {
  const res = await fetch(`${AUTH_URL}/utilisateurs`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/**
 * PUT /utilisateurs/{id} → UtilisateurResponse  (admin)
 * @param {number} id
 * @param {{ nom?, prenom?, email?, role?, est_actif? }} data
 */
export async function updateUtilisateur(id, data) {
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}`, {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** GET /utilisateurs/salaires → SalairesStatsResponse  (admin) */
export async function getSalaires() {
  const res = await fetch(`${AUTH_URL}/utilisateurs/salaires`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** DELETE /utilisateurs/{id} — suppression physique, libère l'email (admin) */
export async function deleteUtilisateur(id) {
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}`, {
    method: 'DELETE',
    headers: bearerHeader(),
  })
  if (res.status === 204) return null
  return handleResponse(res)
}

/** PATCH /utilisateurs/{id}/desactiver — désactivation logique, email conservé (admin) */
export async function desactiverUtilisateur(id) {
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}/desactiver`, {
    method: 'PATCH',
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** PATCH /utilisateurs/{id}/reactiver — réactivation d'un compte suspendu (admin) */
export async function reactiverUtilisateur(id) {
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}/reactiver`, {
    method: 'PATCH',
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/**
 * PUT /utilisateurs/{id}/password
 * @param {number} id
 * @param {{ ancien_password, nouveau_password }} data
 */
export async function changePassword(id, data) {
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}/password`, {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}


// ════════════════════════════════════════════════════════════
// STOCK — port 8003
// GET /produits, /stocks retournent des tableaux directs
// ════════════════════════════════════════════════════════════

/** GET /produits → List[ProduitResponse] */
export async function getProduits(params = {}) {
  const res = await fetch(`${STOCK_URL}/produits${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** POST /produits → ProduitResponse  (admin/gestionnaire) */
export async function createProduit(data) {
  const res = await fetch(`${STOCK_URL}/produits`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** PUT /produits/{id} → ProduitResponse  (admin/gestionnaire) */
export async function updateProduit(id, data) {
  const res = await fetch(`${STOCK_URL}/produits/${id}`, {
    method: 'PUT', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** DELETE /produits/{id}  (admin) */
export async function deleteProduit(id) {
  const res = await fetch(`${STOCK_URL}/produits/${id}`, {
    method: 'DELETE', headers: bearerHeader(),
  })
  if (res.status === 204) return null
  return handleResponse(res)
}

/** GET /stocks?entrepot_id=X → List[StockResponse] */
export async function getStocks(params = {}) {
  const res = await fetch(`${STOCK_URL}/stocks${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** GET /stocks/alertes → StockAlertResponse  (admin/gestionnaire) */
export async function getStocksEnAlerte() {
  const res = await fetch(`${STOCK_URL}/stocks/alertes`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** GET /stocks/produits-perimes → { date_calcul, nb_produits, total_global, categories } */
export async function getProduitsPerimes() {
  const res = await fetch(`${STOCK_URL}/stocks/produits-perimes`, { headers: bearerHeader() })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// MOUVEMENT — port 8004
// Retourne MouvementList { total, page, per_page, mouvements: [] }
// Pagination : ?page=1&per_page=10
// Filtres    : ?type_mouvement=entree|sortie|transfert
//              ?produit_id=X  ?entrepot_source_id=X  ?entrepot_dest_id=X
// ════════════════════════════════════════════════════════════

/**
 * GET /mouvements → MouvementList
 * @param {{ page?, per_page?, type_mouvement?, produit_id?, entrepot_source_id?, entrepot_dest_id? }} params
 */
export async function getMouvements(params = {}) {
  const res = await fetch(`${MOUVEMENT_URL}/mouvements${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** POST /mouvements → MouvementResponse */
export async function createMouvement(data) {
  const res = await fetch(`${MOUVEMENT_URL}/mouvements`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** PUT /mouvements/{id} → MouvementResponse (statut, motif, note seulement) */
export async function updateMouvement(id, data) {
  const res = await fetch(`${MOUVEMENT_URL}/mouvements/${id}`, {
    method: 'PUT', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** DELETE /mouvements/{id} → annule le mouvement et inverse les stocks */
export async function annulerMouvement(id) {
  const res = await fetch(`${MOUVEMENT_URL}/mouvements/${id}`, {
    method: 'DELETE', headers: authHeader(),
  })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// ALERTES — port 8005
// Retourne AlerteList { total, page, per_page, alertes: [] }
// niveau  : normal | critique | rupture | surstock
// statut  : active | traitee | resolue | ignoree
// ════════════════════════════════════════════════════════════

/**
 * GET /alertes → AlerteList
 * @param {{ page?, per_page?, niveau?, statut?, produit_id?, entrepot_id? }} params
 */
export async function getAlertes(params = {}) {
  const res = await fetch(`${ALERTES_URL}/alertes${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** GET /alertes/actives → AlerteList */
export async function getAlertesActives() {
  const res = await fetch(`${ALERTES_URL}/alertes/actives`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** GET /alertes/stats → AlerteStats */
export async function getAlertesStats() {
  const res = await fetch(`${ALERTES_URL}/alertes/stats`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** POST /alertes/verifier-stocks → { success, alertes_declenchees } */
export async function verifierStocks() {
  const res = await fetch(`${ALERTES_URL}/alertes/verifier-stocks`, {
    method: 'POST',
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** POST /alertes/verifier-expirations → { success, alertes_declenchees, produits_analyses } */
export async function verifierExpirations(seuilJours = 30) {
  const res = await fetch(`${ALERTES_URL}/alertes/verifier-expirations?seuil_jours=${seuilJours}`, {
    method: 'POST',
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** PUT /alertes/{id} → AlerteResponse  (changer statut) */
export async function updateAlerte(id, data) {
  const res = await fetch(`${ALERTES_URL}/alertes/${id}`, {
    method: 'PUT', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// NOTIFICATIONS — port 8006
// Retourne NotificationList { total, page, per_page, notifications: [] }
// ════════════════════════════════════════════════════════════

/** GET /notifications → NotificationList */
export async function getNotifications(params = {}) {
  const res = await fetch(`${NOTIF_URL}/notifications${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** GET /notifications/stats → NotificationStats */
export async function getNotificationsStats() {
  const res = await fetch(`${NOTIF_URL}/notifications/stats`, { headers: bearerHeader() })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// REPORTING — port 8007
// ════════════════════════════════════════════════════════════

/**
 * GET /reporting/dashboard → DashboardResponse
 * { kpi, top_produits, previsions_ml, alertes_actives, generated_at }
 */
export async function getDashboard() {
  const res = await fetch(`${REPORTING_URL}/reporting/dashboard`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** GET /reporting/kpi → KPIGlobaux */
export async function getKpi() {
  const res = await fetch(`${REPORTING_URL}/reporting/kpi`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** GET /reporting/previsions → List[PrevisionML] */
export async function getPrevisionsML(params = {}) {
  const res = await fetch(`${REPORTING_URL}/reporting/previsions${qs(params)}`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** GET /reporting/rapports → List[RapportResponse] */
export async function getRapports(params = {}) {
  const res = await fetch(`${REPORTING_URL}/reporting/rapports${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** POST /reporting/rapports → RapportResponse */
export async function createRapport(data) {
  const res = await fetch(`${REPORTING_URL}/reporting/rapports`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/**
 * POST /reporting/profit-perte → ProfitPerteResponse
 * @param {{ eau?, electricite?, autres?, salaires?, pertes_produits? }} data
 */
export async function calculerProfitPerte(data) {
  const res = await fetch(`${REPORTING_URL}/reporting/profit-perte`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/**
 * GET /reporting/profit-perte/historique → List[ProfitPerteResponse]
 * @param {{ limit?, page? }} params
 */
export async function getHistoriquePL(params = {}) {
  const res = await fetch(`${REPORTING_URL}/reporting/profit-perte/historique${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** GET /reporting/pertes-produits → PertesProduitsResponse */
export async function getPertesProduitsReporting() {
  const res = await fetch(`${REPORTING_URL}/reporting/pertes-produits`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** GET /reporting/salaires → SalairesResponse */
export async function getSalairesReporting() {
  const res = await fetch(`${REPORTING_URL}/reporting/salaires`, { headers: bearerHeader() })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// IA / RAG — port 8008
// ════════════════════════════════════════════════════════════

/** POST /ia/question → { reponse, sources, documents_utilises, temps_generation_ms } */
export async function askQuestion(question, produit_id = null) {
  const res = await fetch(`${IA_URL}/ia/question`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ question, produit_id, n_results: 5 }),
  })
  return handleResponse(res)
}

/**
 * GET /ia/recommandations → { recommandations, total, page, per_page }
 * @param {{ statut?, urgence?, page?, per_page? }} params
 */
export async function getRecommandations(params = {}) {
  const res = await fetch(`${IA_URL}/ia/recommandations${qs(params)}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/**
 * POST /ia/recommandation → RecommandationResponse  (pipeline RAG complet)
 * @param {{ produit_id, entrepot_id, alerte_id?, stock_actuel?, seuil_min?, contexte_supplementaire? }} data
 */
export async function createRecommandation(data) {
  const res = await fetch(`${IA_URL}/ia/recommandation`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** POST /ia/recommandations/{id}/feedback */
export async function sendFeedback(id, feedback) {
  const res = await fetch(`${IA_URL}/ia/recommandations/${id}/feedback`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(feedback),
  })
  return handleResponse(res)
}

/**
 * GET /ia/previsions?seuil_jours=30 → PrevisionResponse
 * @param {number} seuilJours
 */
export async function getPrevisions(seuilJours = 30) {
  const res = await fetch(`${IA_URL}/ia/previsions?seuil_jours=${seuilJours}`, {
    headers: bearerHeader(),
  })
  return handleResponse(res)
}

/** GET /ia/stats → { llm_model, embedding_model, documents_count, ... } */
export async function getIaStats() {
  const res = await fetch(`${IA_URL}/ia/stats`, { headers: bearerHeader() })
  return handleResponse(res)
}

/**
 * POST /ia/recommander-promotion → PromotionIAResponse
 * L'IA analyse le produit et recommande un % de réduction optimal
 * @param {{ produit_id, produit_nom?, stock_actuel?, prix_actuel?, jours_avant_expiration?, categorie? }} data
 */
export async function recommanderPromotion(data) {
  const res = await fetch(`${IA_URL}/ia/recommander-promotion`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// PROMOTIONS — port 8003
// ════════════════════════════════════════════════════════════

/** GET /promotions → PromotionList */
export async function getPromotions(params = {}) {
  const res = await fetch(`${STOCK_URL}/promotions${qs(params)}`, { headers: bearerHeader() })
  return handleResponse(res)
}

/** POST /promotions → PromotionResponse */
export async function createPromotion(data) {
  const res = await fetch(`${STOCK_URL}/promotions`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** PUT /promotions/{id} → PromotionResponse */
export async function updatePromotion(id, data) {
  const res = await fetch(`${STOCK_URL}/promotions/${id}`, {
    method: 'PUT', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

/** DELETE /promotions/{id} — désactive la promotion */
export async function deletePromotion(id) {
  const res = await fetch(`${STOCK_URL}/promotions/${id}`, {
    method: 'DELETE', headers: bearerHeader(),
  })
  if (res.status === 204) return null
  return handleResponse(res)
}

/**
 * POST /promotions/appliquer-ia?produit_id=... → PromotionResponse
 * Applique la recommandation IA comme promotion officielle
 * @param {{ produit_id, recommandation_ia_id, pourcentage_reduction, date_fin? }} data
 */
export async function appliquerIAPromotion(data) {
  const { produit_id, ...body } = data
  const res = await fetch(`${STOCK_URL}/promotions/appliquer-ia?produit_id=${produit_id}`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(body),
  })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// FOURNISSEURS — port 8003
// ════════════════════════════════════════════════════════════

export async function getFournisseurs(params = {}) {
  const res = await fetch(`${STOCK_URL}/fournisseurs${qs(params)}`, { headers: bearerHeader() })
  return handleResponse(res)
}

export async function getFournisseur(id) {
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}`, { headers: bearerHeader() })
  return handleResponse(res)
}

export async function createFournisseur(data) {
  const res = await fetch(`${STOCK_URL}/fournisseurs`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function updateFournisseur(id, data) {
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}`, {
    method: 'PUT', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function deleteFournisseur(id) {
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}`, {
    method: 'DELETE', headers: bearerHeader(),
  })
  return handleResponse(res)
}

export async function getFournisseurProduits(id) {
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}/produits`, { headers: bearerHeader() })
  return handleResponse(res)
}

export async function lierProduitFournisseur(fournisseurId, data) {
  const res = await fetch(`${STOCK_URL}/fournisseurs/${fournisseurId}/produits`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function delierProduitFournisseur(fournisseurId, produitId) {
  const res = await fetch(`${STOCK_URL}/fournisseurs/${fournisseurId}/produits/${produitId}`, {
    method: 'DELETE', headers: bearerHeader(),
  })
  return handleResponse(res)
}


// ════════════════════════════════════════════════════════════
// IA — NOUVELLES ROUTES (marge, timing, fournisseurs)
// ════════════════════════════════════════════════════════════

export async function vectoriserFournisseurs() {
  const res = await fetch(`${IA_URL}/ia/embedding/vectoriser-fournisseurs`, {
    method: 'POST', headers: bearerHeader(),
  })
  return handleResponse(res)
}

export async function vectoriserMarches() {
  const res = await fetch(`${IA_URL}/ia/embedding/vectoriser-marches`, {
    method: 'POST', headers: bearerHeader(),
  })
  return handleResponse(res)
}

export async function analyserMarge(produitId) {
  const res = await fetch(`${IA_URL}/ia/marges/analyser?produit_id=${produitId}`, {
    method: 'POST', headers: bearerHeader(),
  })
  return handleResponse(res)
}

export async function timingMarche(produitId) {
  const res = await fetch(`${IA_URL}/ia/marche/timing?produit_id=${produitId}`, {
    method: 'POST', headers: bearerHeader(),
  })
  return handleResponse(res)
}

export async function performanceFournisseurs() {
  const res = await fetch(`${IA_URL}/ia/fournisseurs/performance`, { headers: bearerHeader() })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// DÉPÔTS — port 8002
// ════════════════════════════════════════════════════════════

export async function getDepots(params = {}) {
  const res = await fetch(`${WAREHOUSE_URL}/depots${qs(params)}`, { headers: bearerHeader() })
  return handleResponse(res)
}
export async function getDepot(id) {
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}`, { headers: bearerHeader() })
  return handleResponse(res)
}
export async function createDepot(data) {
  const res = await fetch(`${WAREHOUSE_URL}/depots`, { method: 'POST', headers: authHeader(), body: JSON.stringify(data) })
  return handleResponse(res)
}
export async function updateDepot(id, data) {
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(data) })
  return handleResponse(res)
}
export async function deleteDepot(id) {
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}`, { method: 'DELETE', headers: bearerHeader() })
  return handleResponse(res)
}
export async function getDepotMagasins(id) {
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}/magasins`, { headers: bearerHeader() })
  return handleResponse(res)
}
export async function getDepotTree(id) {
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}/tree`, { headers: bearerHeader() })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// MAGASINS — port 8002
// ════════════════════════════════════════════════════════════

export async function getMagasins(params = {}) {
  const res = await fetch(`${WAREHOUSE_URL}/magasins${qs(params)}`, { headers: bearerHeader() })
  return handleResponse(res)
}
export async function getMagasin(id) {
  const res = await fetch(`${WAREHOUSE_URL}/magasins/${id}`, { headers: bearerHeader() })
  return handleResponse(res)
}
export async function createMagasin(data) {
  const res = await fetch(`${WAREHOUSE_URL}/magasins`, { method: 'POST', headers: authHeader(), body: JSON.stringify(data) })
  return handleResponse(res)
}
export async function updateMagasin(id, data) {
  const res = await fetch(`${WAREHOUSE_URL}/magasins/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(data) })
  return handleResponse(res)
}
export async function deleteMagasin(id) {
  const res = await fetch(`${WAREHOUSE_URL}/magasins/${id}`, { method: 'DELETE', headers: bearerHeader() })
  return handleResponse(res)
}

// ════════════════════════════════════════════════════════════
// TRANSFERTS — port 8002
// ════════════════════════════════════════════════════════════

export async function transfererDepotVersMagasin(data) {
  const res = await fetch(`${WAREHOUSE_URL}/transfers/depot-to-magasin`, { method: 'POST', headers: authHeader(), body: JSON.stringify(data) })
  return handleResponse(res)
}
export async function transfererMagasinVersDepot(data) {
  const res = await fetch(`${WAREHOUSE_URL}/transfers/magasin-to-depot`, { method: 'POST', headers: authHeader(), body: JSON.stringify(data) })
  return handleResponse(res)
}
export async function verifierCoherence() {
  const res = await fetch(`${WAREHOUSE_URL}/coherence/check`, { headers: bearerHeader() })
  return handleResponse(res)
}

