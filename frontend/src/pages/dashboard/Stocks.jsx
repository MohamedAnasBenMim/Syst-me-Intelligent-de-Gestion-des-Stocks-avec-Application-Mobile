import { useState, useEffect, useMemo } from 'react'
import {
  Layers, AlertTriangle, TrendingDown, CheckCircle,
  Search, Filter, ChevronRight, Home, RefreshCw, List,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getStocks, getDepots, getMagasins } from '../../services/api'
import './common.css'

// ── Config ──────────────────────────────────────────────────
const NIVEAUX = [
  { value: 'tous',     label: 'Tous les niveaux' },
  { value: 'normal',   label: 'Normal'   },
  { value: 'critique', label: 'Critique' },
  { value: 'rupture',  label: 'Rupture'  },
  { value: 'surstock', label: 'Surstock' },
]

const TYPE_COLOR = { ROOT: '#4F46E5', DEPOT: '#0891B2', MAGASIN: '#059669' }
const TYPE_LABEL = { ROOT: 'Central',  DEPOT: 'Dépôt',   MAGASIN: 'Magasin' }
const TYPE_BG    = { ROOT: '#EEF2FF',  DEPOT: '#ECFEFF',  MAGASIN: '#ECFDF5' }

// ── Helpers arbre ────────────────────────────────────────────
function collectIds(node) {
  return [node.id, ...(node.enfants || []).flatMap(collectIds)]
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    const f = findNode(n.enfants || [], id)
    if (f) return f
  }
  return null
}

function flattenTree(nodes, depth = 0) {
  return nodes.flatMap(n => [
    { ...n, depth },
    ...flattenTree(n.enfants || [], depth + 1),
  ])
}

// ── Niveau helpers ───────────────────────────────────────────
function niveauBadge(niveau) {
  const cfg = {
    rupture:  { label: 'Rupture',  bg: '#FEE2E2', color: '#DC3545' },
    critique: { label: 'Critique', bg: '#FFF3CD', color: '#E8730A' },
    surstock: { label: 'Surstock', bg: '#EEF2FF', color: '#6366F1' },
    normal:   { label: 'Normal',   bg: '#DCFCE7', color: '#16A34A' },
  }
  const c = cfg[niveau] || { label: niveau || '—', bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: c.bg, color: c.color,
    }}>{c.label}</span>
  )
}

function niveauColor(niveau) {
  return { rupture: '#DC3545', critique: '#E8730A', surstock: '#6366F1', normal: '#16A34A' }[niveau] || '#6B7280'
}

function worstNiveau(stocks) {
  if (stocks.some(s => s.niveau_alerte === 'rupture'))  return 'rupture'
  if (stocks.some(s => s.niveau_alerte === 'critique')) return 'critique'
  if (stocks.some(s => s.niveau_alerte === 'surstock')) return 'surstock'
  if (stocks.length > 0)                                return 'normal'
  return null
}

// ── Composant : carte d'un nœud hiérarchique ────────────────
function NodeCard({ node, allStocks, onClick }) {
  const ids        = useMemo(() => collectIds(node), [node])
  const nodeStocks = allStocks.filter(s => ids.includes(s.entrepot_id))
  const worst      = worstNiveau(nodeStocks)
  const totalQte   = nodeStocks.reduce((sum, s) => sum + (s.quantite || 0), 0)
  const nbProduits = new Set(nodeStocks.map(s => s.produit_id)).size
  const capacite   = node.capacite_max || 0
  const taux       = capacite > 0 ? Math.min(100, Math.round((totalQte / capacite) * 100)) : null
  const hasChildren = (node.enfants || []).length > 0

  const worstLabel = {
    rupture:  'Rupture de stock',
    critique: 'Stock critique',
    surstock: '↑ Surstock',
    normal:   'Tout normal',
  }

  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${TYPE_COLOR[node.type_entrepot]}25`,
        borderLeft: `4px solid ${TYPE_COLOR[node.type_entrepot]}`,
        borderRadius: 12,
        padding: '16px 20px',
        background: worst === 'rupture' ? '#FEF2F2'
                  : worst === 'critique' ? '#FFFBEB'
                  : TYPE_BG[node.type_entrepot] || '#FAFAFA',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        transition: 'box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Nom + type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: TYPE_COLOR[node.type_entrepot] + '20',
            color: TYPE_COLOR[node.type_entrepot],
          }}>
            {TYPE_LABEL[node.type_entrepot] || node.type_entrepot}
          </span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1E1B4B' }}>{node.nom}</span>
          {node.ville && <span style={{ fontSize: 12, color: '#9CA3AF' }}>— {node.ville}</span>}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 20, fontSize: 13, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#6B7280' }}>
            <strong style={{ color: '#1E1B4B' }}>{nbProduits}</strong> produit{nbProduits !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#6B7280' }}>
            <strong style={{ color: '#1E1B4B' }}>{totalQte.toLocaleString('fr-FR')}</strong> unités
          </span>
          {taux !== null && (
            <span style={{ color: '#6B7280' }}>
              Occupation :&nbsp;
              <strong style={{ color: taux > 90 ? '#DC3545' : taux > 70 ? '#E8730A' : '#16A34A' }}>
                {taux}%
              </strong>
            </span>
          )}
          {worst && (
            <span style={{ fontWeight: 600, color: niveauColor(worst) }}>
              {worstLabel[worst]}
            </span>
          )}
          {nodeStocks.length === 0 && (
            <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Aucun stock</span>
          )}
        </div>

        {/* Enfants hint */}
        {hasChildren && (
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            {node.enfants.length} {TYPE_LABEL[node.enfants[0]?.type_entrepot] || 'sous-nœud'}
            {node.enfants.length > 1 ? 's' : ''}
          </div>
        )}
        {node.responsable && (
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            Responsable : {node.responsable}
            {node.telephone ? ` — ${node.telephone}` : ''}
          </div>
        )}
      </div>

      <ChevronRight size={20} color={TYPE_COLOR[node.type_entrepot]} style={{ flexShrink: 0 }} />
    </div>
  )
}

// ── Composant : tableau de stocks ────────────────────────────
function StockTable({ stocks, entrepotNom }) {
  if (stocks.length === 0) {
    return (
      <div className="state-empty">
        <Layers size={40} color="#ADB5BD" />
        <p>Aucun stock dans cet emplacement.</p>
      </div>
    )
  }
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>PRODUIT</th>
            <th>ENTREPÔT</th>
            <th>FOURNISSEUR</th>
            <th>LOT</th>
            <th>QUANTITÉ</th>
            <th>NIVEAU</th>
            <th>RÉCEPTION</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map(s => (
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
              <td className="text-muted">{entrepotNom(s.entrepot_id)}</td>
              <td>
                {s.fournisseur_nom
                  ? <span style={{ fontSize: 13, color: '#0891B2', fontWeight: 600 }}>{s.fournisseur_nom}</span>
                  : <span className="text-muted">—</span>
                }
              </td>
              <td>
                {s.numero_lot
                  ? <span style={{ fontSize: 12, background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{s.numero_lot}</span>
                  : <span className="text-muted">—</span>
                }
              </td>
              <td>
                <span style={{ fontWeight: 700, fontSize: 15, color: niveauColor(s.niveau_alerte) }}>
                  {s.quantite?.toLocaleString('fr-FR') ?? '—'}
                </span>
              </td>
              <td>{niveauBadge(s.niveau_alerte)}</td>
              <td className="td-date">
                {s.date_reception
                  ? new Date(s.date_reception).toLocaleDateString('fr-FR')
                  : s.updated_at
                    ? new Date(s.updated_at).toLocaleDateString('fr-FR')
                    : '—'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────
export default function Stocks() {
  useAuth()

  const [stocks,         setStocks]         = useState([])
  const [tree,           setTree]           = useState([])
  const [flatEntrepots,  setFlatEntrepots]  = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [viewMode,       setViewMode]       = useState('hierarchy')

  // Drill
  const [drillPath,      setDrillPath]      = useState([])

  // List mode filters
  const [search,         setSearch]         = useState('')
  const [filterNiveau,   setFilterNiveau]   = useState('tous')
  const [filterEntrepot, setFilterEntrepot] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [s, depotsRes, magasinsRes] = await Promise.all([
        getStocks(),
        getDepots({ actif_seulement: false }).catch(() => ({ depots: [] })),
        getMagasins({ actif_seulement: false }).catch(() => ({ magasins: [] })),
      ])
      const depots    = depotsRes?.depots    || []
      const magasins  = magasinsRes?.magasins || []
      const treeArr   = depots.map(d => ({
        ...d,
        type_entrepot: 'DEPOT',
        enfants: magasins
          .filter(m => m.depot_id === d.id)
          .map(m => ({ ...m, type_entrepot: 'MAGASIN', enfants: [] })),
      }))
      // Normalise les stocks : utilise depot_id ou magasin_id comme entrepot_id
      const stocksArr = (Array.isArray(s) ? s : []).map(st => ({
        ...st,
        entrepot_id: st.depot_id || st.magasin_id || st.entrepot_id,
      }))
      setStocks(stocksArr)
      setTree(treeArr)
      setFlatEntrepots(flattenTree(treeArr))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Drill helpers ──────────────────────────────────────────
  const currentNode   = drillPath.length > 0 ? findNode(tree, drillPath[drillPath.length - 1]) : null
  const isLeaf        = currentNode?.type_entrepot === 'MAGASIN' || (currentNode && !(currentNode.enfants?.length))
  const childrenToShow = currentNode ? (currentNode.enfants || []) : tree
  const breadcrumb    = drillPath.map(id => findNode(tree, id)).filter(Boolean)

  const leafStocks = useMemo(() => {
    if (!isLeaf || !currentNode) return []
    return stocks.filter(s => s.entrepot_id === currentNode.id)
  }, [isLeaf, currentNode?.id, stocks]) // eslint-disable-line

  function drillInto(id)  { setDrillPath(p => [...p, id]) }
  function drillTo(index) { setDrillPath(p => p.slice(0, index)) }

  // ── List mode ──────────────────────────────────────────────
  const selectedIds = filterEntrepot
    ? (() => {
        const n = findNode(tree, Number(filterEntrepot))
        return n ? collectIds(n) : [Number(filterEntrepot)]
      })()
    : null

  const listFiltered = stocks.filter(s => {
    const q = search.toLowerCase()
    return (
      (s.produit?.designation?.toLowerCase().includes(q) || s.produit?.reference?.toLowerCase().includes(q)) &&
      (filterNiveau === 'tous' || s.niveau_alerte === filterNiveau) &&
      (!selectedIds || selectedIds.includes(s.entrepot_id))
    )
  })

  // ── Stats globales ─────────────────────────────────────────
  const totalRupture = stocks.filter(s => s.niveau_alerte === 'rupture').length
  const totalCrit    = stocks.filter(s => s.niveau_alerte === 'critique').length
  const totalSur     = stocks.filter(s => s.niveau_alerte === 'surstock').length

  function entrepotNom(id) {
    return flatEntrepots.find(e => e.id === id)?.nom || `#${id}`
  }

  // ── Dropdown indenté ───────────────────────────────────────
  const INDENT = ['', '  └─ ', '      └─ ']

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Layers size={22} color="var(--teal)" />
            <div>
              <h1>Stocks</h1>
              <p>{loading ? '…' : `${stocks.length} entrée${stocks.length !== 1 ? 's' : ''} de stock`}</p>
            </div>
          </div>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualiser
          </button>
        </div>

        {/* ── KPI ── */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#F0F9FF' }}>
              <Layers size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val">{loading ? '—' : stocks.length}</div>
              <div className="stat-lbl">Total stocks</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#FEF2F2' }}>
              <TrendingDown size={20} color="#DC3545" />
            </div>
            <div>
              <div className="stat-val" style={{ color: '#DC3545' }}>{loading ? '—' : totalRupture}</div>
              <div className="stat-lbl">En rupture</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#FFF7ED' }}>
              <AlertTriangle size={20} color="#E8730A" />
            </div>
            <div>
              <div className="stat-val" style={{ color: '#E8730A' }}>{loading ? '—' : totalCrit}</div>
              <div className="stat-lbl">Critiques</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#EEF2FF' }}>
              <CheckCircle size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val" style={{ color: '#6366F1' }}>{loading ? '—' : totalSur}</div>
              <div className="stat-lbl">Surstocks</div>
            </div>
          </div>
        </div>

        {/* ── Toggle vue ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'hierarchy', label: 'Vue hiérarchique' },
            { key: 'list',      label: 'Liste complète',  icon: List },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                background: viewMode === key ? '#004678' : 'white',
                color:      viewMode === key ? 'white'   : '#374151',
                border: `1px solid ${viewMode === key ? '#004678' : '#E5E7EB'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════ VUE HIÉRARCHIQUE ══════════════ */}
        {viewMode === 'hierarchy' && (
          <>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
              <button
                onClick={() => drillTo(0)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  background: drillPath.length === 0 ? '#004678' : '#F3F4F6',
                  color:      drillPath.length === 0 ? 'white'   : '#374151',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <Home size={13} /> Tous les entrepôts
              </button>

              {breadcrumb.map((n, i) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChevronRight size={14} color="#9CA3AF" />
                  <button
                    onClick={() => drillTo(i + 1)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                      background: i === breadcrumb.length - 1 ? TYPE_COLOR[n.type_entrepot] : '#F3F4F6',
                      color:      i === breadcrumb.length - 1 ? 'white' : '#374151',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {n.nom}
                  </button>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="state-loading">
                <Layers size={28} className="spin" />
                <span>Chargement de la hiérarchie…</span>
              </div>
            ) : error ? (
              <div className="state-error"><AlertTriangle size={16} /> {error}</div>
            ) : !isLeaf ? (
              /* Nœuds enfants → cartes cliquables */
              <div>
                {childrenToShow.length === 0 ? (
                  <div className="state-empty">
                    <Layers size={40} color="#ADB5BD" />
                    <p>Aucun entrepôt à afficher.</p>
                  </div>
                ) : (
                  childrenToShow.map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      allStocks={stocks}
                      onClick={() => drillInto(node.id)}
                    />
                  ))
                )}
              </div>
            ) : (
              /* Feuille MAGASIN → tableau stocks */
              <div className="data-card">
                <div className="data-card-header">
                  <div>
                    <span className="data-card-title">{currentNode.nom}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 10 }}>
                      {leafStocks.length} article{leafStocks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {currentNode.responsable && (
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      Responsable : {currentNode.responsable}
                      {currentNode.telephone ? ` — ${currentNode.telephone}` : ''}
                    </span>
                  )}
                </div>
                <StockTable stocks={leafStocks} entrepotNom={entrepotNom} />
              </div>
            )}
          </>
        )}

        {/* ══════════════ VUE LISTE ══════════════ */}
        {viewMode === 'list' && (
          <>
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
              <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}>
                {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
              {flatEntrepots.length > 0 && (
                <select value={filterEntrepot} onChange={e => setFilterEntrepot(e.target.value)}>
                  <option value="">Tous les entrepôts</option>
                  {flatEntrepots.map(e => (
                    <option key={e.id} value={String(e.id)}>
                      {INDENT[e.depth] || '        '}{e.nom}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loading ? (
              <div className="state-loading"><Layers size={28} className="spin" /><span>Chargement…</span></div>
            ) : error ? (
              <div className="state-error"><AlertTriangle size={16} /> {error}</div>
            ) : (
              <div className="data-card">
                <div className="data-card-header">
                  <span className="data-card-title">État des stocks</span>
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    {listFiltered.length} résultat{listFiltered.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <StockTable stocks={listFiltered} entrepotNom={entrepotNom} />
              </div>
            )}
          </>
        )}

      </div>
    </DashboardLayout>
  )
}
