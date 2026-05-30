import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Configuration réseau ──────────────────────────────────────
//
//  MODE LOCAL  (même WiFi que le PC) :
//    laisser TUNNEL_URL = null
//
//  MODE TUNNEL (4G ou autre réseau) :
//    1. lancer  : node gateway.js
//    2. lancer  : cloudflared tunnel --url http://localhost:9000
//    3. copier l'URL affichée et la coller ci-dessous
//
const TUNNEL_URL = 'https://columnists-owner-detected-cannon.trycloudflare.com';
const LOCAL_HOST = '192.168.100.4';

const AUTH_URL      = TUNNEL_URL ? `${TUNNEL_URL}/api/auth`         : `http://${LOCAL_HOST}:8001/api/v1`;
const WAREHOUSE_URL = TUNNEL_URL ? `${TUNNEL_URL}/api/warehouse`    : `http://${LOCAL_HOST}:8002/api/v1`;
const STOCK_URL     = TUNNEL_URL ? `${TUNNEL_URL}/api/stock`        : `http://${LOCAL_HOST}:8003/api/v1`;
const MOUVEMENT_URL = TUNNEL_URL ? `${TUNNEL_URL}/api/mouvement`    : `http://${LOCAL_HOST}:8004/api/v1`;
const ALERTES_URL   = TUNNEL_URL ? `${TUNNEL_URL}/api/alertes`      : `http://${LOCAL_HOST}:8005/api/v1`;
const NOTIF_URL     = TUNNEL_URL ? `${TUNNEL_URL}/api/notification` : `http://${LOCAL_HOST}:8006/api/v1`;
const REPORTING_URL = TUNNEL_URL ? `${TUNNEL_URL}/api/reporting`    : `http://${LOCAL_HOST}:8007/api/v1`;
const IA_URL        = TUNNEL_URL ? `${TUNNEL_URL}/api/ia`           : `http://${LOCAL_HOST}:8008/api/v1`;

// ── Helpers ───────────────────────────────────────────────────
export async function getToken() {
  return await AsyncStorage.getItem('sgs_token');
}
export async function setToken(t) {
  await AsyncStorage.setItem('sgs_token', t);
}
export async function removeToken() {
  await AsyncStorage.removeItem('sgs_token');
}

async function authHeader() {
  const t = await getToken();
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}
async function bearerHeader() {
  const t = await getToken();
  return { Authorization: `Bearer ${t}` };
}

function qs(params = {}) {
  const p = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString();
  return p ? '?' + p : '';
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    let message;
    if (typeof data.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail.map(e => e.msg || JSON.stringify(e)).join(' | ');
    } else {
      message = JSON.stringify(data.detail);
    }
    throw new Error(message);
  }
  return data;
}

// ════════════════════════════════════════════════════════════
// AUTH — port 8001
// ════════════════════════════════════════════════════════════
export async function login(email, password) {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function clerkLogin({ clerk_user_id, clerk_token, email, prenom, nom }) {
  const res = await fetch(`${AUTH_URL}/auth/clerk-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clerk_user_id, clerk_token, email, prenom, nom }),
  });
  return handleResponse(res);
}

export async function getMe() {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/auth/me`, { headers: h });
  return handleResponse(res);
}

export async function forgotPassword(email) {
  const res = await fetch(`${AUTH_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export async function resetPassword(session_token, otp_code, nouveau_password) {
  const res = await fetch(`${AUTH_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_token, otp_code, nouveau_password }),
  });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// UTILISATEURS — port 8001
// ════════════════════════════════════════════════════════════
export async function getUtilisateurs() {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs`, { headers: h });
  return handleResponse(res);
}

export async function getUtilisateur(id) {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createUtilisateur(data) {
  const h = await authHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateUtilisateur(id, data) {
  const h = await authHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteUtilisateur(id) {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}`, { method: 'DELETE', headers: h });
  if (res.status === 204) return {};
  return handleResponse(res);
}

export async function desactiverUtilisateur(id) {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}/desactiver`, { method: 'PATCH', headers: h });
  return handleResponse(res);
}

export async function reactiverUtilisateur(id) {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}/reactiver`, { method: 'PATCH', headers: h });
  return handleResponse(res);
}

export async function changePassword(id, data) {
  const h = await authHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/${id}/password`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getSalaires() {
  const h = await bearerHeader();
  const res = await fetch(`${AUTH_URL}/utilisateurs/salaires`, { headers: h });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// DÉPÔTS — port 8002
// ════════════════════════════════════════════════════════════
export async function getDepots(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getDepot(id) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createDepot(data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateDepot(id, data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteDepot(id) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}`, { method: 'DELETE', headers: h });
  if (res.status === 204) return {};
  return handleResponse(res);
}

export async function getDepotMagasins(id) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}/magasins`, { headers: h });
  return handleResponse(res);
}

export async function getDepotTree(id) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/depots/${id}/tree`, { headers: h });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// MAGASINS — port 8002
// ════════════════════════════════════════════════════════════
export async function getMagasins(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/magasins${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getMagasin(id) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/magasins/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createMagasin(data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/magasins`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateMagasin(id, data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/magasins/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteMagasin(id) {
  const h = await bearerHeader();
  const res = await fetch(`${WAREHOUSE_URL}/magasins/${id}`, { method: 'DELETE', headers: h });
  if (res.status === 204) return {};
  return handleResponse(res);
}

export async function getEntrepots(params = {}) {
  const [depots, magasins] = await Promise.all([
    getDepots(params).catch(() => []),
    getMagasins(params).catch(() => []),
  ]);
  const dl = Array.isArray(depots)   ? depots   : (depots.depots     ?? depots.items   ?? []);
  const ml = Array.isArray(magasins) ? magasins : (magasins.magasins ?? magasins.items ?? []);
  return [
    ...dl.map(d => ({ ...d, _type: 'depot' })),
    ...ml.map(m => ({ ...m, _type: 'magasin' })),
  ];
}

// ════════════════════════════════════════════════════════════
// TRANSFERTS — port 8002
// ════════════════════════════════════════════════════════════
export async function transfererDepotVersMagasin(data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/transfers/depot-to-magasin`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function transfererMagasinVersDepot(data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/transfers/magasin-to-depot`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function transfererEntreMagasins(data) {
  const h = await authHeader();
  const res = await fetch(`${WAREHOUSE_URL}/transfers/magasin-to-magasin`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// PRODUITS / STOCK — port 8003
// ════════════════════════════════════════════════════════════
export async function getProduits(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/produits${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getProduit(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/produits/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createProduit(data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/produits`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateProduit(id, data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/produits/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteProduit(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/produits/${id}`, { method: 'DELETE', headers: h });
  if (res.status === 204) return {};
  return handleResponse(res);
}

export async function getStocks(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/stocks${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getStocksEnAlerte() {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/stocks/alertes`, { headers: h });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// FOURNISSEURS — port 8003
// ════════════════════════════════════════════════════════════
export async function getFournisseurs(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getFournisseur(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createFournisseur(data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateFournisseur(id, data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteFournisseur(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}`, { method: 'DELETE', headers: h });
  if (res.status === 204) return {};
  return handleResponse(res);
}

export async function getFournisseurProduits(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs/${id}/produits`, { headers: h });
  return handleResponse(res);
}

export async function lierProduitFournisseur(fournisseurId, data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs/${fournisseurId}/produits`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function delierProduitFournisseur(fournisseurId, produitId) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/fournisseurs/${fournisseurId}/produits/${produitId}`, {
    method: 'DELETE', headers: h,
  });
  if (res.status === 204) return {};
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// MOUVEMENTS — port 8004
// ════════════════════════════════════════════════════════════
export async function getMouvements(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${MOUVEMENT_URL}/mouvements${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getMouvement(id) {
  const h = await bearerHeader();
  const res = await fetch(`${MOUVEMENT_URL}/mouvements/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createMouvement(data) {
  const h = await authHeader();
  const res = await fetch(`${MOUVEMENT_URL}/mouvements`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function annulerMouvement(id, motif) {
  const h = await authHeader();
  const res = await fetch(`${MOUVEMENT_URL}/mouvements/${id}/annuler`, {
    method: 'POST', headers: h, body: JSON.stringify({ motif }),
  });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// ALERTES — port 8005
// ════════════════════════════════════════════════════════════
export async function getAlertes(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${ALERTES_URL}/alertes${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getAlertesActives() {
  const h = await bearerHeader();
  const res = await fetch(`${ALERTES_URL}/alertes/actives`, { headers: h });
  return handleResponse(res);
}

export async function getAlertesStats() {
  const h = await bearerHeader();
  const res = await fetch(`${ALERTES_URL}/alertes/stats`, { headers: h });
  return handleResponse(res);
}

export async function updateAlerte(id, data) {
  const h = await authHeader();
  const res = await fetch(`${ALERTES_URL}/alertes/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function acquitterAlerte(id) {
  const h = await authHeader();
  const res = await fetch(`${ALERTES_URL}/alertes/${id}/acquitter`, {
    method: 'POST', headers: h, body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function resoudreAlerte(id) {
  const h = await authHeader();
  const res = await fetch(`${ALERTES_URL}/alertes/${id}/resoudre`, {
    method: 'POST', headers: h, body: JSON.stringify({}),
  });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// NOTIFICATIONS — port 8006
// ════════════════════════════════════════════════════════════
export async function getNotifications(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${NOTIF_URL}/notifications${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getNotificationsStats() {
  const h = await bearerHeader();
  const res = await fetch(`${NOTIF_URL}/notifications/stats`, { headers: h });
  return handleResponse(res);
}

export async function marquerNotificationLue(id) {
  const h = await authHeader();
  const res = await fetch(`${NOTIF_URL}/notifications/${id}/lire`, {
    method: 'POST', headers: h, body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function marquerToutesLues() {
  const h = await authHeader();
  const res = await fetch(`${NOTIF_URL}/notifications/tout-lire`, {
    method: 'POST', headers: h, body: JSON.stringify({}),
  });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// REPORTING — port 8007
// ════════════════════════════════════════════════════════════
export async function getDashboard() {
  const h = await bearerHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/dashboard`, { headers: h });
  return handleResponse(res);
}

export async function getKpi() {
  const h = await bearerHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/kpi`, { headers: h });
  return handleResponse(res);
}

export async function getProfitPerte() {
  const h = await bearerHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/profit-perte/historique?limit=1`, { headers: h });
  return handleResponse(res);
}

export async function calculerPL(data) {
  const h = await authHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/profit-perte/calculer`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getHistoriquePL(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/profit-perte/historique${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getPrevisionsML(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/previsions${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getPertesProduits() {
  const h = await bearerHeader();
  const res = await fetch(`${REPORTING_URL}/reporting/pertes-produits`, { headers: h });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// PROMOTIONS — port 8003
// ════════════════════════════════════════════════════════════
export async function getPromotions(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/promotions${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getPromotion(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/promotions/${id}`, { headers: h });
  return handleResponse(res);
}

export async function createPromotion(data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/promotions`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updatePromotion(id, data) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/promotions/${id}`, {
    method: 'PUT', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deletePromotion(id) {
  const h = await bearerHeader();
  const res = await fetch(`${STOCK_URL}/promotions/${id}`, { method: 'DELETE', headers: h });
  if (res.status === 204) return {};
  return handleResponse(res);
}

export async function desactiverPromotion(id) {
  const h = await authHeader();
  const res = await fetch(`${STOCK_URL}/promotions/${id}/desactiver`, {
    method: 'POST', headers: h, body: JSON.stringify({}),
  });
  return handleResponse(res);
}

// ════════════════════════════════════════════════════════════
// IA / RAG — port 8008
// ════════════════════════════════════════════════════════════
export async function askQuestion(question, produit_id = null, entrepot_id = null) {
  const h = await authHeader();
  const res = await fetch(`${IA_URL}/ia/question`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ question, produit_id, entrepot_id, n_results: 5 }),
  });
  return handleResponse(res);
}

export async function getRecommandations(params = {}) {
  const h = await bearerHeader();
  const res = await fetch(`${IA_URL}/ia/recommandations${qs(params)}`, { headers: h });
  return handleResponse(res);
}

export async function getPrevisions(seuilJours = 30) {
  const h = await bearerHeader();
  const res = await fetch(`${IA_URL}/ia/previsions?seuil_jours=${seuilJours}`, { headers: h });
  return handleResponse(res);
}

export async function sendFeedback(data) {
  const h = await authHeader();
  const res = await fetch(`${IA_URL}/ia/recommandations/feedback`, {
    method: 'POST', headers: h, body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function performanceFournisseurs() {
  const h = await bearerHeader();
  const res = await fetch(`${IA_URL}/ia/fournisseurs/performance`, { headers: h });
  return handleResponse(res);
}
