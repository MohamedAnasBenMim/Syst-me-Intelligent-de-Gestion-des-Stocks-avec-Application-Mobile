import { useState, useEffect, useCallback } from 'react'
import {
  BellRing, Loader, AlertTriangle, CheckCircle, XCircle,
  Mail, ChevronLeft, ChevronRight,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getNotifications, getNotificationsStats } from '../../services/api'
import './common.css'

// ── Helpers ────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function truncate(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

const STATUT_CFG = {
  envoyee:    { badgeClass: 'badge-green',  label: 'Envoyé'     },
  en_attente: { badgeClass: 'badge-orange', label: 'En attente' },
  echec:      { badgeClass: 'badge-red',    label: 'Échec'      },
  ENVOYEE:    { badgeClass: 'badge-green',  label: 'Envoyé'     },
  EN_ATTENTE: { badgeClass: 'badge-orange', label: 'En attente' },
  ECHEC:      { badgeClass: 'badge-red',    label: 'Échec'      },
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

export default function Notifications() {
  const { user } = useAuth() // eslint-disable-line no-unused-vars

  const [notifications, setNotifications] = useState([])
  const [stats,         setStats]         = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [page,          setPage]          = useState(1)
  const [total,         setTotal]         = useState(0)
  const [toast,         setToast]         = useState(null)

  const PER_PAGE = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [notifData, statsData] = await Promise.all([
        getNotifications({ page, per_page: PER_PAGE }),
        getNotificationsStats(),
      ])
      setNotifications(notifData?.notifications || [])
      setTotal(notifData?.total || 0)
      setStats(statsData || null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <BellRing size={22} color="#6366F1" />
            <div>
              <h1>Notifications</h1>
              <p>{total} notification{total !== 1 ? 's' : ''} (lecture seule)</p>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(40,167,69,0.1)' }}>
              <CheckCircle size={20} color="#28A745" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_envoyees ?? '—'}</div>
              <div className="stat-lbl">Envoyées</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(232,115,10,0.1)' }}>
              <Loader size={20} color="#E8730A" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_en_attente ?? '—'}</div>
              <div className="stat-lbl">En attente</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(220,53,69,0.1)' }}>
              <XCircle size={20} color="#DC3545" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_echecs ?? '—'}</div>
              <div className="stat-lbl">Échecs</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6,148,162,0.1)' }}>
              <Mail size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val">{stats?.total_email ?? '—'}</div>
              <div className="stat-lbl">Email</div>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">Historique des notifications</span>
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
          ) : notifications.length === 0 ? (
            <div className="state-empty">
              <BellRing size={32} color="#ADB5BD" />
              <span>Aucune notification</span>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>TYPE</th>
                    <th>SUJET</th>
                    <th>DESTINATAIRE</th>
                    <th>PRODUIT / ENTREPÔT</th>
                    <th>STATUT</th>
                    <th>ALERTE #</th>
                    <th>DATE ENVOI</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map(n => {
                    const sc = STATUT_CFG[n.statut] || STATUT_CFG.en_attente
                    const typeLabel = n.canal
                      ? n.canal.toUpperCase()
                      : (n.type_notification || '—').toUpperCase()

                    return (
                      <tr key={n.id}>
                        <td className="td-id">#{n.id}</td>
                        <td>
                          <span className="badge badge-teal">{typeLabel}</span>
                        </td>
                        <td style={{ maxWidth: 240 }}>
                          <span title={n.sujet} style={{ fontSize: 13, color: '#1E1B4B' }}>
                            {truncate(n.sujet, 60)}
                          </span>
                        </td>
                        <td>
                          <div className="td-name" style={{ fontSize: 13 }}>
                            {n.destinataire_nom || '—'}
                          </div>
                          {n.destinataire_email && (
                            <div className="td-muted">{n.destinataire_email}</div>
                          )}
                        </td>
                        <td>
                          {n.produit_nom && (
                            <div style={{ fontSize: 12, color: '#374151' }}>{n.produit_nom}</div>
                          )}
                          {n.entrepot_nom && (
                            <div className="td-muted">{n.entrepot_nom}</div>
                          )}
                          {!n.produit_nom && !n.entrepot_nom && (
                            <span className="text-light">—</span>
                          )}
                        </td>
                        <td><span className={`badge ${sc.badgeClass}`}>{sc.label}</span></td>
                        <td className="td-muted">
                          {n.alerte_id ? `#${n.alerte_id}` : '—'}
                        </td>
                        <td className="td-date">
                          {fmtDate(n.envoye_le || n.created_at)}
                        </td>
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
