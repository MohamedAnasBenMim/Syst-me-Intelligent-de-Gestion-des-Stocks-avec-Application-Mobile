import { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader, RefreshCw, Zap } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { askQuestion, getIaStats } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import './IaRag.css'

const SUGGESTIONS = [
  'Quel produit a eu le plus de sorties ce mois ?',
  "Y a-t-il des mouvements suspects dans l'entrepôt 1 ?",
  'Quand a eu lieu la dernière entrée du produit 2 ?',
  'Quel entrepôt est le plus sollicité ?',
  'Quels produits risquent une rupture de stock ?',
]

function MessageBubble({ msg, userInitials }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--ai'}`}>
      {!isUser && (
        <div className="msg-avatar ai-avatar"><Brain size={16} color="#fff" /></div>
      )}
      <div className={`msg-bubble ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
        <div className="msg-text">{msg.content}</div>
        {msg.sources?.length > 0 && (
          <details className="msg-sources">
            <summary>Sources utilisées ({msg.sources.length})</summary>
            <ul>
              {msg.sources.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </details>
        )}
        {msg.meta && (
          <div className="msg-meta">
            {msg.meta.docs} docs · {msg.meta.ms}ms
          </div>
        )}
      </div>
      {isUser && (
        <div className="msg-avatar user-avatar">{userInitials}</div>
      )}
    </div>
  )
}

export default function IaRag() {
  const { user } = useAuth()
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [iaStats,   setIaStats]   = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const initiales = user
    ? `${(user.prenom || user.nom || 'U')[0]}${(user.nom || '')[0] || ''}`.toUpperCase()
    : 'U'

  useEffect(() => {
    getIaStats()
      .then(setIaStats)
      .catch(() => setIaStats(null))
  }, [])

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
        meta: { docs: data.documents_utilises, ms: data.temps_generation_ms },
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Erreur : ${err.message}`,
        sources: [],
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <DashboardLayout>
      <div className="iarag-page">

        {/* ── En-tête ── */}
        <div className="iarag-header">
          <div className="iarag-header-left">
            <Brain size={22} color="var(--teal)" />
            <h1>Assistant IA — RAG</h1>
          </div>
          <div className="iarag-header-right">
            {iaStats && (
              <div className="ia-status-chip">
                <span className="ia-dot" />
                {iaStats.llm_model || 'Groq'} · {iaStats.documents_count} docs
              </div>
            )}
            <button className="btn-icon" onClick={() => setMessages([])} title="Réinitialiser">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* ── Barre statut modèle ── */}
        {iaStats && (
          <div className="ia-model-bar">
            <Zap size={13} color="var(--teal)" />
            <span>Modèle : <b>{iaStats.llm_model}</b></span>
            <span className="bar-sep" />
            <span>Embeddings : <b>{iaStats.embedding_model?.split('/').pop()}</b></span>
            <span className="bar-sep" />
            <span>Base vectorielle : <b>{iaStats.documents_count} docs indexés</b></span>
            <span className="ia-dot ml-auto" />
            <span className="ia-connected">Groq LLM connecté</span>
          </div>
        )}

        {/* ── Suggestions rapides ── */}
        <div className="suggestions-row">
          {SUGGESTIONS.map(s => (
            <button key={s} className="suggestion-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>

        {/* ── Zone de chat ── */}
        <div className="chat-area">

          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon"><Brain size={36} color="#fff" /></div>
              <h3>Posez vos questions sur votre stock</h3>
              <p>L'IA analyse votre historique de mouvements et répond<br />
                en langage naturel grâce au pipeline RAG + Groq</p>
              <div className="chat-empty-cards">
                {[
                  { icon: '📊', text: 'Analyse des ruptures' },
                  { icon: '📈', text: 'Tendances de stock' },
                  { icon: '⚠️', text: 'Anomalies détectées' },
                ].map(c => (
                  <button key={c.text} className="empty-card"
                    onClick={() => send(c.text)}>
                    <span>{c.icon}</span>
                    <span>{c.text}</span>
                    <span className="empty-card-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} userInitials={initiales} />
          ))}

          {loading && (
            <div className="msg-row msg-row--ai">
              <div className="msg-avatar ai-avatar"><Brain size={16} color="#fff" /></div>
              <div className="msg-bubble bubble-ai typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={2}
            placeholder="Posez votre question sur votre stock..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            className={`chat-send-btn ${input.trim() && !loading ? 'active' : ''}`}
            onClick={() => send()}
            disabled={!input.trim() || loading}
          >
            {loading ? <Loader size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="chat-hint">
          L'IA base ses réponses sur l'historique vectorisé de vos mouvements · Entrée pour envoyer
        </p>

      </div>
    </DashboardLayout>
  )
}
