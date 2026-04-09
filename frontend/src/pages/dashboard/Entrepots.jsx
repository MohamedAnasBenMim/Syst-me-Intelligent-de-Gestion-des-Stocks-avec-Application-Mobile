import { useState, useEffect } from 'react'
import {
  Warehouse, Plus, Pencil, Trash2, Loader, X, Check,
  AlertTriangle, Search, LayoutGrid, ChevronDown, ChevronRight,
  Package, MapPin, Phone, User,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getEntrepots, createEntrepot, updateEntrepot, deleteEntrepot, getStocks } from '../../services/api'
import './common.css'

// ── Modal Créer / Modifier ──────────────────────────────────
function EntrepotModal({ mode, initial, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    nom:          initial?.nom          || '',
    code:         initial?.code         || '',
    ville:        initial?.ville        || '',
    adresse:      initial?.adresse      || '',
    capacite_max: initial?.capacite_max ?? 1000,
    responsable:  initial?.responsable  || '',
    telephone:    initial?.telephone    || '',
  })
  const [zones,   setZones]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }
  function addZone() { setZones(prev => [...prev, { nom: '', code: '', capacite_max: 100 }]) }
  function removeZone(idx) { setZones(prev => prev.filter((_, i) => i !== idx)) }
  function setZone(idx, field, val) { setZones(prev => prev.map((z, i) => i === idx ? { ...z, [field]: val } : z)) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        nom:          form.nom,
        code:         form.code,
        ville:        form.ville        || undefined,
        adresse:      form.adresse      || undefined,
        capacite_max: Number(form.capacite_max),
        responsable:  form.responsable  || undefined,
        telephone:    form.telephone    || undefined,
      }
      if (isCreate && zones.length > 0) {
        payload.zones = zones
          .filter(z => z.nom.trim() && z.code.trim())
          .map(z => ({ nom: z.nom.trim(), code: z.code.trim().toUpperCase(), capacite_max: Number(z.capacite_max) || 100 }))
      }
      const saved = isCreate ? await createEntrepot(payload) : await updateEntrepot(initial.id, payload)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>{isCreate ? 'Nouvel entrepôt' : "Modifier l'entrepôt"}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Nom <span className="req">*</span></label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom de l'entrepôt" required autoFocus />
            </div>
            <div className="form-group">
              <label>Code <span className="req">*</span></label>
              <input value={form.code} onChange={e => set('code', e.target.value)} placeholder="Ex: WH-001" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ville</label>
              <input value={form.ville} onChange={e => set('ville', e.target.value)} placeholder="Ville" />
            </div>
            <div className="form-group">
              <label>Capacité max</label>
              <input type="number" min="0" value={form.capacite_max} onChange={e => set('capacite_max', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Adresse complète" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Responsable</label>
              <input value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Nom du responsable" />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+216 00 000 000" />
            </div>
          </div>
          {isCreate && (
            <div className="form-group" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LayoutGrid size={14} color="#6366F1" /> Zones
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#6B7280' }}>(optionnel)</span>
                </label>
                <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addZone}>
                  <Plus size={13} /> Ajouter une zone
                </button>
              </div>
              {zones.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>Aucune zone — vous pouvez en ajouter après la création.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {zones.map((z, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px' }}>
                      <div className="form-group" style={{ flex: 2, margin: 0 }}>
                        <label style={{ fontSize: 11 }}>Nom <span className="req">*</span></label>
                        <input value={z.nom} onChange={e => setZone(idx, 'nom', e.target.value)} placeholder="Zone A" style={{ padding: '6px 10px', fontSize: 13 }} />
                      </div>
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label style={{ fontSize: 11 }}>Code <span className="req">*</span></label>
                        <input value={z.code} onChange={e => setZone(idx, 'code', e.target.value)} placeholder="A" style={{ padding: '6px 10px', fontSize: 13, textTransform: 'uppercase' }} />
                      </div>
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label style={{ fontSize: 11 }}>Capacité</label>
                        <input type="number" min="1" value={z.capacite_max} onChange={e => setZone(idx, 'capacite_max', e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }} />
                      </div>
                      <button type="button" onClick={() => removeZone(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC3545', padding: '6px 4px', flexShrink: 0 }}>
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={loading} onClick={submit}>
            {loading ? <><Loader size={14} className="spin" /> Enregistrement…</> : <><Check size={14} /> {isCreate ? 'Créer' : 'Enregistrer'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Suppression ───────────────────────────────────────
function DeleteModal({ entrepot, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  async function confirm() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2>Supprimer l'entrepôt</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="del-confirm">
            <div className="del-icon"><Trash2 size={26} color="#DC3545" /></div>
            <p>Voulez-vous vraiment supprimer <strong>{entrepot.nom}</strong> ({entrepot.code}) ?</p>
            <span>Cette action est irréversible.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-danger" onClick={confirm} disabled={loading}>
            {loading ? <><Loader size={14} className="spin" /> Suppression…</> : <><Trash2 size={14} /> Supprimer</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panneau détail d'un entrepôt (zones + stocks) ──────────
function EntrepotDetail({ entrepot }) {
  const [stocks,  setStocks]  = useState(null)   // null = pas encore chargé
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    getStocks({ entrepot_id: entrepot.id })
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setStocks(list)
      })
      .catch(() => setError('Impossible de charger le stock.'))
      .finally(() => setLoading(false))
  }, [entrepot.id])

  const zones = entrepot.zones || []

  return (
    <div style={{ padding: '16px 20px 20px', background: '#F8FAFC', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ display: 'grid', gridTemplateColumns: zones.length > 0 ? '1fr 2fr' : '1fr', gap: 20 }}>

        {/* ── Zones ── */}
        {zones.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <LayoutGrid size={14} color="#6366F1" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>Zones ({zones.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {zones.map(z => {
                const taux = z.capacite_max > 0 ? Math.round(((z.capacite_utilisee || 0) / z.capacite_max) * 100) : 0
                const barC = taux >= 90 ? '#DC3545' : taux >= 70 ? '#E8730A' : '#6366F1'
                return (
                  <div key={z.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1E1B4B' }}>{z.nom}</span>
                        <span className="badge badge-teal" style={{ marginLeft: 8, fontSize: 10 }}>{z.code}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>Cap. {z.capacite_max?.toLocaleString('fr-FR')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(taux, 100)}%`, height: '100%', background: barC, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11, color: barC, fontWeight: 600, minWidth: 34 }}>{taux}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Stock produits ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Package size={14} color="#6366F1" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>
              Produits en stock {stocks !== null ? `(${stocks.length})` : ''}
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#6B7280', fontSize: 13 }}>
              <Loader size={16} className="spin" /> Chargement…
            </div>
          ) : error ? (
            <div style={{ color: '#DC3545', fontSize: 13 }}><AlertTriangle size={13} style={{ marginRight: 5 }} />{error}</div>
          ) : stocks && stocks.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: '8px 0' }}>Aucun produit en stock dans cet entrepôt.</div>
          ) : stocks && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11 }}>RÉFÉRENCE</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11 }}>DÉSIGNATION</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: 11 }}>QUANTITÉ</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11 }}>NIVEAU</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: 11 }}>PRIX/U</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(s => {
                    const prod = s.produit || {}
                    const niv  = (s.niveau_alerte || '').toLowerCase()
                    const nivColor = niv === 'rupture' ? '#DC3545' : niv === 'critique' ? '#E8730A' : niv === 'surstock' ? '#6366F1' : '#28A745'
                    const nivBg    = niv === 'rupture' ? '#FEF2F2' : niv === 'critique' ? '#FFF7ED' : niv === 'surstock' ? '#EEF2FF' : '#F0FDF4'
                    const isLow = niv === 'critique' || niv === 'rupture'
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                        <td style={{ padding: '8px 12px' }}>
                          {prod.reference
                            ? <span className="badge badge-teal" style={{ fontSize: 10 }}>{prod.reference}</span>
                            : <span style={{ color: '#9CA3AF' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1E1B4B' }}>
                          {prod.designation || `Produit #${s.produit_id}`}
                          {prod.categorie && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{prod.categorie}</div>}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: isLow ? '#DC3545' : '#1E1B4B', fontSize: 14 }}>
                          {s.quantite?.toLocaleString('fr-FR') ?? 0}
                          {prod.unite_mesure && <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF', marginLeft: 3 }}>{prod.unite_mesure}</span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: nivBg, color: nivColor, textTransform: 'uppercase' }}>
                            {niv || 'normal'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280', fontSize: 12 }}>
                          {prod.prix_unitaire != null
                            ? `${Number(prod.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────
export default function Entrepots() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'
  const canWrite = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [entrepots,   setEntrepots]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState(new Set())
  const [modal,       setModal]       = useState(null)
  const [toast,       setToast]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getEntrepots({ per_page: 50 })
      setEntrepots(Array.isArray(data?.entrepots) ? data.entrepots : [])
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
    if (modal?.type === 'create') {
      setEntrepots(prev => [saved, ...prev])
      showToast(`Entrepôt « ${saved.nom} » créé avec succès.`)
    } else {
      setEntrepots(prev => prev.map(e => e.id === saved.id ? saved : e))
      showToast(`Entrepôt « ${saved.nom} » mis à jour.`)
    }
    setModal(null)
  }

  async function handleDelete() {
    const target = modal.item
    try {
      await deleteEntrepot(target.id)
      setEntrepots(prev => prev.filter(e => e.id !== target.id))
      setExpanded(prev => { const s = new Set(prev); s.delete(target.id); return s })
      showToast(`Entrepôt « ${target.nom} » supprimé.`)
    } catch (err) {
      showToast(err.message, false)
    } finally {
      setModal(null)
    }
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const filtered = entrepots.filter(e => {
    const q = search.toLowerCase()
    return e.nom?.toLowerCase().includes(q) || e.code?.toLowerCase().includes(q) || e.ville?.toLowerCase().includes(q)
  })

  const totalZones = entrepots.reduce((acc, e) => acc + (e.zones?.length ?? 0), 0)

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Warehouse size={22} color="var(--teal)" />
            <div>
              <h1>Entrepôts</h1>
              <p>{loading ? '…' : `${entrepots.length} entrepôt${entrepots.length > 1 ? 's' : ''} enregistré${entrepots.length > 1 ? 's' : ''}`}</p>
            </div>
          </div>
          {canWrite && (
            <div className="page-hdr-actions">
              <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
                <Plus size={15} /> Nouvel entrepôt
              </button>
            </div>
          )}
        </div>

        {/* ── Stat cards ── */}
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6,148,162,0.1)' }}>
              <Warehouse size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val">{loading ? '—' : entrepots.length}</div>
              <div className="stat-lbl">Total entrepôts</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(15,31,61,0.1)' }}>
              <LayoutGrid size={20} color="#1E1B4B" />
            </div>
            <div>
              <div className="stat-val">{loading ? '—' : totalZones}</div>
              <div className="stat-lbl">Total zones</div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={15} className="toolbar-search-icon" />
            <input
              placeholder="Rechercher par nom, code ou ville…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Liste entrepôts ── */}
        {loading ? (
          <div className="data-card">
            <div className="state-loading"><Loader size={28} className="spin" /><span>Chargement…</span></div>
          </div>
        ) : error ? (
          <div className="data-card">
            <div className="state-error"><AlertTriangle size={16} /> {error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="data-card">
            <div className="state-empty">
              <Warehouse size={40} color="#ADB5BD" />
              <p>{search ? 'Aucun entrepôt ne correspond à la recherche.' : 'Aucun entrepôt enregistré.'}</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(e => {
              const isOpen   = expanded.has(e.id)
              const taux     = e.taux_occupation ?? (e.capacite_max > 0 ? Math.round(((e.capacite_utilisee || 0) / e.capacite_max) * 100) : 0)
              const barColor = taux >= 90 ? '#DC3545' : taux >= 70 ? '#E8730A' : '#6366F1'

              return (
                <div key={e.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

                  {/* ── Ligne principale ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>

                    {/* Icône + toggle */}
                    <button
                      onClick={() => toggleExpand(e.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: isOpen ? '#EEF2FF' : '#F8FAFC', border: '1px solid #E5E7EB', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                      title={isOpen ? 'Réduire' : 'Voir zones et stock'}
                    >
                      {isOpen
                        ? <ChevronDown size={16} color="#6366F1" />
                        : <ChevronRight size={16} color="#6B7280" />}
                    </button>

                    {/* Nom + Code */}
                    <div style={{ flex: '0 0 200px' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1E1B4B' }}>{e.nom}</div>
                      <span className="badge badge-teal" style={{ fontSize: 10, marginTop: 3 }}>{e.code}</span>
                    </div>

                    {/* Infos */}
                    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                      {e.ville && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B7280' }}>
                          <MapPin size={13} /> {e.ville}
                        </span>
                      )}
                      {e.responsable && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B7280' }}>
                          <User size={13} /> {e.responsable}
                        </span>
                      )}
                      {e.telephone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B7280' }}>
                          <Phone size={13} /> {e.telephone}
                        </span>
                      )}
                      {(e.zones?.length > 0) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6366F1' }}>
                          <LayoutGrid size={13} /> {e.zones.length} zone{e.zones.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Taux occupation */}
                    <div style={{ flex: '0 0 160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                        <span>Occupation</span>
                        <span style={{ color: barColor, fontWeight: 700 }}>{taux}%</span>
                      </div>
                      <div style={{ height: 6, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(taux, 100)}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>
                        <span>{(e.capacite_utilisee || 0).toLocaleString('fr-FR')}</span>
                        <span>{e.capacite_max?.toLocaleString('fr-FR')}</span>
                      </div>
                    </div>

                    {/* Statut */}
                    <span className={`badge ${e.est_actif ? 'badge-green' : 'badge-gray'}`} style={{ flexShrink: 0 }}>
                      {e.est_actif ? 'Actif' : 'Inactif'}
                    </span>

                    {/* Actions */}
                    <div className="act-btn-row" style={{ flexShrink: 0 }}>
                      {canWrite && (
                        <button className="act-btn edit" title="Modifier" onClick={() => setModal({ type: 'edit', item: e })}>
                          <Pencil size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        <button className="act-btn del" title="Supprimer" onClick={() => setModal({ type: 'delete', item: e })}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Panneau expandable : zones + stocks ── */}
                  {isOpen && <EntrepotDetail entrepot={e} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Modals ── */}
        {modal?.type === 'create' && (
          <EntrepotModal mode="create" initial={null} onClose={() => setModal(null)} onSaved={handleSaved} />
        )}
        {modal?.type === 'edit' && (
          <EntrepotModal mode="edit" initial={modal.item} onClose={() => setModal(null)} onSaved={handleSaved} />
        )}
        {modal?.type === 'delete' && (
          <DeleteModal entrepot={modal.item} onClose={() => setModal(null)} onConfirm={handleDelete} />
        )}

        {/* ── Toast ── */}
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
