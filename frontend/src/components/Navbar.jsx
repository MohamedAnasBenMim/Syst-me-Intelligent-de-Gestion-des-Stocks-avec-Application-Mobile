import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import './Navbar.css'

const SGSLogo = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="10" fill="url(#logo-grad)"/>
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#5784BA"/>
        <stop offset="100%" stopColor="#9AC8EB"/>
      </linearGradient>
    </defs>
    {/* Warehouse roof */}
    <polygon points="6,16 18,7 30,16" fill="white" opacity="0.95"/>
    {/* Building body */}
    <rect x="8" y="16" width="20" height="13" rx="1.5" fill="white" opacity="0.85"/>
    {/* Door */}
    <rect x="15" y="21" width="6" height="8" rx="1" fill="#5784BA"/>
    {/* Left window */}
    <rect x="10" y="18" width="4" height="3" rx="1" fill="#B6D8F2"/>
    {/* Right window */}
    <rect x="22" y="18" width="4" height="3" rx="1" fill="#B6D8F2"/>
    {/* Pulse dot (live indicator) */}
    <circle cx="28" cy="8" r="3.5" fill="#F4CFDF"/>
    <circle cx="28" cy="8" r="2" fill="white"/>
  </svg>
)

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
          <SGSLogo />
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