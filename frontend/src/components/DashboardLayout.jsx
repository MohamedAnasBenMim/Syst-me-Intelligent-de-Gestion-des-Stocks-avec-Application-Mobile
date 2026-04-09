import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Layers, ArrowLeftRight, Bell, Mail, RefreshCw,
  BarChart2, Settings, LogOut, Brain,
  Warehouse, ShoppingCart, Users, Search, ChevronDown, Tag,
  AlertTriangle, X, Package,
} from 'lucide-react'
import logoImg from '../assets/becarthai-logo.jpg'
import { useAuth } from '../context/AuthContext'
import { useClerk } from '@clerk/react'
import { getIaStats, getAlertes, getNotifications, verifierExpirations, verifierStocks } from '../services/api'
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
  const { user, logout, avatar } = useAuth()
  const { signOut: clerkSignOut } = useClerk()
  const navigate    = useNavigate()
  const location    = useLocation()
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [iaStatus,     setIaStatus]     = useState(null)
  const [alertCount,   setAlertCount]   = useState(0)
  const [notifCount,   setNotifCount]   = useState(0)
  const [search,       setSearch]       = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [toasts,       setToasts]       = useState([])   // notifications in-app
  const prevAlertCount = useRef(null)
  const pushGranted    = useRef(false)

  // ── Demander permission notifications navigateur ─────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        pushGranted.current = p === 'granted'
      })
    } else if ('Notification' in window) {
      pushGranted.current = Notification.permission === 'granted'
    }
  }, [])

  // ── Afficher une notification navigateur ─────────────────
  const pushBrowserNotif = useCallback((titre, corps) => {
    if (pushGranted.current && 'Notification' in window) {
      try {
        new Notification(titre, {
          body: corps,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'sgs-alerte',
          renotify: true,
        })
      } catch (_) {}
    }
  }, [])

  // ── Ajouter un toast in-app ───────────────────────────────
  const addToast = useCallback((message, niveau = 'critique') => {
    const id = Date.now()
    setToasts(prev => [...prev.slice(-3), { id, message, niveau }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  // ── Polling notifications (toutes les 60 secondes) ───────
  const fetchNotifCount = useCallback(async () => {
    try {
      const data = await getNotifications({ per_page: 1 })
      setNotifCount(data?.total ?? 0)
    } catch (_) {}
  }, [])

  // ── Polling alertes actives (toutes les 30 secondes) ─────
  const fetchAlertCount = useCallback(async () => {
    try {
      const data = await getAlertes({ statut: 'ACTIVE', per_page: 1 })
      const count = data?.total ?? data?.alertes?.length ?? 0
      setAlertCount(count)

      // Notifier si de nouvelles alertes sont apparues
      if (prevAlertCount.current !== null && count > prevAlertCount.current) {
        const diff = count - prevAlertCount.current
        const msg  = `${diff} nouvelle(s) alerte(s) critique(s) dans votre stock !`
        pushBrowserNotif('⚠️ SGS SaaS — Nouvelle alerte', msg)
        addToast(msg, 'critique')
      }
      prevAlertCount.current = count
    } catch (_) {}
  }, [pushBrowserNotif, addToast])

  // ── Scanner stocks critiques + expirations (démarrage + toutes les 5 min) ─
  const scanExpirations = useCallback(async () => {
    try { await verifierExpirations(30) } catch (_) {}
    try { await verifierStocks() } catch (_) {}
  }, [])

  useEffect(() => {
    getIaStats()
      .then(data => setIaStatus({ ok: true, model: data.llm_model, docs: data.documents_count }))
      .catch(() => setIaStatus({ ok: false }))

    fetchAlertCount()
    fetchNotifCount()
    scanExpirations()   // scan immédiat au chargement

    const alertInterval = setInterval(fetchAlertCount,  30_000)
    const notifInterval = setInterval(fetchNotifCount,  60_000)
    const expInterval   = setInterval(scanExpirations, 600_000) // toutes les 10 min
    return () => { clearInterval(alertInterval); clearInterval(notifInterval); clearInterval(expInterval) }
  }, [fetchAlertCount, fetchNotifCount, scanExpirations])

  async function handleLogout() {
    logout()
    await clerkSignOut()
    navigate('/login', { replace: true })
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
          <div className="ds-logo-icon" style={{ background: 'transparent', padding: 0, overflow: 'hidden', borderRadius: 8 }}>
            <img src={logoImg} alt="Logo" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
          </div>
          <div>
            <span className="ds-logo-name">SGS SaaS</span>
            <span className="ds-logo-version">v1.0</span>
          </div>
        </div>

        {/* Profil */}
        <div className="ds-profile">
          <div className="ds-avatar">
            {avatar
              ? <img src={avatar} alt="profil" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initiales}
          </div>
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
              <div className="topbar-avatar">
                {avatar
                  ? <img src={avatar} alt="profil" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : initiales}
              </div>
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

      {/* ── Toasts notifications in-app ── */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', flexDirection: 'column', gap: 10,
          zIndex: 9999, maxWidth: 360,
        }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              background: t.niveau === 'critique' ? '#FEF2F2' : '#FFF7ED',
              border: `1.5px solid ${t.niveau === 'critique' ? '#EF4444' : '#F97316'}`,
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              animation: 'slideIn 0.3s ease',
            }}>
              <AlertTriangle size={18} color={t.niveau === 'critique' ? '#EF4444' : '#F97316'}
                style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13,
                  color: t.niveau === 'critique' ? '#B91C1C' : '#C2410C' }}>
                  Alerte Stock
                </div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{t.message}</div>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9CA3AF', padding: 0, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
