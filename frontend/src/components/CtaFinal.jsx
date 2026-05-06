import { Link } from 'react-router-dom'
import { ArrowRight, MessageSquare } from 'lucide-react'
import './CtaFinal.css'

export default function CtaFinal() {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-box">
          <div className="cta-blob cta-blob-1" />
          <div className="cta-blob cta-blob-2" />
          <div className="cta-inner">
            <div className="cta-badge">Commencez aujourd'hui</div>
            <h2 className="cta-title">
              Prêt à transformer votre<br />gestion de stock ?
            </h2>
            <p className="cta-sub">
              Rejoignez 500+ entreprises qui pilotent leur stock avec l'IA.
              Sans carte bancaire, configuré en 5 minutes.
            </p>
            <div className="cta-actions">
              <Link to="/register" className="btn btn-white">
                Créer mon compte gratuit <ArrowRight size={16} />
              </Link>
              <a href="#contact" className="btn btn-outline-white">
                <MessageSquare size={16} /> Parler à un expert
              </a>
            </div>
            <div className="cta-perks">
              {['Aucune carte requise', 'Configuration en 5 min', 'Annulable à tout moment'].map(p => (
                <span key={p} className="cta-perk">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
