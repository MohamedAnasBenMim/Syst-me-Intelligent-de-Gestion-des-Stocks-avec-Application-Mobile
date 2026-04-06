import { useState, useEffect } from 'react'
import { Package, Plus, Pencil, Trash2, Loader, X, Check, AlertTriangle, Search } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getProduits, createProduit, updateProduit, deleteProduit } from '../../services/api'
import './common.css'

// ── Modal Créer / Modifier ──────────────────────────────────
function ProduitModal({ mode, initial, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    reference:        initial?.reference        || '',
    designation:      initial?.designation      || '',
    categorie:        initial?.categorie        || '',
    unite_mesure:     initial?.unite_mesure     || 'unite',
    prix_unitaire:    initial?.prix_unitaire    ?? '',
    seuil_alerte_min: initial?.seuil_alerte_min ?? '',
    seuil_alerte_max: initial?.seuil_alerte_max ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        designation:      form.designation,
        categorie:        form.categorie        || undefined,
        unite_mesure:     form.unite_mesure     || 'unite',
        prix_unitaire:    form.prix_unitaire    !== '' ? Number(form.prix_unitaire)    : undefined,
        seuil_alerte_min: form.seuil_alerte_min !== '' ? Number(form.seuil_alerte_min) : undefined,
        seuil_alerte_max: form.seuil_alerte_max !== '' ? Number(form.seuil_alerte_max) : undefined,
      }
      if (isCreate) payload.reference = form.reference

      const saved = isCreate
        ? await createProduit(payload)
        : await updateProduit(initial.id, payload)
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
          <h2>{isCreate ? 'Nouveau produit' : 'Modifier le produit'}</h2>
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
              <label>Référence <span className="req">*</span></label>
              {isCreate ? (
                <input
                  value={form.reference}
                  onChange={e => set('reference', e.target.value)}
                  placeholder="Ex: PROD-001"
                  required
                  autoFocus
                />
              ) : (
                <input value={initial.reference} readOnly style={{ background: '#F4F4F5', color: '#6B7280' }} />
              )}
              {!isCreate && <span className="form-hint">La référence n'est pas modifiable.</span>}
            </div>
            <div className="form-group">
              <label>Désignation <span className="req">*</span></label>
              <input
                value={form.designation}
                onChange={e => set('designation', e.target.value)}
                placeholder="Nom du produit"
                required
                autoFocus={!isCreate}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Catégorie</label>
              <input
                value={form.categorie}
                onChange={e => set('categorie', e.target.value)}
                placeholder="Ex: Électronique, Alimentaire…"
              />
            </div>
            <div className="form-group">
              <label>Unité de mesure</label>
              <select value={form.unite_mesure} onChange={e => set('unite_mesure', e.target.value)}>
                <option value="unite">Unité</option>
                <option value="kg">Kilogramme (kg)</option>
                <option value="litre">Litre (L)</option>
                <option value="metre">Mètre (m)</option>
                <option value="boite">Boîte</option>
                <option value="palette">Palette</option>
                <option value="carton">Carton</option>
              </select>
            </div>
          </div>

          <div className="form-row3">
            <div className="form-group">
              <label>Prix unitaire (MAD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.prix_unitaire}
                onChange={e => set('prix_unitaire', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Seuil alerte min</label>
              <input
                type="number"
                min="0"
                value={form.seuil_alerte_min}
                onChange={e => set('seuil_alerte_min', e.target.value)}
                placeholder="Ex: 10"
              />
            </div>
            <div className="form-group">
              <label>Seuil alerte max</label>
              <input
                type="number"
                min="0"
                value={form.seuil_alerte_max}
                onChange={e => set('seuil_alerte_max', e.target.value)}
                placeholder="Ex: 500"
              />
            </div>
          </div>
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
function DeleteModal({ produit, onClose, onConfirm }) {
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
          <h2>Supprimer le produit</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="del-confirm">
            <div className="del-icon"><Trash2 size={26} color="#DC3545" /></div>
            <p>
              Voulez-vous vraiment supprimer <strong>{produit.designation}</strong> ?
            </p>
            <span>Référence : {produit.reference} — action irréversible.</span>
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
export default function Produits() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'
  const canWrite = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [produits,   setProduits]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [search,     setSearch]     = useState('')
  const [filterCat,  setFilterCat]  = useState('')
  const [modal,      setModal]      = useState(null)
  const [toast,      setToast]      = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getProduits()
      setProduits(Array.isArray(data) ? data : [])
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
      setProduits(prev => [saved, ...prev])
      showToast(`Produit « ${saved.designation} » créé avec succès.`)
    } else {
      setProduits(prev => prev.map(p => p.id === saved.id ? saved : p))
      showToast(`Produit « ${saved.designation} » mis à jour.`)
    }
    setModal(null)
  }

  async function handleDelete() {
    const target = modal.item
    try {
      await deleteProduit(target.id)
      setProduits(prev => prev.filter(p => p.id !== target.id))
      showToast(`Produit « ${target.designation} » supprimé.`)
    } catch (err) {
      showToast(err.message, false)
    } finally {
      setModal(null)
    }
  }

  // ── Catégories uniques extraites des produits ────────────────
  const categories = [...new Set(produits.map(p => p.categorie).filter(Boolean))].sort()

  // ── Filtre local ─────────────────────────────────────────────
  const filtered = produits.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = (
      p.reference?.toLowerCase().includes(q)   ||
      p.designation?.toLowerCase().includes(q) ||
      p.categorie?.toLowerCase().includes(q)
    )
    const matchCat = !filterCat || p.categorie === filterCat
    return matchSearch && matchCat
  })

  return (
    <DashboardLayout>
      <div className="page">

        {/* ── Header ── */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Package size={22} color="var(--teal)" />
            <div>
              <h1>Produits</h1>
              <p>
                {loading ? '…' : `${produits.length} produit${produits.length > 1 ? 's' : ''} enregistré${produits.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {canWrite && (
            <div className="page-hdr-actions">
              <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
                <Plus size={15} /> Nouveau produit
              </button>
            </div>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={15} className="toolbar-search-icon" />
            <input
              placeholder="Rechercher par référence, désignation, catégorie…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {search && (
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}

          {categories.length > 0 && (
            <>
              <div className="toolbar-sep" />
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
              >
                <option value="">Toutes catégories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* ── Table ── */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">Catalogue produits</span>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="state-loading">
              <Loader size={28} className="spin" />
              <span>Chargement des produits…</span>
            </div>
          ) : error ? (
            <div className="state-error">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="state-empty">
              <Package size={40} color="#ADB5BD" />
              <p>{search || filterCat ? 'Aucun produit ne correspond aux critères.' : 'Aucun produit enregistré.'}</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>RÉFÉRENCE</th>
                    <th>DÉSIGNATION</th>
                    <th>CATÉGORIE</th>
                    <th>UNITÉ</th>
                    <th>PRIX/U</th>
                    <th>SEUIL MIN</th>
                    <th>SEUIL MAX</th>
                    <th>STATUT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td className="td-id">#{p.id}</td>
                      <td>
                        <span className="badge badge-teal">{p.reference}</span>
                      </td>
                      <td className="td-name">{p.designation}</td>
                      <td className="text-muted">{p.categorie || '—'}</td>
                      <td className="text-muted">{p.unite_mesure || '—'}</td>
                      <td className="text-navy">
                        {p.prix_unitaire != null
                          ? `${Number(p.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`
                          : '—'
                        }
                      </td>
                      <td className="text-muted">{p.seuil_alerte_min ?? '—'}</td>
                      <td className="text-muted">{p.seuil_alerte_max ?? '—'}</td>
                      <td>
                        <span className={`badge ${p.est_actif ? 'badge-green' : 'badge-gray'}`}>
                          {p.est_actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div className="act-btn-row">
                          {canWrite && (
                            <button
                              className="act-btn edit"
                              title="Modifier"
                              onClick={() => setModal({ type: 'edit', item: p })}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="act-btn del"
                              title="Supprimer"
                              onClick={() => setModal({ type: 'delete', item: p })}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        {modal?.type === 'create' && (
          <ProduitModal
            mode="create"
            initial={null}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'edit' && (
          <ProduitModal
            mode="edit"
            initial={modal.item}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'delete' && (
          <DeleteModal
            produit={modal.item}
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
