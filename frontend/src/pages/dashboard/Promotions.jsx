import { useState, useEffect } from 'react'
import {
  Tag, Brain, Loader, AlertTriangle, RefreshCw, Plus, X,
  Check, Flame, Zap, ChevronDown, ChevronUp, Trash2, Pencil,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getProduitsPerimes, getPromotions, createPromotion,
  updatePromotion, deletePromotion,
  recommanderPromotion, appliquerIAPromotion,
  getProduits,
} from '../../services/api'
import './common.css'
import './Promotions.css'

function fmtTND(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Carte produit périmé avec bouton IA ──────────────────────
function PerimeCard({ p, onIaClick }) {
  const isExpire = p.jours_restants != null && p.jours_restants <= 0
  const isUrgent = p.jours_restants != null && p.jours_restants <= 7 && p.jours_restants > 0

  return (
    <div className={`perime-card ${isExpire ? 'perime-card--expire' : isUrgent ? 'perime-card--urgent' : ''}`}>
      <div className="perime-header">
        <div className="perime-nom">{p.designation || p.nom || `Produit #${p.id}`}</div>
        {isExpire && <span className="perime-tag perime-tag--expire">Expiré</span>}
        {isUrgent && <span className="perime-tag perime-tag--urgent">Critique</span>}
        {!isExpire && !isUrgent && <span className="perime-tag perime-tag--warn">À surveiller</span>}
      </div>
      <div className="perime-meta">
        {p.categorie && <span>{p.categorie}</span>}
        {p.quantite != null && <span>{p.quantite} unités</span>}
        {p.prix_unitaire != null && <span>{fmtTND(p.prix_unitaire)}</span>}
        {p.date_expiration && <span>Exp: {fmtDate(p.date_expiration)}</span>}
        {p.jours_restants != null && (
          <span style={{ color: isExpire ? '#EF4444' : isUrgent ? '#F59E0B' : '#6B7280', fontWeight: 600 }}>
            {isExpire ? `Expiré depuis ${Math.abs(p.jours_restants)}j` : `J-${p.jours_restants}`}
          </span>
        )}
      </div>
      <button className="btn-ia-reco" onClick={() => onIaClick(p)}>
        <Brain size={14} /> Recommandation IA
      </button>
    </div>
  )
}

// ── Panneau recommandation IA ─────────────────────────────────
function IaPanel({ reco, produit, onAppliquer, onFermer, applying }) {
  const urgenceCfg = {
    critique: { color: '#EF4444', label: 'Urgence critique' },
    haute:    { color: '#F59E0B', label: 'Urgence haute' },
    moyenne:  { color: '#6366F1', label: 'Urgence moyenne' },
    basse:    { color: '#22C55E', label: 'Urgence basse' },
  }
  const urg = urgenceCfg[reco.urgence] || urgenceCfg.moyenne

  return (
    <div className="ia-panel">
      <div className="ia-panel-header">
        <div className="ia-panel-title">
          <Brain size={16} color="#6366F1" />
          Recommandation IA — {reco.produit_nom}
        </div>
        <button className="modal-close" onClick={onFermer}><X size={15} /></button>
      </div>

      <div className="ia-reco-main">
        <div className="ia-reco-pct">{reco.pourcentage_suggere.toFixed(0)}%</div>
        <div className="ia-reco-label">de réduction recommandée</div>
        {reco.prix_initial != null && (
          <div className="ia-reco-prix">
            <span className="prix-barre">{fmtTND(reco.prix_initial)}</span>
            <span className="prix-arrow">→</span>
            <span className="prix-promo">{fmtTND(reco.prix_promo_estime)}</span>
          </div>
        )}
      </div>

      <div className="ia-panel-motif">
        <div className="ia-panel-motif-title">
          <Zap size={13} color="#6366F1" /> Analyse IA
        </div>
        <p>{reco.analyse_complete || reco.motif}</p>
      </div>

      <div className="ia-panel-footer">
        <div className="ia-panel-meta">
          <span style={{ color: urg.color, fontWeight: 600, fontSize: 12 }}>
            ● {urg.label}
          </span>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>
            Confiance : {Math.round(reco.confiance_score * 100)}%
          </span>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>
            {reco.temps_generation_ms}ms
          </span>
        </div>
        <button
          className="btn-appliquer"
          onClick={() => onAppliquer(reco)}
          disabled={applying}
        >
          {applying
            ? <><Loader size={14} className="spin" /> Application…</>
            : <><Check size={14} /> Appliquer cette promotion</>}
        </button>
      </div>
    </div>
  )
}

// ── Modal édition promotion ───────────────────────────────────
function EditPromotionModal({ promo, onClose, onSaved }) {
  const [form, setForm] = useState({
    pourcentage_reduction: promo.pourcentage_reduction ?? '',
    motif:    promo.motif   ?? '',
    date_fin: promo.date_fin ? promo.date_fin.split('T')[0] : '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const saved = await updatePromotion(promo.id, {
        pourcentage_reduction: parseFloat(form.pourcentage_reduction),
        motif:    form.motif   || null,
        date_fin: form.date_fin || null,
      })
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
          <h2>Modifier la promotion — {promo.produit_nom}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Réduction (%) <span className="req">*</span></label>
              <input type="number" min="1" max="100" step="0.5"
                value={form.pourcentage_reduction}
                onChange={e => set('pourcentage_reduction', e.target.value)}
                required />
            </div>
            <div className="form-group">
              <label>Date fin (optionnel)</label>
              <input type="date" value={form.date_fin}
                onChange={e => set('date_fin', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Motif</label>
            <input value={form.motif}
              onChange={e => set('motif', e.target.value)}
              placeholder="Ex: Expiration proche, Liquidation saisonnière" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader size={14} className="spin" /> Enregistrement…</> : <><Check size={14} /> Enregistrer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal promotion manuelle ──────────────────────────────────
function PromotionModal({ produits, onClose, onSaved }) {
  const [form, setForm] = useState({
    produit_id: '', pourcentage_reduction: '', motif: '',
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const saved = await createPromotion({
        produit_id:           parseInt(form.produit_id),
        pourcentage_reduction: parseFloat(form.pourcentage_reduction),
        motif:                form.motif || null,
        date_debut:           form.date_debut,
        date_fin:             form.date_fin || null,
      })
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
          <h2>Nouvelle promotion</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}

          <div className="form-group">
            <label>Produit <span className="req">*</span></label>
            <select value={form.produit_id} onChange={e => set('produit_id', e.target.value)} required>
              <option value="">Sélectionner un produit…</option>
              {produits.map(p => (
                <option key={p.id} value={p.id}>
                  {p.designation} — {fmtTND(p.prix_unitaire)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Réduction (%) <span className="req">*</span></label>
              <input type="number" min="1" max="100" step="0.5"
                value={form.pourcentage_reduction}
                onChange={e => set('pourcentage_reduction', e.target.value)}
                placeholder="Ex: 20" required />
            </div>
            <div className="form-group">
              <label>Date fin (optionnel)</label>
              <input type="date" value={form.date_fin}
                min={form.date_debut}
                onChange={e => set('date_fin', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Motif</label>
            <input value={form.motif}
              onChange={e => set('motif', e.target.value)}
              placeholder="Ex: Expiration proche, Liquidation saisonnière" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader size={14} className="spin" /> Création…</> : <><Tag size={14} /> Créer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function Promotions() {
  const { user: me } = useAuth()
  const isAdminOrGest = me?.role === 'admin' || me?.role === 'gestionnaire'

  const [promotions,  setPromotions]  = useState([])
  const [perimes,     setPerimes]     = useState([])
  const [produits,    setProduits]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [iaLoading,   setIaLoading]   = useState(null)   // produit_id en cours
  const [applying,    setApplying]    = useState(false)
  const [iaReco,      setIaReco]      = useState(null)   // { reco, produit }
  const [modal,       setModal]       = useState(false)
  const [editPromo,   setEditPromo]   = useState(null)   // promotion en cours d'édition
  const [toast,       setToast]       = useState(null)
  const [showPerimes, setShowPerimes] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [prom, per, prod] = await Promise.allSettled([
      getPromotions({ per_page: 50 }),
      getProduitsPerimes(),
      getProduits(),
    ])
    if (prom.status === 'fulfilled') {
      const d = prom.value
      setPromotions(Array.isArray(d) ? d : d?.promotions || [])
    }
    if (per.status === 'fulfilled') {
      const d = per.value
      // Récupère la liste des produits périmés depuis toutes les catégories
      const cats = d?.categories || []
      const list = cats.flatMap(c => (c.produits || []).map(p => ({
        ...p, categorie: c.categorie,
        jours_restants: p.jours_avant_expiration,
      })))
      setPerimes(list)
    }
    if (prod.status === 'fulfilled') {
      setProduits(Array.isArray(prod.value) ? prod.value : prod.value?.produits || [])
    }
    setLoading(false)
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleIaClick(produit) {
    setIaLoading(produit.id)
    setIaReco(null)
    try {
      const reco = await recommanderPromotion({
        produit_id:             produit.id || produit.produit_id,
        produit_nom:            produit.designation || produit.nom,
        stock_actuel:           produit.quantite,
        prix_actuel:            produit.prix_unitaire,
        jours_avant_expiration: produit.jours_restants ?? produit.jours_avant_expiration,
        categorie:              produit.categorie,
      })
      setIaReco({ reco, produit })
    } catch (err) {
      showToast(`Erreur IA : ${err.message}`, false)
    } finally {
      setIaLoading(null)
    }
  }

  async function handleAppliquer(reco) {
    setApplying(true)
    try {
      const saved = await appliquerIAPromotion({
        produit_id:            reco.produit_id,
        recommandation_ia_id:  reco.recommandation_id,
        pourcentage_reduction: reco.pourcentage_suggere,
      })
      setPromotions(prev => [saved, ...prev])
      setIaReco(null)
      showToast(`Promotion -${reco.pourcentage_suggere.toFixed(0)}% appliquée sur ${reco.produit_nom} !`)
    } catch (err) {
      showToast(`Erreur : ${err.message}`, false)
    } finally {
      setApplying(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deletePromotion(id)
      setPromotions(prev => prev.filter(p => p.id !== id))
      showToast('Promotion désactivée.')
    } catch (err) {
      showToast(err.message, false)
    }
  }

  function handleEditSaved(saved) {
    setEditPromo(null)
    setPromotions(prev => prev.map(p => p.id === saved.id ? saved : p))
    showToast('Promotion mise à jour.')
  }

  async function handleActivate(id) {
    try {
      const updated = await updatePromotion(id, { est_active: true })
      setPromotions(prev => prev.map(p => p.id === id ? updated : p))
      showToast('Promotion réactivée.')
    } catch (err) {
      showToast(err.message, false)
    }
  }

  function handleModalSaved(saved) {
    setModal(false)
    setPromotions(prev => [saved, ...prev])
    showToast(`Promotion créée sur ${saved.produit_nom} !`)
  }

  const actives   = promotions.filter(p => p.est_active)
  const inactives = promotions.filter(p => !p.est_active)

  return (
    <DashboardLayout>
      <div className="page">

        {/* Header */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Tag size={22} color="#6366F1" />
            <div>
              <h1>Promotions & Réductions</h1>
              <p>L'IA recommande le % optimal pour limiter les pertes sur produits à risque</p>
            </div>
          </div>
          <div className="page-hdr-actions">
            <button className="btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualiser
            </button>
            {isAdminOrGest && (
              <button className="btn-primary" onClick={() => setModal(true)}>
                <Plus size={15} /> Promotion manuelle
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="state-loading"><Loader size={24} className="spin" /><p>Chargement…</p></div>
        ) : (
          <>
            {/* ── Produits à risque ── */}
            {perimes.length > 0 && (
              <div className="data-card">
                <div className="data-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flame size={16} color="#EF4444" />
                    <span className="data-card-title">Produits à risque</span>
                    <span className="badge badge-solid-red">{perimes.length}</span>
                  </div>
                  <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setShowPerimes(v => !v)}>
                    {showPerimes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showPerimes ? 'Réduire' : 'Afficher'}
                  </button>
                </div>
                {showPerimes && (
                  <div className="perime-grid">
                    {perimes.map((p, i) => (
                      <div key={i} className="perime-item-wrap">
                        <PerimeCard
                          p={p}
                          onIaClick={isAdminOrGest ? handleIaClick : () => {}}
                        />
                        {iaLoading === (p.id || p.produit_id) && (
                          <div className="ia-loading-overlay">
                            <Loader size={20} className="spin" />
                            <span>L'IA analyse…</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Panneau recommandation IA ── */}
            {iaReco && (
              <IaPanel
                reco={iaReco.reco}
                produit={iaReco.produit}
                onAppliquer={handleAppliquer}
                onFermer={() => setIaReco(null)}
                applying={applying}
              />
            )}

            {/* ── Promotions actives ── */}
            <div className="data-card">
              <div className="data-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag size={15} color="#22C55E" />
                  <span className="data-card-title">Promotions actives</span>
                  <span className="badge badge-green">{actives.length}</span>
                </div>
              </div>
              {actives.length === 0 ? (
                <div className="state-empty">
                  <Tag size={32} /><p>Aucune promotion active.</p>
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PRODUIT</th>
                        <th>RÉDUCTION</th>
                        <th>PRIX INITIAL</th>
                        <th>PRIX PROMO</th>
                        <th>MOTIF</th>
                        <th>DATE FIN</th>
                        <th>SOURCE</th>
                        {isAdminOrGest && <th>ACTIONS</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {actives.map(p => (
                        <tr key={p.id}>
                          <td className="td-name">{p.produit_nom || `#${p.produit_id}`}</td>
                          <td>
                            <span className="pct-badge">-{p.pourcentage_reduction}%</span>
                          </td>
                          <td style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>
                            {fmtTND(p.prix_initial)}
                          </td>
                          <td style={{ color: '#22C55E', fontWeight: 700 }}>
                            {fmtTND(p.prix_promo)}
                          </td>
                          <td className="td-muted" style={{ maxWidth: 200 }}>
                            {p.motif || '—'}
                          </td>
                          <td className="td-date">{fmtDate(p.date_fin)}</td>
                          <td>
                            {p.recommandation_ia_id
                              ? <span className="badge badge-teal"><Brain size={10} /> IA</span>
                              : <span className="badge badge-gray">Manuel</span>}
                          </td>
                          {isAdminOrGest && (
                            <td style={{ display: 'flex', gap: 4 }}>
                              <button className="act-btn" title="Modifier"
                                onClick={() => setEditPromo(p)}>
                                <Pencil size={13} />
                              </button>
                              <button className="act-btn del" title="Désactiver"
                                onClick={() => handleDelete(p.id)}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Historique ── */}
            {inactives.length > 0 && (
              <div className="data-card">
                <div className="data-card-header">
                  <span className="data-card-title" style={{ color: '#9CA3AF' }}>
                    Promotions terminées ({inactives.length})
                  </span>
                </div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PRODUIT</th><th>RÉDUCTION</th>
                        <th>PRIX PROMO</th><th>DATE FIN</th><th>SOURCE</th>
                        {isAdminOrGest && <th>ACTIONS</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {inactives.slice(0, 10).map(p => (
                        <tr key={p.id} style={{ opacity: 0.7 }}>
                          <td className="td-name">{p.produit_nom || `#${p.produit_id}`}</td>
                          <td><span className="pct-badge pct-badge--inactive">-{p.pourcentage_reduction}%</span></td>
                          <td>{fmtTND(p.prix_promo)}</td>
                          <td className="td-date">{fmtDate(p.date_fin)}</td>
                          <td>
                            {p.recommandation_ia_id
                              ? <span className="badge badge-teal"><Brain size={10} /> IA</span>
                              : <span className="badge badge-gray">Manuel</span>}
                          </td>
                          {isAdminOrGest && (
                            <td>
                              <button className="act-btn" title="Réactiver cette promotion"
                                onClick={() => handleActivate(p.id)}>
                                <Check size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal promotion manuelle */}
        {modal && (
          <PromotionModal
            produits={produits}
            onClose={() => setModal(false)}
            onSaved={handleModalSaved}
          />
        )}

        {/* Modal édition promotion */}
        {editPromo && (
          <EditPromotionModal
            promo={editPromo}
            onClose={() => setEditPromo(null)}
            onSaved={handleEditSaved}
          />
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
