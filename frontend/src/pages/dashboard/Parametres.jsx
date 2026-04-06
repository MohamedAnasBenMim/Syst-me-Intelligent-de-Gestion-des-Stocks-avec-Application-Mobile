import { useState } from 'react'
import {
  Settings, Eye, EyeOff, Loader, Check, AlertTriangle, Lock, User,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { changePassword } from '../../services/api'
import './common.css'
import './Parametres.css'

const ROLE_LABELS = {
  admin:        'Administrateur',
  gestionnaire: 'Gestionnaire',
  operateur:    'Opérateur',
}

export default function Parametres() {
  const { user: me } = useAuth()

  const [form, setForm] = useState({ ancien: '', nouveau: '', confirm: '' })
  const [show, setShow] = useState({ ancien: false, nouveau: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }
  function toggleShow(field) { setShow(s => ({ ...s, [field]: !s[field] })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (form.nouveau.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (form.nouveau !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      await changePassword(me.id, {
        ancien_password:   form.ancien,
        nouveau_password:  form.nouveau,
      })
      setSuccess(true)
      setForm({ ancien: '', nouveau: '', confirm: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="page">

        {/* Header */}
        <div className="page-hdr">
          <div className="page-hdr-left">
            <Settings size={22} color="var(--teal)" />
            <div>
              <h1>Paramètres</h1>
              <p>Gérez votre profil et votre sécurité</p>
            </div>
          </div>
        </div>

        <div className="prm-two-col">

          {/* Profil */}
          <div className="data-card">
            <div className="data-card-header">
              <span className="data-card-title">
                <User size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Informations du profil
              </span>
            </div>
            <div className="prm-profile-body">
              {me && (
                <>
                  <div className="prm-avatar">
                    {`${(me.prenom || 'U')[0]}${(me.nom || '')[0] || ''}`.toUpperCase()}
                  </div>
                  <div className="prm-name">{me.prenom} {me.nom}</div>
                  <div className="prm-email">{me.email}</div>
                  <span className="badge badge-navy prm-role">
                    {ROLE_LABELS[me.role] || me.role}
                  </span>
                  <div className="prm-info-grid">
                    <div className="prm-info-row">
                      <span className="prm-info-label">ID utilisateur</span>
                      <span className="prm-info-val">#{me.id}</span>
                    </div>
                    <div className="prm-info-row">
                      <span className="prm-info-label">Statut</span>
                      <span className={`badge ${me.est_actif ? 'badge-green' : 'badge-red'}`}>
                        {me.est_actif ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>
                  <p className="prm-note">
                    Pour modifier vos informations personnelles (nom, email), contactez un administrateur.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Changer mot de passe */}
          <div className="data-card">
            <div className="data-card-header">
              <span className="data-card-title">
                <Lock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Changer le mot de passe
              </span>
            </div>
            <form className="prm-pwd-body" onSubmit={handleSubmit}>
              {error && (
                <div className="form-err"><AlertTriangle size={14} /> {error}</div>
              )}
              {success && (
                <div className="prm-success">
                  <Check size={14} /> Mot de passe modifié avec succès.
                </div>
              )}

              <div className="form-group">
                <label>Mot de passe actuel <span className="req">*</span></label>
                <div className="pwd-wrap">
                  <input
                    type={show.ancien ? 'text' : 'password'}
                    value={form.ancien}
                    onChange={e => set('ancien', e.target.value)}
                    placeholder="Votre mot de passe actuel"
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => toggleShow('ancien')}>
                    {show.ancien ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Nouveau mot de passe <span className="req">*</span></label>
                <div className="pwd-wrap">
                  <input
                    type={show.nouveau ? 'text' : 'password'}
                    value={form.nouveau}
                    onChange={e => set('nouveau', e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required minLength={6}
                  />
                  <button type="button" className="pwd-toggle" onClick={() => toggleShow('nouveau')}>
                    {show.nouveau ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirmer le nouveau mot de passe <span className="req">*</span></label>
                <div className="pwd-wrap">
                  <input
                    type={show.confirm ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={e => set('confirm', e.target.value)}
                    placeholder="Répétez le nouveau mot de passe"
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => toggleShow('confirm')}>
                    {show.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary prm-submit" disabled={loading}>
                {loading
                  ? <><Loader size={14} className="spin" /> Enregistrement…</>
                  : <><Check size={14} /> Mettre à jour</>}
              </button>
            </form>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
