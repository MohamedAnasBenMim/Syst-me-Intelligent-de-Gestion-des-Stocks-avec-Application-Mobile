import { useState, useEffect } from 'react'
import { Warehouse, Plus, Pencil, Trash2, Loader, X, Check, AlertTriangle, Search, LayoutGrid } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getEntrepots, createEntrepot, updateEntrepot, deleteEntrepot } from '../../services/api'
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
  const [zones,   setZones]   = useState([])   // zones initiales (création uniquement)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  function addZone() {
    setZones(prev => [...prev, { nom: '', code: '', capacite_max: 100 }])
  }
  function removeZone(idx) {
    setZones(prev => prev.filter((_, i) => i !== idx))
  }
  function setZone(idx, field, val) {
    setZones(prev => prev.map((z, i) => i === idx ? { ...z, [field]: val } : z))
  }

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
          .map(z => ({
            nom:          z.nom.trim(),
            code:         z.code.trim().toUpperCase(),
            capacite_max: Number(z.capacite_max) || 100,
          }))
      }
      const saved = isCreate
        ? await createEntrepot(payload)
        : await updateEntrepot(initial.id, payload)
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
          <h2>{isCreate ? 'Nouvel entrepôt' : 'Modifier l\'entrepôt'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          {error && (
            <div className="form-err">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Nom <span className="req">*</span></label>
              <input
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
                placeholder="Nom de l'entrepôt"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Code <span className="req">*</span></label>
              <input
                value={form.code}
                onChange={e => set('code', e.target.value)}
                placeholder="Ex: WH-001"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ville</label>
              <input
                value={form.ville}
                onChange={e => set('ville', e.target.value)}
                placeholder="Ville"
              />
            </div>
            <div className="form-group">
              <label>Capacité max</label>
              <input
                type="number"
                min="0"
                value={form.capacite_max}
                onChange={e => set('capacite_max', e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Adresse</label>
            <input
              value={form.adresse}
              onChange={e => set('adresse', e.target.value)}
              placeholder="Adresse complète"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Responsable</label>
              <input
                value={form.responsable}
                onChange={e => set('responsable', e.target.value)}
                placeholder="Nom du responsable"
              />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input
                value={form.telephone}
                onChange={e => set('telephone', e.target.value)}
                placeholder="+212 6 00 00 00 00"
              />
            </div>
          </div>

          {/* ── Zones (création uniquement) ── */}
          {isCreate && (
            <div className="form-group" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LayoutGrid size={14} color="#6366F1" /> Zones de l'entrepôt
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#6B7280' }}>(optionnel)</span>
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={addZone}
                >
                  <Plus size={13} /> Ajouter une zone
                </button>
              </div>

              {zones.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>
                  Aucune zone — vous pouvez en ajouter après la création.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {zones.map((z, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px' }}>
                      <div className="form-group" style={{ flex: 2, margin: 0 }}>
                        <label style={{ fontSize: 11 }}>Nom <span className="req">*</span></label>
                        <input
                          value={z.nom}
                          onChange={e => setZone(idx, 'nom', e.target.value)}
                          placeholder="Ex : Zone A"
                          style={{ padding: '6px 10px', fontSize: 13 }}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label style={{ fontSize: 11 }}>Code <span className="req">*</span></label>
                        <input
                          value={z.code}
                          onChange={e => setZone(idx, 'code', e.target.value)}
                          placeholder="Ex : A"
                          style={{ padding: '6px 10px', fontSize: 13, textTransform: 'uppercase' }}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label style={{ fontSize: 11 }}>Capacité</label>
                        <input
                          type="number"
                          min="1"
                          value={z.capacite_max}
                          onChange={e => setZone(idx, 'capacite_max', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: 13 }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeZone(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC3545', padding: '6px 4px', flexShrink: 0 }}
                        title="Supprimer la zone"
                      >
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
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            onClick={submit}
          >
            {loading
              ? <><Loader size={14} className="spin" /> Enregistrement…</>
              : <><Check size={14} /> {isCreate ? 'Créer' : 'Enregistrer'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Suppression ───────────────────────────────────────
function DeleteModal({ entrepot, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

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
            <p>
              Voulez-vous vraiment supprimer <strong>{entrepot.nom}</strong> ({entrepot.code}) ?
            </p>
            <span>Cette action est irréversible.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-danger" onClick={confirm} disabled={loading}>
            {loading
              ? <><Loader size={14} className="spin" /> Suppression…</>
              : <><Trash2 size={14} /> Supprimer</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────
export default function Entrepots() {
  const { user } = useAuth()
  const isAdmin       = user?.role === 'admin'
  const canWrite      = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [entrepots, setEntrepots] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(null)  // null | { type, item? }
  const [toast,     setToast]     = useState(null)  // { msg, ok }

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
      showToast(`Entrepôt « ${target.nom} » supprimé.`)
    } catch (err) {
      showToast(err.message, false)
    } finally {
      setModal(null)
    }
  }

  // ── Filtre local ────────────────────────────────────────────
  const filtered = entrepots.filter(e => {
    const q = search.toLowerCase()
    return (
      e.nom?.toLowerCase().includes(q)  ||
      e.code?.toLowerCase().includes(q) ||
      e.ville?.toLowerCase().includes(q)
    )
  })

  // ── Stats ───────────────────────────────────────────────────
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
              <p>
                {loading ? '…' : `${entrepots.length} entrepôt${entrepots.length > 1 ? 's' : ''} enregistré${entrepots.length > 1 ? 's' : ''}`}
              </p>
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
              <Warehouse size={20} color="#1E1B4B" />
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

        {/* ── Contenu ── */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">Liste des entrepôts</span>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="state-loading">
              <Loader size={28} className="spin" />
              <span>Chargement des entrepôts…</span>
            </div>
          ) : error ? (
            <div className="state-error">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="state-empty">
              <Warehouse size={40} color="#ADB5BD" />
              <p>{search ? 'Aucun entrepôt ne correspond à la recherche.' : 'Aucun entrepôt enregistré.'}</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>NOM / CODE</th>
                    <th>VILLE</th>
                    <th>CAPACITÉ MAX</th>
                    <th>UTILISÉE</th>
                    <th>TAUX</th>
                    <th>RESPONSABLE</th>
                    <th>STATUT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const taux = e.taux_occupation ?? (
                      e.capacite_max > 0
                        ? Math.round((e.capacite_utilisee / e.capacite_max) * 100)
                        : 0
                    )
                    const barColor = taux >= 90 ? '#DC3545' : taux >= 70 ? '#E8730A' : '#6366F1'

                    return (
                      <tr key={e.id}>
                        <td className="td-id">#{e.id}</td>
                        <td>
                          <div className="td-name">{e.nom}</div>
                          <div className="td-muted">{e.code}</div>
                        </td>
                        <td className="text-muted">{e.ville || '—'}</td>
                        <td>{e.capacite_max?.toLocaleString('fr-FR') ?? '—'}</td>
                        <td>{e.capacite_utilisee?.toLocaleString('fr-FR') ?? '—'}</td>
                        <td style={{ minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              flex: 1, height: 6, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(taux, 100)}%`,
                                height: '100%',
                                background: barColor,
                                borderRadius: 4,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 12, color: barColor, fontWeight: 600, minWidth: 34 }}>
                              {taux}%
                            </span>
                          </div>
                        </td>
                        <td className="text-muted">{e.responsable || '—'}</td>
                        <td>
                          <span className={`badge ${e.est_actif ? 'badge-green' : 'badge-gray'}`}>
                            {e.est_actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <div className="act-btn-row">
                            {canWrite && (
                              <button
                                className="act-btn edit"
                                title="Modifier"
                                onClick={() => setModal({ type: 'edit', item: e })}
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                className="act-btn del"
                                title="Supprimer"
                                onClick={() => setModal({ type: 'delete', item: e })}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {!canWrite && (
                              <span className="text-light" style={{ fontSize: 12 }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        {modal?.type === 'create' && (
          <EntrepotModal
            mode="create"
            initial={null}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'edit' && (
          <EntrepotModal
            mode="edit"
            initial={modal.item}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'delete' && (
          <DeleteModal
            entrepot={modal.item}
            onClose={() => setModal(null)}
            onConfirm={handleDelete}
          />
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
