import { useState, useEffect } from 'react'
import { ArrowRightLeft, ArrowRight, ArrowLeft, Loader, Check, AlertTriangle, ChevronRight } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { getDepots, getMagasins, getProduits, getStocks, createMouvement } from '../../services/api'
import './common.css'

const STEPS = ['Type', 'Détails', 'Confirmation']

function StepBar({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#28A745' : active ? '#6366F1' : '#E5E7EB',
                color: done || active ? '#fff' : '#9CA3AF',
                fontWeight: 700, fontSize: 14,
              }}>
                {done ? <Check size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#6366F1' : done ? '#28A745' : '#9CA3AF', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#28A745' : '#E5E7EB', margin: '0 8px', marginBottom: 20 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Transferts() {
  const [step,        setStep]        = useState(0)
  const [direction,   setDirection]   = useState(null)   // 'depot_to_magasin' | 'magasin_to_depot'
  const [depots,      setDepots]      = useState([])
  const [magasins,    setMagasins]    = useState([])
  const [produits,    setProduits]    = useState([])
  const [stocks,      setStocks]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState(null)

  const [form, setForm] = useState({
    depot_id: '', magasin_id: '', produit_id: '',
    quantite: '', reference: '', notes: '', motif: '',
  })
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  useEffect(() => {
    Promise.allSettled([
      getDepots({ actif_seulement: true }),
      getMagasins({ actif_seulement: true }),
      getProduits(),
      getStocks(),
    ]).then(([dep, mag, prod, stk]) => {
      setDepots(dep.status === 'fulfilled' ? (dep.value?.depots || []) : [])
      setMagasins(mag.status === 'fulfilled' ? (mag.value?.magasins || []) : [])
      setProduits(prod.status === 'fulfilled' && Array.isArray(prod.value) ? prod.value : [])
      setStocks(stk.status === 'fulfilled' && Array.isArray(stk.value) ? stk.value : [])
    }).finally(() => setLoading(false))
  }, [])

  const magasinsFiltres = magasins.filter(m => !form.depot_id || String(m.depot_id) === String(form.depot_id))

  function stockDisponible(locId, locType, produit_id) {
    if (!locId || !produit_id) return null
    const s = stocks.filter(s => {
      if (s.produit_id != produit_id) return false
      if (locType === 'DEPOT')    return s.depot_id   == locId || s.entrepot_id == locId
      if (locType === 'MAGASIN')  return s.magasin_id == locId || s.entrepot_id == locId
      return s.entrepot_id == locId
    })
    return s.reduce((a, s) => a + (s.quantite || 0), 0)
  }

  const sourceId   = direction === 'depot_to_magasin' ? form.depot_id   : form.magasin_id
  const sourceType = direction === 'depot_to_magasin' ? 'DEPOT'         : 'MAGASIN'
  const dispo      = stockDisponible(sourceId, sourceType, form.produit_id)
  const produit  = produits.find(p => String(p.id) === String(form.produit_id))
  const depot    = depots.find(d => String(d.id) === String(form.depot_id))
  const magasin  = magasins.find(m => String(m.id) === String(form.magasin_id))

  function step1Valid() { return !!direction }
  function step2Valid() {
    if (!form.depot_id || !form.magasin_id || !form.produit_id || !form.quantite) return false
    if (Number(form.quantite) <= 0) return false
    if (dispo !== null && Number(form.quantite) > dispo) return false
    return true
  }

  async function submit() {
    setSubmitting(true); setError(null)
    try {
      // Service-Mouvement gère le transfert ET crée l'historique en une seule opération
      const payload = {
        type_mouvement:    'transfert',
        produit_id:        Number(form.produit_id),
        quantite:          Number(form.quantite),
        entrepot_source_id: direction === 'depot_to_magasin' ? Number(form.depot_id)   : Number(form.magasin_id),
        source_type:        direction === 'depot_to_magasin' ? 'DEPOT'                 : 'MAGASIN',
        entrepot_dest_id:   direction === 'depot_to_magasin' ? Number(form.magasin_id) : Number(form.depot_id),
        destination_type:   direction === 'depot_to_magasin' ? 'MAGASIN'              : 'DEPOT',
        motif:     form.motif     || (direction === 'depot_to_magasin' ? 'Approvisionnement dépôt → magasin' : 'Retour magasin → dépôt'),
        reference: form.reference || undefined,
        note:      form.notes     || undefined,
      }
      const mvt = await createMouvement(payload)

      // Construire le résultat pour l'affichage
      setResult({
        success:          true,
        message:          mvt.entrepot_source_nom && mvt.entrepot_dest_nom
          ? `Transfert de ${form.quantite} unités : ${mvt.entrepot_source_nom} → ${mvt.entrepot_dest_nom}`
          : `Transfert de ${form.quantite} unités effectué avec succès`,
        quantite_depot:   null,
        quantite_magasin: null,
      })
      setStep(3)
    } catch (err) { setError(err.message || JSON.stringify(err)) }
    finally { setSubmitting(false) }
  }

  function reset() {
    setStep(0); setDirection(null)
    setForm({ depot_id: '', magasin_id: '', produit_id: '', quantite: '', reference: '', notes: '', motif: '' })
    setResult(null); setError(null)
  }

  if (loading) return (
    <DashboardLayout>
      <div className="page"><div className="state-loading"><Loader size={28} className="spin" /><span>Chargement…</span></div></div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="page">
        <div className="page-hdr">
          <div className="page-hdr-left">
            <ArrowRightLeft size={22} color="var(--teal)" />
            <div><h1>Transferts</h1><p>Approvisionner un magasin depuis un dépôt, ou effectuer un retour</p></div>
          </div>
        </div>

        <div className="data-card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="data-card-header"><span className="data-card-title">Nouveau transfert</span></div>
          <div style={{ padding: '24px 28px' }}>

            {step < 3 && <StepBar current={step} />}

            {/* ── Étape 0 : type ── */}
            {step === 0 && (
              <div>
                <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>Sélectionnez le sens du transfert :</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    { key: 'depot_to_magasin', icon: ArrowRight, title: 'Dépôt vers Magasin', desc: 'Approvisionner un magasin depuis son dépôt parent', color: '#6366F1' },
                    { key: 'magasin_to_depot', icon: ArrowLeft,  title: 'Magasin vers Dépôt',  desc: 'Retourner du stock au dépôt depuis un magasin',   color: '#E8730A' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setDirection(opt.key); setStep(1) }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                        padding: '24px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${direction === opt.key ? opt.color : '#E5E7EB'}`,
                        background: direction === opt.key ? opt.color + '10' : '#FAFAFA',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: opt.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <opt.icon size={22} color={opt.color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', marginBottom: 4 }}>{opt.title}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Étape 1 : détails ── */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: direction === 'depot_to_magasin' ? '#EEF2FF' : '#FFF7ED', fontSize: 13, fontWeight: 600, color: direction === 'depot_to_magasin' ? '#4338CA' : '#C2410C', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {direction === 'depot_to_magasin' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                  {direction === 'depot_to_magasin' ? 'Approvisionnement : Dépôt → Magasin' : 'Retour : Magasin → Dépôt'}
                </div>

                <div className="form-group">
                  <label>Dépôt <span className="req">*</span></label>
                  <select value={form.depot_id} onChange={e => { setF('depot_id', e.target.value); setF('magasin_id', '') }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                    <option value="">— Sélectionner un dépôt —</option>
                    {depots.map(d => <option key={d.id} value={d.id}>{d.nom} ({d.depot_type})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Magasin <span className="req">*</span></label>
                  <select value={form.magasin_id} onChange={e => setF('magasin_id', e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }} disabled={!form.depot_id}>
                    <option value="">— Sélectionner un magasin —</option>
                    {magasinsFiltres.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>)}
                  </select>
                  {form.depot_id && magasinsFiltres.length === 0 && <span className="form-hint" style={{ color: '#DC3545' }}>Aucun magasin actif pour ce dépôt.</span>}
                </div>

                <div className="form-group">
                  <label>Produit <span className="req">*</span></label>
                  <select value={form.produit_id} onChange={e => setF('produit_id', e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}>
                    <option value="">— Sélectionner un produit —</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.designation} ({p.reference})</option>)}
                  </select>
                </div>

                {form.produit_id && sourceId && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E5E7EB', fontSize: 13 }}>
                    <span style={{ color: '#6B7280' }}>Stock disponible</span>
                    <span style={{ fontWeight: 700, color: dispo === 0 ? '#DC3545' : '#1E1B4B', marginLeft: 8, fontSize: 15 }}>
                      {dispo !== null ? dispo.toLocaleString('fr-FR') : '—'} {produit?.unite_mesure || 'unités'}
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label>Quantité <span className="req">*</span></label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={form.quantite} onChange={e => setF('quantite', e.target.value)}
                    placeholder={`Max: ${dispo !== null ? dispo : '?'}`}
                    style={{ borderColor: form.quantite && dispo !== null && Number(form.quantite) > dispo ? '#DC3545' : undefined }}
                  />
                  {form.quantite && dispo !== null && Number(form.quantite) > dispo && (
                    <span className="form-hint" style={{ color: '#DC3545' }}>Quantité demandée dépasse le stock disponible ({dispo}).</span>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Référence</label>
                    <input value={form.reference} onChange={e => setF('reference', e.target.value)} placeholder="Bon de livraison…" />
                  </div>
                  <div className="form-group">
                    <label>{direction === 'magasin_to_depot' ? 'Motif du retour' : 'Notes'}</label>
                    <input value={direction === 'magasin_to_depot' ? form.motif : form.notes} onChange={e => setF(direction === 'magasin_to_depot' ? 'motif' : 'notes', e.target.value)} placeholder="Optionnel…" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn-ghost" onClick={() => setStep(0)}>Retour</button>
                  <button className="btn-primary" disabled={!step2Valid()} onClick={() => setStep(2)}>
                    Continuer <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Étape 2 : confirmation ── */}
            {step === 2 && (
              <div>
                <div style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ padding: '12px 16px', background: direction === 'depot_to_magasin' ? '#EEF2FF' : '#FFF7ED', borderBottom: '1px solid #E5E7EB', fontSize: 13, fontWeight: 700, color: direction === 'depot_to_magasin' ? '#4338CA' : '#C2410C' }}>
                    Résumé du transfert
                  </div>
                  {[
                    { label: 'Type',      val: direction === 'depot_to_magasin' ? 'Approvisionnement Dépôt → Magasin' : 'Retour Magasin → Dépôt' },
                    { label: 'Dépôt',     val: depot?.nom },
                    { label: 'Magasin',   val: magasin?.nom },
                    { label: 'Produit',   val: `${produit?.designation} (${produit?.reference})` },
                    { label: 'Quantité',  val: `${Number(form.quantite).toLocaleString('fr-FR')} ${produit?.unite_mesure || 'unités'}` },
                    form.reference && { label: 'Référence', val: form.reference },
                    (form.notes || form.motif) && { label: 'Notes', val: form.notes || form.motif },
                  ].filter(Boolean).map(row => (
                    <div key={row.label} style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid #F0F0F0' }}>
                      <span style={{ width: 100, fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1E1B4B' }}>{row.val}</span>
                    </div>
                  ))}
                </div>

                {error && <div className="form-err" style={{ marginBottom: 16 }}><AlertTriangle size={14} /> {error}</div>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => setStep(1)}>Modifier</button>
                  <button className="btn-primary" disabled={submitting} onClick={submit}>
                    {submitting ? <><Loader size={14} className="spin" /> Transfert en cours…</> : <><Check size={14} /> Confirmer le transfert</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── Étape 3 : succès ── */}
            {step === 3 && result && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={28} color="#28A745" />
                </div>
                <h3 style={{ color: '#166534', marginBottom: 8 }}>Transfert réussi</h3>
                <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>{result.message}</p>
                {(result.quantite_depot !== null || result.quantite_magasin !== null) && (
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
                    {result.quantite_depot !== undefined && (
                      <div style={{ padding: '10px 20px', background: '#EEF2FF', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>Stock dépôt</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#4338CA' }}>{result.quantite_depot?.toLocaleString('fr-FR')}</div>
                      </div>
                    )}
                    {result.quantite_magasin !== undefined && (
                      <div style={{ padding: '10px 20px', background: '#F0FDFA', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>Stock magasin</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#065F46' }}>{result.quantite_magasin?.toLocaleString('fr-FR')}</div>
                      </div>
                    )}
                  </div>
                )}
                <button className="btn-primary" onClick={reset}>Nouveau transfert</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
