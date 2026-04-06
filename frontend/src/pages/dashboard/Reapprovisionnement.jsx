import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Brain, AlertCircle, AlertTriangle, CheckCircle, Package,
         Warehouse, Loader, Check, X, Send } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { getPrevisions, getRecommandations, sendFeedback, askQuestion, createRecommandation } from '../../services/api'
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
      <p className="rag-hint">Alimenté par Mistral LLM + RAG · Entrée pour envoyer</p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────
const urgenceConfig = {
  critique: { color: '#DC3545', bg: '#FFF5F5', border: '#DC3545', label: 'CRITIQUE', icon: AlertCircle },
  haute:    { color: '#E8730A', bg: '#FFF8F0', border: '#E8730A', label: 'HAUTE',    icon: AlertTriangle },
  moyenne:  { color: '#FFC107', bg: '#FFFDF0', border: '#FFC107', label: 'MOYENNE',  icon: AlertTriangle },
  basse:    { color: '#28A745', bg: '#F0FFF4', border: '#28A745', label: 'BASSE',    icon: CheckCircle },
}

function jourLabel(jours) {
  if (jours <= 0)  return { text: 'Rupture dans 0 jours', color: '#DC3545' }
  if (jours < 1)   return { text: 'Rupture dans < 1 jour', color: '#DC3545' }
  return { text: `Rupture dans ${Math.floor(jours)} jour${jours >= 2 ? 's' : ''}`, color: jours <= 7 ? '#E8730A' : '#FFC107' }
}

// ── Composant carte prévision ──────────────────────────────
function PrevisionCard({ p, onCommander }) {
  const { text, color } = jourLabel(p.jours_avant_rupture)
  const cfg = urgenceConfig[p.urgence] || urgenceConfig.basse
  const Icon = cfg.icon

  return (
    <div className="prev-card" style={{ borderLeftColor: cfg.border }}>
      <div className="prev-card-left">
        <Icon size={22} color={cfg.color} />
      </div>
      <div className="prev-card-body">
        <div className="prev-prod-name">{p.produit_nom}</div>
        <div className="prev-rupture" style={{ color }}>{text}</div>
        <div className="prev-qty">Commander {Math.round(p.quantite_a_commander)} unités
          <span className="prev-entrepot"> · {p.entrepot_nom}</span>
        </div>
      </div>
      <button className="btn btn-primary prev-btn" onClick={() => onCommander(p)}>
        Commander
      </button>
    </div>
  )
}

// ── Composant carte recommandation IA ─────────────────────
function RecommandationCard({ rec, onFeedback }) {
  const cfg = urgenceConfig[rec.urgence] || urgenceConfig.basse
  const [loading, setLoading] = useState('')
  const [done, setDone]       = useState('')

  async function handle(action) {
    setLoading(action)
    try {
      await onFeedback(rec.id, { action_taken: action, comment: '' })
      setDone(action)
    } finally {
      setLoading('')
    }
  }

  if (done === 'acceptee') return (
    <div className="rec-card rec-card--done success">
      <Check size={16} /> Recommandation acceptée
    </div>
  )
  if (done === 'rejetee') return (
    <div className="rec-card rec-card--done warning">
      <RefreshCw size={14} /> Rejetée — nouvelle recommandation en cours de génération…
    </div>
  )

  return (
    <div className="rec-card" style={{ borderLeftColor: cfg.border, background: cfg.bg }}>
      <div className="rec-card-header">
        <span className="rec-urgence-badge" style={{ background: cfg.color }}>{cfg.label}</span>
        <div className="rec-confiance">
          <span>Confiance IA</span>
          <div className="rec-confiance-bar">
            <div className="rec-confiance-fill"
              style={{ width: `${Math.round(rec.confiance_score * 100)}%` }} />
          </div>
          <span>{Math.round(rec.confiance_score * 100)}%</span>
        </div>
      </div>
      <div className="rec-titre">{rec.titre}</div>
      <div className="rec-contenu">{rec.contenu}</div>
      <div className="rec-meta">
        <span><Package size={12} /> Produit #{rec.produit_id}</span>
        <span><Warehouse size={12} /> Entrepôt #{rec.entrepot_id}</span>
        {rec.quantite_suggeree && (
          <span className="rec-qty-chip">Commander {Math.round(rec.quantite_suggeree)} unités</span>
        )}
      </div>
      <div className="rec-actions">
        <button className="rec-btn accept" onClick={() => handle('acceptee')} disabled={!!loading}>
          {loading === 'acceptee' ? <Loader size={14} className="spin" /> : <Check size={14} />}
          Accepter
        </button>
        <button className="rec-btn reject" onClick={() => handle('rejetee')} disabled={!!loading}>
          {loading === 'rejetee' ? <Loader size={14} className="spin" /> : <X size={14} />}
          Rejeter
        </button>
      </div>
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
  const [formOpen,        setFormOpen]        = useState(false)
  const [seuilJours,      setSeuilJours]      = useState(30)
  const [genLoading,      setGenLoading]      = useState(false)
  const [genResult,       setGenResult]       = useState(null)
  const [form,            setForm]            = useState({ question: '' })

  useEffect(() => { fetchPrevisions() }, [seuilJours])
  useEffect(() => { fetchRecs() }, [])

  async function fetchPrevisions() {
    setLoadingPrev(true)
    try {
      const data = await getPrevisions(seuilJours)
      setPrevisions(data.previsions || [])
    } catch { setPrevisions([]) }
    finally { setLoadingPrev(false) }
  }

  async function fetchRecs() {
    setLoadingRec(true)
    try {
      const data = await getRecommandations({ statut: 'en_attente', per_page: 20 })
      setRecommandations(data.recommandations || [])
    } catch { setRecommandations([]) }
    finally { setLoadingRec(false) }
  }

  async function handleCommander(prevision) {
    setGenLoading(true)
    setGenResult(null)
    try {
      const rep = await createRecommandation({
        produit_id:              prevision.produit_id,
        entrepot_id:             prevision.entrepot_id,
        stock_actuel:            prevision.stock_actuel,
        seuil_min:               prevision.seuil_min,
        contexte_supplementaire: `Rupture prévue dans ${prevision.jours_avant_rupture} jours. Commander ${prevision.quantite_a_commander} unités.`,
      })
      setGenResult(rep.titre + ' — ' + rep.contenu)
      fetchRecs()
    } catch (e) {
      setGenResult(`Erreur: ${e.message}`)
    } finally {
      setGenLoading(false)
    }
  }

  async function handleFeedback(id, feedback) {
    await sendFeedback(id, feedback)
    fetchRecs()
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
          ) : previsions.length === 0 ? (
            <div className="reappro-empty">
              <CheckCircle size={32} color="#28A745" />
              <p>Aucune rupture prévue dans les {seuilJours} prochains jours</p>
            </div>
          ) : (
            <div className="prev-list">
              {previsions.map((p, i) => (
                <PrevisionCard key={`${p.produit_id}-${p.entrepot_id}-${i}`}
                  p={p} onCommander={handleCommander} />
              ))}
            </div>
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
            <span>Alimenté par Mistral LLM + LangChain</span>
          </div>
        </div>

        {/* ── Recommandations IA en attente ── */}
        <div className="reappro-card">
          <div className="reappro-card-header">
            <div className="reappro-card-title">
              <Brain size={18} color="var(--teal)" />
              <span>Recommandations IA en attente</span>
              {!loadingRec && (
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
              <CheckCircle size={32} color="#28A745" />
              <p>Aucune recommandation en attente</p>
            </div>
          ) : (
            <div className="rec-list">
              {recommandations.map(rec => (
                <RecommandationCard key={rec.id} rec={rec} onFeedback={handleFeedback} />
              ))}
            </div>
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
                  la recommandation via le pipeline RAG + Mistral.
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
                  onClick={() => handleCommander({ produit_nom: 'produit', entrepot_nom: 'entrepôt',
                    stock_actuel: 0, seuil_min: 0, jours_avant_rupture: 0, quantite_a_commander: 0,
                    contexte_supplementaire: form.question })}
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
              <span className="prophet-badge">RAG · Mistral</span>
            </div>
          </div>
          <RagChat userInitials={initiales} />
        </div>

      </div>
    </DashboardLayout>
  )
}
