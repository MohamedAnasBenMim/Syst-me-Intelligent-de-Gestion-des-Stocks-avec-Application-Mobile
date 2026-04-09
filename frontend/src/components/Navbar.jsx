import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import logoImg from '../assets/becarthai-logo.jpg'
import './Navbar.css'

const links = ['Fonctionnalités', 'Tarifs', 'À propos', 'Contact']

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-inner">

        {/* LOGO */}
        <a href="#" className="navbar-logo">
          <img src={logoImg} alt="BecarthAI" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 9 }} />
          <span>SGS <strong>SaaS</strong></span>
        </a>

        {/* LINKS */}
        <ul className="navbar-links">
          {links.map(l => (
            <li key={l}>
              <a href={`#${l.toLowerCase()}`}>{l}</a>
            </li>
          ))}
        </ul>

        {/* ACTIONS */}
        <div className="navbar-actions">
          <Link to="/login" className="btn-outline btn-sm">
            Se connecter
          </Link>
          <Link to="/register" className="btn-nav-cta btn-sm">
            Essai gratuit
          </Link>
        </div>

        {/* MOBILE */}
        <button className="hamburger" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="mobile-menu">
          <ul>
            {links.map(l => (
              <li key={l}>
                <a href={`#${l.toLowerCase()}`}>{l}</a>
              </li>
            ))}
          </ul>

          <div className="mobile-actions">
            <Link to="/login" className="btn btn-outline">
              Se connecter
            </Link>
            <Link to="/register" className="btn btn-outline">
              Essai gratuit
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
