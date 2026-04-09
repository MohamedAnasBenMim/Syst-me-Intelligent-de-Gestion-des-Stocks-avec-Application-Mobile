import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Loader, AlertTriangle, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ShieldAlert,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getAlertes, getAlertesStats, updateAlerte } from '../../services/api'
import './common.css'

// ── Helpers ────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const NIVEAU_CFG = {
  RUPTURE:          { badgeClass: 'badge-solid-red',    label: 'Rupture'          },
  CRITIQUE:         { badgeClass: 'badge-solid-orange', label: 'Critique'         },
  SURSTOCK:         { badgeClass: 'badge-solid-teal',   label: 'Surstock'         },
  NORMAL:           { badgeClass: 'badge-green',        label: 'Normal'           },
  EXPIRATION_PROCHE:{ badgeClass: 'badge-solid-purple', label: 'Expiration proche'},
  // fallback minuscules
  rupture:          { badgeClass: 'badge-solid-red',    label: 'Rupture'  },
  critique:         { badgeClass: 'badge-solid-orange', label: 'Critique' },
  surstock:         { badgeClass: 'badge-solid-teal',   label: 'Surstock' },
  normal:           { badgeClass: 'badge-green',        label: 'Normal'   },
}

const STATUT_CFG = {
  ACTIVE:  { badgeClass: 'badge-red',    label: 'Active'  },
  TRAITEE: { badgeClass: 'badge-orange', label: 'Traitée' },
  RESOLUE: { badgeClass: 'badge-green',  label: 'Résolue' },
  IGNOREE: { badgeClass: 'badge-gray',   label: 'Ignorée' },
  // fallback minuscules
  active:  { badgeClass: 'badge-red',    label: 'Active'  },
  traitee: { badgeClass: 'badge-orange', label: 'Traitée' },
  resolue: { badgeClass: 'badge-green',  label: 'Résolue' },
  ignoree: { badgeClass: 'badge-gray',   label: 'Ignorée' },
}

// ── Toast ──────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
      {toast.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
      {toast.msg}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────

export default function Alertes() {
  const { user } = useAuth()
  const isManager = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [alertes,       setAlertes]       = useState([])
  const [stats,         setStats]         = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [filterNiveau,  setFilterNiveau]  = useState('')
  const [filterStatut,  setFilterStatut]  = useState('')
  const [page,          setPage]          = useState(1)
  const [total,         setTotal]         = useState(0)
  const [updating,      setUpdating]      = useState(null)
  const [toast,         setToast]         = useState(null)

  const PER_PAGE = 20

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, per_page: PER_PAGE }
      if (filterNiveau) params.niveau = filterNiveau
      if (filterStatut) params.statut = filterStatut
      const [alertesData, statsData] = await Promise.all([
        getAlertes(params),
        getAlertesStats(),
      ])
      setAlertes(alertesData?.alertes || [])
      setTotal(alertesData?.total || 0)
      setStats(statsData || null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [page, filterNiveau, filterStatut])

  useEffect(() => { load() }, [load])

  async function handleAction(alerte, statut) {
    setUpdating(alerte.id)
    try {
      await updateAlerte(alerte.id, { statut })
      showToast(`Alerte marquée comme "${statut}".`)
      load()
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || 'Erreur lors de la mise à jour.', false)
    } finally {
      setUpdating(null)
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Bell size={22} color="#6366F1" />
            <div>
              <h1>Alertes de stock</h1>
              <p>{total} alerte{total !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(220,53,69,0.1)' }}>
              <ShieldAlert size={20} color="#DC3545" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_actives ?? '—'}</div>
              <div className="stat-lbl">Actives</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(220,53,69,0.12)' }}>
              <AlertTriangle size={20} color="#DC3545" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_ruptures ?? '—'}</div>
              <div className="stat-lbl">Ruptures</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(232,115,10,0.1)' }}>
              <AlertTriangle size={20} color="#E8730A" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_critiques ?? '—'}</div>
              <div className="stat-lbl">Critiques</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(40,167,69,0.1)' }}>
              <CheckCircle size={20} color="#28A745" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_resolues ?? '—'}</div>
              <div className="stat-lbl">Résolues</div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Niveau :</span>
          <select
            value={filterNiveau}
            onChange={e => { setFilterNiveau(e.target.value); setPage(1) }}
          >
            <option value="">Tous</option>
            <option value="NORMAL">Normal</option>
            <option value="CRITIQUE">Critique</option>
            <option value="RUPTURE">Rupture</option>
            <option value="SURSTOCK">Surstock</option>
            <option value="EXPIRATION_PROCHE">Expiration proche</option>
          </select>
          <div className="toolbar-sep" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Statut :</span>
          <select
            value={filterStatut}
            onChange={e => { setFilterStatut(e.target.value); setPage(1) }}
          >
            <option value="">Tous</option>
            <option value="ACTIVE">Active</option>
            <option value="TRAITEE">Traitée</option>
            <option value="RESOLUE">Résolue</option>
            <option value="IGNOREE">Ignorée</option>
          </select>
        </div>

        {/* ── Table ── */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">Liste des alertes</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Page {page} / {totalPages || 1}
            </span>
          </div>

          {loading ? (
            <div className="state-loading">
              <Loader size={24} className="spin" />
              <span>Chargement…</span>
            </div>
          ) : error ? (
            <div className="state-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : alertes.length === 0 ? (
            <div className="state-empty">
              <CheckCircle size={32} color="#28A745" />
              <span>Aucune alerte trouvée</span>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>NIVEAU</th>
                    <th>PRODUIT</th>
                    <th>ENTREPÔT</th>
                    <th>QTÉ ACTUELLE</th>
                    <th>SEUIL MIN</th>
                    <th>MESSAGE</th>
                    <th>STATUT</th>
                    <th>DATE</th>
                    {isManager && <th>ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {alertes.map(a => {
                    const nc = NIVEAU_CFG[a.niveau] || NIVEAU_CFG.normal
                    const sc = STATUT_CFG[a.statut] || STATUT_CFG.active
                    const isUpdating = updating === a.id

                    return (
                      <tr key={a.id}>
                        <td className="td-id">#{a.id}</td>
                        <td><span className={`badge ${nc.badgeClass}`}>{nc.label}</span></td>
                        <td className="td-name">{a.produit_nom || `Produit #${a.produit_id}`}</td>
                        <td className="td-muted">{a.entrepot_nom || `Entrepôt #${a.entrepot_id}`}</td>
                        <td style={{ fontWeight: 600 }}>{a.quantite_actuelle ?? '—'}</td>
                        <td className="td-muted">{a.seuil_alerte_min ?? '—'}</td>
                        <td style={{ fontSize: 12, color: '#374151', maxWidth: 220 }}>
                          <span title={a.message}>
                            {a.message?.length > 60 ? a.message.slice(0, 60) + '…' : (a.message || '—')}
                          </span>
                        </td>
                        <td><span className={`badge ${sc.badgeClass}`}>{sc.label}</span></td>
                        <td className="td-date">{fmtDate(a.created_at)}</td>
                        {isManager && (
                          <td>
                            <div className="td-acts">
                              {(a.statut === 'active' || a.statut === 'ACTIVE') && (
                                <>
                                  <button
                                    className="act-btn edit"
                                    title="Traiter"
                                    disabled={isUpdating}
                                    onClick={() => handleAction(a, 'TRAITEE')}
                                    style={{ width: 'auto', padding: '4px 10px', fontSize: 11, fontWeight: 600 }}
                                  >
                                    {isUpdating ? <Loader size={11} className="spin" /> : 'Traiter'}
                                  </button>
                                  <button
                                    className="act-btn"
                                    title="Ignorer"
                                    disabled={isUpdating}
                                    onClick={() => handleAction(a, 'IGNOREE')}
                                    style={{ width: 'auto', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#6B7280' }}
                                  >
                                    Ignorer
                                  </button>
                                </>
                              )}
                              {(a.statut === 'traitee' || a.statut === 'TRAITEE') && (
                                <button
                                  className="act-btn"
                                  title="Résoudre"
                                  disabled={isUpdating}
                                  onClick={() => handleAction(a, 'RESOLUE')}
                                  style={{ width: 'auto', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#28A745', borderColor: '#28A745' }}
                                >
                                  {isUpdating ? <Loader size={11} className="spin" /> : 'Résoudre'}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && !error && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid #F0F0F0' }}>
              <button
                className="btn-ghost"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '7px 14px' }}
              >
                <ChevronLeft size={14} /> Précédent
              </button>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{page} / {totalPages}</span>
              <button
                className="btn-ghost"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '7px 14px' }}
              >
                Suivant <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* ── Toast ── */}
        <Toast toast={toast} />
      </div>
    </DashboardLayout>
  )
}
