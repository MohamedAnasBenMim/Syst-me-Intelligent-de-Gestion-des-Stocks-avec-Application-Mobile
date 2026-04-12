import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Eye, EyeOff, Check } from 'lucide-react'
import { login as apiLogin } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useSignIn } from '@clerk/react/legacy'
import { useClerk } from '@clerk/react'
import logoImg from '../assets/becarthai-logo.jpg'
import './Login.css'

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { saveLogin } = useAuth()

  const { signIn, isLoaded: clerkLoaded } = useSignIn()
  const { signOut: clerkSignOut } = useClerk()

  const [form, setForm]     = useState({ email: '', password: '', remember: false })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  // Message de succès après inscription
  const justRegistered = location.state?.registered

  const update = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setErrors(err => ({ ...err, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.email.includes('@')) e.email    = 'Email invalide'
    if (form.password.length < 6)  e.password = 'Mot de passe requis'
    return e
  }

  const handleGoogleLogin = async () => {
    console.log('[Google] clerkLoaded:', clerkLoaded, '| signIn:', signIn)
    if (!clerkLoaded) { setApiError('Clerk non initialisé, rechargez la page'); return }
    if (!signIn)      { setApiError('signIn indisponible, rechargez la page'); return }

    setGoogleLoading(true)
    setApiError('')
    try {
      // Déconnecte toute session Clerk existante avant de relancer OAuth
      try { await clerkSignOut() } catch (_) {}

      const origin = window.location.origin
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: `${origin}/google-welcome`,
      })
    } catch (err) {
      console.error('[Google OAuth] erreur complète:', err)
      setApiError(err?.errors?.[0]?.message || err.message || JSON.stringify(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setApiError('')
    try {
      const data = await apiLogin({ email: form.email, password: form.password })
      saveLogin(data.access_token, { id: data.user_id, role: data.role })
      navigate('/dashboard')
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-layout">

      {/* ── GAUCHE (illustration bleue) ── */}
      <aside className="login-left">
        <div className="geo-top-left" />
        <div className="geo-bottom-right" />

        <img src="https://i.pravatar.cc/56?u=avatar.login.2" alt="" className="float-avatar fa-1" />
        <img src="https://i.pravatar.cc/44?u=avatar.login.4" alt="" className="float-avatar fa-2" />
        <img src="https://i.pravatar.cc/48?u=avatar.login.5" alt="" className="float-avatar fa-4" />

        <div className="ll-logo">
          <span>SGS SaaS</span>
        </div>

        <div className="ll-body">
          <div className="ll-cards">
            <div className="ll-card ll-card-kpi">
              <div className="kpi-block"><div className="kv">247</div><div className="kl">Produits</div></div>
              <div className="kpi-divider"/>
              <div className="kpi-block"><div className="kv" style={{color:'#DC2626'}}>5</div><div className="kl">Alertes</div></div>
              <div className="kpi-divider"/>
              <div className="kpi-block"><div className="kv" style={{color:'#059669'}}>128</div><div className="kl">Mouvements</div></div>
            </div>
            <div className="ll-card ll-card-chart">
              <div className="cc-title">Flux de stock mensuel</div>
              <div className="cc-bars">
                {[55,70,45,85,60,78,90,65,80,70].map((h,i) => (
                  <div key={i} className="cc-bar" style={{height:`${h}%`}}/>
                ))}
              </div>
            </div>
          </div>

          <ul className="ll-bullets">
            {[
              'Tableau de bord en temps réel',
              'Alertes IA et détection d\'anomalies',
              'Rapports et prévisions ML',
            ].map(item => (
              <li key={item}>
                <span className="bullet-check"><Check size={12} color="#fff" /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="ll-footer">© 2025 SGS SaaS · Tous droits réservés</p>
      </aside>

      {/* ── DROITE (formulaire) ── */}
      <main className="login-right">
        <div className="login-card">
          <div className="ll-logo-top">
            <div className="ll-logo-icon">
              <img src={logoImg} alt="BecarthAI" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
            </div>
            <span className="ll-logo-text">SGS <strong>SaaS</strong></span>
          </div>

          <div className="lc-header">
            <div className="lc-title">Se connecter</div>
            <p className="lc-sub">Pas encore de compte ? <Link to="/register" className="lc-link">Créer un compte</Link></p>
          </div>

          {justRegistered && (
            <div className="api-success">
              ✓ Compte créé avec succès ! Connectez-vous.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <div className="input-wrap">
                <Mail size={15} className="input-icon" />
                <input id="login-email" name="email" type="email"
                  placeholder="vous@entreprise.com"
                  autoComplete="email"
                  value={form.email} onChange={update}
                  className={errors.email ? 'error' : ''} />
              </div>
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <div className="pw-label-row">
                <label htmlFor="login-password">Mot de passe</label>
                <Link to="/forgot-password" className="lc-link" style={{ fontSize: '12px' }}>Mot de passe oublié ?</Link>
              </div>
              <div className="input-wrap">
                <input id="login-password" name="password" type={showPw ? 'text' : 'password'}
                  placeholder="Votre mot de passe" value={form.password} onChange={update}
                  autoComplete="current-password"
                  className={errors.password ? 'error' : ''}
                  style={{ paddingLeft: '12px', paddingRight: '40px' }} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <div className="form-check" style={{ marginBottom: '24px' }}>
              <label className="check-label">
                <input type="checkbox" name="remember" checked={form.remember} onChange={update} />
                <span>Se souvenir de moi</span>
              </label>
            </div>

            {apiError && <div className="api-error">{apiError}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>

          </form>

          <div className="divider">
            <span>ou</span>
          </div>

          <button
            type="button"
            className="btn btn-google btn-full"
            onClick={handleGoogleLogin}
            disabled={!clerkLoaded || googleLoading}
          >
            {googleLoading
              ? <span style={{ width: 18, height: 18, border: '2px solid #cbd5e1', borderTopColor: '#5784BA', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', marginRight: 8 }} />
              : <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 8, flexShrink: 0 }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
            }
            Se connecter avec Google
          </button>

          <p className="lc-note">Aucune carte bancaire requise — Essai gratuit 14 jours</p>
        </div>
      </main>

    </div>
  )
}
