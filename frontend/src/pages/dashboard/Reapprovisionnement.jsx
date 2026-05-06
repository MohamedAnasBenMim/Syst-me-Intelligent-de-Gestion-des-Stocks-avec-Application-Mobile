import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Brain, AlertCircle, AlertTriangle, CheckCircle, Package,
         Warehouse, Loader, Check, X, Send } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { getPrevisions, getRecommandations, sendFeedback, askQuestion, createRecommandation, createMouvement } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import './Reapprovisionnement.css'

// ── Suggestions RAG spécifiques au réapprovisionnement ────
const RAG_SUGGESTIONS = [
  'Quels produits risquent une rupture cette semaine ?',
  'Quel entrepôt consomme le plus de stock ?',
  'Combien commander pour tenir 30 jours ?',
  'Y a-t-il des anomalies de consommation récentes ?',
]

// ── Mini chat RAG intégré ─────────────────────────────────
function RagChat({ userInitials }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(question) {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const data = await askQuestion(q)
      setMessages(prev => [...prev, {
        role: 'ai',
        content: data.reponse,
        sources: data.sources || [],
        ms: data.temps_generation_ms,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai', content: `Erreur : ${err.message}`, sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="rag-chat">
      {/* Suggestions */}
      <div className="rag-suggestions">
        {RAG_SUGGESTIONS.map(s => (
          <button key={s} className="rag-chip" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      {/* Messages */}
      <div className="rag-messages">
        {messages.length === 0 && (
          <div className="rag-empty">
            <Brain size={28} color="var(--teal)" />
            <p>Posez une question sur votre stock — l'IA répond en temps réel</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`rag-msg ${msg.role === 'user' ? 'rag-msg--user' : 'rag-msg--ai'}`}>
            {msg.role === 'ai' && (
              <div className="rag-avatar ai"><Brain size={13} color="#fff" /></div>
            )}
            <div className={`rag-bubble ${msg.role === 'user' ? 'rag-bubble--user' : 'rag-bubble--ai'}`}>
              {msg.content}
              {msg.sources?.length > 0 && (
                <details className="rag-sources">
                  <summary>Sources ({msg.sources.length}) · {msg.ms}ms</summary>
                  <ul>{msg.sources.map((s, j) => <li key={j}>{s}</li>)}</ul>
                </details>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="rag-avatar user">{userInitials}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="rag-msg rag-msg--ai">
            <div className="rag-avatar ai"><Brain size={13} color="#fff" /></div>
            <div className="rag-bubble rag-bubble--ai rag-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="rag-input-row">
        <textarea
          className="rag-input"
          rows={1}
          placeholder="Posez votre question sur le stock..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          className={`rag-send ${input.trim() && !loading ? 'active' : ''}`}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          {loading ? <Loader size={15} className="spin" /> : <Send size={15} />}
        </button>
      </div>
      <p className="rag-hint">Alimenté par Groq LLM + RAG · Entrée pour envoyer</p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────
const urgenceConfig = {
  critique: { color: '#DC3545', bg: '#FFF5F5', border: '#DC3545', label: 'CRITIQUE', icon: AlertCircle },
  haute:    { color: '#E8730A', bg: '#FFF8F0', border: '#E8730A', label: 'HAUTE',    icon: AlertTriangle },
  moyenne:  { color: '#FFC107', bg: '#FFFDF0', border: '#FFC107', label: 'MOYENNE',  icon: AlertTriangle },
  basse:    { color: '#28A745', bg: '#F0FFF4', border: '#28A745', label: 'BASSE',    icon: CheckCircle },
  stable:   { color: '#6366F1', bg: '#F5F3FF', border: '#C4B5FD', label: 'STABLE',   icon: CheckCircle },
}

function jourLabel(jours, seuilJours) {
  if (jours >= 9999) return { text: 'Aucune consommation — stock stable', color: '#6366F1' }
  if (jours <= 0)    return { text: 'Rupture imminente !',                color: '#DC3545' }
  const enDanger = jours <= seuilJours
  return {
    text:  `Rupture estimée dans ${Math.floor(jours)} jour${jours >= 2 ? 's' : ''}`,
    color: enDanger ? (jours <= 7 ? '#DC3545' : '#E8730A') : '#6B7280',
  }
}

// ── Composant carte prévision ──────────────────────────────
function PrevisionCard({ p, seuilJours, onCommander }) {
  const { text, color } = jourLabel(p.jours_avant_rupture, seuilJours)
  const cfg  = urgenceConfig[p.urgence] || urgenceConfig.basse
  const Icon = cfg.icon
  const isStable = p.urgence === 'stable'

  return (
    <div className="prev-card" style={{ borderLeftColor: cfg.border, background: cfg.bg, opacity: isStable ? 0.85 : 1 }}>
      <div className="prev-card-left">
        <Icon size={22} color={cfg.color} />
      </div>
      <div className="prev-card-body">
        <div className="prev-prod-name">
          {p.produit_nom}
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 700,
            padding: '2px 7px', borderRadius: 10,
            background: cfg.color + '22', color: cfg.color,
          }}>{cfg.label}</span>
        </div>
        <div className="prev-rupture" style={{ color }}>{text}</div>
        <div className="prev-qty">
          {isStable
            ? <span style={{ color: '#9CA3AF' }}>Stock actuel : {p.stock_actuel} · {p.entrepot_nom}</span>
            : <>Commander {Math.round(p.quantite_a_commander)} unités
                <span className="prev-entrepot"> · {p.entrepot_nom}</span>
              </>
          }
        </div>
        {p.recommandation && (
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontStyle: 'italic' }}>
            {p.recommandation}
          </div>
        )}
      </div>
      {!isStable && (
        <button className="btn btn-primary prev-btn" onClick={() => onCommander(p)}>
          Commander
        </button>
      )}
    </div>
  )
}

// ── Étoiles de notation ───────────────────────────────────
function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange(n === value ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{
            cursor: 'pointer', fontSize: 20,
            color: n <= (hovered || value || 0) ? '#F59E0B' : '#D1D5DB',
            transition: 'color 0.15s',
          }}
        >★</span>
      ))}
      {value && (
        <span style={{ fontSize: 11, color: '#6B7280', alignSelf: 'center', marginLeft: 4 }}>
          {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bon', 'Excellent'][value]}
        </span>
      )}
    </div>
  )
}

// ── Calcul jours restants = date_expiration - aujourd'hui ──────────
function calcJoursExpirationActuels(rec) {
  const ctx = rec.contexte || {}

  // Priorité 1 : date_expiration stockée directement dans le contexte (YYYY-MM-DD)
  if (ctx.date_expiration) {
    const [y, m, d] = ctx.date_expiration.split('-').map(Number)
    const dateExp = new Date(y, m - 1, d)   // minuit heure locale
    const today   = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((dateExp - today) / (1000 * 60 * 60 * 24))
  }

  // Fallback : pour les anciennes recommandations sans date_expiration stockée
  // on reconstruit depuis created_at + jours_avant_expiration_original
  const joursOriginal = ctx.jours_avant_expiration
  if (joursOriginal == null || !rec.created_at) return null
  const createdAt = new Date(rec.created_at)
  const dateExp   = new Date(createdAt)
  dateExp.setDate(dateExp.getDate() + joursOriginal)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dateExp.setHours(0, 0, 0, 0)
  return Math.ceil((dateExp - today) / (1000 * 60 * 60 * 24))
}

// ── Composant carte recommandation IA ─────────────────────
function RecommandationCard({ rec, onFeedback }) {
  const cfg = urgenceConfig[rec.urgence] || urgenceConfig.basse
  const [loading,         setLoading]       = useState(false)
  const [phase,           setPhase]         = useState('')   // '' | 'accepted' | 'rejecting' | 'rejected'
  const [showFeedback,    setShowFeedback]  = useState(false)
  const [rating,          setRating]        = useState(null)
  const [comment,         setComment]       = useState('')
  const [qteReelle,       setQteReelle]     = useState('')
  const [fbError,         setFbError]       = useState(null)

  // Jours d'expiration recalculés à partir d'aujourd'hui
  const joursExpActuels = calcJoursExpirationActuels(rec)

  // Date de génération de la recommandation
  const genereLe = rec.created_at
    ? new Date(rec.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  async function submit(action) {
    setLoading(true)
    setFbError(null)
    if (action === 'rejetee') setPhase('rejecting')
    try {
      await onFeedback(rec.id, {
        action_taken:    action,
        rating:          rating   || undefined,
        comment:         comment  || undefined,
        quantite_reelle: qteReelle !== '' ? Number(qteReelle) : undefined,
      }, rec)
      setPhase(action === 'rejetee' ? 'rejected' : 'accepted')
    } catch (e) {
      setFbError(e?.message || 'Erreur lors de l\'envoi du feedback.')
      setPhase('')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'accepted') return (
    <div className="rec-card rec-card--done success">
      <Check size={16} /> Recommandation acceptée — merci pour votre retour !
    </div>
  )

  if (phase === 'rejecting') return (
    <div className="rec-card rec-card--done" style={{ background: '#FFF8F0', borderColor: '#E8730A' }}>
      <Loader size={14} className="spin" style={{ color: '#E8730A' }} />
      <span style={{ marginLeft: 8, color: '#E8730A', fontWeight: 600 }}>
        Rejet enregistré — l'IA génère une nouvelle recommandation…
      </span>
    </div>
  )

  if (phase === 'rejected') return (
    <div className="rec-card rec-card--done" style={{ background: '#FFF8F0', borderColor: '#E8730A' }}>
      <RefreshCw size={14} color="#E8730A" />
      <span style={{ marginLeft: 8, color: '#E8730A', fontWeight: 600 }}>
        Rejetée — nouvelle recommandation générée. Actualisez la liste.
      </span>
    </div>
  )

  // Statut initial du backend : "GENEREE" (pas encore traitée)
  const isPending = rec.statut === 'GENEREE'

  return (
    <div className="rec-card" style={{ borderLeftColor: cfg.border, background: cfg.bg }}>
      {/* ── En-tête ── */}
      <div className="rec-card-header">
        <span className="rec-urgence-badge" style={{ background: cfg.color }}>{cfg.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Jours expiration recalculés */}
          {joursExpActuels != null && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
              background: joursExpActuels <= 3 ? '#FEE2E2' : joursExpActuels <= 7 ? '#FEF9C3' : '#F0FDF4',
              color: joursExpActuels <= 3 ? '#DC3545' : joursExpActuels <= 7 ? '#B45309' : '#28A745',
            }}>
              {joursExpActuels <= 0
                ? 'Expiré'
                : `⏱ Expire dans ${joursExpActuels}j`}
            </span>
          )}
          <div className="rec-confiance">
            <span>Confiance IA</span>
            <div className="rec-confiance-bar">
              <div className="rec-confiance-fill"
                style={{ width: `${Math.round(rec.confiance_score * 100)}%` }} />
            </div>
            <span>{Math.round(rec.confiance_score * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Avertissement si recommandation ancienne */}
      {genereLe && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
          Générée le {genereLe}
          {joursExpActuels != null && (
            <span style={{ color: '#6366F1', marginLeft: 6 }}>
              · Expiration recalculée à partir d'aujourd'hui : <b>{joursExpActuels <= 0 ? 'expiré' : `${joursExpActuels} jours`}</b>
            </span>
          )}
        </div>
      )}

      {/* ── Contenu ── */}
      <div className="rec-titre">{rec.titre}</div>
      <div className="rec-contenu">
        {joursExpActuels != null
          ? rec.contenu.replace(
              /dans\s+\d+\s+jours?/gi,
              `dans ${joursExpActuels} jour${joursExpActuels > 1 ? 's' : ''}`
            )
          : rec.contenu}
      </div>
      <div className="rec-meta">
        <span><Package size={12} /> Produit #{rec.produit_id}</span>
        <span><Warehouse size={12} /> Entrepôt #{rec.entrepot_id || '—'}</span>
        {rec.quantite_suggeree && (
          <span className="rec-qty-chip">Commander {Math.round(rec.quantite_suggeree)} unités</span>
        )}
        {rec.fournisseur_suggere && (
          <span className="rec-qty-chip" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
            Fournisseur : {rec.fournisseur_suggere}
          </span>
        )}
        {!isPending && (
          <span className="rec-qty-chip" style={{ background: '#F3F4F6', color: '#6B7280' }}>
            Statut : {rec.statut}
          </span>
        )}
      </div>

      {/* ── Boutons principaux (seulement si en attente) ── */}
      {isPending && !showFeedback && (
        <div className="rec-actions">
          <button className="rec-btn accept" onClick={() => setShowFeedback(true)} disabled={loading}>
            <Check size={14} /> Accepter
          </button>
          <button className="rec-btn reject" onClick={() => submit('rejetee')} disabled={loading}>
            {loading ? <Loader size={14} className="spin" /> : <X size={14} />}
            Rejeter
          </button>
          <button
            className="rec-btn"
            style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
            onClick={() => setShowFeedback(v => !v)}
          >
            ★ Donner un avis
          </button>
        </div>
      )}

      {/* Bouton avis pour recommandations déjà traitées */}
      {!isPending && !showFeedback && (
        <div className="rec-actions">
          <button
            className="rec-btn"
            style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
            onClick={() => setShowFeedback(v => !v)}
          >
            ★ Donner un avis
          </button>
        </div>
      )}

      {/* ── Zone feedback ── */}
      {showFeedback && (
        <div style={{
          marginTop: 12, padding: '14px 16px', borderRadius: 10,
          background: '#F9FAFB', border: '1px solid #E5E7EB',
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 10 }}>
            ★ Votre retour sur cette recommandation
          </div>

          {fbError && (
            <div style={{ color: '#DC3545', fontSize: 12, marginBottom: 8 }}>
              <AlertTriangle size={12} /> {fbError}
            </div>
          )}

          {/* Note */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>
              Note de qualité
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Quantité réelle commandée */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>
              Quantité réellement commandée (optionnel)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={qteReelle}
              onChange={e => setQteReelle(e.target.value)}
              placeholder={rec.quantite_suggeree ? `Suggérée : ${Math.round(rec.quantite_suggeree)}` : 'Ex : 50'}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #D1D5DB', fontSize: 13,
              }}
            />
          </div>

          {/* Commentaire */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Ex : Quantité insuffisante, mauvais fournisseur suggéré…"
              rows={2}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #D1D5DB', fontSize: 13, resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Actions finales */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="rec-btn accept"
              onClick={() => submit('acceptee')}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? <Loader size={14} className="spin" /> : <Check size={14} />}
              Accepter & envoyer
            </button>
            <button
              className="rec-btn reject"
              onClick={() => submit('rejetee')}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? <Loader size={14} className="spin" /> : <X size={14} />}
              Rejeter & envoyer
            </button>
            <button
              className="rec-btn"
              onClick={() => setShowFeedback(false)}
              disabled={loading}
              style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────
export default function Reapprovisionnement() {
  const { user } = useAuth()
  const initiales = user
    ? `${(user.prenom || user.nom || 'U')[0]}${(user.nom || '')[0] || ''}`.toUpperCase()
    : 'U'

  const [previsions,      setPrevisions]      = useState([])
  const [recommandations, setRecommandations] = useState([])
  const [loadingPrev,     setLoadingPrev]     = useState(true)
  const [loadingRec,      setLoadingRec]      = useState(true)
  const [errorPrev,       setErrorPrev]       = useState(null)
  const [formOpen,        setFormOpen]        = useState(false)
  const [seuilJours,      setSeuilJours]      = useState(30)
  const [genLoading,      setGenLoading]      = useState(false)
  const [genResult,       setGenResult]       = useState(null)
  const [form,            setForm]            = useState({ question: '' })

  useEffect(() => { fetchPrevisions() }, [seuilJours])
  useEffect(() => { fetchRecs() }, [])

  async function fetchPrevisions() {
    setLoadingPrev(true)
    setErrorPrev(null)
    try {
      const data = await getPrevisions(seuilJours)
      const list = data?.previsions || []
      setPrevisions(list)
      if (list.length === 0 && !data?.success) {
        setErrorPrev('Impossible de récupérer les prévisions. Vérifiez que les services sont démarrés.')
      }
    } catch (e) {
      setPrevisions([])
      setErrorPrev(e?.message || 'Erreur de connexion au service IA.')
    } finally {
      setLoadingPrev(false)
    }
  }

  async function fetchRecs() {
    setLoadingRec(true)
    try {
      // Charger toutes les recommandations récentes (pas seulement en_attente)
      const data = await getRecommandations({ per_page: 30 })
      setRecommandations(data.recommandations || [])
    } catch { setRecommandations([]) }
    finally { setLoadingRec(false) }
  }

  async function handleCommander(prevision) {
    setGenLoading(true)
    setGenResult(null)

    // Cas 1 : prévision IA avec produit + entrepôt → créer mouvement d'entrée direct
    if (prevision.produit_id && prevision.entrepot_id) {
      try {
        const qte = Math.round(prevision.quantite_a_commander) || 1
        await createMouvement({
          type_mouvement:   'entree',
          produit_id:       prevision.produit_id,
          quantite:         qte,
          entrepot_dest_id: prevision.entrepot_id,
          destination_type: 'DEPOT',
          motif: `Commande réapprovisionnement — ${prevision.produit_nom} (${prevision.entrepot_nom})`,
        })
        setGenResult(
          `Commande enregistrée : ${qte} unités de ${prevision.produit_nom} → ${prevision.entrepot_nom}. ` +
          `Les alertes associées seront résolues automatiquement si le stock repasse au-dessus du seuil.`
        )
        // Générer recommandation IA en background (non bloquant)
        createRecommandation({
          produit_id:              prevision.produit_id,
          entrepot_id:             prevision.entrepot_id,
          stock_actuel:            prevision.stock_actuel,
          seuil_min:               prevision.seuil_min,
          contexte_supplementaire: `Commande passée : ${qte} unités. Rupture prévue dans ${prevision.jours_avant_rupture} jours.`,
        }).then(() => fetchRecs()).catch(() => {})
        fetchPrevisions()
      } catch (e) {
        setGenResult(`Erreur: ${e.message}`)
      } finally {
        setGenLoading(false)
      }
      return
    }

    // Cas 2 : demande manuelle libre (modal) → générer recommandation IA uniquement
    try {
      const rep = await createRecommandation({
        produit_id:              prevision.produit_id  || null,
        entrepot_id:             prevision.entrepot_id || null,
        stock_actuel:            prevision.stock_actuel,
        seuil_min:               prevision.seuil_min,
        contexte_supplementaire: prevision.contexte_supplementaire,
      })
      setGenResult(rep.titre + ' — ' + rep.contenu)
      fetchRecs()
    } catch (e) {
      setGenResult(`Erreur: ${e.message}`)
    } finally {
      setGenLoading(false)
    }
  }

  async function handleFeedback(id, feedback, rec) {
    await sendFeedback(id, feedback)

    // Auto-create mouvement d'entrée when accepting a recommendation
    if (feedback.action_taken === 'acceptee' && rec?.produit_id && rec?.entrepot_id) {
      const qte = feedback.quantite_reelle || rec.quantite_suggeree
      if (qte > 0) {
        try {
          await createMouvement({
            type_mouvement:   'entree',
            produit_id:       rec.produit_id,
            quantite:         Number(qte),
            entrepot_dest_id: rec.entrepot_id,
            destination_type: 'DEPOT',
            motif:            `Réapprovisionnement IA — ${rec.titre || 'Recommandation acceptée'}`,
          })
        } catch (e) {
          console.warn('Mouvement auto-entrée échoué:', e.message)
        }
      }
    }

    await fetchRecs()
  }

  return (
    <DashboardLayout>
      <div className="reappro-page">

        {/* ── En-tête ── */}
        <div className="page-header">
          <div className="page-header-left">
            <RefreshCw size={22} color="var(--teal)" />
            <h1>Réapprovisionnement</h1>
          </div>
          <button className="btn btn-primary" onClick={() => setFormOpen(v => !v)}>
            + Nouvelle demande
          </button>
        </div>

        {/* ── Prévisions Prophet ML ── */}
        <div className="reappro-card">
          <div className="reappro-card-header">
            <div className="reappro-card-title">
              <Brain size={18} color="var(--teal)" />
              <span>Prévisions IA</span>
              <span className="prophet-badge">Prophet ML</span>
            </div>
            <div className="reappro-card-controls">
              <select value={seuilJours} onChange={e => setSeuilJours(Number(e.target.value))}
                className="seuil-select">
                <option value={7}>7 jours</option>
                <option value={15}>15 jours</option>
                <option value={30}>30 jours</option>
                <option value={60}>60 jours</option>
              </select>
              <button className="btn-refresh" onClick={fetchPrevisions}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loadingPrev ? (
            <div className="reappro-loading"><Loader size={20} className="spin" /> Calcul en cours…</div>
          ) : errorPrev ? (
            <div className="reappro-empty" style={{ color: '#DC3545' }}>
              <AlertTriangle size={32} color="#DC3545" />
              <p style={{ fontWeight: 600 }}>Erreur de chargement</p>
              <p style={{ fontSize: 12, color: '#6B7280', maxWidth: 380, textAlign: 'center' }}>{errorPrev}</p>
            </div>
          ) : previsions.length === 0 ? (
            <div className="reappro-empty">
              <CheckCircle size={32} color="#28A745" />
              <p>Aucune donnée de stock disponible</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>Ajoutez des produits en stock pour voir les prévisions.</p>
            </div>
          ) : (
            <>
              {/* Résumé période */}
              {(() => {
                const enDanger = previsions.filter(p => p.jours_avant_rupture < seuilJours && p.urgence !== 'stable')
                const stables  = previsions.filter(p => p.urgence === 'stable')
                return (
                  <div style={{ display: 'flex', gap: 12, padding: '8px 0 12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: enDanger.length ? '#DC3545' : '#28A745', fontWeight: 600 }}>
                      {enDanger.length > 0
                        ? `${enDanger.length} produit(s) à risque dans les ${seuilJours} prochains jours`
                        : `✔ Aucune rupture dans les ${seuilJours} prochains jours`}
                    </span>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      · {stables.length} produit(s) stables (sans consommation enregistrée)
                    </span>
                  </div>
                )
              })()}
              <div className="prev-list">
                {previsions.map((p, i) => (
                  <PrevisionCard key={`${p.produit_id}-${p.entrepot_id}-${i}`}
                    p={p} seuilJours={seuilJours} onCommander={handleCommander} />
                ))}
              </div>
            </>
          )}

          {genLoading && (
            <div className="gen-loading">
              <Loader size={16} className="spin" /> L'IA génère la recommandation…
            </div>
          )}
          {genResult && (
            <div className="gen-result">
              <Brain size={14} color="var(--teal)" />
              <p>{genResult}</p>
            </div>
          )}

          <div className="prophet-footer">
            <Brain size={13} color="#ADB5BD" />
            <span>Alimenté par Groq LLM + RAG</span>
          </div>
        </div>

        {/* ── Recommandations IA ── */}
        <div className="reappro-card">
          <div className="reappro-card-header">
            <div className="reappro-card-title">
              <Brain size={18} color="var(--teal)" />
              <span>Recommandations IA</span>
              {!loadingRec && recommandations.length > 0 && (
                <span className="rec-count-badge">{recommandations.length}</span>
              )}
            </div>
            <button className="btn-refresh" onClick={fetchRecs}>
              <RefreshCw size={14} />
            </button>
          </div>

          {loadingRec ? (
            <div className="reappro-loading"><Loader size={20} className="spin" /> Chargement…</div>
          ) : recommandations.length === 0 ? (
            <div className="reappro-empty">
              <Brain size={32} color="#C4B5FD" />
              <p style={{ fontWeight: 600, color: '#374151' }}>Aucune recommandation générée</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 320, textAlign: 'center' }}>
                Cliquez sur <b>Commander</b> sur une prévision ci-dessus, ou utilisez
                le bouton <b>+ Nouvelle demande</b> pour générer une recommandation IA.
              </p>
            </div>
          ) : (
            <>
              {/* Recommandations en attente de décision (statut GENEREE) */}
              {recommandations.filter(r => r.statut === 'GENEREE').length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#E8730A', marginBottom: 8, padding: '0 4px' }}>
                    En attente de décision ({recommandations.filter(r => r.statut === 'GENEREE').length})
                  </div>
                  <div className="rec-list">
                    {recommandations
                      .filter(r => r.statut === 'GENEREE')
                      .map(rec => (
                        <RecommandationCard key={rec.id} rec={rec} onFeedback={handleFeedback} />
                      ))}
                  </div>
                </>
              )}

              {/* Recommandations déjà traitées (ACCEPTEE / REJETEE) */}
              {recommandations.filter(r => r.statut !== 'GENEREE').length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: '16px 0 8px', padding: '0 4px' }}>
                    Historique — Donner votre avis ({recommandations.filter(r => r.statut !== 'GENEREE').length})
                  </div>
                  <div className="rec-list">
                    {recommandations
                      .filter(r => r.statut !== 'GENEREE')
                      .map(rec => (
                        <RecommandationCard key={rec.id} rec={rec} onFeedback={handleFeedback} />
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Modal demande manuelle ── */}
        {formOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFormOpen(false)}>
            <div className="modal" style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                  <Brain size={18} color="var(--teal)" /> Nouvelle demande manuelle
                </span>
                <button className="modal-close" onClick={() => setFormOpen(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
                  Décrivez votre besoin en langage naturel — l'IA génère automatiquement
                  la recommandation via le pipeline RAG + Groq.
                </p>
                <div className="form-group">
                  <label>Votre demande</label>
                  <textarea
                    className="manual-textarea"
                    rows={4}
                    placeholder="Ex: J'ai besoin de réapprovisionner l'huile d'olive dans l'entrepôt de Tunis, le stock est très bas..."
                    value={form.question}
                    onChange={e => setForm({ question: e.target.value })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
                {genResult && (
                  <div className="gen-result" style={{ marginTop: 12 }}>
                    <Brain size={14} color="var(--teal)" />
                    <p>{genResult}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setFormOpen(false)}>Annuler</button>
                <button
                  className="btn-primary"
                  disabled={!form.question.trim() || genLoading}
                  onClick={() => handleCommander({
                    produit_id: null, entrepot_id: null,
                    stock_actuel: 0, seuil_min: 0,
                    contexte_supplementaire: form.question,
                  })}
                >
                  {genLoading
                    ? <><Loader size={14} className="spin" /> Génération…</>
                    : <><Brain size={14} /> Générer recommandation IA</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Assistant IA RAG ── */}
        <div className="reappro-card">
          <div className="reappro-card-header">
            <div className="reappro-card-title">
              <Brain size={18} color="var(--teal)" />
              <span>Assistant IA — Questions sur votre stock</span>
              <span className="prophet-badge">RAG · Groq</span>
            </div>
          </div>
          <RagChat userInitials={initiales} />
        </div>

      </div>
    </DashboardLayout>
  )
}
