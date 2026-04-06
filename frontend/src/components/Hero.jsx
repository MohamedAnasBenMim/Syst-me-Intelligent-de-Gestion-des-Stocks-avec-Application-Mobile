import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Play, CheckCircle2 } from 'lucide-react'
import './Hero.css'

export default function Hero() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const items = el.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      })
    }, { threshold: 0.1 })

    items.forEach(i => obs.observe(i))
    return () => obs.disconnect()
  }, [])

  return (
    <section className="hero" ref={ref}>
      <div className="hero-blob hero-blob-1" />
      <div className="hero-blob hero-blob-2" />

      <div className="container hero-center">
        <h1 className="hero-title reveal">
          Gérez votre stock<br />
          <span className="hero-gradient">avec intelligence</span>
        </h1>

        <p className="hero-subtitle reveal reveal-delay-1">
          La solution SaaS complète pour les TPE/PME. Alertes automatiques,
          prévisions ML Prophet, multi-entrepôts tout en un.
        </p>

        <div className="hero-buttons reveal reveal-delay-1">
          <Link to="/register" className="btn btn-outline hero-cta">
            Commencer gratuitement
          </Link>

          <a href="#fonctionnalites" className="btn btn-outline">
            <Play size={15} /> Voir la démo
          </a>
        </div>

        <div className="trust-row reveal reveal-delay-2">
          {['Sans carte bancaire', '14 jours gratuits', 'Support 24/7'].map(t => (
            <span key={t} className="trust-item">
              <CheckCircle2 size={14} /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}