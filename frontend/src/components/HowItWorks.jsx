import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import './HowItWorks.css'

/* ── Step 1 — Signup form illustration ── */
const IlluSignup = () => (
  <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="step-illu-svg">
    <rect width="220" height="140" rx="14" fill="#EFF6FF"/>
    {/* Card */}
    <rect x="30" y="16" width="160" height="108" rx="10" fill="white" filter="url(#s1)"/>
    <defs>
      <filter id="s1" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.10"/>
      </filter>
    </defs>
    {/* Header bar */}
    <rect x="30" y="16" width="160" height="28" rx="10" fill="#2563EB"/>
    <rect x="30" y="34" width="160" height="10" fill="#2563EB"/>
    <text x="50" y="34" fontSize="10" fill="white" fontWeight="700">Créer un compte</text>
    {/* Avatar circle */}
    <circle cx="110" cy="55" r="14" fill="#BFDBFE"/>
    <circle cx="110" cy="51" r="6" fill="#93C5FD"/>
    <path d="M96 68 Q96 62 110 62 Q124 62 124 68" fill="#93C5FD"/>
    {/* Input fields */}
    <rect x="44" y="74" width="132" height="10" rx="5" fill="#F1F5F9"/>
    <rect x="44" y="74" width="48" height="10" rx="5" fill="#BFDBFE"/>
    <rect x="44" y="90" width="132" height="10" rx="5" fill="#F1F5F9"/>
    <rect x="44" y="90" width="32" height="10" rx="5" fill="#BFDBFE"/>
    {/* Button */}
    <rect x="60" y="106" width="100" height="12" rx="6" fill="#2563EB"/>
    <text x="85" y="115" fontSize="7" fill="white" fontWeight="600">S'inscrire gratuitement</text>
  </svg>
)

/* ── Step 2 — Stock dashboard illustration ── */
const IlluStock = () => (
  <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="step-illu-svg">
    <rect width="220" height="140" rx="14" fill="#F5F3FF"/>
    <defs>
      <filter id="s2" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.10"/>
      </filter>
    </defs>
    {/* Main card */}
    <rect x="12" y="12" width="196" height="116" rx="10" fill="white" filter="url(#s2)"/>
    {/* Top bar */}
    <rect x="12" y="12" width="196" height="20" rx="10" fill="#8B5CF6"/>
    <rect x="12" y="24" width="196" height="8" fill="#8B5CF6"/>
    <text x="22" y="25" fontSize="8" fill="white" fontWeight="600">Tableau de bord — Stock</text>
    {/* Stat mini cards */}
    <rect x="20" y="38" width="52" height="32" rx="6" fill="#F5F3FF"/>
    <text x="28" y="52" fontSize="16" fontWeight="800" fill="#8B5CF6">247</text>
    <text x="28" y="62" fontSize="6" fill="#7C3AED">Produits</text>
    <rect x="80" y="38" width="52" height="32" rx="6" fill="#ECFDF5"/>
    <text x="88" y="52" fontSize="16" fontWeight="800" fill="#059669">12k</text>
    <text x="88" y="62" fontSize="6" fill="#059669">Unités</text>
    <rect x="140" y="38" width="60" height="32" rx="6" fill="#FEF2F2"/>
    <text x="148" y="52" fontSize="16" fontWeight="800" fill="#DC2626">3</text>
    <text x="148" y="62" fontSize="6" fill="#DC2626">Ruptures</text>
    {/* Table rows */}
    <rect x="20" y="78" width="192" height="8" rx="3" fill="#F8FAFC"/>
    <rect x="20" y="78" width="70" height="8" rx="3" fill="#DDD6FE"/>
    <rect x="20" y="90" width="192" height="8" rx="3" fill="#F8FAFC"/>
    <rect x="20" y="90" width="100" height="8" rx="3" fill="#EDE9FE"/>
    <rect x="20" y="102" width="192" height="8" rx="3" fill="#F8FAFC"/>
    <rect x="20" y="102" width="55" height="8" rx="3" fill="#DDD6FE"/>
    {/* Package icon */}
    <rect x="172" y="79" width="34" height="9" rx="4" fill="#8B5CF6"/>
    <text x="176" y="86" fontSize="6" fill="white" fontWeight="600">+ Entrée</text>
  </svg>
)

/* ── Step 3 — AI insights illustration ── */
const IlluIA = () => (
  <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="step-illu-svg">
    <rect width="220" height="140" rx="14" fill="#ECFDF5"/>
    <defs>
      <filter id="s3" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.10"/>
      </filter>
    </defs>
    {/* Card */}
    <rect x="12" y="12" width="196" height="116" rx="10" fill="white" filter="url(#s3)"/>
    {/* Top */}
    <rect x="12" y="12" width="196" height="20" rx="10" fill="#059669"/>
    <rect x="12" y="24" width="196" height="8" fill="#059669"/>
    <text x="22" y="25" fontSize="8" fill="white" fontWeight="600">Prévisions IA — 30 jours</text>
    {/* Chart area */}
    <rect x="20" y="38" width="140" height="60" rx="6" fill="#F0FDF4"/>
    {/* Axes */}
    <line x1="30" y1="90" x2="152" y2="90" stroke="#A7F3D0" strokeWidth="1.5"/>
    <line x1="30" y1="44" x2="30" y2="90" stroke="#A7F3D0" strokeWidth="1.5"/>
    {/* Area chart fill */}
    <path d="M30,80 L50,72 L70,65 L90,58 L110,62 L130,50 L150,44 L150,90 L30,90 Z" fill="#BBF7D0" opacity="0.7"/>
    {/* Line */}
    <polyline points="30,80 50,72 70,65 90,58 110,62 130,50 150,44" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round"/>
    {/* Dots */}
    <circle cx="150" cy="44" r="4" fill="#059669"/>
    <circle cx="90" cy="58" r="3" fill="#34D399"/>
    {/* Alert badge */}
    <rect x="166" y="38" width="36" height="28" rx="6" fill="#FEF2F2"/>
    <text x="174" y="50" fontSize="14" fill="#DC2626" fontWeight="800">!</text>
    <text x="170" y="60" fontSize="5.5" fill="#DC2626" fontWeight="600">Rupture J+8</text>
    {/* Recommendations */}
    <rect x="20" y="106" width="80" height="8" rx="4" fill="#DCFCE7"/>
    <text x="26" y="113" fontSize="6" fill="#059669" fontWeight="600">Commander 50 unités</text>
    <rect x="108" y="106" width="92" height="8" rx="4" fill="#FEF9C3"/>
    <text x="114" y="113" fontSize="6" fill="#CA8A04" fontWeight="600">Confiance : 87%</text>
  </svg>
)

const steps = [
  {
    num: '01', Illu: IlluSignup, color: '#2563EB',
    title: 'Créez votre compte',
    desc: 'Inscription gratuite en 2 minutes, sans carte bancaire. Configurez vos entrepôts et importez vos produits.',
  },
  {
    num: '02', Illu: IlluStock, color: '#8B5CF6',
    title: 'Gérez vos stocks',
    desc: 'Enregistrez les entrées, sorties et transferts. L\'IA analyse chaque mouvement en temps réel.',
  },
  {
    num: '03', Illu: IlluIA, color: '#059669',
    title: 'Recevez des insights IA',
    desc: 'Alertes automatiques, prévisions de rupture à 30 jours et recommandations intelligentes.',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = el.querySelectorAll('.step-card')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.1 })
    items.forEach(c => obs.observe(c))
    return () => obs.disconnect()
  }, [])

  return (
    <section className="how-section" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="badge-pill how-badge">Comment ça marche</span>
          <h2>Opérationnel en 3 étapes</h2>
          <p>De l'inscription à vos premières prévisions IA, en moins de 10 minutes</p>
        </div>
        <div className="steps-row">
          {steps.map(({ num, Illu, color, title, desc }, i) => (
            <div key={num} className="step-wrap">
              <div className="step-card reveal" style={{ '--step-color': color, transitionDelay: `${i * 0.15}s` }}>
                <div className="step-num-badge">{num}</div>
                <div className="step-illu-wrap">
                  <Illu />
                </div>
                <h3 className="step-title">{title}</h3>
                <p className="step-desc">{desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="step-connector">
                  <ArrowRight size={20} className="step-arrow-icon" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
