import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { forgotPassword, resetPassword } from '../services/api'
import logoImg from '../assets/becarthai-logo.jpg'
import './Login.css'

function getStrength(pw) {
  let s = 0
  if (pw.length >= 8)          s++
  if (/[A-Z]/.test(pw))        s++
  if (/[0-9]/.test(pw))        s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}
const strengthLabel = ['', 'Faible', 'Moyen', 'Bien', 'Fort']
const strengthColor = ['', '#DC3545', '#FFC107', '#0694A2', '#28A745']

export default function ForgotPassword() {
  const navigate = useNavigate()

  // Étape 1 : email
  const [email,   setEmail]   = useState('')
  // Étape 2 : code OTP (6 chiffres séparés)
  const [otp,     setOtp]     = useState(['', '', '', '', '', ''])
  // Étape 3 : nouveau mot de passe
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [showCf,    setShowCf]    = useState(false)

  const [step,          setStep]          = useState(1)   // 1 | 2 | 3 | 'done'
  const [sessionToken,  setSessionToken]  = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')

  const otpRefs = useRef([])
  const strength = getStrength(password)

  // ── Étape 1 : envoyer l'email ─────────────────────────────
  const handleSendEmail = async e => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Email invalide'); return }
    setLoading(true); setError('')
    try {
      const res = await forgotPassword(email)
      setSessionToken(res.session_token || '')
    } catch (_) {
      // On avance quand même pour ne pas révéler si l'email existe
      setSessionToken('')
    } finally {
      setLoading(false)
      setStep(2)
    }
  }

  // ── Gestion saisie OTP case par case ─────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    setError('')
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }
  const handleOtpPaste = e => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      otpRefs.current[5]?.focus()
    }
    e.preventDefault()
  }

  // ── Étape 2 : valider le code → passer à étape 3 ─────────
  const handleVerifyCode = e => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setError('Entrez les 6 chiffres du code'); return }
    setError('')
    setStep(3)
  }

  // ── Étape 3 : changer le mot de passe ────────────────────
  const handleReset = async e => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Minimum 6 caractères'); return }
    if (password !== confirm)  { setError('Les mots de passe ne correspondent pas'); return }

    setLoading(true)
    try {
      await resetPassword(sessionToken, otp.join(''), password)
      setStep('done')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message)
      // Si le code est mauvais, revenir à l'étape 2
      if (err.message?.toLowerCase().includes('code') ||
          err.message?.toLowerCase().includes('invalide') ||
          err.message?.toLowerCase().includes('expiré')) {
        setStep(2)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <main style={{ width: '100%', maxWidth: 460, padding: '24px 16px' }}>
        <div className="login-card">

          {/* Logo */}
          <div className="ll-logo-top">
            <div className="ll-logo-icon">
              <img src={logoImg} alt="BecarthAI"
                style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
            </div>
            <span className="ll-logo-text">SGS <strong>SaaS</strong></span>
          </div>

          {/* ── ÉTAPE TERMINÉE ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <CheckCircle size={52} color="#5784BA"
                style={{ margin: '0 auto 20px', display: 'block' }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>
                Mot de passe mis à jour !
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 8 }}>
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                Redirection vers la connexion dans 3 secondes…
              </p>
            </div>
          )}

          {/* ── ÉTAPE 1 : Email ── */}
          {step === 1 && (
            <>
              <div className="lc-header">
                <div className="lc-title">Mot de passe oublié ?</div>
                <p className="lc-sub">
                  Entrez votre email et nous vous enverrons un code de vérification.
                </p>
              </div>
              <form onSubmit={handleSendEmail} noValidate>
                <div className="form-group">
                  <label>Adresse email</label>
                  <div className="input-wrap">
                    <Mail size={15} className="input-icon" />
                    <input type="email" placeholder="vous@entreprise.com"
                      value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                      className={error ? 'error' : ''} />
                  </div>
                  {error && <span className="form-error">{error}</span>}
                </div>
                <button type="submit" className="btn btn-primary btn-full"
                  disabled={loading} style={{ marginBottom: 18 }}>
                  {loading ? 'Envoi en cours…' : 'Envoyer le code'}
                </button>
                <div style={{ textAlign: 'center' }}>
                  <Link to="/login" className="lc-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <ArrowLeft size={14} /> Retour à la connexion
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* ── ÉTAPE 2 : Code OTP ── */}
          {step === 2 && (
            <>
              <div className="lc-header">
                <div className="lc-title">Vérification</div>
                <p className="lc-sub">
                  Un code à 6 chiffres a été envoyé à <strong>{email}</strong>.
                  Entrez-le ci-dessous.
                </p>
              </div>
              <form onSubmit={handleVerifyCode} noValidate>
                {/* Champs OTP individuels */}
                <div style={{
                  display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24
                }}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => otpRefs.current[i] = el}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      style={{
                        width: 48, height: 56, textAlign: 'center',
                        fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
                        border: `2px solid ${digit ? '#5784BA' : '#e2e8f0'}`,
                        borderRadius: 10, outline: 'none',
                        background: digit ? '#EFF6FF' : '#fff',
                        color: '#1e293b', transition: 'all 0.15s',
                        boxShadow: digit ? '0 0 0 3px rgba(87,132,186,0.15)' : 'none',
                      }}
                    />
                  ))}
                </div>

                {error && <div className="api-error">{error}</div>}

                <button type="submit" className="btn btn-primary btn-full"
                  style={{ marginBottom: 14 }}>
                  Valider le code
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <button type="button" onClick={() => { setStep(1); setOtp(['','','','','','']); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: '#5784BA', fontWeight: 600, textDecoration: 'underline' }}>
                    Changer d'email
                  </button>
                  <button type="button" onClick={handleSendEmail}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: '#5784BA', fontWeight: 600, textDecoration: 'underline' }}>
                    Renvoyer le code
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── ÉTAPE 3 : Nouveau mot de passe ── */}
          {step === 3 && (
            <>
              <div className="lc-header">
                <div className="lc-title">Nouveau mot de passe</div>
                <p className="lc-sub">Choisissez un mot de passe sécurisé.</p>
              </div>
              <form onSubmit={handleReset} noValidate>
                <div className="form-group">
                  <label>Nouveau mot de passe</label>
                  <div className="input-wrap">
                    <input type={showPw ? 'text' : 'password'}
                      placeholder="Min. 6 caractères" value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                      style={{ paddingLeft: 12, paddingRight: 40 }} />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                        {[1,2,3,4].map(s => (
                          <div key={s} style={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: s <= strength ? strengthColor[strength] : '#e9ecef',
                          }} />
                        ))}
                      </div>
                      <span style={{ color: strengthColor[strength], fontSize: 11,
                        fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {strengthLabel[strength]}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Confirmer le mot de passe</label>
                  <div className="input-wrap">
                    <input type={showCf ? 'text' : 'password'}
                      placeholder="Répétez le mot de passe" value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError('') }}
                      style={{ paddingLeft: 12, paddingRight: 40 }}
                      className={confirm && confirm !== password ? 'error' : ''} />
                    <button type="button" className="pw-toggle" onClick={() => setShowCf(v => !v)}>
                      {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <div className="api-error">{error}</div>}

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
                </button>
              </form>
            </>
          )}

        </div>
      </main>
    </div>
  )
}
