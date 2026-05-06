import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeftRight, Plus, Loader, X, CheckCircle, XCircle,
  AlertTriangle, ChevronLeft, ChevronRight, Building2, Store,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getMouvements, createMouvement, getDepots, getMagasins, getProduits, getFournisseurs,
  annulerMouvement,
} from '../../services/api'
import './common.css'

// ── Helpers ────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Clé composite pour éviter la collision d'IDs entre dépôts et magasins
function locKey(type, id) { return `${type}_${id}` }
function parseLocKey(key) {
  if (!key) return { id: null, type: null }
  const idx = key.lastIndexOf('_')
  return { type: key.slice(0, idx), id: Number(key.slice(idx + 1)) }
}

const TYPE_CFG = {
  entree:    { label: 'ENTRÉE',    badgeClass: 'badge-green', signColor: '#28A745', sign: '+' },
  sortie:    { label: 'SORTIE',    badgeClass: 'badge-red',   signColor: '#DC3545', sign: '-' },
  transfert: { label: 'TRANSFERT', badgeClass: 'badge-teal',  signColor: '#6366F1', sign: '⇄' },
}

const STATUT_CFG = {
  valide:     { label: 'Validé',     badgeClass: 'badge-green'  },
  en_attente: { label: 'En attente', badgeClass: 'badge-orange' },
  annule:     { label: 'Annulé',     badgeClass: 'badge-red'    },
}

// ── Petit badge type localisation ──────────────────────────
function LocBadge({ type }) {
  if (!type) return null
  const isDepot = type === 'DEPOT'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginRight: 4,
      background: isDepot ? '#EEF2FF' : '#F0FDF4',
      color:      isDepot ? '#4338CA' : '#166534',
      verticalAlign: 'middle',
    }}>
      {isDepot ? <><Building2 size={9} style={{ display: 'inline', marginRight: 2 }} />DEP</> : <><Store size={9} style={{ display: 'inline', marginRight: 2 }} />MAG</>}
    </span>
  )
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

// ── Modal Créer un mouvement ───────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    type_mouvement:     'entree',
    produit_id:         '',
    quantite:           '',
    entrepot_dest_key:  '',   // composite "DEPOT_1" ou "MAGASIN_2"
    entrepot_source_key:'',
    fournisseur_id:     '',
    motif:              '',
    reference:          '',
  })
  const [produits,     setProduits]     = useState([])
  const [locations,    setLocations]    = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [loadingRef, setLoadingRef] = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    Promise.allSettled([
      getProduits(),
      getDepots({ actif_seulement: false }),
      getMagasins({ actif_seulement: false }),
      getFournisseurs({ per_page: 100 }),
    ]).then(([p, d, m, f]) => {
      if (p.status === 'fulfilled') setProduits(Array.isArray(p.value) ? p.value : [])
      const depots   = (d.status === 'fulfilled' ? d.value?.depots   || [] : []).map(x => ({ ...x, type: 'DEPOT' }))
      const magasins = (m.status === 'fulfilled' ? m.value?.magasins || [] : []).map(x => ({ ...x, type: 'MAGASIN' }))
      setLocations([...depots, ...magasins])
      if (f.status === 'fulfilled') setFournisseurs(f.value?.fournisseurs || [])
      setLoadingRef(false)
    })
  }, [])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  const needsDest   = form.type_mouvement === 'entree'    || form.type_mouvement === 'transfert'
  const needsSource = form.type_mouvement === 'sortie'    || form.type_mouvement === 'transfert'

  // Nom affiché pour une clé composite
  function locNom(key) {
    if (!key) return '—'
    const { type, id } = parseLocKey(key)
    const loc = locations.find(l => l.type === type && l.id === id)
    return loc ? loc.nom : key
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)

    if (!form.produit_id) { setError('Veuillez sélectionner un produit.'); return }
    if (!form.quantite || Number(form.quantite) <= 0) { setError('La quantité doit être supérieure à 0.'); return }
    if (needsDest   && !form.entrepot_dest_key)   { setError('La destination est requise.'); return }
    if (needsSource && !form.entrepot_source_key) { setError('La source est requise.'); return }
    if (form.type_mouvement === 'transfert' && form.entrepot_source_key === form.entrepot_dest_key) {
      setError('La source et la destination doivent être différentes pour un transfert.')
      return
    }

    const destParsed   = parseLocKey(form.entrepot_dest_key)
    const sourceParsed = parseLocKey(form.entrepot_source_key)

    setLoading(true)
    try {
      const body = {
        type_mouvement: form.type_mouvement,
        produit_id:     Number(form.produit_id),
        quantite:       Number(form.quantite),
      }
      if (needsDest && destParsed.id) {
        body.entrepot_dest_id = destParsed.id
        body.destination_type = destParsed.type
      }
      if (needsSource && sourceParsed.id) {
        body.entrepot_source_id = sourceParsed.id
        body.source_type        = sourceParsed.type
      }
      if (form.fournisseur_id)   body.fournisseur_id = Number(form.fournisseur_id)
      if (form.motif.trim())     body.motif          = form.motif.trim()
      if (form.reference.trim()) body.reference      = form.reference.trim()

      const created = await createMouvement(body)
      onCreated(created)
    } catch (err) {
      setError(err?.message || 'Erreur lors de la création.')
    } finally {
      setLoading(false)
    }
  }

  const depots   = locations.filter(l => l.type === 'DEPOT')
  const magasins = locations.filter(l => l.type === 'MAGASIN')

  function LocationSelect({ value, onChange, label }) {
    return (
      <div className="form-group">
        <label>{label} <span className="req">*</span></label>
        <select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Sélectionner…</option>
          <optgroup label="— Dépôts —">
            {depots.map(l => (
              <option key={`d-${l.id}`} value={locKey('DEPOT', l.id)}>
                {l.nom || `Dépôt #${l.id}`}
              </option>
            ))}
          </optgroup>
          <optgroup label="— Magasins —">
            {magasins.map(l => (
              <option key={`m-${l.id}`} value={locKey('MAGASIN', l.id)}>
                {l.nom || `Magasin #${l.id}`}
              </option>
            ))}
          </optgroup>
        </select>
        {value && (
          <span className="form-hint" style={{ color: parseLocKey(value).type === 'DEPOT' ? '#4338CA' : '#166534' }}>
            {parseLocKey(value).type === 'DEPOT' ? '📦 Dépôt sélectionné' : '🏪 Magasin sélectionné'} : {locNom(value)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>Créer un mouvement</h2>
          <button className="modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {loadingRef ? (
              <div className="state-loading"><Loader size={20} className="spin" /><span>Chargement des données…</span></div>
            ) : (
              <>
                {error && (
                  <div className="form-err">
                    <AlertTriangle size={15} />
                    {error}
                  </div>
                )}

                {/* Type + Produit */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Type de mouvement <span className="req">*</span></label>
                    <select
                      value={form.type_mouvement}
                      onChange={e => {
                        set('type_mouvement', e.target.value)
                        set('entrepot_dest_key', '')
                        set('entrepot_source_key', '')
                      }}
                    >
                      <option value="entree">Entrée (réception stock)</option>
                      <option value="sortie">Sortie (livraison / consommation)</option>
                      <option value="transfert">Transfert inter-site</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Produit <span className="req">*</span></label>
                    <select value={form.produit_id} onChange={e => set('produit_id', e.target.value)}>
                      <option value="">Sélectionner…</option>
                      {produits.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.designation
                            ? `${p.reference ? `[${p.reference}] ` : ''}${p.designation}`
                            : `Produit #${p.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantité */}
                <div className="form-group">
                  <label>Quantité <span className="req">*</span></label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={form.quantite}
                    onChange={e => set('quantite', e.target.value)}
                    placeholder="Ex: 100"
                  />
                </div>

                {/* Destination (entrée / transfert) */}
                {needsDest && (
                  <LocationSelect
                    label="Destination"
                    value={form.entrepot_dest_key}
                    onChange={v => set('entrepot_dest_key', v)}
                  />
                )}

                {/* Fournisseur (entrée uniquement) */}
                {form.type_mouvement === 'entree' && (
                  <div className="form-group">
                    <label>Fournisseur <span style={{ color: '#9CA3AF', fontSize: 12 }}>(optionnel)</span></label>
                    <select value={form.fournisseur_id} onChange={e => set('fournisseur_id', e.target.value)}>
                      <option value="">— Aucun fournisseur —</option>
                      {fournisseurs.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.nom}{f.ville ? ` — ${f.ville}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Source (sortie / transfert) */}
                {needsSource && (
                  <LocationSelect
                    label="Source"
                    value={form.entrepot_source_key}
                    onChange={v => set('entrepot_source_key', v)}
                  />
                )}

                {/* Avertissement source == dest pour transfert */}
                {form.type_mouvement === 'transfert'
                  && form.entrepot_source_key
                  && form.entrepot_dest_key
                  && form.entrepot_source_key === form.entrepot_dest_key && (
                  <div className="form-err" style={{ marginTop: -8 }}>
                    <AlertTriangle size={14} /> La source et la destination doivent être différentes.
                  </div>
                )}

                {/* Motif + Référence */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Motif <span style={{ color: '#9CA3AF', fontSize: 12 }}>(optionnel)</span></label>
                    <input
                      type="text"
                      value={form.motif}
                      onChange={e => set('motif', e.target.value)}
                      placeholder="Ex: Réapprovisionnement"
                    />
                  </div>
                  <div className="form-group">
                    <label>Référence <span style={{ color: '#9CA3AF', fontSize: 12 }}>(optionnel)</span></label>
                    <input
                      type="text"
                      value={form.reference}
                      onChange={e => set('reference', e.target.value)}
                      placeholder="Ex: BL-2025-001"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading || loadingRef}>
              {loading ? <Loader size={14} className="spin" /> : <Plus size={14} />}
              + Créer le mouvement
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────

export default function Mouvements() {
  const { user }  = useAuth()
  const canCancel = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [mouvements,    setMouvements]    = useState([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [filterType,    setFilterType]    = useState('')
  const [filterStatut,  setFilterStatut]  = useState('')
  const [modal,         setModal]         = useState(null)
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
      if (filterType)   params.type_mouvement = filterType
      if (filterStatut) params.statut         = filterStatut
      const data = await getMouvements(params)
      setMouvements(data?.mouvements || [])
      setTotal(data?.total || 0)
    } catch (err) {
      setError(err?.message || 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [page, filterType, filterStatut])

  useEffect(() => { load() }, [load])

  const countAttente = mouvements.filter(m => m.statut === 'en_attente').length
  const countValide  = mouvements.filter(m => m.statut === 'valide').length

  function handleCreated() {
    setModal(null)
    showToast('Mouvement créé avec succès.')
    setPage(1)
    load()
  }

  async function handleCancel(id) {
    if (!window.confirm(`Annuler le mouvement #${id} ? Cette action est irréversible et inversera le stock.`)) return
    try {
      await annulerMouvement(id)
      showToast(`Mouvement #${id} annulé — stock corrigé.`)
      load()
    } catch (err) {
      showToast(err?.message || 'Erreur lors de l\'annulation.', false)
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <ArrowLeftRight size={22} color="#6366F1" />
            <div>
              <h1>Mouvements de stock</h1>
              <p>
                {loading
                  ? '…'
                  : `${total > 0 ? total : mouvements.length} mouvement${(total > 0 ? total : mouvements.length) !== 1 ? 's' : ''} au total`
                }
              </p>
            </div>
          </div>
          <div className="page-hdr-actions">
            <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
              <Plus size={15} /> Nouveau mouvement
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <ArrowLeftRight size={20} color="#6366F1" />
            </div>
            <div>
              <div className="stat-val">{total}</div>
              <div className="stat-lbl">Total mouvements</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(232,115,10,0.1)' }}>
              <Loader size={20} color="#E8730A" />
            </div>
            <div>
              <div className="stat-val">{countAttente}</div>
              <div className="stat-lbl">En attente</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(40,167,69,0.1)' }}>
              <CheckCircle size={20} color="#28A745" />
            </div>
            <div>
              <div className="stat-val">{countValide}</div>
              <div className="stat-lbl">Validés</div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Type :</span>
          {[
            { val: '',          label: 'Tous' },
            { val: 'entree',    label: 'Entrées' },
            { val: 'sortie',    label: 'Sorties' },
            { val: 'transfert', label: 'Transferts' },
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => { setFilterType(opt.val); setPage(1) }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                background: filterType === opt.val ? '#6366F1' : '#F4F4F5',
                color:      filterType === opt.val ? '#fff'    : '#6B7280',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
          <div className="toolbar-sep" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Statut :</span>
          <select
            value={filterStatut}
            onChange={e => { setFilterStatut(e.target.value); setPage(1) }}
          >
            <option value="">Tous</option>
            <option value="en_attente">En attente</option>
            <option value="valide">Validé</option>
            <option value="annule">Annulé</option>
          </select>
        </div>

        {/* ── Table ── */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">Liste des mouvements</span>
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
          ) : mouvements.length === 0 ? (
            <div className="state-empty">
              <ArrowLeftRight size={32} color="#ADB5BD" />
              <span>Aucun mouvement trouvé</span>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#ID</th>
                    <th>TYPE</th>
                    <th>PRODUIT</th>
                    <th>DE → VERS</th>
                    <th>QTÉ</th>
                    <th>STATUT</th>
                    <th>PAR</th>
                    <th>DATE</th>
                    {canCancel && <th>ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {mouvements.map(m => {
                    const tc = TYPE_CFG[m.type_mouvement] || TYPE_CFG.entree
                    const sc = STATUT_CFG[m.statut]       || STATUT_CFG.en_attente

                    // Utilise les champs typés en priorité (source_depot_nom/source_magasin_nom)
                    const sourceNom  = m.source_magasin_nom  || m.source_depot_nom  || m.entrepot_source_nom || (m.entrepot_source_id ? `#${m.entrepot_source_id}` : null)
                    const destNom    = m.destination_magasin_nom || m.destination_depot_nom || m.entrepot_dest_nom || (m.entrepot_dest_id ? `#${m.entrepot_dest_id}` : null)
                    const sourceType = m.source_type
                    const destType   = m.destination_type

                    const route = m.type_mouvement === 'entree'
                      ? <span className="text-muted">— → <LocBadge type={destType} /><strong>{destNom || '—'}</strong></span>
                      : m.type_mouvement === 'sortie'
                      ? <span className="text-muted"><LocBadge type={sourceType} /><strong>{sourceNom || '—'}</strong> → —</span>
                      : <span className="text-muted"><LocBadge type={sourceType} /><strong>{sourceNom || '—'}</strong> → <LocBadge type={destType} /><strong>{destNom || '—'}</strong></span>

                    return (
                      <tr key={m.id}>
                        <td className="td-id">#{m.id}</td>
                        <td><span className={`badge ${tc.badgeClass}`}>{tc.label}</span></td>
                        <td className="td-name">{m.produit_nom || `Produit #${m.produit_id}`}</td>
                        <td style={{ fontSize: 12 }}>{route}</td>
                        <td style={{ fontWeight: 700, color: tc.signColor }}>
                          {tc.sign}{m.quantite}
                        </td>
                        <td><span className={`badge ${sc.badgeClass}`}>{sc.label}</span></td>
                        <td className="td-muted">{m.utilisateur_nom || '—'}</td>
                        <td className="td-date">{fmtDate(m.created_at)}</td>
                        {canCancel && (
                          <td>
                            {m.statut !== 'annule' && (
                              <button
                                onClick={() => handleCancel(m.id)}
                                title="Annuler ce mouvement"
                                className="act-btn del"
                                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}
                              >
                                <X size={12} /> Annuler
                              </button>
                            )}
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
              <span style={{ fontSize: 13, color: '#6B7280' }}>
                {page} / {totalPages}
              </span>
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

        {/* ── Modal ── */}
        {modal?.type === 'create' && (
          <CreateModal
            onClose={() => setModal(null)}
            onCreated={handleCreated}
          />
        )}

        {/* ── Toast ── */}
        <Toast toast={toast} />
      </div>
    </DashboardLayout>
  )
}
