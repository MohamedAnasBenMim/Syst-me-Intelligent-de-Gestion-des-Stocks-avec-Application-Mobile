import { Warehouse, Mail, Phone, MapPin, Globe, Share2, AtSign } from 'lucide-react'
import './Footer.css'

const links = {
  Produit:    ['Fonctionnalités', 'Tarifs', 'Nouveautés', 'Feuille de route'],
  Ressources: ['Documentation', 'API Reference', 'Blog', 'Tutoriels vidéo'],
  Entreprise: ['À propos', 'Carrières', 'Partenaires', 'Presse'],
  Légal:      ['Conditions', 'Confidentialité', 'Cookies', 'RGPD'],
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="footer-logo-icon">
                <Warehouse size={18} color="#fff" />
              </div>
              <span>SGS <strong>SaaS</strong></span>
            </div>
            <p className="footer-tagline">
              La plateforme intelligente de gestion de stock pour les entreprises de la région MENA. IA prédictive, multi-entrepôts, temps réel.
            </p>
            <div className="footer-contact">
              {[
                { icon: Mail,   text: 'contact@sgssaas.com' },
                { icon: Phone,  text: '+216 70 123 456' },
                { icon: MapPin, text: 'Tunis, Tunisie' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="footer-contact-item">
                  <Icon size={13} /> <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([title, items]) => (
            <div key={title} className="footer-col">
              <div className="footer-col-title">{title}</div>
              <ul>
                {items.map(item => (
                  <li key={item}><a href="#">{item}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <div className="footer-copy">
            © 2025 SGS SaaS. Tous droits réservés.
          </div>
          <div className="footer-socials">
            <a href="#" aria-label="GitHub"><Globe size={18} /></a>
            <a href="#" aria-label="LinkedIn"><Share2 size={18} /></a>
            <a href="#" aria-label="Email"><AtSign size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}
