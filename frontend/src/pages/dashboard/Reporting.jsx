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
  calculerProfitPerte, getHistoriquePL,
} from '../../services/api'
import './common.css'
import './Reporting.css'

// Valeurs exactes du backend enum TypeRapport
const TYPES_RAPPORT = [
  { value: 'mensuel',      label: 'Mensuel'      },
  { value: 'journalier',   label: 'Journalier'   },
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
  { value: 'personnalise', label: 'Personnalisé' },
]

function fmtTND(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(n)
}

// ── Modal Rapport ────────────────────────────────────────────
function RapportModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ type_rapport: 'mensuel', titre: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const saved = await createRapport(form)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Générer un rapport</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}

          <div className="form-group">
            <label>Titre <span className="req">*</span></label>
            <input value={form.titre} onChange={e => set('titre', e.target.value)}
              placeholder="Ex : Rapport stock Q1 2026" required />
          </div>

          <div className="form-group">
            <label>Type <span className="req">*</span></label>
            <select value={form.type_rapport} onChange={e => set('type_rapport', e.target.value)}>
              {TYPES_RAPPORT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading}>
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

  const profit = result?.profit_net
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
                  <span>Chiffre d'affaires</span>
                  <span className="pl-val-green">{fmtTND(result.chiffre_affaires)}</span>
                </div>
                <div className="pl-summary-row">
                  <span>Total dépenses</span>
                  <span className="pl-val-red">{fmtTND(result.total_depenses)}</span>
                </div>
                <div className="pl-summary-row pl-summary-row--bold">
                  <span>Marge brute</span>
                  <span>{fmtTND(result.marge_brute)}</span>
                </div>
              </div>

              {/* Détail dépenses (toggle) */}
              <button className="pl-toggle-btn" onClick={() => setShowDetail(v => !v)}>
                {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetail ? 'Masquer' : 'Détail des dépenses'}
              </button>

              {showDetail && result.depenses && (
                <div className="pl-detail">
                  <div className="pl-detail-row">
                    <span>Électricité</span><span>{fmtTND(result.depenses.electricite)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>Eau</span><span>{fmtTND(result.depenses.eau)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>
                      Salaires
                      {result.depenses.salaires_auto && (
                        <span className="auto-tag ml-4">auto</span>
                      )}
                    </span>
                    <span>{fmtTND(result.depenses.salaires)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>
                      Pertes produits
                      {result.depenses.pertes_produits_auto && (
                        <span className="auto-tag ml-4">auto</span>
                      )}
                    </span>
                    <span>{fmtTND(result.depenses.pertes_produits)}</span>
                  </div>
                  <div className="pl-detail-row">
                    <span>Autres charges</span><span>{fmtTND(result.depenses.autres)}</span>
                  </div>
                  <div className="pl-detail-row pl-detail-row--total">
                    <span>Total</span><span>{fmtTND(result.depenses.total)}</span>
                  </div>
                </div>
              )}

              {/* Analyse IA */}
              {result.analyse_ia && (
                <div className="pl-ia-block">
                  <div className="pl-ia-title"><Zap size={13} /> Analyse IA</div>
                  <p className="pl-ia-text">{result.analyse_ia}</p>
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
                    <th>CA</th>
                    <th>DÉPENSES</th>
                    <th>PROFIT NET</th>
                    <th>MARGE</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map((h, i) => {
                    const net = h.profit_net
                    const isPos = net >= 0
                    return (
                      <tr key={i}>
                        <td>{new Date(h.created_at || h.date_calcul).toLocaleDateString('fr-FR')}</td>
                        <td>{fmtTND(h.chiffre_affaires)}</td>
                        <td>{fmtTND(h.total_depenses)}</td>
                        <td>
                          <span className={isPos ? 'pl-val-green' : 'pl-val-red'}>
                            {isPos ? '+' : ''}{fmtTND(net)}
                          </span>
                        </td>
                        <td>{h.taux_marge != null ? `${h.taux_marge.toFixed(1)}%` : '—'}</td>
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

  const [kpi,       setKpi]       = useState(null)
  const [previsions, setPrevisions] = useState([])
  const [rapports,  setRapports]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [modal,     setModal]     = useState(false)
  const [toast,     setToast]     = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [k, p, r] = await Promise.allSettled([
        getKpi(),
        getPrevisionsML(),
        getRapports({ per_page: 20 }),
      ])
      if (k.status === 'fulfilled') setKpi(k.value)
      if (p.status === 'fulfilled') setPrevisions(Array.isArray(p.value) ? p.value : [])
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

  const urgencePrev = previsions.filter(p => p.jours_restants != null && p.jours_restants < 15)

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
              {urgencePrev.length > 0 && (
                <span className="badge badge-solid-red">{urgencePrev.length} urgent{urgencePrev.length > 1 ? 's' : ''}</span>
              )}
            </div>
            {loading ? (
              <div className="state-loading"><Loader size={20} className="spin" /></div>
            ) : previsions.length === 0 ? (
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
                      <th>JOURS AVANT RUPTURE</th>
                      <th>CONFIANCE</th>
                      <th>RECOMMANDATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previsions.slice(0, 10).map((p, i) => {
                      const jours = p.jours_avant_rupture
                      const cls = jours == null ? 'badge-gray'
                        : jours < 7  ? 'badge-solid-red'
                        : jours < 15 ? 'badge-solid-orange'
                        : 'badge-solid-green'
                      return (
                        <tr key={i}>
                          <td className="td-name">{p.produit_nom || `Produit #${p.produit_id}`}</td>
                          <td>{p.stock_actuel ?? '—'}</td>
                          <td>
                            <span className={`badge ${cls}`}>
                              {jours == null ? 'N/A' : `${jours}j`}
                            </span>
                          </td>
                          <td>{p.confiance != null ? `${Math.round(p.confiance * 100)}%` : '—'}</td>
                          <td style={{ fontSize: 11, color: '#6B7280', maxWidth: 260 }}>
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
                      <th>FORMAT</th>
                      <th>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapports.map(r => (
                      <tr key={r.id}>
                        <td className="td-name">{r.titre || '—'}</td>
                        <td>
                          <span className="badge badge-navy">
                            {TYPES_RAPPORT.find(t => t.value === r.type_rapport)?.label || r.type_rapport}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-teal">{(r.format || '').toUpperCase()}</span>
                        </td>
                        <td className="td-date">{fmtDate(r.created_at)}</td>
                      </tr>
                    ))}
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
