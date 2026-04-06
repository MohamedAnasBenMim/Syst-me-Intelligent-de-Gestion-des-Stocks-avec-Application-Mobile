import { useEffect, useRef } from 'react'
import './Features.css'

/* ── Inline SVG illustrations ── */
const IlluWarehouse = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#EFF6FF"/>
    {/* Building */}
    <rect x="10" y="22" width="60" height="28" rx="3" fill="#BFDBFE"/>
    <polygon points="8,22 40,6 72,22" fill="#2563EB"/>
    {/* Door */}
    <rect x="32" y="34" width="16" height="16" rx="2" fill="#1D4ED8"/>
    {/* Windows */}
    <rect x="14" y="28" width="10" height="8" rx="2" fill="#93C5FD"/>
    <rect x="56" y="28" width="10" height="8" rx="2" fill="#93C5FD"/>
    {/* Pins */}
    <circle cx="20" cy="14" r="4" fill="#2563EB"/>
    <circle cx="20" cy="14" r="2" fill="white"/>
    <circle cx="60" cy="10" r="4" fill="#8B5CF6"/>
    <circle cx="60" cy="10" r="2" fill="white"/>
  </svg>
)

const IlluAI = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#F5F3FF"/>
    {/* Chat bubbles */}
    <rect x="8" y="8" width="38" height="12" rx="6" fill="#DDD6FE"/>
    <rect x="8" y="24" width="50" height="12" rx="6" fill="#DDD6FE"/>
    {/* AI response bubble */}
    <rect x="14" y="40" width="52" height="12" rx="6" fill="#8B5CF6"/>
    <circle cx="8" cy="46" r="5" fill="#8B5CF6"/>
    {/* Brain nodes */}
    <circle cx="66" cy="10" r="3" fill="#8B5CF6"/>
    <circle cx="72" cy="18" r="2" fill="#C4B5FD"/>
    <circle cx="62" cy="20" r="2" fill="#C4B5FD"/>
    <line x1="66" y1="10" x2="72" y2="18" stroke="#C4B5FD" strokeWidth="1.5"/>
    <line x1="66" y1="10" x2="62" y2="20" stroke="#C4B5FD" strokeWidth="1.5"/>
    <line x1="72" y1="18" x2="62" y2="20" stroke="#C4B5FD" strokeWidth="1.5"/>
  </svg>
)

const IlluChart = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#ECFDF5"/>
    {/* Axes */}
    <line x1="12" y1="44" x2="72" y2="44" stroke="#A7F3D0" strokeWidth="2"/>
    <line x1="12" y1="8" x2="12" y2="44" stroke="#A7F3D0" strokeWidth="2"/>
    {/* Bars */}
    <rect x="18" y="28" width="8" height="16" rx="2" fill="#6EE7B7"/>
    <rect x="30" y="20" width="8" height="24" rx="2" fill="#34D399"/>
    <rect x="42" y="14" width="8" height="30" rx="2" fill="#10B981"/>
    <rect x="54" y="18" width="8" height="26" rx="2" fill="#059669"/>
    {/* Trend line */}
    <polyline points="22,28 34,20 46,13 58,17" fill="none" stroke="#065F46" strokeWidth="2" strokeDasharray="3,2"/>
    <circle cx="58" cy="17" r="3" fill="#059669"/>
  </svg>
)

const IlluAlert = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#FEF2F2"/>
    {/* Bell shape */}
    <path d="M40 8 C32 8 26 14 26 22 L26 36 L54 36 L54 22 C54 14 48 8 40 8Z" fill="#FCA5A5"/>
    <rect x="34" y="36" width="12" height="4" rx="2" fill="#F87171"/>
    <circle cx="40" cy="48" r="4" fill="#EF4444"/>
    {/* Badge */}
    <circle cx="58" cy="12" r="8" fill="#DC2626"/>
    <text x="55" y="17" fontSize="9" fill="white" fontWeight="bold">3</text>
    {/* Waves */}
    <path d="M20 18 Q16 22 20 26" stroke="#FCA5A5" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M60 18 Q64 22 60 26" stroke="#FCA5A5" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
)

const IlluShield = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#FFFBEB"/>
    {/* Shield */}
    <path d="M40 6 L60 14 L60 30 Q60 44 40 52 Q20 44 20 30 L20 14 Z" fill="#FDE68A"/>
    <path d="M40 12 L54 18 L54 30 Q54 40 40 46 Q26 40 26 30 L26 18 Z" fill="#F59E0B"/>
    {/* Check */}
    <polyline points="32,28 38,34 50,22" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Users */}
    <circle cx="16" cy="32" r="5" fill="#FCD34D"/>
    <circle cx="28" cy="44" r="5" fill="#FBBF24"/>
    <circle cx="52" cy="44" r="5" fill="#FBBF24"/>
    <circle cx="64" cy="32" r="5" fill="#FCD34D"/>
  </svg>
)

const IlluZap = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#ECFEFF"/>
    {/* Phone */}
    <rect x="26" y="6" width="28" height="44" rx="6" fill="#A5F3FC"/>
    <rect x="30" y="10" width="20" height="32" rx="3" fill="white"/>
    <circle cx="40" cy="46" r="2" fill="#0891B2"/>
    {/* Notification card */}
    <rect x="32" y="13" width="16" height="10" rx="2" fill="#0891B2"/>
    <rect x="34" y="27" width="12" height="2" rx="1" fill="#A5F3FC"/>
    <rect x="34" y="31" width="8" height="2" rx="1" fill="#A5F3FC"/>
    {/* Zap bolt */}
    <polygon points="62,8 56,24 62,24 58,40 68,18 62,18" fill="#0891B2"/>
  </svg>
)

const IlluTrace = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#F5F3FF"/>
    {/* Timeline line */}
    <line x1="20" y1="10" x2="20" y2="48" stroke="#C4B5FD" strokeWidth="2"/>
    {/* Events */}
    <circle cx="20" cy="14" r="5" fill="#7C3AED"/>
    <rect x="28" y="10" width="42" height="8" rx="4" fill="#DDD6FE"/>
    <circle cx="20" cy="28" r="5" fill="#8B5CF6"/>
    <rect x="28" y="24" width="34" height="8" rx="4" fill="#DDD6FE"/>
    <circle cx="20" cy="42" r="5" fill="#A78BFA"/>
    <rect x="28" y="38" width="38" height="8" rx="4" fill="#DDD6FE"/>
    {/* Check marks */}
    <polyline points="17,14 19,16 23,12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17,28 19,30 23,26" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17,42 19,44 23,40" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const IlluAPI = () => (
  <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="56" rx="8" fill="#F0FDFA"/>
    {/* Browser bar */}
    <rect x="6" y="6" width="68" height="44" rx="6" fill="#CCFBF1"/>
    <rect x="6" y="6" width="68" height="12" rx="6" fill="#99F6E4"/>
    <rect x="6" y="12" width="68" height="6" fill="#99F6E4"/>
    {/* Traffic lights */}
    <circle cx="14" cy="12" r="3" fill="#F87171"/>
    <circle cx="22" cy="12" r="3" fill="#FBBF24"/>
    <circle cx="30" cy="12" r="3" fill="#34D399"/>
    {/* Code lines */}
    <rect x="12" y="24" width="20" height="3" rx="1.5" fill="#0F766E"/>
    <rect x="36" y="24" width="14" height="3" rx="1.5" fill="#0D9488"/>
    <rect x="16" y="31" width="30" height="3" rx="1.5" fill="#14B8A6"/>
    <rect x="12" y="38" width="24" height="3" rx="1.5" fill="#0F766E"/>
    <rect x="40" y="38" width="12" height="3" rx="1.5" fill="#0D9488"/>
  </svg>
)

const features = [
  { Illu: IlluWarehouse, title: 'Multi-entrepôts',           desc: 'Gérez simultanément tous vos entrepôts avec visibilité complète en temps réel depuis une seule interface.' },
  { Illu: IlluAI,        title: 'IA & Recommandations RAG',  desc: 'Pipeline RAG avec Mistral 7B pour des conseils intelligents et contextualisés à votre stock.' },
  { Illu: IlluChart,     title: 'Prévisions Prophet ML',     desc: 'Algorithmes Facebook Prophet + régression linéaire pour prédire les ruptures à 30 jours.' },
  { Illu: IlluAlert,     title: 'Alertes automatiques',      desc: 'Détection en temps réel des stocks critiques, anomalies et dépassements via Isolation Forest.' },
  { Illu: IlluShield,    title: 'Sécurité & Rôles',          desc: 'JWT sécurisé avec 3 niveaux d\'accès : administrateur, gestionnaire et opérateur.' },
  { Illu: IlluZap,       title: 'Notifications push',        desc: 'Alertes en temps réel par email et notification web dès qu\'un seuil critique est atteint.' },
  { Illu: IlluTrace,     title: 'Traçabilité complète',      desc: 'Historique de chaque mouvement avec who/what/when. Audit trail complet et exportable.' },
  { Illu: IlluAPI,       title: 'API REST ouverte',          desc: 'Intégrez SGS SaaS à vos outils ERP/WMS existants via une API RESTful documentée Swagger.' },
]

export default function Features() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cards = el.querySelectorAll('.feature-card')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.1 })
    cards.forEach(c => obs.observe(c))
    return () => obs.disconnect()
  }, [])

  return (
    <section id="fonctionnalités" className="features-section" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="badge-pill">Fonctionnalités</span>
          <h2>Tout ce dont vous avez besoin</h2>
          <p>Une plateforme complète conçue pour simplifier et automatiser la gestion de stock des entreprises modernes</p>
        </div>
        <div className="features-grid">
          {features.map(({ Illu, title, desc }, i) => (
            <div key={title} className="feature-card reveal" style={{ transitionDelay: `${(i % 4) * 0.1}s` }}>
              <div className="feature-illu-wrap">
                <Illu />
              </div>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
