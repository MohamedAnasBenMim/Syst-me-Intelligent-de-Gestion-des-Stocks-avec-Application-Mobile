import { useState, useEffect } from 'react'
import { Truck, Plus, Pencil, Trash2, Loader, X, Star, Package, ChevronDown, ChevronUp } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur,
  getFournisseurProduits, performanceFournisseurs,
  lierProduitFournisseur, delierProduitFournisseur, getProduits,
} from '../../services/api'
import './common.css'

// ── Note étoiles ────────────────────────────────────────────
function Etoiles({ note }) {
  if (note == null) return <span style={{ color: '#9ca3af' }}>—</span>
  return (
    <span style={{ color: '#f59e0b', display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} fill={i <= Math.round(note) ? '#f59e0b' : 'none'} />
      ))}
      <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 4 }}>{note.toFixed(1)}</span>
    </span>
  )
}

// ── Badge délai ─────────────────────────────────────────────
function BadgeDelai({ jours }) {
  if (jours == null) return <span style={{ color: '#9ca3af' }}>—</span>
  const color = jours <= 3 ? '#16a34a' : jours <= 7 ? '#d97706' : '#dc2626'
  return (
    <span style={{
      background: color + '20', color, borderRadius: 6,
      padding: '2px 8px', fontSize: 12, fontWeight: 600,
    }}>
      {jours}j
    </span>
  )
}

// ── Modal Créer / Modifier ───────────────────────────────────
function FournisseurModal({ mode, initial, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState({
    nom:                   initial?.nom                   || '',
    contact_personne:      initial?.contact_personne      || '',
    telephone:             initial?.telephone             || '',
    email:                 initial?.email                 || '',
    adresse:               initial?.adresse               || '',
    conditions_paiement:   initial?.conditions_paiement   || '',
    delai_livraison_jours: initial?.delai_livraison_jours ?? '',
    note:                  initial?.note                  ?? '',
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
        nom:                   form.nom,
        contact_personne:      form.contact_personne   || null,
        telephone:             form.telephone          || null,
        email:                 form.email              || null,
        adresse:               form.adresse            || null,
        conditions_paiement:   form.conditions_paiement|| null,
        delai_livraison_jours: form.delai_livraison_jours !== '' ? Number(form.delai_livraison_jours) : null,
        note:                  form.note !== '' ? Number(form.note) : null,
      }
      if (isCreate) await createFournisseur(payload)
      else          await updateFournisseur(initial.id, payload)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 600, color: '#374151' }
  const fieldStyle = { marginBottom: 16 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, width: '100%',
        maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {isCreate ? 'Nouveau fournisseur' : 'Modifier le fournisseur'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Nom du fournisseur *</label>
            <input style={inputStyle} value={form.nom} required onChange={e => set('nom', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Contact</label>
              <input style={inputStyle} value={form.contact_personne} onChange={e => set('contact_personne', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input style={inputStyle} value={form.telephone} onChange={e => set('telephone', e.target.value)} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Adresse</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              value={form.adresse} onChange={e => set('adresse', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Délai livraison (jours)</label>
              <input style={inputStyle} type="number" min="0" value={form.delai_livraison_jours}
                onChange={e => set('delai_livraison_jours', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Note (0-5)</label>
              <input style={inputStyle} type="number" min="0" max="5" step="0.1" value={form.note}
                onChange={e => set('note', e.target.value)} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Conditions de paiement</label>
            <input style={inputStyle} value={form.conditions_paiement}
              onChange={e => set('conditions_paiement', e.target.value)}
              placeholder="ex: 30 jours fin de mois" />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#0A4B78', color: '#fff', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {loading ? <Loader size={16} className="spin" /> : null}
              {isCreate ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Ligne détail fournisseur (produits liés + IA) ────────────
function FournisseurDetail({ fournisseur, token }) {
  const [produits,      setProduits]      = useState(null)
  const [allProduits,   setAllProduits]   = useState([])
  const [showLierForm,  setShowLierForm]  = useState(false)
  const [linkProduitId, setLinkProduitId] = useState('')
  const [linkPrix,      setLinkPrix]      = useState('')
  const [linkLoading,   setLinkLoading]   = useState(false)
  const [linkError,     setLinkError]     = useState(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaResult,  setIaResult]  = useState(null)

  useEffect(() => {
    getFournisseurProduits(fournisseur.id)
      .then(data => setProduits(Array.isArray(data) ? data : []))
      .catch(() => setProduits([]))
    getProduits()
      .then(data => setAllProduits(Array.isArray(data) ? data : data?.produits || []))
      .catch(() => setAllProduits([]))
  }, [fournisseur.id])

  async function handleLier(e) {
    e.preventDefault()
    if (!linkProduitId) return
    setLinkLoading(true)
    setLinkError(null)
    try {
      await lierProduitFournisseur(fournisseur.id, {
        produit_id: Number(linkProduitId),
        prix_achat: linkPrix !== '' ? Number(linkPrix) : undefined,
      })
      const updated = await getFournisseurProduits(fournisseur.id)
      setProduits(Array.isArray(updated) ? updated : [])
      setShowLierForm(false)
      setLinkProduitId('')
      setLinkPrix('')
    } catch (err) {
      setLinkError(err?.message || 'Erreur lors du liage.')
    } finally {
      setLinkLoading(false)
    }
  }

  async function handleDelier(produitId) {
    if (!window.confirm('Délier ce produit du fournisseur ?')) return
    try {
      await delierProduitFournisseur(fournisseur.id, produitId)
      setProduits(prev => prev.filter(p => p.produit_id !== produitId))
    } catch (err) {
      alert(err?.message || 'Erreur lors du déliage.')
    }
  }

  async function analyserIA() {
    setIaLoading(true)
    setIaResult(null)
    try {
      const r = await performanceFournisseurs()
      if (!r || typeof r !== 'object') throw new Error('Réponse invalide')
      const item = r.classement?.find(c =>
        c.nom?.toLowerCase().trim() === fournisseur.nom?.toLowerCase().trim()
      )
      if (item) {
        setIaResult(item)
      } else if (r.classement?.length > 0) {
        // Fournisseur non trouvé dans le classement — afficher la synthèse globale
        setIaResult({ synthese: r.synthese, recommandation_globale: r.recommandation_globale })
      } else {
        setIaResult(r)
      }
    } catch (err) {
      setIaResult({ error: err?.message || 'Analyse IA indisponible' })
    } finally {
      setIaLoading(false)
    }
  }

  return (
    <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Produits liés */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Package size={14} />Produits liés ({produits?.length ?? '…'})
            </div>
            <button
              onClick={() => { setShowLierForm(v => !v); setLinkError(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 6, border: '1px solid #0A4B78',
                background: showLierForm ? '#0A4B78' : '#fff',
                color: showLierForm ? '#fff' : '#0A4B78',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={11} /> Lier un produit
            </button>
          </div>

          {showLierForm && (
            <form onSubmit={handleLier} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              {linkError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 6 }}>{linkError}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Produit *</div>
                  <select
                    value={linkProduitId}
                    onChange={e => setLinkProduitId(e.target.value)}
                    required
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, minWidth: 160 }}
                  >
                    <option value="">Sélectionner…</option>
                    {allProduits.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.designation}{p.reference ? ` [${p.reference}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Prix achat (TND)</div>
                  <input
                    type="number" min="0" step="0.01" value={linkPrix}
                    onChange={e => setLinkPrix(e.target.value)}
                    placeholder="Optionnel"
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, width: 100 }}
                  />
                </div>
                <button type="submit" disabled={linkLoading || !linkProduitId} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: '#0A4B78', color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: linkLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {linkLoading ? <Loader size={11} className="spin" /> : <Plus size={11} />}
                  Lier
                </button>
                <button type="button" onClick={() => setShowLierForm(false)} style={{
                  padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb',
                  background: '#fff', fontSize: 12, cursor: 'pointer',
                }}>
                  <X size={11} />
                </button>
              </div>
            </form>
          )}

          {produits === null
            ? <Loader size={14} className="spin" />
            : produits.length === 0
            ? <span style={{ color: '#9ca3af', fontSize: 13 }}>Aucun produit lié</span>
            : produits.map(p => (
              <div key={p.produit_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#4b5563', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>
                  • {p.designation} <span style={{ color: '#9ca3af' }}>({p.reference})</span>
                  {p.prix_achat && <span style={{ color: '#0A4B78', marginLeft: 8 }}>{p.prix_achat} TND</span>}
                </span>
                <button
                  onClick={() => handleDelier(p.produit_id)}
                  title="Délier ce produit"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={13} />
                </button>
              </div>
            ))
          }
        </div>

        {/* Analyse IA */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <button onClick={analyserIA} disabled={iaLoading} style={{
            padding: '7px 14px', borderRadius: 8, border: '1px solid #0A4B78',
            background: iaLoading ? '#f0f5ff' : '#fff', color: '#0A4B78',
            cursor: iaLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          }}>
            {iaLoading ? <Loader size={13} className="spin" /> : 'IA'}
            {iaLoading ? 'Analyse en cours…' : 'Analyser avec l\'IA'}
          </button>

          {/* Note : manuelle vs IA */}
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, fontStyle: 'italic' }}>
            Note /5 = saisie manuelle · Score /10 = calculé par l'IA
          </div>

          {iaResult && !iaResult.error && (
            <div style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Score IA */}
              {iaResult.score != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>Score IA :</span>
                  <span style={{
                    background: iaResult.score >= 7 ? '#f0fdf4' : iaResult.score >= 5 ? '#fefce8' : '#fef2f2',
                    color:      iaResult.score >= 7 ? '#16a34a' : iaResult.score >= 5 ? '#d97706' : '#dc2626',
                    fontWeight: 800, fontSize: 15, padding: '1px 10px', borderRadius: 6,
                  }}>{iaResult.score}/10</span>
                </div>
              )}
              {/* Points forts */}
              {iaResult.points_forts?.length > 0 && (
                <div>
                  {iaResult.points_forts.map((p, i) => (
                    <div key={i} style={{ color: '#16a34a', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, color: '#16a34a', fontWeight: 700 }}>+</span><span>{p}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Points faibles */}
              {iaResult.points_faibles?.length > 0 && (
                <div>
                  {iaResult.points_faibles.map((p, i) => (
                    <div key={i} style={{ color: '#dc2626', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, color: '#dc2626', fontWeight: 700 }}>-</span><span>{p}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Synthèse globale */}
              {(iaResult.synthese || iaResult.recommandation_globale) && (
                <div style={{ background: '#f0f9ff', borderRadius: 6, padding: '6px 10px', color: '#0369a1', fontSize: 12, marginTop: 2 }}>
                  {iaResult.synthese || iaResult.recommandation_globale}
                </div>
              )}
            </div>
          )}
          {iaResult?.error && (
            <div style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', borderRadius: 6, padding: '6px 10px' }}>
              {iaResult.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────
export default function Fournisseurs() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'
  const canEdit  = user?.role === 'admin' || user?.role === 'gestionnaire'

  const [fournisseurs, setFournisseurs] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [modal,        setModal]        = useState(null)   // null | { mode, item? }
  const [expanded,     setExpanded]     = useState(null)   // id du fournisseur développé

  async function load() {
    setLoading(true)
    try {
      const data = await getFournisseurs({ actifs_seulement: true, limit: 200 })
      setFournisseurs(data.fournisseurs || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(f) {
    if (!window.confirm(`Désactiver le fournisseur "${f.nom}" ?`)) return
    try {
      await deleteFournisseur(f.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  // Statistiques rapides
  const avgDelai  = fournisseurs.length
    ? (fournisseurs.filter(f => f.delai_livraison_jours != null)
        .reduce((a, f) => a + f.delai_livraison_jours, 0) /
       (fournisseurs.filter(f => f.delai_livraison_jours != null).length || 1)).toFixed(1)
    : '—'
  const avgNote = fournisseurs.length
    ? (fournisseurs.filter(f => f.note != null)
        .reduce((a, f) => a + f.note, 0) /
       (fournisseurs.filter(f => f.note != null).length || 1)).toFixed(1)
    : '—'

  return (
    <DashboardLayout>
      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <Truck size={26} color="#0A4B78" />
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0A4B78' }}>Fournisseurs</h1>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
              {fournisseurs.length} fournisseur{fournisseurs.length !== 1 ? 's' : ''} actif{fournisseurs.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canEdit && (
            <button onClick={() => setModal({ mode: 'create' })} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', borderRadius: 10, border: 'none',
              background: '#0A4B78', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
            }}>
              <Plus size={18} /> Nouveau fournisseur
            </button>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Fournisseurs actifs', value: fournisseurs.length, color: '#0A4B78' },
            { label: 'Délai moyen livraison', value: avgDelai !== '—' ? `${avgDelai}j` : '—', color: '#d97706' },
            { label: 'Note moyenne', value: avgNote !== '—' ? `${avgNote}/5` : '—', color: '#16a34a' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: '#fff', borderRadius: 12, padding: '18px 20px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0',
            }}>
              <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{kpi.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Tableau */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader size={28} className="spin" color="#0A4B78" />
          </div>
        ) : error ? (
          <div style={{ background: '#fef2f2', borderRadius: 10, padding: 20, color: '#dc2626' }}>{error}</div>
        ) : fournisseurs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <Truck size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>Aucun fournisseur. Créez-en un avec le bouton ci-dessus.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  {['Nom', 'Contact', 'Téléphone', 'Délai livraison', 'Note', 'Produits', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fournisseurs.map(f => (
                  <>
                    <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                      onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#1f2937' }}>{f.nom}</div>
                        {f.conditions_paiement && (
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{f.conditions_paiement}</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#4b5563', fontSize: 14 }}>{f.contact_personne || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#4b5563', fontSize: 14 }}>{f.telephone || '—'}</td>
                      <td style={{ padding: '14px 16px' }}><BadgeDelai jours={f.delai_livraison_jours} /></td>
                      <td style={{ padding: '14px 16px' }}><Etoiles note={f.note} /></td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: '#eff6ff', color: '#0A4B78', borderRadius: 6,
                          padding: '2px 8px', fontSize: 12, fontWeight: 600,
                        }}>
                          {f.nb_produits ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          {canEdit && (
                            <button onClick={() => setModal({ mode: 'edit', item: f })} style={{
                              background: '#f0f9ff', border: 'none', borderRadius: 7, padding: '6px 10px',
                              cursor: 'pointer', color: '#0A4B78',
                            }}>
                              <Pencil size={14} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(f)} style={{
                              background: '#fef2f2', border: 'none', borderRadius: 7, padding: '6px 10px',
                              cursor: 'pointer', color: '#dc2626',
                            }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                          {expanded === f.id
                            ? <ChevronUp size={16} color="#6b7280" />
                            : <ChevronDown size={16} color="#6b7280" />}
                        </div>
                      </td>
                    </tr>
                    {expanded === f.id && (
                      <tr key={`detail-${f.id}`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <FournisseurDetail fournisseur={f} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <FournisseurModal
          mode={modal.mode}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </DashboardLayout>
  )
}
