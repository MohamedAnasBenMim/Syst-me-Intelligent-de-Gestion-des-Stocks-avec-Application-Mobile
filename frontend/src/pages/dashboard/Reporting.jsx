import { useState, useEffect } from 'react'
import {
  BarChart2, Plus, Loader, AlertTriangle, RefreshCw,
  FileText, TrendingUp, TrendingDown, Package, X, Check,
  DollarSign, Users, Flame, Zap, ChevronDown, ChevronUp,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getKpi, getPrevisionsML, getRapports, createRapport,
  calculerProfitPerte, getHistoriquePL, askQuestion, getAlertes,
} from '../../services/api'
import './common.css'
import './Reporting.css'

// Valeurs exactes du backend enum TypeRapport
const TYPES_RAPPORT = [
  { value: 'mensuel',           label: 'Mensuel'                        },
  { value: 'journalier',        label: 'Journalier'                     },
  { value: 'hebdomadaire',      label: 'Hebdomadaire'                   },
  { value: 'personnalise',      label: 'Personnalisé'                   },
  { value: 'etat_stock_ia',     label: 'État du stock (IA)'          },
  { value: 'analyse_pl_ia',     label: 'Analyse financière (IA)'     },
]

// Types virtuels → backend type réel
const IA_TYPES = {
  etat_stock_ia:  { backendType: 'personnalise', mode: 'stock'    },
  analyse_pl_ia:  { backendType: 'personnalise', mode: 'financier' },
}

// Construire un prompt enrichi avec toutes les données collectées
async function buildIAPrompt(mode) {
  // Fetch toutes les données en parallèle
  const [kpiRes, prevRes, alertesRes, plRes] = await Promise.allSettled([
    getKpi(),
    getPrevisionsML(),
    getAlertes({ statut: 'ACTIVE', per_page: 50 }),
    getHistoriquePL({ limit: 1 }),
  ])

  const kpi       = kpiRes.status       === 'fulfilled' ? kpiRes.value       : null
  const previsions = prevRes.status     === 'fulfilled' ? (Array.isArray(prevRes.value) ? prevRes.value : []) : []
  const alertesData = alertesRes.status === 'fulfilled' ? (alertesRes.value?.alertes || []) : []
  const plHist    = plRes.status        === 'fulfilled' ? (Array.isArray(plRes.value) ? plRes.value : plRes.value?.historique || []) : []
  const lastPL    = plHist[0] || null

  // ── Section KPI ──
  const kpiBlock = kpi ? `
=== INDICATEURS CLÉS (KPI) ===
- Produits en stock           : ${kpi.total_produits ?? '?'}
- Entrepôts actifs            : ${kpi.total_entrepots ?? '?'}
- Stocks actifs (références)  : ${kpi.total_stocks_actifs ?? '?'}
- Alertes actives             : ${kpi.total_alertes_actives ?? '?'}
- Dont critiques              : ${kpi.total_critiques ?? '?'}
- Ruptures de stock           : ${kpi.total_ruptures ?? '?'}
- Surstocks                   : ${kpi.total_surstocks ?? '?'}
- Mouvements aujourd'hui      : ${kpi.total_mouvements_jour ?? '?'}
- Valeur totale du stock (TND): ${kpi.valeur_stock_total?.toFixed(2) ?? '?'}
- Taux occupation moyen       : ${kpi.taux_occupation_moyen?.toFixed(1) ?? '?'}%` : ''

  // ── Section Prévisions ML ──
  const urgentes = previsions.filter(p => p.jours_avant_rupture != null && p.jours_avant_rupture < 15)
  const prevBlock = previsions.length > 0 ? `
=== PRÉVISIONS ML (Prophet) — Ruptures imminentes ===
${urgentes.length === 0 ? '✔ Aucune rupture urgente prévue dans les 15 prochains jours.' : ''}
${previsions.slice(0, 10).map(p =>
  `- ${p.produit_nom || 'Produit #' + p.produit_id} | stock=${p.stock_actuel ?? '?'} | rupture dans ${p.jours_avant_rupture ?? '?'}j | confiance=${p.confiance != null ? Math.round(p.confiance * 100) + '%' : '?'} | conseil: ${p.recommandation || '—'}`
).join('\n')}` : ''

  // ── Section Alertes actives ──
  const alertBlock = alertesData.length > 0 ? `
=== ALERTES ACTIVES (${alertesData.length}) ===
${alertesData.slice(0, 15).map(a =>
  `- [${a.niveau}] ${a.produit_nom || 'Produit #' + a.produit_id} | entrepôt: ${a.entrepot_nom || '#' + a.entrepot_id} | qté=${a.quantite_actuelle ?? '?'} | seuil=${a.seuil_alerte_min ?? '?'} | ${a.message || ''}`
).join('\n')}` : '\n=== ALERTES === Aucune alerte active.'

  // ── Section P&L ──
  // Historique retourne: valeur_stock, profit, total_depenses, calcule_le, statut
  // La réponse directe retourne aussi chiffre_affaires, marge_brute, taux_marge
  const plBlock = lastPL ? (() => {
    const ca    = (lastPL.chiffre_affaires > 0 ? lastPL.chiffre_affaires : lastPL.valeur_stock) ?? 0
    const net   = lastPL.profit ?? 0
    const dep   = lastPL.total_depenses ?? 0
    const marge = ca > 0 ? ((net / ca) * 100).toFixed(1) + '%' : 'Non calculable'
    const date  = lastPL.calcule_le ? new Date(lastPL.calcule_le).toLocaleDateString('fr-FR') : 'N/A'
    return `
=== DERNIER CALCUL PROFIT & PERTES (calculé le ${date}) ===
- Valeur du stock             : ${ca.toFixed(2)} TND
- Total dépenses (charges)    : ${dep.toFixed(2)} TND
- Marge brute (stock - dépen) : ${(ca - dep).toFixed(2)} TND
- Profit net                  : ${net.toFixed(2)} TND (${net >= 0 ? 'BÉNÉFICE' : 'PERTE'})
- Taux de marge               : ${marge}
- Statut                      : ${lastPL.statut || 'N/A'}`
  })() : `
=== PROFIT & PERTES ===
Aucun calcul P&L effectué encore.`

  const contexte = [kpiBlock, prevBlock, alertBlock, plBlock].filter(Boolean).join('\n')

  if (mode === 'stock') {
    return `Tu es un expert en gestion de stock. Génère un rapport professionnel complet sur l'état actuel du stock en utilisant EXCLUSIVEMENT les données réelles ci-dessous.

${contexte}

INSTRUCTIONS :
Le rapport doit contenir :
1. **Résumé exécutif** — synthèse de la situation en 3-5 phrases
2. **État des stocks** — analyse des ruptures, surstocks, alertes critiques avec les chiffres précis
3. **Prévisions et risques** — produits à risque selon le ML, délais avant rupture
4. **Indicateurs financiers** — valeur du stock, taux d'occupation
5. **Recommandations prioritaires** — actions concrètes classées par urgence (haute/moyenne/basse)
6. **Conclusion** — évaluation globale de la santé du stock

Utilise les données réelles fournies. Sois précis, professionnel, et cite les chiffres exacts.`
  } else {
    return `Tu es un expert financier en gestion de stock. Génère une analyse financière complète en utilisant EXCLUSIVEMENT les données réelles ci-dessous.

${contexte}

INSTRUCTIONS :
L'analyse doit contenir :
1. **Résumé financier** — situation globale en 3-5 phrases avec les chiffres clés
2. **Analyse du chiffre d'affaires et marges** — CA, marge brute, profit net avec interprétation
3. **Analyse des coûts et pertes** — dépenses par catégorie, pertes sur stock, impact financier des ruptures
4. **Valeur du stock et rotation** — valeur totale, taux d'occupation, produits à risque financier
5. **Prévisions financières** — impact estimé des ruptures imminentes sur le CA
6. **Recommandations d'optimisation** — actions pour réduire les coûts et améliorer la rentabilité

Utilise les données réelles fournies. Sois précis, professionnel, et cite les chiffres en TND.`
  }
}

function fmtTND(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(n)
}

// ── Modal Rapport ────────────────────────────────────────────
function RapportModal({ onClose, onSaved }) {
  const [form, setForm]           = useState({ type_rapport: 'mensuel', titre: '', description: '' })
  const [loading, setLoading]     = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [error, setError]         = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  const isIAType = IA_TYPES[form.type_rapport] != null

  async function genererAvecIA() {
    const cfg = IA_TYPES[form.type_rapport]
    if (!cfg) return
    setLoadingIA(true)
    setError(null)
    try {
      // Collecter KPI + prévisions + alertes + P&L puis construire le prompt enrichi
      const prompt = await buildIAPrompt(cfg.mode)
      const res = await askQuestion(prompt)
      const texte = res?.reponse || res?.response || ''
      set('description', texte)
      if (!form.titre) {
        const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        const typeLabel = TYPES_RAPPORT.find(t => t.value === form.type_rapport)?.label.replace('🤖 ', '') || ''
        set('titre', `${typeLabel} — ${now}`)
      }
    } catch (err) {
      setError("Erreur IA : " + (err?.message || 'Impossible de générer la description.'))
    } finally {
      setLoadingIA(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const backendType = IA_TYPES[form.type_rapport]?.backendType || form.type_rapport
      const payload = {
        type_rapport: backendType,
        titre:        form.titre,
        description:  form.description || null,
      }
      const saved = await createRapport(payload)
      // Attach description locally for immediate table display
      onSaved({ ...saved, _description: form.description })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>Générer un rapport</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}

          <div className="form-group">
            <label>Type <span className="req">*</span></label>
            <select value={form.type_rapport} onChange={e => set('type_rapport', e.target.value)}>
              {TYPES_RAPPORT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isIAType && (
              <p style={{ fontSize: 11, color: '#6366F1', marginTop: 4 }}>
                L'IA analysera les données en temps réel pour générer le contenu du rapport.
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Titre <span className="req">*</span></label>
            <input value={form.titre} onChange={e => set('titre', e.target.value)}
              placeholder="Ex : Rapport stock Q1 2026" required />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Description / Contenu</span>
              {isIAType && (
                <button type="button" className="btn-ghost"
                  style={{ padding: '3px 10px', fontSize: 11 }}
                  onClick={genererAvecIA} disabled={loadingIA}>
                  {loadingIA
                    ? <><Loader size={11} className="spin" /> Collecte données + IA…</>
                    : <><Zap size={11} /> Générer avec IA</>}
                </button>
              )}
            </label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={isIAType
                ? "Cliquez sur « Générer avec IA » pour obtenir une analyse automatique…"
                : "Description optionnelle du rapport…"}
              rows={isIAType ? 8 : 3}
              style={{ width: '100%', resize: 'vertical', fontSize: 12, lineHeight: 1.6,
                padding: '8px 10px', borderRadius: 6, border: '1px solid #E5E7EB',
                fontFamily: 'inherit', color: '#374151' }}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading || loadingIA}>
              {loading
                ? <><Loader size={14} className="spin" /> Génération…</>
                : <><Check size={14} /> Générer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + '18' }}>
        {icon}
      </div>
      <div>
        <div className="stat-val">{value ?? '—'}</div>
        <div className="stat-lbl">{label}</div>
        {sub && <div className="stat-lbl" style={{ marginTop: 2, fontSize: 11 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Section P&L ──────────────────────────────────────────────
function PLSection() {
  const [form, setForm] = useState({
    eau: '', electricite: '', autres: '',
    salaires: '', pertes_produits: '',
  })
  const [result,    setResult]    = useState(null)
  const [historique, setHistorique] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [error,     setError]     = useState(null)
  const [showHist,  setShowHist]  = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function calculate(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const payload = {
        eau:          form.eau          !== '' ? parseFloat(form.eau)          : 0,
        electricite:  form.electricite  !== '' ? parseFloat(form.electricite)  : 0,
        autres:       form.autres       !== '' ? parseFloat(form.autres)       : 0,
        salaires:     form.salaires     !== '' ? parseFloat(form.salaires)     : null,
        pertes_produits: form.pertes_produits !== '' ? parseFloat(form.pertes_produits) : null,
      }
      const data = await calculerProfitPerte(payload)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadHistorique() {
    setLoadingHist(true)
    try {
      const data = await getHistoriquePL({ limit: 10 })
      setHistorique(Array.isArray(data) ? data : data?.historique || [])
      setShowHist(true)
    } catch {
      setHistorique([])
      setShowHist(true)
    } finally {
      setLoadingHist(false)
    }
  }

  // Champs réels retournés par le backend
  const profit   = result?.profit
  const ca       = result?.chiffre_affaires > 0 ? result.chiffre_affaires : result?.valeur_stock
  const marge    = result?.marge_brute ?? (ca != null && result?.total_depenses != null ? ca - result.total_depenses : profit)
  const taux     = result?.taux_marge > 0 ? result.taux_marge.toFixed(1) : (ca > 0 ? ((profit / ca) * 100).toFixed(1) : null)
  const isProfit = profit != null && profit >= 0

  return (
    <div className="pl-section">
      <div className="pl-section-header">
        <DollarSign size={18} color="#6366F1" />
        <h2>Calcul Profit & Pertes (P&L)</h2>
      </div>

      <div className="pl-grid">
        {/* ── Formulaire dépenses ── */}
        <div className="pl-form-card">
          <div className="pl-form-title">Saisir les charges</div>
          <p className="pl-form-hint">
            Laissez <em>Salaires</em> ou <em>Pertes produits</em> vide pour les récupérer automatiquement
            depuis les données du système.
          </p>
          <form onSubmit={calculate}>
            {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}

            <div className="pl-form-group">
              <label><Zap size={13} /> Électricité (TND)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.electricite} onChange={e => set('electricite', e.target.value)} />
            </div>
            <div className="pl-form-group">
              <label>💧 Eau (TND)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.eau} onChange={e => set('eau', e.target.value)} />
            </div>
            <div className="pl-form-group">
              <label><Users size={13} /> Salaires (TND) <span className="auto-tag">auto</span></label>
              <input type="number" min="0" step="0.01" placeholder="Auto (depuis Auth)"
                value={form.salaires} onChange={e => set('salaires', e.target.value)} />
            </div>
            <div className="pl-form-group">
              <label><Flame size={13} /> Pertes produits (TND) <span className="auto-tag">auto</span></label>
              <input type="number" min="0" step="0.01" placeholder="Auto (depuis Stock)"
                value={form.pertes_produits} onChange={e => set('pertes_produits', e.target.value)} />
            </div>
            <div className="pl-form-group">
              <label>Autres charges (TND)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.autres} onChange={e => set('autres', e.target.value)} />
            </div>

            <button type="submit" className="btn-primary pl-submit-btn" disabled={loading}>
              {loading
                ? <><Loader size={14} className="spin" /> Calcul en cours…</>
                : <><DollarSign size={14} /> Calculer le P&L</>}
            </button>
          </form>
        </div>

        {/* ── Résultat ── */}
        <div className="pl-result-card">
          {!result ? (
            <div className="pl-result-empty">
              <DollarSign size={40} color="#E5E7EB" />
              <p>Remplissez le formulaire et cliquez sur<br /><b>Calculer le P&L</b></p>
            </div>
          ) : (
            <>
              {/* Profit net */}
              <div className={`pl-net ${isProfit ? 'pl-net--profit' : 'pl-net--perte'}`}>
                {isProfit ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                <div>
                  <div className="pl-net-label">{isProfit ? 'Bénéfice net' : 'Perte nette'}</div>
                  <div className="pl-net-value">{fmtTND(Math.abs(profit))}</div>
                </div>
              </div>

              {/* Résumé chiffres clés */}
              <div className="pl-summary">
                <div className="pl-summary-row">
                  <span>
                    {result?.chiffre_affaires > 0 ? 'Chiffre d\'affaires (sorties)' : 'Valeur du stock'}
                  </span>
                  <span className="pl-val-green">{fmtTND(ca)}</span>
                </div>
                <div className="pl-summary-row">
                  <span>Total dépenses</span>
                  <span className="pl-val-red">{fmtTND(result.total_depenses)}</span>
                </div>
                <div className="pl-summary-row pl-summary-row--bold">
                  <span>Marge brute</span>
                  <span style={{ color: marge >= 0 ? '#28A745' : '#DC3545' }}>{fmtTND(marge)}</span>
                </div>
                {taux && (
                  <div className="pl-summary-row">
                    <span>Taux de marge</span>
                    <span style={{ fontWeight: 600 }}>{taux}%</span>
                  </div>
                )}
              </div>

              {/* Détail dépenses (toggle) */}
              <button className="pl-toggle-btn" onClick={() => setShowDetail(v => !v)}>
                {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetail ? 'Masquer' : 'Détail des dépenses'}
              </button>

              {showDetail && result.detail_depenses && (
                <div className="pl-detail">
                  <div className="pl-detail-row">
                    <span>Électricité</span><span>{fmtTND(result.detail_depenses.electricite)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>Eau</span><span>{fmtTND(result.detail_depenses.eau)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>
                      Salaires
                      {result.detail_depenses.salaires_auto && (
                        <span className="auto-tag ml-4">auto</span>
                      )}
                    </span>
                    <span>{fmtTND(result.detail_depenses.salaires)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>
                      Pertes produits
                      {result.detail_depenses.pertes_produits_auto && (
                        <span className="auto-tag ml-4">auto</span>
                      )}
                    </span>
                    <span>{fmtTND(result.detail_depenses.pertes_produits)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>Autres charges</span><span>{fmtTND(result.detail_depenses.autres)}</span>
                  </div>
                  <div className="pl-detail-row pl-detail-row--total">
                    <span>Total</span><span>{fmtTND(result.detail_depenses.total)}</span>
                  </div>
                </div>
              )}

              {/* Analyse IA */}
              {result.analyse_ia && (
                <div className="pl-ia-block">
                  <div className="pl-ia-title"><Zap size={13} /> Analyse IA</div>
                  {result.analyse_ia.recommandations?.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: '#374151' }}>
                      {result.analyse_ia.recommandations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  {result.analyse_ia.alerte_pertes_produits && (
                    <p className="pl-ia-text" style={{ color: '#DC3545', marginTop: 6 }}>
                      ⚠️ {result.analyse_ia.alerte_pertes_produits}
                    </p>
                  )}
                  {result.analyse_ia.depense_plus_elevee && (
                    <p className="pl-ia-text" style={{ marginTop: 4 }}>
                      Poste de dépense principal : <b>{result.analyse_ia.depense_plus_elevee}</b>
                      {result.analyse_ia.pourcentage_depense_max != null
                        ? ` (${result.analyse_ia.pourcentage_depense_max.toFixed(1)}%)`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Pertes par catégorie */}
              {result.pertes_produits?.categories?.length > 0 && (
                <div className="pl-pertes-block">
                  <div className="pl-pertes-title">Pertes par catégorie</div>
                  {result.pertes_produits.categories.map((c, i) => (
                    <div key={i} className="pl-perte-row">
                      <span>{c.categorie || 'Sans catégorie'}</span>
                      <span>{c.nb_produits} produit(s)</span>
                      <span className="pl-val-red">{fmtTND(c.total_categorie)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Historique ── */}
      <div className="pl-hist-header">
        <button className="btn-ghost pl-hist-btn" onClick={loadHistorique} disabled={loadingHist}>
          {loadingHist
            ? <><Loader size={13} className="spin" /> Chargement…</>
            : <><FileText size={13} /> Voir l'historique P&L</>}
        </button>
      </div>

      {showHist && (
        <div className="data-card" style={{ marginTop: 0 }}>
          <div className="data-card-header">
            <span className="data-card-title">Historique P&L</span>
            <button className="modal-close" onClick={() => setShowHist(false)}><X size={15} /></button>
          </div>
          {historique.length === 0 ? (
            <div className="state-empty"><FileText size={28} /><p>Aucun calcul enregistré.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>CA RÉEL</th>
                    <th>VALEUR STOCK</th>
                    <th>DÉPENSES</th>
                    <th>PROFIT NET</th>
                    <th>MARGE</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map((h, i) => {
                    const net    = h.profit
                    const ca     = h.chiffre_affaires > 0 ? h.chiffre_affaires : null
                    const base   = ca ?? h.valeur_stock
                    const marge  = base > 0 ? ((net / base) * 100).toFixed(1) : null
                    const isPos  = net >= 0
                    return (
                      <tr key={i}>
                        <td>{new Date(h.calcule_le).toLocaleDateString('fr-FR')}</td>
                        <td>{ca ? fmtTND(ca) : <span style={{color:'#9CA3AF',fontSize:11}}>—</span>}</td>
                        <td>{fmtTND(h.valeur_stock)}</td>
                        <td>{fmtTND(h.total_depenses)}</td>
                        <td>
                          <span className={isPos ? 'pl-val-green' : 'pl-val-red'}>
                            {isPos ? '+' : ''}{fmtTND(net)}
                          </span>
                        </td>
                        <td>{marge != null ? `${marge}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function Reporting() {
  const { user: me } = useAuth()
  const isAdminOrGest = me?.role === 'admin' || me?.role === 'gestionnaire'

  const [kpi,        setKpi]        = useState(null)
  const [previsions, setPrevisions] = useState([])
  const [rapports,   setRapports]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [modal,      setModal]      = useState(false)
  const [toast,      setToast]      = useState(null)
  const [periode,    setPeriode]    = useState(30)   // jours filtre prévisions

  useEffect(() => { load() }, [])

  async function load(p = periode) {
    setLoading(true)
    setError(null)
    try {
      const [k, prev, r] = await Promise.allSettled([
        getKpi(),
        getPrevisionsML({ periode: p }),
        getRapports({ per_page: 20 }),
      ])
      if (k.status === 'fulfilled') setKpi(k.value)
      if (prev.status === 'fulfilled') setPrevisions(Array.isArray(prev.value) ? prev.value : [])
      if (r.status === 'fulfilled') {
        const raw = r.value
        setRapports(Array.isArray(raw) ? raw : raw?.rapports || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSaved(saved) {
    setModal(false)
    setRapports(prev => [saved, ...prev])
    showToast('Rapport généré avec succès.')
  }

  function fmtDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Toutes les prévisions pour la période choisie (déjà triées par le backend)
  const previsionsFiltrees = previsions
  const urgencePrev = previsions.filter(p => p.rupture_dans_periode)

  return (
    <DashboardLayout>
      <div className="page">

        {/* Header */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <BarChart2 size={22} color="var(--teal)" />
            <div>
              <h1>Reporting & Analyses</h1>
              <p>Indicateurs clés, prévisions ML, P&L et rapports générés</p>
            </div>
          </div>
          <div className="page-hdr-actions">
            <button className="btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualiser
            </button>
            {isAdminOrGest && (
              <button className="btn-primary" onClick={() => setModal(true)}>
                <Plus size={15} /> Nouveau rapport
              </button>
            )}
          </div>
        </div>

        {error && <div className="state-error"><AlertTriangle size={16} /> {error}</div>}

        {/* KPI Cards */}
        <div className="stat-row">
          <KpiCard
            icon={<Package size={20} color="#6366F1" />}
            label="Produits en stock"
            value={kpi?.total_produits ?? '—'}
            sub={kpi ? `${kpi.taux_occupation_moyen?.toFixed(1) ?? 0}% occupation` : null}
            color="#6366F1"
          />
          <KpiCard
            icon={<TrendingDown size={20} color="#DC3545" />}
            label="Ruptures de stock"
            value={kpi?.total_ruptures ?? '—'}
            color="#DC3545"
          />
          <KpiCard
            icon={<AlertTriangle size={20} color="#E8730A" />}
            label="Alertes actives"
            value={kpi?.total_alertes_actives ?? '—'}
            color="#E8730A"
          />
          <KpiCard
            icon={<TrendingUp size={20} color="#28A745" />}
            label="Mouvements (aujourd'hui)"
            value={kpi?.total_mouvements_jour ?? '—'}
            color="#28A745"
          />
        </div>

        {/* ── Section P&L ── */}
        {isAdminOrGest && <PLSection />}

        {/* Two-column: prévisions + rapports */}
        <div className="rpt-two-col">

          {/* Prévisions ML */}
          <div className="data-card">
            <div className="data-card-header">
              <span className="data-card-title">Prévisions ML — Ruptures imminentes</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {urgencePrev.length > 0 && (
                  <span className="badge badge-solid-red">{urgencePrev.length} urgent{urgencePrev.length > 1 ? 's' : ''}</span>
                )}
                <select
                  value={periode}
                  onChange={e => { const v = Number(e.target.value); setPeriode(v); load(v) }}
                  style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 6,
                    border: '1px solid #E5E7EB', background: '#fff',
                    color: '#374151', cursor: 'pointer',
                  }}
                >
                  <option value={7}>7 jours</option>
                  <option value={15}>15 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={60}>60 jours</option>
                </select>
              </div>
            </div>
            {loading ? (
              <div className="state-loading"><Loader size={20} className="spin" /></div>
            ) : previsionsFiltrees.length === 0 ? (
              <div className="state-empty">
                <TrendingUp size={32} />
                <p>Aucune prévision disponible.</p>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PRODUIT</th>
                      <th>STOCK ACTUEL</th>
                      <th>{`STOCK PRÉVU (J+${periode})`}</th>
                      <th>RUPTURE DANS</th>
                      <th>CONFIANCE</th>
                      <th>RECOMMANDATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previsionsFiltrees.slice(0, 20).map((p, i) => {
                      const jours   = p.jours_avant_rupture
                      const enDanger = p.rupture_dans_periode
                      const jBadge  = jours == null ? 'badge-gray'
                        : jours <= 7  ? 'badge-solid-red'
                        : jours <= 15 ? 'badge-solid-orange'
                        : jours <= periode ? 'badge-solid-orange'
                        : 'badge-solid-green'
                      const stockPrevu = p.stock_prevu
                      return (
                        <tr key={i} style={enDanger ? { background: '#FFF5F5' } : {}}>
                          <td className="td-name">
                            {enDanger && <span style={{ color: '#DC3545', marginRight: 4 }}>⚠</span>}
                            {p.produit_nom || `Produit #${p.produit_id}`}
                          </td>
                          <td>{p.stock_actuel ?? '—'}</td>
                          <td>
                            <span style={{
                              fontWeight: 600,
                              color: enDanger ? '#DC3545' : stockPrevu != null && stockPrevu < 10 ? '#E8730A' : '#28A745'
                            }}>
                              {stockPrevu != null ? stockPrevu : '—'}
                            </span>
                            {enDanger && <span style={{ fontSize: 10, color: '#DC3545', marginLeft: 4 }}>RUPTURE</span>}
                          </td>
                          <td>
                            <span className={`badge ${jBadge}`}>
                              {jours == null ? 'N/A' : `${jours}j`}
                            </span>
                          </td>
                          <td>{p.confiance != null ? `${Math.round(p.confiance * 100)}%` : '—'}</td>
                          <td style={{ fontSize: 11, color: '#6B7280', maxWidth: 240 }}>
                            {p.recommandation || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rapports générés */}
          <div className="data-card">
            <div className="data-card-header">
              <span className="data-card-title">Rapports générés</span>
              <span className="badge badge-teal">{rapports.length}</span>
            </div>
            {loading ? (
              <div className="state-loading"><Loader size={20} className="spin" /></div>
            ) : rapports.length === 0 ? (
              <div className="state-empty">
                <FileText size={32} />
                <p>Aucun rapport généré.</p>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>TITRE</th>
                      <th>TYPE</th>
                      <th>DESCRIPTION / CONTENU</th>
                      <th>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapports.map(r => {
                      let desc = r._description || null
                      if (!desc && r.donnees_json) {
                        try {
                          const d = JSON.parse(r.donnees_json)
                          desc = d.description || null
                        } catch { /* ignore */ }
                      }
                      return (
                      <tr key={r.id}>
                        <td className="td-name">{r.titre || '—'}</td>
                        <td>
                          <span className="badge badge-navy">
                            {TYPES_RAPPORT.find(t => t.value === r.type_rapport)?.label?.replace('🤖 ', '') || r.type_rapport}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: '#6B7280', maxWidth: 260 }}>
                          {desc ? (
                            <span title={desc}>
                              {desc.length > 80 ? desc.slice(0, 80) + '…' : desc}
                            </span>
                          ) : (
                            <span style={{ color: '#D1D5DB' }}>—</span>
                          )}
                        </td>
                        <td className="td-date">{fmtDate(r.created_at)}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal */}
        {modal && (
          <RapportModal onClose={() => setModal(false)} onSaved={handleSaved} />
        )}

        {/* Toast */}
        {toast && (
          <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
            {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
