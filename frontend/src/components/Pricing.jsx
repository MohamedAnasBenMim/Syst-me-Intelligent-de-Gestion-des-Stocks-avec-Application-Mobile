import { useEffect, useRef } from 'react'
import { Check, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Pricing.css'

const plans = [
  {
    name: 'Starter', price: 'Gratuit', sub: 'Pour toujours', featured: false,
    cta: 'Commencer gratuitement', ctaLink: '/register', ctaClass: 'btn-outline-navy',
    features: [
      '1 entrepôt', '50 produits max', 'Dashboard standard',
      'Alertes email basiques', 'Support communauté',
    ],
  },
  {
    name: 'Pro', price: '29 DT', sub: '/ mois HT', featured: true, badge: 'Le plus populaire',
    cta: "Démarrer l'essai gratuit", ctaLink: '/register', ctaClass: 'btn-primary',
    features: [
      '5 entrepôts', 'Produits illimités', 'Dashboard avancé',
      'Alertes IA & anomalies', 'Support prioritaire',
      'Prévisions ML 30 jours', 'Notifications push & email',
    ],
  },
  {
    name: 'Enterprise', price: 'Sur mesure', sub: 'Contactez-nous', featured: false,
    cta: "Contacter l'équipe", ctaLink: '#contact', ctaClass: 'btn-outline-navy',
    features: [
      'Entrepôts illimités', 'Produits illimités', 'Dashboard personnalisé',
      'Alertes IA & anomalies', 'Account manager dédié',
      'Prévisions ML 30 jours', 'Notifications push & email', 'API dédiée + ERP/WMS',
    ],
  },
]

export default function Pricing() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cards = el.querySelectorAll('.pricing-card')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.1 })
    cards.forEach(c => obs.observe(c))
    return () => obs.disconnect()
  }, [])

  return (
    <section id="tarifs" className="pricing-section" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="badge-pill">Tarifs</span>
          <h2>Des prix simples et transparents</h2>
          <p>Commencez gratuitement et évoluez à votre rythme. Annulable à tout moment.</p>
        </div>

        {/* ── Pricing cards ── */}
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`pricing-card reveal ${plan.featured ? 'pricing-card--featured' : ''}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              {plan.badge && (
                <div className="pricing-badge">
                  <Zap size={12} /> {plan.badge}
                </div>
              )}
              <div className="pricing-header">
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-price">{plan.price}</div>
                <div className="pricing-sub">{plan.sub}</div>
              </div>
              <ul className="pricing-features">
                {plan.features.map(f => (
                  <li key={f}>
                    <Check size={15} className="check-icon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to={plan.ctaLink} className={`btn ${plan.ctaClass} pricing-cta`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
