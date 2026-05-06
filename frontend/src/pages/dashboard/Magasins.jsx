import { useState, useEffect } from 'react'
import { Store, Plus, Pencil, Trash2, Loader, X, Check, AlertTriangle, Search, MapPin, User, Phone, Clock } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getMagasins, createMagasin, updateMagasin, deleteMagasin, getDepots } from '../../services/api'
import './common.css'

function OccupationBar({ taux }) {
  const color = taux >= 90 ? '#DC3545' : taux >= 70 ? '#E8730A' : '#28A745'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${Math.min(taux, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 38 }}>{taux.toFixed(1)}%</span>
    </div>
  )
}

function MagasinModal({ mode, initial, depots, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    nom: initial?.nom || '', code: initial?.code || '',
    depot_id: initial?.depot_id || (depots[0]?.id ?? ''),
    ville: initial?.ville || '', adresse: initial?.adresse || '',
    capacite_max: initial?.capacite_max ?? 500,
    responsable: initial?.responsable || '', telephone: initial?.telephone || '',
    email_responsable: initial?.email_responsable || '',
    horaires_ouverture: initial?.horaires_ouverture || '',
    notes: initial?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function submit(e) {
    e.preventDefault(); setError(null)
    if (!form.nom.trim()) { setError('Le nom du magasin est obligatoire.'); return }
    if (isCreate && !form.code.trim()) { setError('Le code est obligatoire.'); return }
    if (!form.depot_id) { setError('Le dépôt parent est obligatoire.'); return }
    setLoading(true)
    try {
      const payload = { ...form, depot_id: Number(form.depot_id), capacite_max: Number(form.capacite_max) }
      if (!isCreate) { delete payload.code }
      const saved = isCreate ? await createMagasin(payload) : await updateMagasin(initial.id, payload)
      onSaved(saved)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>{isCreate ? 'Nouveau magasin' : 'Modifier le magasin'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Nom <span className="req">*</span></label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom du magasin" required autoFocus />
            </div>
            <div className="form-group">
              <label>Code <span className="req">*</span></label>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="Ex: MAG-001" required disabled={!isCreate} style={!isCreate ? { background: '#F4F4F5', color: '#6B7280' } : {}} />
            </div>
          </div>
          <div className="form-group">
            <label>Dépôt parent <span className="req">*</span></label>
            <select value={form.depot_id} onChange={e => set('depot_id', e.target.value)} required style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
              <option value="">— Sélectionner un dépôt —</option>
              {depots.map(d => (
                <option key={d.id} value={d.id}>{d.nom} ({d.depot_type})</option>
              ))}
            </select>
            {form.depot_id && (
              <span className="form-hint" style={{ color: '#6366F1' }}>
                Dépôt parent : {depots.find(d => d.id == form.depot_id)?.nom}
              </span>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ville</label>
              <input value={form.ville} onChange={e => set('ville', e.target.value)} placeholder="Tunis, Sfax…" />
            </div>
            <div className="form-group">
              <label>Capacité max</label>
              <input type="number" min="1" value={form.capacite_max} onChange={e => set('capacite_max', e.target.value)} placeholder="500" />
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
          <div className="form-row">
            <div className="form-group">
              <label>Email responsable</label>
              <input type="email" value={form.email_responsable} onChange={e => set('email_responsable', e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="form-group">
              <label>Horaires d'ouverture</label>
              <input value={form.horaires_ouverture} onChange={e => set('horaires_ouverture', e.target.value)} placeholder="Lun-Sam 08:00-18:00" />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes libres…" />
          </div>
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

export default function Magasins() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'
  const canWrite = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [magasins,     setMagasins]     = useState([])
  const [depots,       setDepots]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [filterDepot,  setFilterDepot]  = useState('')
  const [modal,        setModal]        = useState(null)
  const [toast,        setToast]        = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [magData, depData] = await Promise.allSettled([
        getMagasins({ actif_seulement: false }),
        getDepots({ actif_seulement: true }),
      ])
      setMagasins(magData.status === 'fulfilled' ? (magData.value?.magasins || []) : [])
      setDepots(depData.status === 'fulfilled' ? (depData.value?.depots || []) : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function showToast(msg, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  function handleSaved(saved) {
    if (modal?.type === 'create') {
      setMagasins(prev => [saved, ...prev])
      showToast(`Magasin « ${saved.nom} » créé.`)
    } else {
      setMagasins(prev => prev.map(m => m.id === saved.id ? saved : m))
      showToast(`Magasin « ${saved.nom} » mis à jour.`)
    }
    setModal(null)
  }

  async function handleDelete() {
    const target = modal.item
    try {
      await deleteMagasin(target.id)
      setMagasins(prev => prev.filter(m => m.id !== target.id))
      showToast(`Magasin « ${target.nom} » supprimé.`)
    } catch (err) { showToast(err.message, false) }
    finally { setModal(null) }
  }

  const filtered = magasins.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = m.nom?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q) || m.ville?.toLowerCase().includes(q)
    const matchDepot  = !filterDepot || String(m.depot_id) === filterDepot
    return matchSearch && matchDepot
  })

  return (
    <DashboardLayout>
      <div className="page">
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Store size={22} color="var(--teal)" />
            <div>
              <h1>Magasins</h1>
              <p>{loading ? '…' : `${magasins.length} magasin${magasins.length > 1 ? 's' : ''} enregistré${magasins.length > 1 ? 's' : ''}`}</p>
            </div>
          </div>
          {canWrite && (
            <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
              <Plus size={15} /> Nouveau magasin
            </button>
          )}
        </div>

        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={15} className="toolbar-search-icon" />
            <input placeholder="Rechercher par nom, code ou ville…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {search && <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setSearch('')}><X size={14} /></button>}
          {depots.length > 0 && (
            <>
              <div className="toolbar-sep" />
              <select value={filterDepot} onChange={e => setFilterDepot(e.target.value)}>
                <option value="">Tous les dépôts</option>
                {depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </>
          )}
        </div>

        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">Liste des magasins</span>
            <span className="text-muted" style={{ fontSize: 13 }}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div className="state-loading"><Loader size={28} className="spin" /><span>Chargement…</span></div>
          ) : error ? (
            <div className="state-error"><AlertTriangle size={16} /> {error}</div>
          ) : filtered.length === 0 ? (
            <div className="state-empty"><Store size={40} color="#ADB5BD" /><p>Aucun magasin trouvé.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>NOM / CODE</th><th>DÉPÔT PARENT</th><th>VILLE</th>
                    <th>OCCUPATION</th><th>RESPONSABLE</th><th>HORAIRES</th><th>STATUT</th><th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id}>
                      <td className="td-id">#{m.id}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{m.nom}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{m.code}</div>
                      </td>
                      <td>
                        {m.depot_nom
                          ? <span style={{ fontSize: 12, background: '#EEF2FF', color: '#4338CA', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>{m.depot_nom}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="text-muted">
                        {m.ville && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{m.ville}</span>}
                      </td>
                      <td style={{ minWidth: 140 }}><OccupationBar taux={m.taux_occupation || 0} /></td>
                      <td style={{ fontSize: 12 }}>
                        {m.responsable && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} />{m.responsable}</div>}
                        {m.telephone   && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280' }}><Phone size={11} />{m.telephone}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: '#6B7280' }}>
                        {m.horaires_ouverture && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{m.horaires_ouverture}</span>}
                      </td>
                      <td><span className={`badge ${m.est_actif ? 'badge-green' : 'badge-gray'}`}>{m.est_actif ? 'Actif' : 'Inactif'}</span></td>
                      <td>
                        <div className="act-btn-row">
                          {canWrite && <button className="act-btn edit" title="Modifier" onClick={() => setModal({ type: 'edit', item: m })}><Pencil size={14} /></button>}
                          {isAdmin  && <button className="act-btn del"  title="Supprimer" onClick={() => setModal({ type: 'delete', item: m })}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(modal?.type === 'create' || modal?.type === 'edit') && (
          <MagasinModal mode={modal.type} initial={modal.item || null} depots={depots} onClose={() => setModal(null)} onSaved={handleSaved} />
        )}
        {modal?.type === 'delete' && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
            <div className="modal modal-sm">
              <div className="modal-header"><h2>Supprimer le magasin</h2><button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button></div>
              <div className="modal-body"><div className="del-confirm"><div className="del-icon"><Trash2 size={26} color="#DC3545" /></div><p>Supprimer <strong>{modal.item.nom}</strong> ?</p><span>Action irréversible.</span></div></div>
              <div className="modal-footer"><button className="btn-ghost" onClick={() => setModal(null)}>Annuler</button><button className="btn-danger" onClick={handleDelete}><Trash2 size={14} /> Supprimer</button></div>
            </div>
          </div>
        )}
        {toast && <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>{toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />}{toast.msg}</div>}
      </div>
    </DashboardLayout>
  )
}
