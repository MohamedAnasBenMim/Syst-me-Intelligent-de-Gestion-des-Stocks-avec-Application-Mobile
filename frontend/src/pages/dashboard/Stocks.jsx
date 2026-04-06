import { useState, useEffect } from 'react'
import { Layers, AlertTriangle, TrendingDown, CheckCircle, Search, Filter } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getStocks, getEntrepots } from '../../services/api'
import './common.css'

// ── Config niveaux ──────────────────────────────────────────
const NIVEAUX = [
  { value: 'tous',     label: 'Tous les niveaux' },
  { value: 'normal',   label: 'Normal'   },
  { value: 'critique', label: 'Critique' },
  { value: 'rupture',  label: 'Rupture'  },
  { value: 'surstock', label: 'Surstock' },
]

function niveauBadge(niveau) {
  switch (niveau) {
    case 'rupture':  return <span className="badge badge-solid-red">Rupture</span>
    case 'critique': return <span className="badge badge-solid-orange">Critique</span>
    case 'surstock': return <span className="badge badge-solid-teal">Surstock</span>
    case 'normal':   return <span className="badge badge-solid-green">Normal</span>  // badge-green → solid
    default:         return <span className="badge badge-gray">{niveau || '—'}</span>
  }
}

function niveauColor(niveau) {
  switch (niveau) {
    case 'rupture':  return '#DC3545'
    case 'critique': return '#E8730A'
    case 'surstock': return '#6366F1'
    case 'normal':   return '#28A745'
    default:         return '#6B7280'
  }
}

// ── Page principale ─────────────────────────────────────────
export default function Stocks() {
  useAuth()

  const [stocks,       setStocks]       = useState([])
  const [entrepots,    setEntrepots]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [filterNiveau, setFilterNiveau] = useState('tous')
  const [filterEntrepot, setFilterEntrepot] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [stocksData, entrepotsData] = await Promise.all([
        getStocks(),
        getEntrepots({ per_page: 50 }).then(d => d?.entrepots ?? []),
      ])
      setStocks(Array.isArray(stocksData) ? stocksData : [])
      setEntrepots(Array.isArray(entrepotsData) ? entrepotsData : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtre local ────────────────────────────────────────────
  const filtered = stocks.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = (
      s.produit?.designation?.toLowerCase().includes(q) ||
      s.produit?.reference?.toLowerCase().includes(q)
    )
    const matchNiveau   = filterNiveau === 'tous' || s.niveau_alerte === filterNiveau
    const matchEntrepot = !filterEntrepot || String(s.entrepot_id) === filterEntrepot
    return matchSearch && matchNiveau && matchEntrepot
  })

  // ── Stats calculées sur TOUS les stocks (pas sur filtered) ──
  const totalStocks  = stocks.length
  const totalRupture = stocks.filter(s => s.niveau_alerte === 'rupture').length
  const totalCrit    = stocks.filter(s => s.niveau_alerte === 'critique').length
  const totalSur     = stocks.filter(s => s.niveau_alerte === 'surstock').length

  // ── Nom entrepôt helper ─────────────────────────────────────
  function entrepotNom(id) {
    const e = entrepots.find(e => e.id === id)
    return e ? e.nom : `#${id}`
  }

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Layers size={22} color="var(--teal)" />
            <div>
              <h1>Stocks</h1>
              <p>
                {loading ? '…' : `${stocks.length} entrée${stocks.length > 1 ? 's' : ''} de stock`}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6,148,162,0.1)' }}>
              <Layers size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val">{loading ? '—' : totalStocks}</div>
              <div className="stat-lbl">Total stocks</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(220,53,69,0.1)' }}>
              <TrendingDown size={20} color="#DC3545" />
            </div>
            <div>
              <div className="stat-val" style={{ color: '#DC3545' }}>{loading ? '—' : totalRupture}</div>
              <div className="stat-lbl">En rupture</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(232,115,10,0.1)' }}>
              <AlertTriangle size={20} color="#E8730A" />
            </div>
            <div>
              <div className="stat-val" style={{ color: '#E8730A' }}>{loading ? '—' : totalCrit}</div>
              <div className="stat-lbl">Critiques</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6,148,162,0.1)' }}>
              <CheckCircle size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val" style={{ color: '#6366F1' }}>{loading ? '—' : totalSur}</div>
              <div className="stat-lbl">Surstocks</div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={15} className="toolbar-search-icon" />
            <input
              placeholder="Rechercher par produit ou référence…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="toolbar-sep" />
          <Filter size={15} color="#ADB5BD" />

          <select
            value={filterNiveau}
            onChange={e => setFilterNiveau(e.target.value)}
          >
            {NIVEAUX.map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>

          {entrepots.length > 0 && (
            <select
              value={filterEntrepot}
              onChange={e => setFilterEntrepot(e.target.value)}
            >
              <option value="">Tous les entrepôts</option>
              {entrepots.map(e => (
                <option key={e.id} value={String(e.id)}>{e.nom}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Table ── */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">État des stocks</span>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="state-loading">
              <Layers size={28} className="spin" />
              <span>Chargement des stocks…</span>
            </div>
          ) : error ? (
            <div className="state-error">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="state-empty">
              <Layers size={40} color="#ADB5BD" />
              <p>
                {search || filterNiveau !== 'tous' || filterEntrepot
                  ? 'Aucun stock ne correspond aux critères.'
                  : 'Aucun stock enregistré.'}
              </p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>PRODUIT</th>
                    <th>ENTREPÔT</th>
                    <th>QUANTITÉ</th>
                    <th>NIVEAU</th>
                    <th>MIS À JOUR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td className="td-id">#{s.id}</td>
                      <td>
                        <div className="td-name">{s.produit?.designation || `Produit #${s.produit_id}`}</div>
                        {s.produit?.reference && (
                          <span className="badge badge-teal" style={{ marginTop: 4 }}>
                            {s.produit.reference}
                          </span>
                        )}
                      </td>
                      <td className="text-muted">
                        {entrepotNom(s.entrepot_id)}
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: niveauColor(s.niveau_alerte),
                        }}>
                          {s.quantite?.toLocaleString('fr-FR') ?? '—'}
                        </span>
                      </td>
                      <td>{niveauBadge(s.niveau_alerte)}</td>
                      <td className="td-date">
                        {s.updated_at
                          ? new Date(s.updated_at).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
