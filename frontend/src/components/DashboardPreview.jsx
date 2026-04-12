import { TrendingUp, Bell, Package, Warehouse, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import './DashboardPreview.css'

/* ── Mini SVG illustrations for feature pills ── */
const IlluAnalyse = () => (
  <svg viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="36">
    <rect width="48" height="36" rx="6" fill="#EFF6FF"/>
    <line x1="6" y1="30" x2="42" y2="30" stroke="#BFDBFE" strokeWidth="1.5"/>
    <line x1="6" y1="8" x2="6" y2="30" stroke="#BFDBFE" strokeWidth="1.5"/>
    <rect x="9"  y="18" width="5" height="12" rx="2" fill="#93C5FD"/>
    <rect x="17" y="12" width="5" height="18" rx="2" fill="#60A5FA"/>
    <rect x="25" y="16" width="5" height="14" rx="2" fill="#3B82F6"/>
    <rect x="33" y="8"  width="5" height="22" rx="2" fill="#2563EB"/>
    <polyline points="11,18 19,12 27,16 35,8" fill="none" stroke="#1D4ED8" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="35" cy="8" r="2" fill="#1D4ED8"/>
  </svg>
)

const IlluIA = () => (
  <svg viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="36">
    <rect width="48" height="36" rx="6" fill="#F5F3FF"/>
    <circle cx="24" cy="16" r="9" fill="#DDD6FE"/>
    <circle cx="24" cy="16" r="5" fill="#8B5CF6"/>
    <circle cx="24" cy="16" r="2" fill="white"/>
    {/* Orbiting nodes */}
    <circle cx="24" cy="5"  r="2.5" fill="#7C3AED"/>
    <circle cx="34" cy="21" r="2.5" fill="#7C3AED"/>
    <circle cx="14" cy="21" r="2.5" fill="#7C3AED"/>
    <line x1="24" y1="7"  x2="24" y2="11" stroke="#C4B5FD" strokeWidth="1"/>
    <line x1="32" y1="20" x2="29" y2="18" stroke="#C4B5FD" strokeWidth="1"/>
    <line x1="16" y1="20" x2="19" y2="18" stroke="#C4B5FD" strokeWidth="1"/>
    <rect x="8" y="29" width="32" height="4" rx="2" fill="#EDE9FE"/>
    <rect x="8" y="29" width="20" height="4" rx="2" fill="#8B5CF6"/>
  </svg>
)

const IlluAlerts = () => (
  <svg viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="36">
    <rect width="48" height="36" rx="6" fill="#FEF2F2"/>
    <rect x="6"  y="10" width="36" height="7" rx="3.5" fill="#FCA5A5"/>
    <rect x="6"  y="10" width="10" height="7" rx="3.5" fill="#EF4444"/>
    <rect x="6"  y="20" width="36" height="7" rx="3.5" fill="#FDE68A"/>
    <rect x="6"  y="20" width="18" height="7" rx="3.5" fill="#F59E0B"/>
    <rect x="6"  y="6"  width="36" height="2"  rx="1" fill="#FECACA"/>
    <circle cx="38" cy="8" r="5" fill="#DC2626"/>
    <text x="35.5" y="11" fontSize="6" fill="white" fontWeight="800">!</text>
    <rect x="6"  y="30" width="24" height="3" rx="1.5" fill="#FCA5A5"/>
  </svg>
)

/* ── Inline mini donut chart ── */
const DonutChart = ({ pct, color, bg }) => {
  const r = 14, c = 16
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx={c} cy={c} r={r} fill="none" stroke={bg} strokeWidth="4"/>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}/>
    </svg>
  )
}

const kpis = [
  { label: 'Produits actifs', value: 247,  icon: Package,    color: '#2563EB', bg: '#EFF6FF',  trend: +12, pct: 82 },
  { label: 'Entrepôts',       value: 3,    icon: Warehouse,  color: '#8B5CF6', bg: '#F5F3FF',  trend: 0,   pct: 100 },
  { label: 'Alertes actives', value: 5,    icon: Bell,       color: '#DC2626', bg: '#FEF2F2',  trend: -2,  pct: 28 },
  { label: 'Mouvements/mois', value: 128,  icon: TrendingUp, color: '#059669', bg: '#ECFDF5',  trend: +18, pct: 68 },
]

const stockRows = [
  { name: 'Huile d\'olive 5L',  sku: 'PRD-001', stock: 12,  seuil: 50, status: 'danger'  },
  { name: 'Farine T65 25kg',    sku: 'PRD-002', stock: 38,  seuil: 80, status: 'warning' },
  { name: 'Lait UHT 1L',        sku: 'PRD-003', stock: 320, seuil: 100,status: 'ok'      },
  { name: 'Sucre blanc 1kg',    sku: 'PRD-004', stock: 95,  seuil: 60, status: 'ok'      },
]

const chartBars = [60,70,50,85,75,90,65,95,70,88,92,80]

export default function DashboardPreview() {
  return (
    <section className="dashboard-section">
      <div className="container">

        <div className="section-header">
          <span className="badge-pill dp-badge">Aperçu produit</span>
          <h2>Dashboard Multi-Entrepôts</h2>
          <p>Suivi intelligent de vos stocks en temps réel</p>
        </div>

        {/* ── DASHBOARD MOCKUP ── */}
        <div className="browser-chrome">
          <div className="dash-mockup">

            {/* MAIN CONTENT */}
            <div className="dash-content">

              {/* TOP BAR */}
              <div className="dash-toprow">
                <div>
                  <div className="dash-page-title">Tableau de bord</div>
                  <div className="dash-page-sub">Mise à jour il y a 2 min</div>
                </div>
                <div className="dash-toprow-right">
                  <div className="dash-dot-live"/>
                  <span className="dash-live-label">En direct</span>
                </div>
              </div>

              {/* KPI CARDS */}
              <div className="dash-kpis">
                {kpis.map((k) => {
                  const Icon = k.icon
                  return (
                    <div key={k.label} className="kpi-card">
                      <div className="kpi-left">
                        <div className="kpi-icon-wrap" style={{ background: k.bg }}>
                          <Icon size={16} color={k.color} />
                        </div>
                        <div>
                          <div className="kpi-value">{k.value}</div>
                          <div className="kpi-label">{k.label}</div>
                        </div>
                      </div>
                      <div className="kpi-right">
                        <DonutChart pct={k.pct} color={k.color} bg={k.bg === '#EFF6FF' ? '#BFDBFE' : k.bg === '#F5F3FF' ? '#DDD6FE' : k.bg === '#FEF2F2' ? '#FECACA' : '#A7F3D0'} />
                        {k.trend !== 0 && (
                          <div className={`kpi-trend ${k.trend > 0 ? 'up' : 'down'}`}>
                            {k.trend > 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                            {Math.abs(k.trend)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* CHART + TABLE */}
              <div className="dash-grid-2">

                {/* BAR CHART */}
                <div className="chart-card">
                  <div className="chart-head">
                    <span className="chart-title">Flux de stock mensuel</span>
                    <span className="chart-sub">12 derniers mois</span>
                  </div>
                  <div className="chart-bars">
                    {chartBars.map((h, i) => (
                      <div key={i} className="bar-wrap">
                        <div className="bar" style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}/>
                      </div>
                    ))}
                  </div>
                  <div className="chart-months">
                    {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => (
                      <span key={i}>{m}</span>
                    ))}
                  </div>
                </div>

                {/* ALERTS */}
                <div className="alerts-card">
                  <div className="alerts-head">
                    <span className="alerts-title">Alertes critiques</span>
                    <span className="alerts-badge">5</span>
                  </div>
                  {[
                    { text: 'Rupture huile d\'olive', sub: 'PRD-001 — 12 unités restantes', type: 'danger' },
                    { text: 'Stock farine en baisse', sub: 'PRD-002 — sous le seuil min',   type: 'warning' },
                    { text: 'Surstock lait UHT',      sub: 'PRD-003 — 3× le seuil max',    type: 'info' },
                  ].map((a, i) => (
                    <div key={i} className={`alert-row alert-${a.type}`}>
                      <div className={`alert-dot dot-${a.type}`}/>
                      <div>
                        <div className="alert-text">{a.text}</div>
                        <div className="alert-sub">{a.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* STOCK TABLE */}
              <div className="stock-table-card">
                <div className="stock-table-head">
                  <span className="stock-table-title">Inventaire récent</span>
                </div>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Produit</th><th>SKU</th><th>Stock</th><th>Seuil</th><th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map(r => (
                      <tr key={r.sku}>
                        <td className="td-name">{r.name}</td>
                        <td className="td-sku">{r.sku}</td>
                        <td className="td-stock">{r.stock}</td>
                        <td className="td-seuil">{r.seuil}</td>
                        <td>
                          <span className={`status-badge status-${r.status}`}>
                            {r.status === 'danger' ? 'Critique' : r.status === 'warning' ? 'Attention' : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>

        {/* ── FEATURE PILLS ── */}
        <div className="dp-features">
          <div className="dp-feature-card">
            <IlluAnalyse />
            <div>
              <div className="dp-feat-title">Analyse temps réel</div>
              <div className="dp-feat-sub">Visualisez chaque flux instantanément</div>
            </div>
          </div>
          <div className="dp-feature-card">
            <IlluIA />
            <div>
              <div className="dp-feat-title">Prévision IA</div>
              <div className="dp-feat-sub">Prophet ML + RAG sur 30 jours</div>
            </div>
          </div>
          <div className="dp-feature-card">
            <IlluAlerts />
            <div>
              <div className="dp-feat-title">Alertes intelligentes</div>
              <div className="dp-feat-sub">Isolation Forest en temps réel</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
