import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import './FAQ.css'

const faqs = [
  {
    q: 'Suis-je concerné par la gestion de stock informatisée ?',
    a: 'Toute entreprise gérant des produits physiques bénéficie d\'une gestion de stock informatisée. Que vous ayez 1 ou 50 entrepôts, SGS SaaS s\'adapte à votre taille : les TPE profitent d\'un suivi simple et fiable, tandis que les PME et grandes entreprises exploitent les prévisions IA, l\'API REST et les intégrations ERP pour piloter leur stock avec précision.',
  },
  {
    q: 'Ai-je besoin de compétences techniques pour adopter SGS SaaS ?',
    a: 'Aucune compétence technique n\'est requise. L\'interface a été conçue pour être prise en main en moins de 10 minutes. Un assistant d\'onboarding vous guide à travers la création de vos entrepôts, l\'import de produits (CSV/Excel) et la configuration des alertes. Pour les équipes techniques, une API REST documentée Swagger est disponible.',
  },
  {
    q: 'Comment fonctionnent les prévisions IA à 30 jours ?',
    a: 'SGS SaaS utilise Facebook Prophet combiné à une régression linéaire pour analyser l\'historique de vos mouvements de stock. Le modèle calcule les tendances de consommation, détecte les saisonnalités et prédit les ruptures potentielles jusqu\'à 30 jours à l\'avance. En cas d\'historique insuffisant, un fallback intelligent basé sur votre stock actuel prend le relais automatiquement.',
  },
  {
    q: 'Puis-je importer mes données existantes depuis Excel ou un ERP ?',
    a: 'Oui. SGS SaaS supporte l\'import CSV et Excel pour les produits, entrepôts et mouvements historiques. Pour les ERP (SAP, Sage, Odoo…), l\'API REST documentée permet une intégration bidirectionnelle. Des connecteurs natifs sont disponibles sur le plan Enterprise. Vos données restent les vôtres et sont exportables à tout moment.',
  },
  {
    q: 'Comment sont détectées les anomalies de stock ?',
    a: 'SGS SaaS intègre l\'algorithme Isolation Forest, une technique de machine learning non supervisé, pour détecter en temps réel les comportements anormaux : chutes soudaines de stock, mouvements atypiques, surstock ou sous-stock par rapport aux patterns historiques. Chaque anomalie déclenche une alerte configurée selon vos seuils personnalisés.',
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    a: 'Absolument. Toutes les communications sont chiffrées en TLS 1.3. L\'authentification repose sur JWT avec expiration courte et refresh token. Le système gère 3 niveaux d\'accès (Administrateur, Gestionnaire, Opérateur). Les données sont sauvegardées quotidiennement. Le plan Enterprise inclut un SLA de disponibilité à 99,9%.',
  },
]

function FaqItem({ faq, index }) {
  const [open, setOpen]       = useState(false)
  const [visible, setVisible] = useState(false)
  const [height, setHeight]   = useState(0)
  const itemRef = useRef(null)
  const bodyRef = useRef(null)

  /* Scroll-reveal via state (not external classList) */
  useEffect(() => {
    const el = itemRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setVisible(true) })
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  /* Measure height after DOM update */
  useEffect(() => {
    if (open && bodyRef.current) {
      setHeight(bodyRef.current.scrollHeight)
    } else {
      setHeight(0)
    }
  }, [open])

  return (
    <div
      ref={itemRef}
      className={`faq-item${open ? ' open' : ''}${visible ? ' faq-visible' : ''}`}
      style={{ transitionDelay: `${index * 0.07}s` }}
    >
      <button className="faq-question" onClick={() => setOpen(o => !o)}>
        <span className="faq-num">0{index + 1}</span>
        <span className="faq-q-text">{faq.q}</span>
        <ChevronDown size={18} className="faq-chevron" />
      </button>
      <div
        className="faq-answer"
        ref={bodyRef}
        style={{ maxHeight: height + 'px' }}
      >
        <p className="faq-answer-text">{faq.a}</p>
      </div>
    </div>
  )
}

export default function FAQ() {
  return (
    <section className="faq-section">
      <div className="container">
        <div className="section-header">
          <span className="badge-pill faq-badge">FAQ</span>
          <h2>Questions fréquentes sur SGS SaaS</h2>
          <p>Réponses courtes et claires pour vous aider à comprendre tout ce dont vous avez besoin avant de commencer.</p>
        </div>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <FaqItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
