import React, { useState, useEffect } from 'react'
import { Package, Plus, Pencil, Trash2, Loader, X, Check, AlertTriangle, Search } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getProduits, createProduit, updateProduit, deleteProduit, getStocks, verifierExpirations, getFournisseurs, getFournisseurProduits } from '../../services/api'
import './common.css'

// ── Helpers dates ──────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dateStatus(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.ceil((d - today) / 86400000)
  if (diff < 0)  return { label: `Expiré (${fmtDate(dateStr)})`,      color: '#DC3545', bg: '#FEF2F2' }
  if (diff === 0) return { label: `Expire aujourd'hui`,                 color: '#DC3545', bg: '#FEF2F2' }
  if (diff <= 7)  return { label: `${fmtDate(dateStr)} (${diff}j)`,    color: '#DC3545', bg: '#FFF0F0' }
  if (diff <= 30) return { label: `${fmtDate(dateStr)} (${diff}j)`,    color: '#E8730A', bg: '#FFF7ED' }
  return               { label: fmtDate(dateStr),                       color: '#28A745', bg: '#F0FDF4' }
}

// ── Badge marge ─────────────────────────────────────────────
function BadgeMarge({ marge, type_produit, avertissement }) {
  if (marge == null) return null
  const ok = type_produit === 'NON_CONSOMMABLE' ? (marge >= 25 && marge <= 80) : (marge >= 5 && marge <= 25)
  const color = ok ? '#16a34a' : '#d97706'
  return (
    <span title={avertissement || ''} style={{
      background: color + '18', color, borderRadius: 6,
      padding: '2px 8px', fontSize: 12, fontWeight: 700,
      cursor: avertissement ? 'help' : 'default',
    }}>
      {marge.toFixed(1)}% 
    </span>
  )
}

// ── Modal Créer / Modifier ──────────────────────────────────
function ProduitModal({ mode, initial, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    reference:            initial?.reference            || '',
    designation:          initial?.designation          || '',
    categorie:            initial?.categorie            || '',
    unite_mesure:         initial?.unite_mesure         || 'unite',
    prix_unitaire:        initial?.prix_unitaire        ?? '',
    prix_achat:           initial?.prix_achat           ?? '',
    prix_vente:           initial?.prix_vente           ?? '',
    type_produit:         initial?.type_produit         || 'CONSOMMABLE',
    pattern_vente:        initial?.pattern_vente        || '',
    mois_debut_vente:     initial?.mois_debut_vente     ?? '',
    mois_fin_vente:       initial?.mois_fin_vente       ?? '',
    jours_pour_vendre:    initial?.jours_pour_vendre    ?? '',
    meilleur_moment_achat:initial?.meilleur_moment_achat|| '',
    seuil_alerte_min:     initial?.seuil_alerte_min     ?? '',
    seuil_alerte_max:     initial?.seuil_alerte_max     ?? '',
    date_fabrication:     initial?.date_fabrication     || '',
    date_expiration:      initial?.date_expiration      || '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  // Calcul marge en temps réel
  const margePreview = (form.prix_achat !== '' && form.prix_vente !== '' && Number(form.prix_achat) > 0)
    ? (((Number(form.prix_vente) - Number(form.prix_achat)) / Number(form.prix_achat)) * 100).toFixed(1)
    : null

  const margeOk = margePreview != null && (
    form.type_produit === 'NON_CONSOMMABLE'
      ? (margePreview >= 25 && margePreview <= 80)
      : (margePreview >= 5  && margePreview <= 25)
  )

  const saisonnel = form.pattern_vente === 'SAISONNIER' || form.pattern_vente === 'OCCASIONNEL'

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        designation:           form.designation,
        categorie:             form.categorie             || undefined,
        unite_mesure:          form.unite_mesure          || 'unite',
        prix_unitaire:         form.prix_unitaire         !== '' ? Number(form.prix_unitaire)    : undefined,
        prix_achat:            form.prix_achat            !== '' ? Number(form.prix_achat)        : undefined,
        prix_vente:            form.prix_vente            !== '' ? Number(form.prix_vente)        : undefined,
        type_produit:          form.type_produit          || 'CONSOMMABLE',
        pattern_vente:         form.pattern_vente         || undefined,
        mois_debut_vente:      form.mois_debut_vente      !== '' ? Number(form.mois_debut_vente)  : undefined,
        mois_fin_vente:        form.mois_fin_vente        !== '' ? Number(form.mois_fin_vente)    : undefined,
        jours_pour_vendre:     form.jours_pour_vendre     !== '' ? Number(form.jours_pour_vendre) : undefined,
        meilleur_moment_achat: form.meilleur_moment_achat || undefined,
        seuil_alerte_min:      form.seuil_alerte_min      !== '' ? Number(form.seuil_alerte_min)  : undefined,
        seuil_alerte_max:      form.seuil_alerte_max      !== '' ? Number(form.seuil_alerte_max)  : undefined,
        date_fabrication:      form.date_fabrication      || undefined,
        date_expiration:       form.date_expiration       || undefined,
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
              <label>Prix unitaire (TND)</label>
              <input type="number" min="0" step="0.01" value={form.prix_unitaire}
                onChange={e => set('prix_unitaire', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Seuil alerte min</label>
              <input type="number" min="0" value={form.seuil_alerte_min}
                onChange={e => set('seuil_alerte_min', e.target.value)} placeholder="Ex: 10" />
            </div>
            <div className="form-group">
              <label>Seuil alerte max</label>
              <input type="number" min="0" value={form.seuil_alerte_max}
                onChange={e => set('seuil_alerte_max', e.target.value)} placeholder="Ex: 500" />
            </div>
          </div>

          {/* ── Classification & Prix ── */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
              Classification & Marge
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type de produit</label>
                <select value={form.type_produit} onChange={e => set('type_produit', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                  <option value="CONSOMMABLE">Consommable (marge 5-25%)</option>
                  <option value="NON_CONSOMMABLE">Non consommable (marge 25-80%)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Pattern de vente</label>
                <select value={form.pattern_vente} onChange={e => set('pattern_vente', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                  <option value="">— Non défini —</option>
                  <option value="REGULIER">Régulier (toute l'année)</option>
                  <option value="SAISONNIER">Saisonnier</option>
                  <option value="OCCASIONNEL">Occasionnel (événement)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prix d'achat (TND)</label>
                <input type="number" min="0" step="0.01" value={form.prix_achat}
                  onChange={e => set('prix_achat', e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Prix de vente (TND)</label>
                <input type="number" min="0" step="0.01" value={form.prix_vente}
                  onChange={e => set('prix_vente', e.target.value)} placeholder="0.00" />
              </div>
            </div>
            {margePreview != null && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: margeOk ? '#f0fdf4' : '#fffbeb',
                color: margeOk ? '#16a34a' : '#d97706',
                border: `1px solid ${margeOk ? '#bbf7d0' : '#fde68a'}`,
              }}>
                {margeOk ? '' : '!'} Marge calculée : {margePreview}%
                {!margeOk && (
                  <span style={{ marginLeft: 8, fontWeight: 400 }}>
                    (plage recommandée : {form.type_produit === 'NON_CONSOMMABLE' ? '25-80%' : '5-25%'})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Champs saisonnier/occasionnel ── */}
          {saisonnel && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                Période de vente
              </div>
              <div className="form-row3">
                <div className="form-group">
                  <label>Mois début vente</label>
                  <select value={form.mois_debut_vente} onChange={e => set('mois_debut_vente', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                    <option value="">—</option>
                    {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                      .map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Mois fin vente</label>
                  <select value={form.mois_fin_vente} onChange={e => set('mois_fin_vente', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                    <option value="">—</option>
                    {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                      .map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Jours pour vendre</label>
                  <input type="number" min="1" value={form.jours_pour_vendre}
                    onChange={e => set('jours_pour_vendre', e.target.value)} placeholder="Ex: 30" />
                </div>
              </div>
              <div className="form-group">
                <label>Meilleur moment d'achat</label>
                <input value={form.meilleur_moment_achat}
                  onChange={e => set('meilleur_moment_achat', e.target.value)}
                  placeholder="Ex: 2 mois avant Ramadan" />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Date de fabrication</label>
              <input type="date" value={form.date_fabrication}
                onChange={e => set('date_fabrication', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date d'expiration</label>
              <input type="date" value={form.date_expiration}
                onChange={e => set('date_expiration', e.target.value)} />
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

  const [produits,      setProduits]      = useState([])
  const [qteProduit,    setQteProduit]    = useState({})
  const [fournMap,      setFournMap]      = useState({})
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [search,        setSearch]        = useState('')
  const [filterCat,     setFilterCat]     = useState('')
  const [modal,         setModal]         = useState(null)
  const [toast,         setToast]         = useState(null)
  const [scanLoading,   setScanLoading]   = useState(false)
  const [pageSize,      setPageSize]      = useState(10)
  const [page,          setPage]          = useState(1)
  const [expandedIds,   setExpandedIds]   = useState(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [prodData, stockData, fournData] = await Promise.allSettled([getProduits(), getStocks(), getFournisseurs()])
      const prods = prodData.status === 'fulfilled' && Array.isArray(prodData.value) ? prodData.value : []
      setProduits(prods)

      if (stockData.status === 'fulfilled') {
        const stocks = Array.isArray(stockData.value) ? stockData.value : []
        const qteMap = {}
        stocks.forEach(s => { qteMap[s.produit_id] = (qteMap[s.produit_id] || 0) + (s.quantite || 0) })
        setQteProduit(qteMap)
      }

      if (fournData.status === 'fulfilled') {
        const raw = fournData.value
        const fourns = Array.isArray(raw) ? raw : (Array.isArray(raw?.fournisseurs) ? raw.fournisseurs : [])
        const liaisonsAll = await Promise.allSettled(fourns.map(f => getFournisseurProduits(f.id).then(ps => ({ fournNom: f.nom, ps }))))
        const map = {}
        liaisonsAll.forEach(r => {
          if (r.status === 'fulfilled') {
            const { fournNom, ps } = r.value
            ;(Array.isArray(ps) ? ps : []).forEach(p => { if (!map[p.produit_id]) map[p.produit_id] = fournNom })
          }
        })
        setFournMap(map)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }

    // Scanner automatiquement les expirations à chaque chargement
    try {
      await verifierExpirations(30)
    } catch (_) {}
  }

  async function handleScanExpirations() {
    setScanLoading(true)
    try {
      const res = await verifierExpirations(30)
      const nb  = res?.alertes_declenchees ?? 0
      showToast(
        nb > 0
          ? `${nb} nouvelle(s) alerte(s) d'expiration déclenchée(s) — emails envoyés.`
          : `Scan terminé — aucune nouvelle alerte d'expiration (déjà alerté ou aucun produit proche).`,
        nb > 0
      )
    } catch (err) {
      showToast('Erreur lors du scan : ' + err.message, false)
    } finally {
      setScanLoading(false)
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

  // ── Pagination ───────────────────────────────────────────────
  const totalPages  = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize)
  const currentPage = Math.min(page, totalPages || 1)
  const paginated   = pageSize === 0 ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
          <div className="page-hdr-actions">
            <button
              className="btn-ghost"
              onClick={handleScanExpirations}
              disabled={scanLoading}
              title="Scanner tous les produits et déclencher les alertes d'expiration proche"
              style={{ color: '#E8730A', borderColor: '#E8730A' }}
            >
              {scanLoading ? <><Loader size={14} className="spin" /> Scan…</> : 'Scanner expirations'}
            </button>
            {canWrite && (
              <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
                <Plus size={15} /> Nouveau produit
              </button>
            )}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={15} className="toolbar-search-icon" />
            <input
              placeholder="Rechercher par référence, désignation, catégorie…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {search && (
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => { setSearch(''); setPage(1) }}>
              <X size={14} />
            </button>
          )}

          {categories.length > 0 && (
            <>
              <div className="toolbar-sep" />
              <select
                value={filterCat}
                onChange={e => { setFilterCat(e.target.value); setPage(1) }}
              >
                <option value="">Toutes catégories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </>
          )}

          <div className="toolbar-sep" />
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            style={{ fontSize: 13 }}
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={0}>Tout afficher</option>
          </select>
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
                    <th style={{ width: 36 }}></th>
                    <th>#</th>
                    <th>RÉFÉRENCE</th>
                    <th>DÉSIGNATION</th>
                    <th>CATÉGORIE</th>
                    <th>UNITÉ</th>
                    <th>PRIX/U</th>
                    <th>FOURNISSEUR</th>
                    <th>MARGE</th>
                    <th>QUANTITÉ</th>
                    <th>SEUIL MIN</th>
                    <th>SEUIL MAX</th>
                    <th>DATE FABR.</th>
                    <th>DATE EXP.</th>
                    <th>STATUT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(p => {
                    const qte      = qteProduit[p.id] ?? null
                    const expSt    = dateStatus(p.date_expiration)
                    const fabSt    = p.date_fabrication ? { label: fmtDate(p.date_fabrication), color: '#6B7280', bg: null } : null
                    const isLow    = qte !== null && qte <= (p.seuil_alerte_min ?? 0)
                    const expanded = expandedIds.has(p.id)
                    const toggle   = () => setExpandedIds(prev => {
                      const next = new Set(prev)
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                      return next
                    })
                    return (
                      <React.Fragment key={p.id}>
                      <tr style={{ background: expanded ? '#f0f5ff' : undefined }}>
                        <td style={{ textAlign: 'center', paddingLeft: 8 }}>
                          <input
                            type="checkbox"
                            checked={expanded}
                            onChange={toggle}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0A4B78' }}
                          />
                        </td>
                        <td className="td-id">#{p.id}</td>
                        <td><span className="badge badge-teal">{p.reference}</span></td>
                        <td className="td-name">{p.designation}</td>
                        <td className="text-muted">{p.categorie || '—'}</td>
                        <td className="text-muted">{p.unite_mesure || '—'}</td>
                        <td className="text-navy">
                          {p.prix_unitaire != null
                            ? `${Number(p.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`
                            : '—'}
                        </td>
                        <td className="text-muted" style={{ fontSize: 12 }}>
                          {fournMap[p.id]
                            ? <span style={{ background: '#EFF6FF', color: '#1D4ED8', borderRadius: 6, padding: '2px 7px', fontWeight: 600, fontSize: 11 }}>{fournMap[p.id]}</span>
                            : <span style={{ color: '#9CA3AF' }}>—</span>}
                        </td>
                        <td><BadgeMarge marge={p.marge_calculee} type_produit={p.type_produit} avertissement={p.avertissement_marge} /></td>
                        <td style={{ fontWeight: 700, color: isLow ? '#DC3545' : '#1E1B4B' }}>
                          {qte !== null ? qte.toLocaleString('fr-FR') : '—'}
                          {isLow && <span style={{ fontSize: 10, marginLeft: 4, color: '#DC3545', fontWeight: 700 }}>!</span>}
                        </td>
                        <td className="text-muted">{p.seuil_alerte_min ?? '—'}</td>
                        <td className="text-muted">{p.seuil_alerte_max ?? '—'}</td>
                        <td style={{ fontSize: 12, color: fabSt?.color || '#9CA3AF' }}>
                          {fabSt?.label || '—'}
                        </td>
                        <td>
                          {expSt
                            ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: expSt.bg, color: expSt.color }}>{expSt.label}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${p.est_actif ? 'badge-green' : 'badge-gray'}`}>
                            {p.est_actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <div className="act-btn-row">
                            {canWrite && (
                              <button className="act-btn edit" title="Modifier" onClick={() => setModal({ type: 'edit', item: p })}>
                                <Pencil size={14} />
                              </button>
                            )}
                            {isAdmin && (
                              <button className="act-btn del" title="Supprimer" onClick={() => setModal({ type: 'delete', item: p })}>
                                <Trash2 size={14} />
                              </button>
                            )}
                            {!canWrite && <span className="text-light" style={{ fontSize: 12 }}>—</span>}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`detail-${p.id}`} style={{ background: '#f8fafc' }}>
                          <td colSpan={16} style={{ padding: '12px 24px', borderBottom: '2px solid #c7d2fe' }}>
                            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 13 }}>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0A4B78', marginBottom: 6 }}>Prix</div>
                                <div>Prix achat : <b>{p.prix_achat != null ? `${Number(p.prix_achat).toFixed(2)} MAD` : '—'}</b></div>
                                <div>Prix vente : <b>{p.prix_vente  != null ? `${Number(p.prix_vente).toFixed(2)} MAD`  : '—'}</b></div>
                                <div>Prix unitaire : <b>{p.prix_unitaire != null ? `${Number(p.prix_unitaire).toFixed(2)} MAD` : '—'}</b></div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0A4B78', marginBottom: 6 }}>Type & vente</div>
                                <div>Type : <b>{p.type_produit || '—'}</b></div>
                                <div>Pattern : <b>{p.pattern_vente || '—'}</b></div>
                                <div>Meilleur moment achat : <b>{p.meilleur_moment_achat || '—'}</b></div>
                              </div>
                              {(p.mois_debut_vente || p.mois_fin_vente || p.jours_pour_vendre) && (
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0A4B78', marginBottom: 6 }}>Saisonnalité</div>
                                  <div>Début vente : <b>{p.mois_debut_vente ?? '—'}</b></div>
                                  <div>Fin vente : <b>{p.mois_fin_vente ?? '—'}</b></div>
                                  <div>Jours pour vendre : <b>{p.jours_pour_vendre ?? '—'}</b></div>
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 700, color: '#0A4B78', marginBottom: 6 }}>Alertes stock</div>
                                <div>Seuil min : <b>{p.seuil_alerte_min ?? '—'}</b></div>
                                <div>Seuil max : <b>{p.seuil_alerte_max ?? '—'}</b></div>
                                <div>Stock actuel : <b style={{ color: isLow ? '#DC3545' : '#16a34a' }}>{qte ?? '—'}{isLow ? ' — Bas' : ''}</b></div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0A4B78', marginBottom: 6 }}>Infos</div>
                                <div>Fournisseur : <b>{fournMap[p.id] || '—'}</b></div>
                                <div>Statut : <b style={{ color: p.est_actif ? '#16a34a' : '#6b7280' }}>{p.est_actif ? 'Actif' : 'Inactif'}</b></div>
                                {p.avertissement_marge && <div style={{ color: '#d97706' }}>{p.avertissement_marge}</div>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && !error && pageSize > 0 && totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderTop: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280',
            }}>
              <span>
                Page {currentPage} / {totalPages} — {filtered.length} produit{filtered.length > 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#d1d5db' : '#374151' }}
                >«</button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#d1d5db' : '#374151' }}
                >‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                  const p = start + i
                  return p <= totalPages ? (
                    <button key={p} onClick={() => setPage(p)} style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
                      background: p === currentPage ? '#0A4B78' : '#fff',
                      color: p === currentPage ? '#fff' : '#374151',
                      fontWeight: p === currentPage ? 700 : 400, cursor: 'pointer',
                    }}>{p}</button>
                  ) : null
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#d1d5db' : '#374151' }}
                >›</button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#d1d5db' : '#374151' }}
                >»</button>
              </div>
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
