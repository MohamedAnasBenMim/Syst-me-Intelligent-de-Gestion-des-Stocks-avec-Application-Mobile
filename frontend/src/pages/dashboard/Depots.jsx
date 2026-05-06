import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Plus, Pencil, Trash2, Loader, X, Check,
  AlertTriangle, Search, ChevronDown, ChevronRight,
  Package, MapPin, Phone, User, GitBranch, List, Store,
  Clock,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getDepots, createDepot, updateDepot, deleteDepot,
  getDepotMagasins, getMagasins, createMagasin, updateMagasin, deleteMagasin,
  getStocks,
} from '../../services/api'
import './common.css'

// ── Couleurs par type ────────────────────────────────────────
const TYPE_COLORS = {
  CENTRAL:  { bg: '#EEF2FF', border: '#6366F1', text: '#4338CA', dot: '#6366F1' },
  REGIONAL: { bg: '#F0FDFA', border: '#0694A2', text: '#065F46', dot: '#0694A2' },
  MAGASIN:  { bg: '#F0FDF4', border: '#28A745', text: '#166534', dot: '#28A745' },
}
const TYPE_LABELS = { CENTRAL: 'Central', REGIONAL: 'Régional', MAGASIN: 'Magasin' }

// ── Modal Dépôt ──────────────────────────────────────────────
function DepotModal({ mode, initial, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    nom: initial?.nom || '', code: initial?.code || '',
    depot_type: initial?.depot_type || 'REGIONAL',
    ville: initial?.ville || '', adresse: initial?.adresse || '',
    capacite_max: initial?.capacite_max ?? 1000,
    responsable: initial?.responsable || '', telephone: initial?.telephone || '',
    email_responsable: initial?.email_responsable || '', notes: initial?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function submit(e) {
    e.preventDefault(); setError(null)
    if (!form.nom.trim()) { setError('Le nom du dépôt est obligatoire.'); return }
    if (isCreate && !form.code.trim()) { setError('Le code est obligatoire.'); return }
    setLoading(true)
    try {
      const payload = { ...form, capacite_max: Number(form.capacite_max) }
      if (!isCreate) delete payload.code
      const saved = isCreate ? await createDepot(payload) : await updateDepot(initial.id, payload)
      onSaved(saved)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>{isCreate ? 'Nouveau dépôt' : 'Modifier le dépôt'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {error && <div className="form-err"><AlertTriangle size={14} /> {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Nom <span className="req">*</span></label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom du dépôt" required autoFocus />
            </div>
            <div className="form-group">
              <label>Code <span className="req">*</span></label>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="Ex: DEP-001" required disabled={!isCreate} style={!isCreate ? { background: '#F4F4F5', color: '#6B7280' } : {}} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.depot_type} onChange={e => set('depot_type', e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                <option value="CENTRAL">Central (siège principal)</option>
                <option value="REGIONAL">Régional (zone géographique)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Capacité max</label>
              <input type="number" min="1" value={form.capacite_max} onChange={e => set('capacite_max', e.target.value)} placeholder="1000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ville</label>
              <input value={form.ville} onChange={e => set('ville', e.target.value)} placeholder="Tunis, Sfax…" />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+216 00 000 000" />
            </div>
          </div>
          <div className="form-group">
            <label>Adresse complète</label>
            <input value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Adresse complète" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Responsable</label>
              <input value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Nom du responsable" />
            </div>
            <div className="form-group">
              <label>Email responsable</label>
              <input type="email" value={form.email_responsable} onChange={e => set('email_responsable', e.target.value)} placeholder="email@exemple.com" />
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

// ── Modal Magasin ────────────────────────────────────────────
function MagasinModal({ mode, initial, depotId, depotNom, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    nom: initial?.nom || '', code: initial?.code || '',
    depot_id: initial?.depot_id || depotId,
    ville: initial?.ville || '', adresse: initial?.adresse || '',
    capacite_max: initial?.capacite_max ?? 500,
    responsable: initial?.responsable || '', telephone: initial?.telephone || '',
    horaires_ouverture: initial?.horaires_ouverture || '', notes: initial?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function submit(e) {
    e.preventDefault(); setError(null)
    if (!form.nom.trim()) { setError('Le nom du magasin est obligatoire.'); return }
    if (isCreate && !form.code.trim()) { setError('Le code est obligatoire.'); return }
    setLoading(true)
    try {
      const payload = { ...form, depot_id: Number(form.depot_id), capacite_max: Number(form.capacite_max) }
      if (!isCreate) delete payload.code
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
          {depotNom && (
            <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#4338CA', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={14} /> Dépôt parent : <strong>{depotNom}</strong>
            </div>
          )}
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
          <div className="form-row">
            <div className="form-group">
              <label>Ville</label>
              <input value={form.ville} onChange={e => set('ville', e.target.value)} placeholder="Tunis, Sfax…" />
            </div>
            <div className="form-group">
              <label>Capacité max</label>
              <input type="number" min="1" value={form.capacite_max} onChange={e => set('capacite_max', e.target.value)} />
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
          <div className="form-group">
            <label>Horaires d'ouverture</label>
            <input value={form.horaires_ouverture} onChange={e => set('horaires_ouverture', e.target.value)} placeholder="Lun-Sam 08:00-18:00" />
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

// ── Panneau détail dépôt (magasins + stocks) ─────────────────
function DepotDetail({ depot, magasins, loadingMag, canWrite, isAdmin, onAddMagasin, onEditMagasin, onDeleteMagasin }) {
  const [stocks,      setStocks]      = useState(null)
  const [loadingStk,  setLoadingStk]  = useState(false)
  const [errorStk,    setErrorStk]    = useState(null)

  useEffect(() => {
    setLoadingStk(true)
    getStocks({ entrepot_id: depot.id })
      .then(data => setStocks(Array.isArray(data) ? data : (data?.stocks || [])))
      .catch(() => setErrorStk('Impossible de charger le stock.'))
      .finally(() => setLoadingStk(false))
  }, [depot.id])

  return (
    <div style={{ padding: '16px 20px 20px', background: '#F8FAFC', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ display: 'grid', gridTemplateColumns: magasins?.length > 0 ? '1fr 2fr' : '1fr', gap: 20 }}>

        {/* ── Magasins ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Store size={14} color="#28A745" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>
                Magasins {loadingMag ? '' : `(${magasins?.length ?? 0})`}
              </span>
            </div>
            {canWrite && (
              <button
                onClick={() => onAddMagasin(depot)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #28A745', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#166534', cursor: 'pointer' }}
              >
                <Plus size={12} /> Ajouter
              </button>
            )}
          </div>

          {loadingMag ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 13 }}>
              <Loader size={14} className="spin" /> Chargement…
            </div>
          ) : !magasins || magasins.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 0' }}>Aucun magasin rattaché.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {magasins.map(m => {
                const taux  = m.taux_occupation ?? (m.capacite_max > 0 ? Math.round(((m.capacite_utilisee || 0) / m.capacite_max) * 100) : 0)
                const barC  = taux >= 90 ? '#DC3545' : taux >= 70 ? '#E8730A' : '#28A745'
                return (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1E1B4B' }}>{m.nom}</span>
                        <span className="badge badge-teal" style={{ marginLeft: 8, fontSize: 10 }}>{m.code}</span>
                        {m.ville && <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>{m.ville}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {canWrite && (
                          <button onClick={() => onEditMagasin(m, depot)} className="act-btn edit" title="Modifier"><Pencil size={12} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => onDeleteMagasin(m)} className="act-btn del" title="Supprimer"><Trash2 size={12} /></button>
                        )}
                      </div>
                    </div>
                    {m.responsable && (
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={10} /> {m.responsable}
                        {m.horaires_ouverture && <><Clock size={10} style={{ marginLeft: 8 }} /> {m.horaires_ouverture}</>}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(taux, 100)}%`, height: '100%', background: barC, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11, color: barC, fontWeight: 600, minWidth: 34 }}>{taux}%</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{(m.capacite_utilisee || 0).toLocaleString('fr-FR')} / {m.capacite_max?.toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Stock produits ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Package size={14} color="#6366F1" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B' }}>
              Produits en stock {stocks !== null ? `(${stocks.length})` : ''}
            </span>
          </div>
          {loadingStk ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#6B7280', fontSize: 13 }}>
              <Loader size={16} className="spin" /> Chargement…
            </div>
          ) : errorStk ? (
            <div style={{ color: '#DC3545', fontSize: 13 }}><AlertTriangle size={13} style={{ marginRight: 5 }} />{errorStk}</div>
          ) : stocks && stocks.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: '8px 0' }}>Aucun produit en stock dans ce dépôt.</div>
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
                    const prod    = s.produit || {}
                    const niv     = (s.niveau_alerte || '').toLowerCase()
                    const nivColor = niv === 'rupture' ? '#DC3545' : niv === 'critique' ? '#E8730A' : niv === 'surstock' ? '#6366F1' : '#28A745'
                    const nivBg   = niv === 'rupture' ? '#FEF2F2' : niv === 'critique' ? '#FFF7ED' : niv === 'surstock' ? '#EEF2FF' : '#F0FDF4'
                    const isLow   = niv === 'critique' || niv === 'rupture'
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
                            ? `${Number(prod.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT`
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

// ── Nœud d'arbre ────────────────────────────────────────────
function TreeNode({ node, depth = 0, onEdit, onDelete, canWrite, isAdmin }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.enfants && node.enfants.length > 0
  const typeKey = node.type_entrepot || 'MAGASIN'
  const colors   = TYPE_COLORS[typeKey] || TYPE_COLORS.MAGASIN
  const typeLabel = TYPE_LABELS[typeKey] || typeKey

  return (
    <div style={{ marginLeft: depth * 28, marginBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: colors.bg, border: `1.5px solid ${colors.border}`,
        borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: hasChildren ? colors.border : 'transparent',
            border: hasChildren ? 'none' : `1px solid ${colors.border}`,
            cursor: hasChildren ? 'pointer' : 'default',
          }}
        >
          {hasChildren
            ? (open ? <ChevronDown size={13} color="#fff" /> : <ChevronRight size={13} color="#fff" />)
            : <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.border, display: 'block' }} />}
        </button>

        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: colors.border, color: '#fff', flexShrink: 0, letterSpacing: 0.5 }}>
          {typeLabel}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.nom}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontSize: 11, color: colors.text, fontFamily: 'monospace' }}>{node.code}</span>
            {node.ville && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#6B7280' }}><MapPin size={10} /> {node.ville}</span>}
            {node.responsable && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#6B7280' }}><User size={10} /> {node.responsable}</span>}
          </div>
        </div>

        {node.capacite_max > 0 && (
          <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 90 }}>
            <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 3 }}>
              {(node.capacite_utilisee || 0).toLocaleString('fr-FR')} / {node.capacite_max.toLocaleString('fr-FR')}
            </div>
            <div style={{ height: 5, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(node.capacite_max > 0 ? Math.round(((node.capacite_utilisee || 0) / node.capacite_max) * 100) : 0, 100)}%`,
                height: '100%', background: colors.dot, borderRadius: 4,
              }} />
            </div>
          </div>
        )}

        {hasChildren && (
          <span style={{ fontSize: 11, color: colors.text, fontWeight: 600, flexShrink: 0 }}>
            {node.enfants.length} magasin{node.enfants.length > 1 ? 's' : ''}
          </span>
        )}

        <span className={`badge ${node.est_actif ? 'badge-green' : 'badge-gray'}`} style={{ flexShrink: 0, fontSize: 10 }}>
          {node.est_actif ? 'Actif' : 'Inactif'}
        </span>

        <div className="act-btn-row" style={{ flexShrink: 0 }}>
          {canWrite && <button className="act-btn edit" title="Modifier" onClick={() => onEdit(node)}><Pencil size={13} /></button>}
          {isAdmin  && <button className="act-btn del"  title="Supprimer" onClick={() => onDelete(node)}><Trash2 size={13} /></button>}
        </div>
      </div>

      {open && hasChildren && (
        <div style={{ marginTop: 6, borderLeft: `2px dashed ${colors.border}`, marginLeft: 11, paddingLeft: 4 }}>
          {node.enfants.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} canWrite={canWrite} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────
export default function Depots() {
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'
  const canWrite  = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [depots,      setDepots]      = useState([])
  const [magasinsMap, setMagasinsMap] = useState({})   // depot_id → magasins[]
  const [loadingMagMap, setLoadingMagMap] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState(new Set())
  const [modal,       setModal]       = useState(null)
  const [toast,       setToast]       = useState(null)
  const [viewMode,    setViewMode]    = useState('list')
  const [tree,        setTree]        = useState([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError,   setTreeError]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await getDepots({ actif_seulement: false })
      setDepots(Array.isArray(data?.depots) ? data.depots : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function loadMagasinsForDepot(depotId) {
    if (magasinsMap[depotId] !== undefined) return
    setLoadingMagMap(prev => ({ ...prev, [depotId]: true }))
    try {
      const data = await getDepotMagasins(depotId)
      setMagasinsMap(prev => ({ ...prev, [depotId]: Array.isArray(data?.magasins) ? data.magasins : [] }))
    } catch { setMagasinsMap(prev => ({ ...prev, [depotId]: [] })) }
    finally { setLoadingMagMap(prev => ({ ...prev, [depotId]: false })) }
  }

  const loadTree = useCallback(async () => {
    setTreeLoading(true); setTreeError(null)
    try {
      const [depotData, magData] = await Promise.all([
        getDepots({ actif_seulement: false }),
        getMagasins({ actif_seulement: false }),
      ])
      const deps = depotData?.depots || []
      const mags = magData?.magasins || []
      const built = deps.map(d => ({
        ...d,
        type_entrepot: d.depot_type,
        enfants: mags
          .filter(m => m.depot_id === d.id)
          .map(m => ({ ...m, type_entrepot: 'MAGASIN', enfants: [] })),
      }))
      setTree(built)
    } catch (err) { setTreeError(err.message) }
    finally { setTreeLoading(false) }
  }, [])

  function toggleExpand(depot) {
    const id = depot.id
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) }
      else { s.add(id); loadMagasinsForDepot(id) }
      return s
    })
  }

  function showToast(msg, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  function handleDepotSaved(saved) {
    if (modal?.type === 'create-depot') setDepots(prev => [saved, ...prev])
    else setDepots(prev => prev.map(d => d.id === saved.id ? saved : d))
    showToast(`Dépôt « ${saved.nom} » ${modal?.type === 'create-depot' ? 'créé' : 'mis à jour'}.`)
    setModal(null)
  }

  async function handleDepotDelete() {
    const target = modal.item
    try {
      await deleteDepot(target.id)
      setDepots(prev => prev.filter(d => d.id !== target.id))
      showToast(`Dépôt « ${target.nom} » supprimé.`)
    } catch (err) { showToast(err.message, false) }
    finally { setModal(null) }
  }

  function handleMagasinSaved(saved) {
    const depId = saved.depot_id
    setMagasinsMap(prev => {
      const existing = prev[depId] || []
      if (modal?.type === 'create-magasin') return { ...prev, [depId]: [saved, ...existing] }
      return { ...prev, [depId]: existing.map(m => m.id === saved.id ? saved : m) }
    })
    showToast(`Magasin « ${saved.nom} » ${modal?.type === 'create-magasin' ? 'créé' : 'mis à jour'}.`)
    setModal(null)
  }

  async function handleMagasinDelete() {
    const m = modal.item
    try {
      await deleteMagasin(m.id)
      setMagasinsMap(prev => ({
        ...prev,
        [m.depot_id]: (prev[m.depot_id] || []).filter(x => x.id !== m.id),
      }))
      showToast(`Magasin « ${m.nom} » supprimé.`)
    } catch (err) { showToast(err.message, false) }
    finally { setModal(null) }
  }

  function handleTreeEdit(node) {
    if (node.type_entrepot === 'MAGASIN') {
      const depot = depots.find(d => d.id === node.depot_id)
      setModal({ type: 'edit-magasin', item: node, depot })
    } else {
      setModal({ type: 'edit-depot', item: node })
    }
  }

  function handleTreeDelete(node) {
    if (node.type_entrepot === 'MAGASIN') setModal({ type: 'delete-magasin', item: node })
    else setModal({ type: 'delete-depot', item: node })
  }

  const filtered    = depots.filter(d => {
    const q = search.toLowerCase()
    return d.nom?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q) || d.ville?.toLowerCase().includes(q)
  })
  const totalMagasins = depots.reduce((a, d) => a + (d.nb_magasins || 0), 0)

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Building2 size={22} color="var(--teal)" />
            <div>
              <h1>Entrepôts</h1>
              <p>{loading ? '…' : `${depots.length} dépôt${depots.length > 1 ? 's' : ''} — ${totalMagasins} magasin${totalMagasins > 1 ? 's' : ''} rattaché${totalMagasins > 1 ? 's' : ''}`}</p>
            </div>
          </div>
          {canWrite && (
            <button className="btn-primary" onClick={() => setModal({ type: 'create-depot' })}>
              <Plus size={15} /> Nouveau dépôt
            </button>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.1)' }}><Building2 size={20} color="#6366F1" /></div>
            <div><div className="stat-val">{loading ? '—' : depots.length}</div><div className="stat-lbl">Total dépôts</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(40,167,69,0.1)' }}><Store size={20} color="#28A745" /></div>
            <div><div className="stat-val">{loading ? '—' : totalMagasins}</div><div className="stat-lbl">Total magasins</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6,148,162,0.1)' }}><Building2 size={20} color="#0694A2" /></div>
            <div><div className="stat-val">{loading ? '—' : depots.filter(d => d.est_actif).length}</div><div className="stat-lbl">Dépôts actifs</div></div>
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
              disabled={viewMode === 'tree'}
            />
          </div>
          {search && viewMode === 'list' && (
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setSearch('')}><X size={14} /></button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              className={viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setViewMode('list')}
            >
              <List size={14} /> Liste
            </button>
            <button
              className={viewMode === 'tree' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => { setViewMode('tree'); loadTree() }}
            >
              <GitBranch size={14} /> Arbre
            </button>
          </div>
        </div>

        {/* ── Vue Arbre ── */}
        {viewMode === 'tree' && (
          treeLoading ? (
            <div className="data-card"><div className="state-loading"><Loader size={28} className="spin" /><span>Chargement de l'arbre…</span></div></div>
          ) : treeError ? (
            <div className="data-card"><div className="state-error"><AlertTriangle size={16} /> {treeError}</div></div>
          ) : tree.length === 0 ? (
            <div className="data-card"><div className="state-empty"><GitBranch size={40} color="#ADB5BD" /><p>Aucune hiérarchie à afficher.</p></div></div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 20px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
                {Object.entries(TYPE_LABELS).map(([type, label]) => {
                  const c = TYPE_COLORS[type]
                  return (
                    <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
                      <span style={{ color: c.text, fontWeight: 600 }}>{label}</span>
                    </span>
                  )
                })}
                <button className="btn-ghost" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={loadTree}>
                  <Loader size={12} /> Actualiser
                </button>
              </div>
              {tree.map(root => (
                <TreeNode
                  key={root.id} node={root} depth={0}
                  onEdit={handleTreeEdit} onDelete={handleTreeDelete}
                  canWrite={canWrite} isAdmin={isAdmin}
                />
              ))}
            </div>
          )
        )}

        {/* ── Vue Liste ── */}
        {viewMode === 'list' && (
          loading ? (
            <div className="data-card"><div className="state-loading"><Loader size={28} className="spin" /><span>Chargement…</span></div></div>
          ) : error ? (
            <div className="data-card"><div className="state-error"><AlertTriangle size={16} /> {error}</div></div>
          ) : filtered.length === 0 ? (
            <div className="data-card"><div className="state-empty"><Building2 size={40} color="#ADB5BD" /><p>Aucun dépôt enregistré.</p></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(d => {
                const isOpen   = expanded.has(d.id)
                const taux     = d.taux_occupation ?? (d.capacite_max > 0 ? Math.round(((d.capacite_utilisee || 0) / d.capacite_max) * 100) : 0)
                const barColor = taux >= 90 ? '#DC3545' : taux >= 70 ? '#E8730A' : '#6366F1'
                const colors   = TYPE_COLORS[d.depot_type] || TYPE_COLORS.REGIONAL

                return (
                  <div key={d.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    {/* ── Ligne principale ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                      <button
                        onClick={() => toggleExpand(d)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: isOpen ? '#EEF2FF' : '#F8FAFC', border: '1px solid #E5E7EB', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                        title={isOpen ? 'Réduire' : 'Voir magasins et stock'}
                      >
                        {isOpen ? <ChevronDown size={16} color="#6366F1" /> : <ChevronRight size={16} color="#6B7280" />}
                      </button>

                      <div style={{ flex: '0 0 200px' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1E1B4B' }}>{d.nom}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                          <span className="badge badge-teal" style={{ fontSize: 10 }}>{d.code}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: colors.bg, color: colors.text }}>{TYPE_LABELS[d.depot_type] || d.depot_type}</span>
                        </div>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                        {d.ville && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B7280' }}><MapPin size={13} /> {d.ville}</span>}
                        {d.responsable && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B7280' }}><User size={13} /> {d.responsable}</span>}
                        {d.telephone   && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B7280' }}><Phone size={13} /> {d.telephone}</span>}
                        {d.nb_magasins > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#28A745' }}>
                            <Store size={13} /> {d.nb_magasins} magasin{d.nb_magasins > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: '0 0 160px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                          <span>Occupation</span>
                          <span style={{ color: barColor, fontWeight: 700 }}>{taux}%</span>
                        </div>
                        <div style={{ height: 6, background: '#E9ECEF', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(taux, 100)}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>
                          <span>{(d.capacite_utilisee || 0).toLocaleString('fr-FR')}</span>
                          <span>{d.capacite_max?.toLocaleString('fr-FR')}</span>
                        </div>
                      </div>

                      <span className={`badge ${d.est_actif ? 'badge-green' : 'badge-gray'}`} style={{ flexShrink: 0 }}>
                        {d.est_actif ? 'Actif' : 'Inactif'}
                      </span>

                      <div className="act-btn-row" style={{ flexShrink: 0 }}>
                        {canWrite && <button className="act-btn edit" title="Modifier" onClick={() => setModal({ type: 'edit-depot', item: d })}><Pencil size={14} /></button>}
                        {isAdmin  && <button className="act-btn del"  title="Supprimer" onClick={() => setModal({ type: 'delete-depot', item: d })}><Trash2 size={14} /></button>}
                      </div>
                    </div>

                    {/* ── Panneau expandable ── */}
                    {isOpen && (
                      <DepotDetail
                        depot={d}
                        magasins={magasinsMap[d.id]}
                        loadingMag={loadingMagMap[d.id] || false}
                        canWrite={canWrite}
                        isAdmin={isAdmin}
                        onAddMagasin={dep => setModal({ type: 'create-magasin', depot: dep })}
                        onEditMagasin={(m, dep) => setModal({ type: 'edit-magasin', item: m, depot: dep })}
                        onDeleteMagasin={m => setModal({ type: 'delete-magasin', item: m })}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── Modals ── */}
        {modal?.type === 'create-depot' && (
          <DepotModal mode="create" initial={null} onClose={() => setModal(null)} onSaved={handleDepotSaved} />
        )}
        {modal?.type === 'edit-depot' && (
          <DepotModal mode="edit" initial={modal.item} onClose={() => setModal(null)} onSaved={handleDepotSaved} />
        )}
        {modal?.type === 'delete-depot' && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
            <div className="modal modal-sm">
              <div className="modal-header"><h2>Supprimer le dépôt</h2><button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button></div>
              <div className="modal-body"><div className="del-confirm"><div className="del-icon"><Trash2 size={26} color="#DC3545" /></div><p>Supprimer <strong>{modal.item.nom}</strong> ?</p><span>Les magasins actifs bloquent la suppression.</span></div></div>
              <div className="modal-footer"><button className="btn-ghost" onClick={() => setModal(null)}>Annuler</button><button className="btn-danger" onClick={handleDepotDelete}><Trash2 size={14} /> Supprimer</button></div>
            </div>
          </div>
        )}
        {(modal?.type === 'create-magasin' || modal?.type === 'edit-magasin') && (
          <MagasinModal
            mode={modal.type === 'create-magasin' ? 'create' : 'edit'}
            initial={modal.item || null}
            depotId={modal.depot?.id}
            depotNom={modal.depot?.nom}
            onClose={() => setModal(null)}
            onSaved={handleMagasinSaved}
          />
        )}
        {modal?.type === 'delete-magasin' && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
            <div className="modal modal-sm">
              <div className="modal-header"><h2>Supprimer le magasin</h2><button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button></div>
              <div className="modal-body"><div className="del-confirm"><div className="del-icon"><Trash2 size={26} color="#DC3545" /></div><p>Supprimer <strong>{modal.item.nom}</strong> ?</p><span>Action irréversible.</span></div></div>
              <div className="modal-footer"><button className="btn-ghost" onClick={() => setModal(null)}>Annuler</button><button className="btn-danger" onClick={handleMagasinDelete}><Trash2 size={14} /> Supprimer</button></div>
            </div>
          </div>
        )}

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
