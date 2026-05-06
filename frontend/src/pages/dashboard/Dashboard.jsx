import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Warehouse, ArrowLeftRight, Bell, TrendingDown, TrendingUp,
  DollarSign, CheckCircle,
  ArrowUp, Loader, Users, ChevronRight, AlertTriangle, X, Brain,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getDashboard, getAlertes, getMouvements, getDepots, getStocks, getUtilisateurs, getPrevisionsML,
  getHistoriquePL,
} from '../../services/api'
import './Dashboard.css'

// ── Helpers ───────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return new Intl.NumberFormat('fr-FR').format(Math.round(n / 1000)) + 'k'
  if (n >= 1_000)     return new Intl.NumberFormat('fr-FR').format(Math.round(n))
  return String(Math.round(n))
}

function fmtCurrency(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency', currency: 'TND', maximumFractionDigits: 0,
  }).format(n)
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return "À l'instant"
  if (m < 60)  return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `Il y a ${h}h`
  return `Il y a ${Math.floor(h / 24)}j`
}

function fmtTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) + ' ' + fmtTime(dateStr)
}

// Palette inspirée du diagramme de pollution
const CHART_COLORS = [
  '#FFD700', // or/jaune
  '#1A3A7A', // bleu marine
  '#CC2222', // rouge
  '#7B3F9E', // violet
  '#87CEEB', // bleu clair
  '#2E7D32', // vert foncé
  '#FF6600', // orange
  '#E91E8C', // rose/magenta
  '#009688', // teal
  '#795548', // marron
]
const ENTREPOT_COLORS = CHART_COLORS

// ── Regrouper mouvements par mois ─────────────────────────
function buildBarData(mouvements) {
  const now   = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
      entrees: 0, sorties: 0, transferts: 0,
    })
  }
  for (const m of mouvements) {
    const d = new Date(m.created_at || m.date_mouvement)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = months.find(b => b.key === key)
    if (!bucket) continue
    const type = (m.type_mouvement || '').toLowerCase()
    if (type === 'entree')         bucket.entrees++
    else if (type === 'sortie')    bucket.sorties++
    else if (type === 'transfert') bucket.transferts++
  }
  return months
}

// ── Composants ────────────────────────────────────────────

// Popup alerte critique avec countdown 5s
function AlertePopup({ alerte, onTraiter, onIgnorer }) {
  const [progress, setProgress] = useState(100)
  const intervalRef = useRef(null)

  useEffect(() => {
    const start = Date.now()
    const duration = 5000
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining === 0) {
        clearInterval(intervalRef.current)
        onIgnorer()
      }
    }, 50)
    return () => clearInterval(intervalRef.current)
  }, [])

  const produit  = alerte.message?.split(' - ')[0] || `Produit #${alerte.produit_id}`
  const entrepot = alerte.entrepot_nom || `Entrepôt #${alerte.entrepot_id}`

  return (
    <div className="alert-popup">
      <div className="alert-popup-header">
        <AlertTriangle size={15} color="#E8730A" />
        <span>Nouvelle alerte critique</span>
        <button className="alert-popup-close" onClick={onIgnorer}><X size={13} /></button>
      </div>
      <div className="alert-popup-body">
        <div className="alert-popup-prod">{produit} — {entrepot}</div>
        {alerte.message && (
          <div className="alert-popup-detail">{alerte.message}</div>
        )}
      </div>
      <div className="alert-popup-actions">
        <button className="alert-popup-traiter" onClick={onTraiter}>Traiter</button>
        <button className="alert-popup-ignorer" onClick={onIgnorer}>Ignorer</button>
      </div>
      <div className="alert-popup-bar-bg">
        <div className="alert-popup-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

// Occupation des entrepôts
function EntrepotOccupation({ entrepots }) {
  if (entrepots.length === 0) {
    return <div className="occ-empty">Aucun entrepôt disponible</div>
  }
  return (
    <div className="occ-list">
      {entrepots.map(e => {
        const stockReel   = e.capacite_utilisee || 0
        const capaciteMax = e.capacite_max || 0
        // Détecter une capacité mal configurée (< stock réel = valeur invalide)
        const nonConfiguree = capaciteMax > 0 && capaciteMax < stockReel
        // Utiliser le stock comme base si capacite_max est invalide
        const base  = nonConfiguree ? stockReel : capaciteMax
        const taux  = base > 0 ? Math.min(parseFloat((stockReel / base * 100).toFixed(1)), 100) : 0
        const barColor = nonConfiguree ? '#9CA3AF'
          : taux >= 85 ? '#EF4444'
          : taux >= 60 ? '#F59E0B'
          : '#6366F1'
        return (
          <div key={e.id} className="occ-row">
            <div className="occ-row-top">
              <div className="occ-row-name">
                <Warehouse size={13} color="#6366F1" />
                <span>{e.nom}</span>
              </div>
              {nonConfiguree
                ? <span className="occ-row-pct" style={{ color: '#F59E0B', fontSize: 11 }}>Non configuré</span>
                : <span className="occ-row-pct" style={{ color: barColor }}>{taux}%</span>
              }
            </div>
            <div className="occ-row-info">
              {stockReel.toLocaleString('fr-FR')} unités
              {nonConfiguree
                ? <span style={{ color: '#F59E0B', marginLeft: 6, fontSize: 11 }}>· capacité max non définie</span>
                : <span style={{ color: '#9CA3AF' }}> / {capaciteMax.toLocaleString('fr-FR')}</span>
              }
            </div>
            <div className="occ-bar-bg">
              <div className="occ-bar-fill" style={{
                width: nonConfiguree ? '100%' : `${taux}%`,
                background: barColor,
                opacity: nonConfiguree ? 0.35 : 1,
              }} />
            </div>
            {nonConfiguree && (
              <div className="occ-warning" style={{ color: '#F59E0B' }}>
                Définir la capacité dans Entrepôts → Modifier
              </div>
            )}
            {!nonConfiguree && taux >= 85 && (
              <div className="occ-warning">Capacité critique</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Carte prévision IA (dashboard compact)
function PrevisionIaRow({ p, onCommander }) {
  const jours = p.jours_avant_rupture
  const { text, color } = jours <= 0
    ? { text: 'Rupture dans 0 jours', color: '#DC3545' }
    : { text: `Rupture dans ${Math.floor(jours)} jour${jours >= 2 ? 's' : ''}`, color: jours <= 7 ? '#DC3545' : '#E8730A' }
  return (
    <div className="prev-ia-row">
      <div className="prev-ia-icon" style={{ color }}>
        {jours <= 0 ? <AlertTriangle size={18} /> : <AlertTriangle size={18} />}
      </div>
      <div className="prev-ia-body">
        <div className="prev-ia-name">{p.produit_nom || `Produit #${p.produit_id}`}</div>
        <div className="prev-ia-text" style={{ color }}>{text}</div>
        <div className="prev-ia-qty">
          {p.quantite_prevue != null && <span>Prévision : {Math.round(p.quantite_prevue)} unités · </span>}
          {p.recommandation || 'Commander des unités supplémentaires'}
        </div>
      </div>
      <button className="prev-ia-btn" onClick={() => onCommander(p)}>Commander</button>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color, subColor }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon-wrap" style={{ background: `${color}18` }}>
          <Icon size={20} color={color} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && (
        <div className="kpi-sub" style={{ color: subColor || '#6B7280' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// Bar chart CSS pur
function BarChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.entrees + d.sorties + d.transferts), 1)
  const allZero = data.every(d => d.entrees === 0 && d.sorties === 0 && d.transferts === 0)

  return (
    <div className="bar-chart">
      <div className="bar-chart-inner">
        {data.map((d, i) => {
          return (
            <div key={i} className="bar-group">
              <div className="bar-tooltip">
                <span>Entrées: {d.entrees}</span>
                <span>Sorties: {d.sorties}</span>
                <span>Transferts: {d.transferts}</span>
              </div>
              <div className="bars-wrap">
                <div className="bar bar-entree"
                  style={{ height: `${allZero ? 30 : Math.max((d.entrees / maxVal) * 100, 2)}%` }} />
                <div className="bar bar-sortie"
                  style={{ height: `${allZero ? 25 : Math.max((d.sorties / maxVal) * 100, 2)}%` }} />
                <div className="bar bar-transfert"
                  style={{ height: `${allZero ? 20 : Math.max((d.transferts / maxVal) * 100, 2)}%` }} />
              </div>
              <span className="bar-label">{d.label}</span>
            </div>
          )
        })}
      </div>
      <div className="bar-legend">
        <span><i style={{ background: '#2E7D32' }} /> Entrées</span>
        <span><i style={{ background: '#CC2222' }} /> Sorties</span>
        <span><i style={{ background: '#FF6600' }} /> Transferts</span>
      </div>
    </div>
  )
}

// Line chart SVG — courbe entrées vs sorties
function LineChart({ data }) {
  const W = 520, H = 180, PL = 36, PR = 16, PT = 16, PB = 32
  const iW = W - PL - PR
  const iH = H - PT - PB
  const maxVal = Math.max(...data.flatMap(d => [d.entrees, d.sorties]), 1)

  const toX = i => PL + (i / (data.length - 1 || 1)) * iW
  const toY = v => PT + iH - (v / maxVal) * iH

  const pointsEntrees  = data.map((d, i) => `${toX(i)},${toY(d.entrees)}`).join(' ')
  const pointsSorties  = data.map((d, i) => `${toX(i)},${toY(d.sorties)}`).join(' ')
  const areaEntrees    = `${PL},${PT + iH} ` + data.map((d, i) => `${toX(i)},${toY(d.entrees)}`).join(' ') + ` ${toX(data.length - 1)},${PT + iH}`
  const areaSorties    = `${PL},${PT + iH} ` + data.map((d, i) => `${toX(i)},${toY(d.sorties)}`).join(' ') + ` ${toX(data.length - 1)},${PT + iH}`

  const ticks = [0, Math.round(maxVal / 2), maxVal]

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="line-chart-svg">
        <defs>
          <linearGradient id="gradE" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CC2222" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#CC2222" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grille horizontale */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={toY(t)} y2={toY(t)}
              stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PL - 4} y={toY(t) + 4} textAnchor="end"
              fontSize="10" fill="#9CA3AF">{t}</text>
          </g>
        ))}

        {/* Aires remplies */}
        <polygon points={areaEntrees} fill="url(#gradE)" />
        <polygon points={areaSorties} fill="url(#gradS)" />

        {/* Courbes */}
        <polyline points={pointsEntrees} fill="none"
          stroke="#2E7D32" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={pointsSorties} fill="none"
          stroke="#CC2222" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.entrees)} r="4"
              fill="#fff" stroke="#2E7D32" strokeWidth="2" />
            <circle cx={toX(i)} cy={toY(d.sorties)} r="4"
              fill="#fff" stroke="#CC2222" strokeWidth="2" />
            {/* Label axe X */}
            <text x={toX(i)} y={H - 6} textAnchor="middle"
              fontSize="11" fill="#9CA3AF">{d.label}</text>
          </g>
        ))}
      </svg>
      <div className="line-chart-legend">
        <span><i style={{ background: '#2E7D32' }} />Entrées</span>
        <span><i style={{ background: '#CC2222' }} />Sorties</span>
      </div>
    </div>
  )
}

// Donut chart CSS conic-gradient
function DonutChart({ entrepots }) {
  const total = entrepots.reduce((s, e) => s + (e.capacite_utilisee || 0), 0)
  if (entrepots.length === 0 || total === 0) {
    return (
      <div className="donut-empty">
        <p>Aucune donnée de stock disponible</p>
      </div>
    )
  }

  let cumul = 0
  const segments = entrepots.slice(0, 4).map((e, i) => {
    const pct = (e.capacite_utilisee / total) * 100
    const seg = { color: ENTREPOT_COLORS[i], start: cumul, end: cumul + pct, pct: Math.round(pct), nom: e.nom || `Entrepôt #${e.id}`, val: Math.round(e.capacite_utilisee) }
    cumul += pct
    return seg
  })
  // Autres
  const autresPct = 100 - cumul
  if (autresPct > 0.5) {
    segments.push({ color: '#E9ECEF', start: cumul, end: 100, pct: Math.round(autresPct), nom: 'Autres', val: Math.round(total - entrepots.slice(0, 4).reduce((s, e) => s + e.capacite_utilisee, 0)) })
  }

  const conicStops = segments.map(s => `${s.color} ${s.start.toFixed(1)}% ${s.end.toFixed(1)}%`).join(', ')

  return (
    <div className="donut-chart">
      <div className="donut-ring-wrap">
        <div className="donut-ring" style={{ background: `conic-gradient(${conicStops})` }} />
        <div className="donut-center">
          <span className="donut-total-label">Total</span>
          <span className="donut-total-val">{new Intl.NumberFormat('fr-FR').format(Math.round(total))} unités</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={i} className="donut-legend-row">
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-leg-name">{s.nom}</span>
            <span className="donut-leg-pct">{s.pct}%</span>
            <span className="donut-leg-val">{new Intl.NumberFormat('fr-FR').format(s.val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Alerte row
const niveauCfg = {
  CRITIQUE:          { color: '#CC2222', bg: '#FEF2F2', label: 'Stock critique' },
  RUPTURE:           { color: '#CC2222', bg: '#FEF2F2', label: 'Rupture stock'  },
  SURSTOCK:          { color: '#FF6600', bg: '#FFF3E0', label: 'Surstock'       },
  NORMAL:            { color: '#2E7D32', bg: '#F0FDF4', label: 'Normal'         },
  EXPIRATION_PROCHE: { color: '#7B3F9E', bg: '#F5F0FF', label: 'Expiration'     },
  // fallback minuscules
  critique: { color: '#CC2222', bg: '#FEF2F2', label: 'Stock critique' },
  rupture:  { color: '#CC2222', bg: '#FEF2F2', label: 'Rupture stock'  },
  surstock: { color: '#FF6600', bg: '#FFF3E0', label: 'Surstock'       },
  normal:   { color: '#2E7D32', bg: '#F0FDF4', label: 'Normal'         },
}
function AlerteRow({ a, onVoir }) {
  const cfg = niveauCfg[a.niveau] || niveauCfg.NORMAL
  return (
    <div className="alerte-row" style={{ borderLeftColor: cfg.color }}>
      <div className="alerte-badge" style={{ background: cfg.color }}>{cfg.label}</div>
      <div className="alerte-body">
        <span className="alerte-prod">{a.message?.split(' - ')[0] || `Produit #${a.produit_id}`}</span>
        <span className="alerte-meta">
          {a.entrepot_nom || `Entrepôt #${a.entrepot_id}`} · {timeAgo(a.created_at)}
        </span>
      </div>
      <button className="alerte-voir-btn" onClick={() => onVoir && onVoir(a)}>Voir</button>
    </div>
  )
}

// Mouvement row (liste compacte)
const typeCfg = {
  entree:    { color: '#22C55E', bg: '#F0FDF4', label: 'ENTRÉE',    sign: '+' },
  sortie:    { color: '#EF4444', bg: '#FEF2F2', label: 'SORTIE',    sign: '-' },
  transfert: { color: '#6366F1', bg: '#EEF2FF', label: 'TRANSFERT', sign: ''  },
}
function MouvRow({ m }) {
  const type = (m.type_mouvement || '').toLowerCase()
  const cfg = typeCfg[type] || typeCfg.entree
  const entrepot = type === 'entree'
    ? m.entrepot_dest_nom
    : type === 'sortie'
    ? m.entrepot_source_nom
    : `${m.entrepot_source_nom || ''}→${m.entrepot_dest_nom || ''}`

  return (
    <div className="mouv-row">
      <span className="mouv-badge" style={{ background: cfg.color }}>{cfg.label}</span>
      <div className="mouv-info">
        <span className="mouv-prod">{m.produit_nom || `Produit #${m.produit_id}`}</span>
        <span className="mouv-meta">
          {cfg.sign}{m.quantite} · {entrepot} · {m.utilisateur_nom || '—'}
        </span>
      </div>
      <span className="mouv-time">{fmtTime(m.created_at)}</span>
    </div>
  )
}

// Mouvement table row
function TableRow({ m }) {
  const cfg = typeCfg[m.type_mouvement] || typeCfg.entree
  const entrepot = m.type_mouvement === 'transfert'
    ? `${m.entrepot_source_nom || '?'} → ${m.entrepot_dest_nom || '?'}`
    : m.entrepot_dest_nom || m.entrepot_source_nom || '—'

  return (
    <tr className="table-row">
      <td className="td-id">#{m.id}</td>
      <td><span className="type-badge" style={{ background: cfg.color }}>{cfg.label}</span></td>
      <td className="td-prod">{m.produit_nom || `Produit #${m.produit_id}`}</td>
      <td className="td-entrepot">{entrepot}</td>
      <td className="td-qty" style={{ color: cfg.color }}>
        {cfg.sign}{m.quantite} unités
      </td>
      <td className="td-date">{fmtDate(m.created_at)}</td>
      <td><span className="statut-badge">{(m.statut || 'valide').toUpperCase()}</span></td>
    </tr>
  )
}

// User card
function UserCard({ u }) {
  const initiales = `${(u.prenom || u.nom || 'U')[0]}${(u.nom || '')[0] || ''}`.toUpperCase()
  const roleLabel = { admin: 'Admin', gestionnaire: 'Gestionnaire', operateur: 'Opérateur' }
  const roleCfg   = {
    admin:        { color: '#fff', bg: '#4F46E5' },
    gestionnaire: { color: '#fff', bg: '#6366F1' },
    operateur:    { color: '#fff', bg: '#8B5CF6' },
  }
  const rc = roleCfg[u.role] || roleCfg.operateur
  return (
    <div className="user-card">
      <div className="user-avatar" style={{ background: u.role === 'admin' ? '#4F46E5' : u.role === 'gestionnaire' ? '#6366F1' : '#8B5CF6' }}>
        {initiales}
      </div>
      <div className="user-info">
        <span className="user-name">{`${u.prenom || ''} ${u.nom || ''}`.trim() || u.email}</span>
        <div className="user-meta">
          <span className="user-role" style={{ background: rc.bg, color: rc.color }}>
            {roleLabel[u.role] || u.role}
          </span>
          <span className="user-status">En ligne</span>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────

export default function Dashboard() {
  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [dash,        setDash]        = useState(null)
  const [alertes,     setAlertes]     = useState([])
  const [mouvs,       setMouvs]       = useState([])
  const [entrepots,   setEntrepots]   = useState([])
  const [users,       setUsers]       = useState([])
  const [previsions,  setPrevisions]  = useState([])
  const [lastPL,      setLastPL]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [tabFilter,   setTabFilter]   = useState('tous')
  const [alertPopup,  setAlertPopup]  = useState(null)   // alerte critique à afficher

  useEffect(() => {
    // Timeout de sécurité — affiche le dashboard après 4s même si les services sont lents
    const safetyTimer = setTimeout(() => setLoading(false), 4000)

    // Phase 1 — données légères → affichage immédiat
    Promise.allSettled([
      getAlertes({ statut: 'ACTIVE', per_page: 6 }),
      getMouvements({ per_page: 500 }),
      getDepots(),
      getStocks(),
    ]).then(([a, m, e, s]) => {
      if (a.status === 'fulfilled') {
        const list = a.value?.alertes || []
        setAlertes(list)
        const crit = list.find(al => ['CRITIQUE','RUPTURE','critique','rupture'].includes(al.niveau))
        if (crit) setAlertPopup(crit)
      }
      if (m.status === 'fulfilled') setMouvs(m.value?.mouvements || [])
      if (e.status === 'fulfilled') {
        const depots = e.value?.depots || []
        const stocks = s.status === 'fulfilled' ? (Array.isArray(s.value) ? s.value : []) : []
        // Calcule capacite_utilisee réelle depuis les stocks
        const depotsAvecStock = depots.map(d => {
          const qte = stocks
            .filter(st => st.depot_id === d.id || st.entrepot_id === d.id)
            .reduce((sum, st) => sum + (st.quantite || 0), 0)
          return { ...d, capacite_utilisee: qte }
        })
        setEntrepots(depotsAvecStock)
      }
      clearTimeout(safetyTimer)
      setLoading(false)
    })

    // Phase 2 — données lourdes en arrière-plan (KPI, ML, P&L, utilisateurs)
    Promise.allSettled([
      getDashboard(),
      user?.role === 'admin' ? getUtilisateurs() : Promise.resolve([]),
      getPrevisionsML(),
      (user?.role === 'admin' || user?.role === 'gestionnaire') ? getHistoriquePL({ limit: 1 }) : Promise.resolve(null),
    ]).then(([d, u, p, pl]) => {
      if (d.status === 'fulfilled') setDash(d.value)
      if (u.status === 'fulfilled') setUsers(Array.isArray(u.value) ? u.value.slice(0, 4) : [])
      if (p.status === 'fulfilled') setPrevisions(Array.isArray(p.value) ? p.value : [])
      if (pl.status === 'fulfilled' && pl.value) {
        const hist = Array.isArray(pl.value) ? pl.value : pl.value?.historique || []
        if (hist.length > 0) setLastPL(hist[0])
      }
    })

    return () => clearTimeout(safetyTimer)
  }, [user?.role])

  const kpi         = dash?.kpi
  const topProduits = dash?.top_produits  || []
  const barData     = buildBarData(mouvs)

  const filteredMouvs = tabFilter === 'tous'
    ? mouvs.slice(0, 8)
    : mouvs.filter(m => m.type_mouvement === tabFilter).slice(0, 8)

  const recentMouvs = mouvs.slice(0, 5)

  return (
    <DashboardLayout>
      <div className="db-page">

        {/* ── Popup alerte critique ── */}
        {alertPopup && (
          <AlertePopup
            alerte={alertPopup}
            onTraiter={() => { setAlertPopup(null); navigate('/dashboard/alertes') }}
            onIgnorer={() => setAlertPopup(null)}
          />
        )}

        {loading ? (
          <div className="db-loading">
            <Loader size={28} className="spin" />
            <span>Chargement du tableau de bord…</span>
          </div>
        ) : (
          <>
            {/* ── KPI ── */}
            <div className="kpi-grid">
              <KpiCard
                icon={Warehouse} label="Dépôts actifs"
                value={fmt(entrepots.filter(e => e.est_actif !== false).length || kpi?.total_entrepots)}
                sub={`${entrepots.length} dépôt${entrepots.length !== 1 ? 's' : ''} enregistré${entrepots.length !== 1 ? 's' : ''}`}
                color="#6366F1"
                subColor="#22C55E"
              />
              <KpiCard
                icon={Package} label="Produits total"
                value={fmt(kpi?.total_produits)}
                sub={`${fmt(kpi?.total_stocks_actifs)} références actives`}
                color="#8B5CF6"
              />
              <KpiCard
                icon={Bell} label="Alertes actives"
                value={fmt(kpi?.total_alertes_actives)}
                sub={`${fmt(kpi?.total_critiques)} critiques`}
                color={kpi?.total_alertes_actives > 0 ? '#EF4444' : '#22C55E'}
                subColor={kpi?.total_critiques > 0 ? '#EF4444' : '#6B7280'}
              />
              <KpiCard
                icon={ArrowLeftRight} label="Mouvements aujourd'hui"
                value={fmt(kpi?.total_mouvements_jour)}
                sub={<span style={{ color: '#22C55E', display: 'flex', alignItems: 'center', gap: 3 }}><ArrowUp size={11} />18% vs hier</span>}
                color="#6366F1"
              />
            </div>

            {/* ── Profit & Pertes (P&L) ── */}
            {(user?.role === 'admin' || user?.role === 'gestionnaire') && (
              <div className="pl-dashboard-section">
                <div className="pl-dashboard-header">
                  <DollarSign size={16} color="#6366F1" />
                  <span className="pl-dashboard-title">Profit &amp; Pertes — Dernier calcul</span>
                  <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 12px' }}
                    onClick={() => navigate('/dashboard/reporting')}>
                    {lastPL ? 'Recalculer' : 'Calculer le P&L'} →
                  </button>
                </div>
                {lastPL ? (() => {
                  const ca     = lastPL.chiffre_affaires > 0 ? lastPL.chiffre_affaires : lastPL.valeur_stock
                  const caLabel = lastPL.chiffre_affaires > 0 ? "Chiffre d'affaires" : 'Valeur du stock'
                  const marge  = lastPL.marge_brute ?? lastPL.profit
                  const taux   = lastPL.taux_marge > 0 ? lastPL.taux_marge.toFixed(1) : (ca > 0 ? ((lastPL.profit / ca) * 100).toFixed(1) : null)
                  return (
                  <div className="pl-dashboard-grid">
                    {/* CA réel ou Valeur du stock */}
                    <div className="pl-dash-card">
                      <div className="pl-dash-icon" style={{ background: '#EEF2FF' }}>
                        <Package size={18} color="#6366F1" />
                      </div>
                      <div className="pl-dash-label">{caLabel}</div>
                      <div className="pl-dash-value" style={{ color: '#6366F1' }}>
                        {fmtCurrency(ca)}
                      </div>
                    </div>
                    {/* Total dépenses */}
                    <div className="pl-dash-card">
                      <div className="pl-dash-icon" style={{ background: '#FEF2F2' }}>
                        <TrendingDown size={18} color="#DC3545" />
                      </div>
                      <div className="pl-dash-label">Total dépenses</div>
                      <div className="pl-dash-value" style={{ color: '#DC3545' }}>
                        {fmtCurrency(lastPL.total_depenses)}
                      </div>
                    </div>
                    {/* Marge brute */}
                    <div className="pl-dash-card">
                      <div className="pl-dash-icon" style={{ background: marge >= 0 ? '#F0FDF4' : '#FEF2F2' }}>
                        <DollarSign size={18} color={marge >= 0 ? '#28A745' : '#DC3545'} />
                      </div>
                      <div className="pl-dash-label">Marge brute</div>
                      <div className="pl-dash-value" style={{ color: marge >= 0 ? '#28A745' : '#DC3545' }}>
                        {marge >= 0 ? '+' : ''}{fmtCurrency(marge)}
                      </div>
                    </div>
                    {/* Profit net */}
                    <div className="pl-dash-card" style={{ border: `2px solid ${lastPL.profit >= 0 ? '#28A745' : '#DC3545'}` }}>
                      <div className="pl-dash-icon" style={{ background: lastPL.profit >= 0 ? '#F0FDF4' : '#FEF2F2' }}>
                        {lastPL.profit >= 0 ? <TrendingUp size={18} color="#28A745" /> : <TrendingDown size={18} color="#DC3545" />}
                      </div>
                      <div className="pl-dash-label">Profit net</div>
                      <div className="pl-dash-value" style={{ color: lastPL.profit >= 0 ? '#28A745' : '#DC3545', fontSize: 20, fontWeight: 700 }}>
                        {lastPL.profit >= 0 ? '+' : ''}{fmtCurrency(lastPL.profit)}
                      </div>
                      {taux && (
                        <div className="pl-dash-sub">Taux : {taux}%</div>
                      )}
                    </div>
                  </div>
                  )
                })() : (
                  <div className="pl-dashboard-empty">
                    <DollarSign size={32} color="#E5E7EB" />
                    <p>Aucun calcul P&L effectué.<br />Rendez-vous dans <b>Reporting</b> pour calculer le profit &amp; pertes.</p>
                    <button className="btn-primary" style={{ marginTop: 10 }}
                      onClick={() => navigate('/dashboard/reporting')}>
                      Calculer le P&L
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Charts ── */}
            <div className="charts-row">
              <div className="chart-card chart-card--bar">
                <div className="chart-header">
                  <span className="chart-title">Mouvements par mois</span>
                </div>
                <BarChart data={barData} />
              </div>
              <div className="chart-card chart-card--donut">
                <div className="chart-header">
                  <span className="chart-title">Répartition du stock</span>
                </div>
                <DonutChart entrepots={entrepots} />
              </div>
            </div>

            {/* ── Courbe évolution entrées / sorties ── */}
            <div className="chart-card chart-card--line">
              <div className="chart-header">
                <span className="chart-title">Évolution des flux — 6 derniers mois</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Entrées vs Sorties</span>
              </div>
              <LineChart data={barData} />
            </div>

            {/* ── Occupation entrepôts + Prévisions IA ── */}
            <div className="occ-prev-row">
              <div className="chart-card">
                <div className="chart-header">
                  <span className="chart-title">Occupation entrepôts</span>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <EntrepotOccupation entrepots={entrepots} />
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="chart-title">Prévisions IA</span>
                  <span className="prophet-mini-badge"><Brain size={11} /> Prophet ML</span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {previsions.length === 0 ? (
                    <div className="panel-empty">
                      <CheckCircle size={28} color="#28A745" />
                      <p>Aucune rupture prévue dans les 30 prochains jours</p>
                    </div>
                  ) : (
                    previsions.slice(0, 4).map((p, i) => (
                      <PrevisionIaRow
                        key={i} p={p}
                        onCommander={() => navigate('/dashboard/reapprovisionnement')}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── 3 colonnes ── */}
            <div className="three-col">

              {/* Alertes récentes */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Alertes récentes</span>
                </div>
                <div className="panel-body">
                  {alertes.length === 0 ? (
                    <div className="panel-empty">
                      <CheckCircle size={28} color="#28A745" />
                      <p>Aucune alerte active</p>
                    </div>
                  ) : (
                    alertes.map((a, i) => (
                      <AlerteRow key={a.id ?? i} a={a}
                        onVoir={() => navigate('/dashboard/alertes')} />
                    ))
                  )}
                </div>
                <button className="panel-link" onClick={() => navigate('/dashboard/alertes')}>
                  Voir toutes les alertes →
                </button>
              </div>

              {/* Derniers mouvements (liste compacte) */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Derniers mouvements</span>
                </div>
                <div className="panel-body">
                  {recentMouvs.length === 0 ? (
                    <div className="panel-empty">
                      <ArrowLeftRight size={28} color="#ADB5BD" />
                      <p>Aucun mouvement récent</p>
                    </div>
                  ) : (
                    recentMouvs.map((m, i) => <MouvRow key={m.id ?? i} m={m} />)
                  )}
                </div>
                <button className="panel-link" onClick={() => navigate('/dashboard/mouvements')}>
                  Voir tous les mouvements →
                </button>
              </div>

              {/* Utilisateurs actifs */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Utilisateurs actifs</span>
                </div>
                <div className="panel-body">
                  {users.length === 0 ? (
                    <div className="panel-empty">
                      <Users size={28} color="#ADB5BD" />
                      <p>
                        {user?.role === 'admin'
                          ? 'Aucun utilisateur trouvé'
                          : 'Réservé aux administrateurs'}
                      </p>
                    </div>
                  ) : (
                    users.map((u, i) => <UserCard key={u.id ?? i} u={u} />)
                  )}
                  {user?.role === 'admin' && (
                    <button className="add-user-btn" onClick={() => navigate('/dashboard/utilisateurs')}>
                      + Ajouter un utilisateur
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Table mouvements ── */}
            <div className="table-card">
              <div className="table-header">
                <span className="table-title">Derniers mouvements</span>
                <button className="table-voir-btn" onClick={() => navigate('/dashboard/mouvements')}>
                  Voir tout <ChevronRight size={14} />
                </button>
              </div>
              <div className="table-filters">
                {['tous', 'entree', 'sortie', 'transfert'].map(f => (
                  <button
                    key={f}
                    className={`filter-tab ${tabFilter === f ? 'active' : ''}`}
                    onClick={() => setTabFilter(f)}
                  >
                    {f === 'tous' ? 'Tous' : f === 'entree' ? 'Entrées' : f === 'sortie' ? 'Sorties' : 'Transferts'}
                  </button>
                ))}
              </div>
              {filteredMouvs.length === 0 ? (
                <div className="table-empty">Aucun mouvement à afficher</div>
              ) : (
                <div className="table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>TYPE</th>
                        <th>PRODUIT</th>
                        <th>ENTREPÔT</th>
                        <th>QUANTITÉ</th>
                        <th>DATE</th>
                        <th>STATUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMouvs.map((m, i) => <TableRow key={m.id ?? i} m={m} />)}
                    </tbody>
                  </table>
                </div>
              )}
              {filteredMouvs.length === 0 && (
                <div className="table-empty">Aucun mouvement disponible</div>
              )}
            </div>

            {/* ── Ruptures + KPIs supplémentaires ── */}
            {(kpi?.total_ruptures > 0 || topProduits.length > 0) && (
              <div className="bottom-row">
                {kpi?.total_ruptures > 0 && (
                  <div className="bottom-card rupture-card">
                    <div className="bottom-card-header">
                      <TrendingDown size={16} color="#DC3545" />
                      <span>Ruptures de stock</span>
                      <span className="rupture-count">{kpi.total_ruptures}</span>
                    </div>
                    <p className="rupture-text">
                      {kpi.total_ruptures} produit(s) en rupture · {kpi.total_surstocks} en surstock
                    </p>
                    <button className="rupture-cta" onClick={() => navigate('/dashboard/reapprovisionnement')}>
                      Gérer le réapprovisionnement <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                {topProduits.length > 0 && (
                  <div className="bottom-card top-card">
                    <div className="bottom-card-header">
                      <Package size={16} color="var(--teal)" />
                      <span>Top produits mouvementés</span>
                    </div>
                    <div className="top-list">
                      {topProduits.slice(0, 4).map((p, i) => (
                        <div key={i} className="top-item">
                          <span className="top-rank">#{i + 1}</span>
                          <span className="top-name">{p.produit_nom || `Produit #${p.produit_id}`}</span>
                          <span className="top-val">{p.total_mouvements} mvt</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bottom-card value-card">
                  <div className="bottom-card-header">
                    <DollarSign size={16} color="#28A745" />
                    <span>Valeur totale du stock</span>
                  </div>
                  <div className="value-big">{fmtCurrency(kpi?.valeur_stock_total)}</div>
                  {(() => {
                    const taux = kpi?.taux_occupation_moyen || 0
                    const tauxAffiche = Math.min(parseFloat(taux.toFixed(1)), 100)
                    const nonConfig   = taux > 100
                    return (
                      <>
                        <div className="value-sub">
                          {nonConfig
                            ? <span style={{ color: '#F59E0B' }}>Certains entrepôts ont une capacité non configurée</span>
                            : `Taux d'occupation moyen : ${tauxAffiche}%`
                          }
                        </div>
                        <div className="value-bar">
                          <div className="value-bar-fill"
                            style={{ width: `${tauxAffiche}%`, background: nonConfig ? '#F59E0B' : undefined }} />
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* P&L mini-card */}
                {(user?.role === 'admin' || user?.role === 'gestionnaire') && (
                  <div className="bottom-card value-card" style={{ borderTop: lastPL ? (lastPL.profit >= 0 ? '3px solid #28A745' : '3px solid #DC3545') : '3px solid #E5E7EB' }}>
                    <div className="bottom-card-header">
                      {lastPL && lastPL.profit >= 0
                        ? <TrendingUp size={16} color="#28A745" />
                        : <TrendingDown size={16} color="#DC3545" />}
                      <span>Profit & Pertes (dernier calcul)</span>
                    </div>
                    {lastPL ? (
                      <>
                        <div className="value-big" style={{ color: lastPL.profit >= 0 ? '#28A745' : '#DC3545' }}>
                          {lastPL.profit >= 0 ? '+' : ''}{fmtCurrency(lastPL.profit)}
                        </div>
                        <div className="value-sub">
                          Stock : {fmtCurrency(lastPL.valeur_stock)} · Charges : {fmtCurrency(lastPL.total_depenses)}
                        </div>
                        {lastPL.chiffre_affaires > 0 && lastPL.marge_brute != null && (
                          <div className="value-sub">
                            Marge brute : {((lastPL.marge_brute / lastPL.chiffre_affaires) * 100).toFixed(1)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="value-sub" style={{ marginTop: 8 }}>Aucun calcul P&L effectué</div>
                    )}
                    <button className="rupture-cta" style={{ marginTop: 10 }}
                      onClick={() => navigate('/dashboard/reporting')}>
                      Calculer le P&L <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
