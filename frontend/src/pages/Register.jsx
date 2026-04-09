import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Eye, EyeOff, Building2, User, ChevronDown, Check, Camera } from 'lucide-react'
import { register as apiRegister } from '../services/api'
import logoImg from '../assets/becarthai-logo.jpg'
import './Register.css'

/* ── force du mot de passe ── */
function getStrength(pw) {
  let score = 0
  if (pw.length >= 8)          score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score // 0-4
}
const strengthLabel = ['', 'Faible', 'Moyen', 'Bien', 'Fort']
const strengthColor = ['', '#DC3545', '#FFC107', '#0694A2', '#28A745']

export default function Register() {
  const [form, setForm] = useState({
    prenom: '', nom: '', email: '', password: '', confirm: '',
    role: '', entreprise: '', matricule: '', terms: false,
  })
  const [showPw,    setShowPw]    = useState(false)
  const [showCf,    setShowCf]    = useState(false)
  const [errors,    setErrors]    = useState({})
  const [loading,   setLoading]   = useState(false)
  const [apiError,  setApiError]  = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const photoBase64 = useRef(null)
  const fileInputRef = useRef(null)

  const strength = getStrength(form.password)

  const update = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setErrors(err => ({ ...err, [name]: '' }))
  }

  const handlePhotoChange = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      photoBase64.current = ev.target.result
      setPhotoPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const validate = () => {
    const e = {}
    if (!form.prenom.trim())    e.prenom    = 'Prénom requis'
    if (!form.nom.trim())       e.nom       = 'Nom requis'
    if (!form.email.includes('@')) e.email  = 'Email invalide'
    if (form.password.length < 8)  e.password = 'Min. 8 caractères'
    if (form.password !== form.confirm) e.confirm = 'Les mots de passe ne correspondent pas'
    if (!form.role)             e.role      = 'Choisissez un rôle'
    if (!form.entreprise.trim()) e.entreprise = 'Entreprise requise'
    if (!form.terms)            e.terms     = 'Vous devez accepter les conditions'
    return e
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setApiError('')
    try {
      await apiRegister({
        prenom:   form.prenom,
        nom:      form.nom,
        email:    form.email,
        password: form.password,
        role:     form.role,
      })
      // Sauvegarder la photo de profil localement
      if (photoBase64.current) {
        localStorage.setItem(`sgs_avatar_${form.email.toLowerCase()}`, photoBase64.current)
      }
      setSubmitted(true)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="register-success">
        <div className="success-box">
          <div className="success-icon"><Check size={32} color="#fff" /></div>
          <h2>Compte créé avec succès !</h2>
          <p>Bienvenue sur SGS SaaS. Vous pouvez maintenant vous connecter.</p>
          <Link to="/login" className="btn btn-primary">Se connecter</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="register-layout">

      {/* ── GAUCHE (illustration bleue, affichée à droite via CSS order) ── */}
      <aside className="register-left">
        <div className="geo-tr" /><div className="geo-bl" />

        {/* Floating avatars */}
        <img src="https://i.pravatar.cc/60?u=avatar.reg.1" alt="" className="float-avatar fa-1" />
        <img src="https://i.pravatar.cc/46?u=avatar.reg.2" alt="" className="float-avatar fa-2" />
        <img src="https://i.pravatar.cc/54?u=avatar.reg.5" alt="" className="float-avatar fa-3" />

        <div className="rl-logo"><span>SGS SaaS</span></div>

        <div className="rl-body">
          <div className="rl-cards">
            {/* Stock overview card */}
            <div className="rl-card rl-card-top">
              <div className="rl-card-title">Aperçu des stocks</div>
              <div className="rl-rows">
                {[
                  { label:'Entrepôt A', pct:78, color:'#5784BA', val:'78%' },
                  { label:'Entrepôt B', pct:45, color:'#F59E0B', val:'45%' },
                  { label:'Entrepôt C', pct:92, color:'#059669', val:'92%' },
                ].map(r => (
                  <div key={r.label} className="rl-row">
                    <div className="rl-dot" style={{background:r.color}}/>
                    <div className="rl-bar"><div className="rl-bar-fill" style={{width:r.pct+'%',background:r.color}}/></div>
                    <div className="rl-val">{r.val}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Summary card */}
            <div className="rl-card rl-card-bottom">
              <div>
                <div className="rl-big-num">247</div>
                <div className="rl-big-label">Produits actifs</div>
              </div>
              <div>
                <div className="rl-mini-badge">+12% ce mois</div>
              </div>
            </div>
          </div>

          <ul className="rl-bullets">
            {[
              'Gestion multi-entrepôts illimitée',
              'Alertes intelligentes automatiques',
              'Prévisions IA à 30 jours',
              'Tableau de bord analytique en temps réel',
            ].map(item => (
              <li key={item}>
                <span className="bullet-check"><Check size={12} color="#fff" /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="rl-footer">© 2025 SGS SaaS · Tous droits réservés</p>
      </aside>

      {/* ── DROITE (formulaire, affiché à gauche via CSS order) ── */}
      <main className="register-right">
        <div className="register-card">
          {/* Logo */}
          <div className="rl-logo-top">
            <div className="rl-logo-icon">
              <img src={logoImg} alt="BecarthAI" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
            </div>
            <span className="rl-logo-text">SGS <strong>SaaS</strong></span>
          </div>

          <div className="rc-header">
            <div className="rc-title">Créer votre compte</div>
            <p className="rc-sub">Déjà inscrit ? <Link to="/login" className="rc-link">Se connecter</Link></p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Photo de profil */}
            <div className="photo-upload-wrap">
              <button type="button" className="photo-upload-btn" onClick={() => fileInputRef.current?.click()}>
                {photoPreview
                  ? <img src={photoPreview} alt="Aperçu" className="photo-preview" />
                  : <div className="photo-placeholder"><Camera size={20} color="#9AC8EB" /></div>
                }
                <span className="photo-upload-label">Photo de profil</span>
              </button>
              <input
                ref={fileInputRef}
                type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
            </div>

            {/* Prénom + Nom */}
            <div className="form-row">
              <div className="form-group">
                <label>Prénom</label>
                <div className="input-wrap">
                  <User size={15} className="input-icon" />
                  <input name="prenom" placeholder="Prénom" value={form.prenom} onChange={update}
                    className={errors.prenom ? 'error' : ''} />
                </div>
                {errors.prenom && <span className="form-error">{errors.prenom}</span>}
              </div>
              <div className="form-group">
                <label>Nom</label>
                <div className="input-wrap">
                  <User size={15} className="input-icon" />
                  <input name="nom" placeholder="Nom" value={form.nom} onChange={update}
                    className={errors.nom ? 'error' : ''} />
                </div>
                {errors.nom && <span className="form-error">{errors.nom}</span>}
              </div>
            </div>

            {/* Email */}
            <div className="form-group">
              <label>Email professionnel</label>
              <div className="input-wrap">
                <Mail size={15} className="input-icon" />
                <input name="email" type="email" placeholder="vous@entreprise.com"
                  value={form.email} onChange={update}
                  className={errors.email ? 'error' : ''} />
              </div>
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            {/* Mot de passe */}
            <div className="form-group">
              <label>Mot de passe</label>
              <div className="input-wrap">
                <input name="password" type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 caractères" value={form.password} onChange={update}
                  className={errors.password ? 'error' : ''} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Barre de force */}
              {form.password && (
                <div className="strength-wrap">
                  <div className="strength-bar">
                    {[1,2,3,4].map(s => (
                      <div key={s} className="strength-seg"
                        style={{ background: s <= strength ? strengthColor[strength] : '#e9ecef' }} />
                    ))}
                  </div>
                  <span style={{ color: strengthColor[strength], fontSize: '11px', fontWeight: 600 }}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            {/* Confirmer */}
            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <div className="input-wrap">
                <input name="confirm" type={showCf ? 'text' : 'password'}
                  placeholder="Répétez le mot de passe" value={form.confirm} onChange={update}
                  className={errors.confirm ? 'error' : ''} />
                <button type="button" className="pw-toggle" onClick={() => setShowCf(v => !v)}>
                  {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm && <span className="form-error">{errors.confirm}</span>}
            </div>

            {/* Rôle */}
            <div className="form-group">
              <label>Rôle</label>
              <div className="input-wrap select-wrap">
                <select name="role" value={form.role} onChange={update}
                  className={errors.role ? 'error' : ''}>
                  <option value="">Votre rôle</option>
                  <option value="admin">Admin</option>
                  <option value="gestionnaire">Gestionnaire</option>
                  <option value="operateur">Opérateur</option>
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
              {errors.role && <span className="form-error">{errors.role}</span>}
            </div>

            {/* Entreprise + Matricule */}
            <div className="form-row">
              <div className="form-group">
                <label>Entreprise</label>
                <div className="input-wrap">
                  <Building2 size={15} className="input-icon" />
                  <input name="entreprise" placeholder="Votre entreprise"
                    value={form.entreprise} onChange={update}
                    className={errors.entreprise ? 'error' : ''} />
                </div>
                {errors.entreprise && <span className="form-error">{errors.entreprise}</span>}
              </div>
              <div className="form-group">
                <label>Matricule</label>
                <div className="input-wrap">
                  <input name="matricule" placeholder="Ex: MAT-0042"
                    value={form.matricule} onChange={update} />
                </div>
              </div>
            </div>

            {/* CGU */}
            <div className="form-check">
              <label className={`check-label ${errors.terms ? 'error' : ''}`}>
                <input type="checkbox" name="terms" checked={form.terms} onChange={update} />
                <span>
                  J'accepte les <a href="#" className="rc-link">conditions d'utilisation</a> et la{' '}
                  <a href="#" className="rc-link">politique de confidentialité</a>
                </span>
              </label>
              {errors.terms && <span className="form-error">{errors.terms}</span>}
            </div>

            {/* Erreur API */}
            {apiError && (
              <div className="api-error">{apiError}</div>
            )}

            {/* Submit */}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Création en cours…' : 'Créer mon compte'}
            </button>

            {/* Divider */}
            <div className="divider"><span>ou</span></div>

            {/* Google */}
            <button type="button" className="btn-google">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"/>
              </svg>
              Continuer avec Google
            </button>

          </form>

          <p className="rc-note">Aucune carte bancaire requise — Essai gratuit 14 jours</p>
        </div>
      </main>

    </div>
  )
}
