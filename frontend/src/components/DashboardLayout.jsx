import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Layers, ArrowLeftRight, Bell, Mail, RefreshCw,
  BarChart2, Settings, LogOut, Brain, Package,
  Warehouse, ShoppingCart, Users, Search, ChevronDown, Tag,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getIaStats, getAlertes } from '../services/api'
import './DashboardLayout.css'

const navItems = [
  { to: '/dashboard',                      icon: Layers,         label: 'Dashboard'           },
  { to: '/dashboard/entrepots',            icon: Warehouse,      label: 'Entrepôts'           },
  { to: '/dashboard/produits',             icon: ShoppingCart,   label: 'Produits'            },
  { to: '/dashboard/stocks',               icon: Package,        label: 'Stocks'              },
  { to: '/dashboard/mouvements',           icon: ArrowLeftRight, label: 'Mouvements'          },
  { to: '/dashboard/alertes',              icon: Bell,           label: 'Alertes',   badge: 'alertes'  },
  { to: '/dashboard/notifications',        icon: Mail,           label: 'Notifications', badge: 'notifs' },
  { to: '/dashboard/reapprovisionnement',  icon: RefreshCw,      label: 'Réapprovisionnement' },
  { to: '/dashboard/reporting',            icon: BarChart2,      label: 'Reporting'           },
  { to: '/dashboard/promotions',           icon: Tag,            label: 'Promotions'          },
  { to: '/dashboard/utilisateurs',         icon: Users,          label: 'Utilisateurs'        },
  { to: '/dashboard/parametres',           icon: Settings,       label: 'Paramètres'          },
]

const PAGE_TITLES = {
  '/dashboard':                     { title: 'Tableau de bord', sub: 'SGS SaaS > Dashboard' },
  '/dashboard/entrepots':           { title: 'Entrepôts',       sub: 'SGS SaaS > Entrepôts' },
  '/dashboard/produits':            { title: 'Produits',        sub: 'SGS SaaS > Produits' },
  '/dashboard/stocks':              { title: 'Stocks',          sub: 'SGS SaaS > Stocks' },
  '/dashboard/mouvements':          { title: 'Mouvements',      sub: 'SGS SaaS > Mouvements' },
  '/dashboard/alertes':             { title: 'Alertes',         sub: 'SGS SaaS > Alertes' },
  '/dashboard/notifications':       { title: 'Notifications',   sub: 'SGS SaaS > Notifications' },
  '/dashboard/reapprovisionnement': { title: 'Réapprovisionnement', sub: 'SGS SaaS > Réapprovisionnement' },
  '/dashboard/reporting':           { title: 'Reporting',       sub: 'SGS SaaS > Reporting' },
  '/dashboard/promotions':          { title: 'Promotions',      sub: 'SGS SaaS > Promotions' },
  '/dashboard/utilisateurs':        { title: 'Utilisateurs',    sub: 'SGS SaaS > Utilisateurs' },
  '/dashboard/parametres':          { title: 'Paramètres',      sub: 'SGS SaaS > Paramètres' },
  '/dashboard/ia':                  { title: 'Assistant IA · RAG', sub: 'SGS SaaS > IA/RAG' },
}

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate    = useNavigate()
  const location    = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [iaStatus,    setIaStatus]    = useState(null)
  const [alertCount,  setAlertCount]  = useState(0)
  const [notifCount] = useState(0)
  const [search,      setSearch]      = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    getIaStats()
      .then(data => setIaStatus({ ok: true, model: data.llm_model, docs: data.documents_count }))
      .catch(() => setIaStatus({ ok: false }))
    getAlertes({ statut: 'active', per_page: 1 })
      .then(data => setAlertCount(data?.total ?? data?.alertes?.length ?? 0))
      .catch(() => {})
  }, [])

  function handleLogout() {
    logout()
    navigate('/')
  }

  const initiales  = user
    ? `${(user.prenom || user.nom || 'U')[0]}${(user.nom || '')[0] || ''}`.toUpperCase()
    : 'U'
  const nomComplet = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email : 'Utilisateur'
  const roleLabel  = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', operateur: 'Opérateur' }
  const roleDisplay = roleLabel[user?.role] || user?.role || 'Utilisateur'

  const page = PAGE_TITLES[location.pathname] || { title: 'Dashboard', sub: 'SGS SaaS' }
  const roleTitle = user?.role === 'admin' ? 'Admin' : user?.role === 'gestionnaire' ? 'Gestionnaire' : ''
  const fullPageTitle = roleTitle ? `${page.title} ${roleTitle}` : page.title

  const badges = { alertes: alertCount, notifs: notifCount }

  return (
    <div className="dash-shell">

      {/* ── Sidebar ── */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div className="ds-logo">
          <div className="ds-logo-icon">
            <Package size={18} color="var(--teal)" />
          </div>
          <div>
            <span className="ds-logo-name">SGS SaaS</span>
            <span className="ds-logo-version">v1.0</span>
          </div>
        </div>

        {/* Profil */}
        <div className="ds-profile">
          <div className="ds-avatar">{initiales}</div>
          <div className="ds-profile-info">
            <div className="ds-user-name">{nomComplet}</div>
            <span className="ds-role-badge">{roleDisplay}</span>
          </div>
        </div>

        <div className="ds-divider" />

        {/* Navigation */}
        <nav className="ds-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `ds-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {item.badge && badges[item.badge] > 0 && (
                <span className="ds-badge">{badges[item.badge]}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ds-divider" />

        {/* Déconnexion */}
        <button className="ds-logout" onClick={handleLogout}>
          <LogOut size={17} />
          <span>Déconnexion</span>
        </button>

        {/* IA/RAG Status */}
        <div className="ds-ia-status">
          <div className="ds-ia-icon">
            <Brain size={15} color="var(--teal)" />
          </div>
          <div className="ds-ia-info">
            <div className="ds-ia-label">
              IA/RAG {iaStatus?.ok ? 'Actif' : 'Inactif'}
            </div>
            <div className="ds-ia-sub">
              <span className={`ds-ia-dot ${iaStatus?.ok ? 'on' : 'off'}`} />
              {iaStatus?.ok ? `${iaStatus.model || 'Mistral'} connecté` : 'Service non disponible'}
            </div>
          </div>
          <NavLink to="/dashboard/ia" className="ds-ia-link" onClick={() => setSidebarOpen(false)}>
            Chat
          </NavLink>
        </div>

      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Contenu principal ── */}
      <div className="dash-main">

        {/* ── Topbar ── */}
        <header className="dash-topbar">
          <div className="topbar-left">
            <button className="dash-hamburger" onClick={() => setSidebarOpen(v => !v)}>
              <span /><span /><span />
            </button>
            <div className="topbar-title-wrap">
              <h2 className="topbar-title">{fullPageTitle}</h2>
              <span className="topbar-sub">{page.sub}</span>
            </div>
          </div>

          <div className="topbar-search-wrap">
            <Search size={15} className="topbar-search-icon" />
            <input
              className="topbar-search"
              placeholder="Rechercher un produit, entrepôt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="topbar-right">
            <button className="topbar-icon-btn" onClick={() => navigate(location.pathname)}
              title="Actualiser">
              <RefreshCw size={16} />
            </button>
            <button className="topbar-icon-btn topbar-bell" onClick={() => navigate('/dashboard/alertes')}>
              <Bell size={16} />
              {alertCount > 0 && <span className="topbar-bell-dot" />}
            </button>
            <div className="topbar-lang">FR</div>
            <button className="topbar-user" onClick={() => setUserMenuOpen(v => !v)}>
              <div className="topbar-avatar">{initiales}</div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{nomComplet}</span>
                <span className="topbar-user-role">{roleDisplay}</span>
              </div>
              <ChevronDown size={14} className={`topbar-chevron ${userMenuOpen ? 'open' : ''}`} />
            </button>
            {userMenuOpen && (
              <div className="topbar-user-menu">
                <button onClick={() => { setUserMenuOpen(false); navigate('/dashboard/parametres') }}>
                  <Settings size={14} /> Paramètres
                </button>
                <div className="menu-sep" />
                <button className="menu-logout" onClick={handleLogout}>
                  <LogOut size={14} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="dash-content">
          {children}
        </div>
      </div>

    </div>
  )
}
