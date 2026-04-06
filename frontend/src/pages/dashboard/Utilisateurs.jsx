import { useState, useEffect } from 'react'
import {
  Users, Plus, Pencil, Trash2, Loader, X, Eye, EyeOff,
  ShieldAlert, Check, AlertTriangle, Search,
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getUtilisateurs, createUtilisateur, updateUtilisateur, deleteUtilisateur,
} from '../../services/api'
import './Utilisateurs.css'

// ── Config rôles ────────────────────────────────────────────
const ROLES = [
  { value: 'admin',        label: 'Administrateur', color: '#4F46E5', bg: 'rgba(79,70,229,0.1)'  },
  { value: 'gestionnaire', label: 'Gestionnaire',   color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  { value: 'operateur',    label: 'Opérateur',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
]
const roleCfg = Object.fromEntries(ROLES.map(r => [r.value, r]))

function RoleBadge({ role }) {
  const c = roleCfg[role] || roleCfg.operateur
  return (
    <span className="role-badge" style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}

// ── Modal Créer / Modifier ──────────────────────────────────
function UtilisateurModal({ mode, initial, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const [form, setForm]     = useState({
    prenom:  initial?.prenom  || '',
    nom:     initial?.nom     || '',
    email:   initial?.email   || '',
    role:    initial?.role    || 'operateur',
    salaire: initial?.salaire ?? '',
    password: '',
  })
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState(null)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (isCreate && form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setLoading(true)
    try {
      let saved
      const salaire = form.salaire !== '' ? parseFloat(form.salaire) : null
      if (isCreate) {
        saved = await createUtilisateur({
          prenom: form.prenom, nom: form.nom,
          email: form.email, password: form.password, role: form.role,
          salaire,
        })
      } else {
        saved = await updateUtilisateur(initial.id, {
          prenom: form.prenom, nom: form.nom,
          email: form.email, role: form.role,
          salaire,
        })
      }
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isCreate ? 'Créer un utilisateur' : 'Modifier l\'utilisateur'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          {error && (
            <div className="modal-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Prénom <span className="req">*</span></label>
              <input
                value={form.prenom} onChange={e => set('prenom', e.target.value)}
                placeholder="Prénom" required autoFocus
              />
            </div>
            <div className="form-group">
              <label>Nom <span className="req">*</span></label>
              <input
                value={form.nom} onChange={e => set('nom', e.target.value)}
                placeholder="Nom" required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email <span className="req">*</span></label>
            <input
              type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@example.com" required
            />
          </div>

          <div className="form-group">
            <label>Rôle <span className="req">*</span></label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Salaire mensuel (TND)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.salaire}
              onChange={e => set('salaire', e.target.value)}
              placeholder="Ex : 1500.00 (optionnel)"
            />
          </div>

          {isCreate && (
            <div className="form-group">
              <label>Mot de passe <span className="req">*</span></label>
              <div className="pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Minimum 6 caractères" required minLength={6}
                />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? <><Loader size={14} className="spin" /> Enregistrement…</> : <><Check size={14} /> {isCreate ? 'Créer' : 'Enregistrer'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Confirmation Suppression ─────────────────────────
function DeleteModal({ user, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  async function confirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm">
        <div className="modal-header">
          <h2>Supprimer l'utilisateur</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="delete-confirm">
            <div className="delete-icon"><Trash2 size={28} color="#DC3545" /></div>
            <p>
              Voulez-vous vraiment supprimer <strong>{user.prenom} {user.nom}</strong> ?
              <br />
              <span className="delete-sub">Cette action est irréversible (désactivation du compte).</span>
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Annuler</button>
            <button className="btn-delete" onClick={confirm} disabled={loading}>
              {loading ? <><Loader size={14} className="spin" /> Suppression…</> : <><Trash2 size={14} /> Supprimer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────
export default function Utilisateurs() {
  const { user: me } = useAuth()

  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(null)   // null | { type: 'create'|'edit'|'delete', user? }
  const [toast,   setToast]   = useState(null)   // { msg, ok }

  // Seul l'admin a accès
  const isAdmin = me?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    load()
  }, [isAdmin])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getUtilisateurs()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSaved(saved) {
    setModal(null)
    if (modal?.type === 'create') {
      setUsers(prev => [saved, ...prev])
      showToast(`Utilisateur ${saved.prenom} ${saved.nom} créé avec succès.`)
    } else {
      setUsers(prev => prev.map(u => u.id === saved.id ? saved : u))
      showToast(`Utilisateur ${saved.prenom} ${saved.nom} mis à jour.`)
    }
  }

  async function handleDelete() {
    const target = modal.user
    try {
      await deleteUtilisateur(target.id)
      setUsers(prev => prev.filter(u => u.id !== target.id))
      showToast(`${target.prenom} ${target.nom} a été supprimé.`)
    } catch (err) {
      showToast(err.message, false)
    } finally {
      setModal(null)
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      u.prenom?.toLowerCase().includes(q) ||
      u.nom?.toLowerCase().includes(q)    ||
      u.email?.toLowerCase().includes(q)  ||
      u.role?.toLowerCase().includes(q)
    )
  })

  // ── Accès refusé ──
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="access-denied">
          <ShieldAlert size={52} color="#DC3545" />
          <h2>Accès refusé</h2>
          <p>Cette page est réservée aux administrateurs.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="users-page">

        {/* ── Header ── */}
        <div className="users-header">
          <div className="users-header-left">
            <Users size={22} color="var(--teal)" />
            <div>
              <h1>Gestion des utilisateurs</h1>
              <p>{loading ? '…' : `${users.length} utilisateur${users.length > 1 ? 's' : ''} actif${users.length > 1 ? 's' : ''}`}</p>
            </div>
          </div>
          <button className="btn-create" onClick={() => setModal({ type: 'create' })}>
            <Plus size={16} /> Nouvel utilisateur
          </button>
        </div>

        {/* ── Barre de recherche ── */}
        <div className="users-toolbar">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              className="search-input"
              placeholder="Rechercher par nom, email, rôle…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>
            )}
          </div>
          <div className="role-pills">
            {ROLES.map(r => (
              <span key={r.value} className="role-pill" style={{ color: r.color, background: r.bg }}>
                {users.filter(u => u.role === r.value).length} {r.label}{users.filter(u => u.role === r.value).length > 1 ? 's' : ''}
              </span>
            ))}
          </div>
        </div>

        {/* ── Contenu ── */}
        {loading ? (
          <div className="users-loading">
            <Loader size={24} className="spin" />
            <span>Chargement des utilisateurs…</span>
          </div>
        ) : error ? (
          <div className="users-error">
            <AlertTriangle size={16} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="users-empty">
            <Users size={40} color="#ADB5BD" />
            <p>{search ? 'Aucun résultat pour cette recherche.' : 'Aucun utilisateur trouvé.'}</p>
          </div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Salaire</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSelf = u.id === me?.id
                  return (
                    <tr key={u.id} className={isSelf ? 'row-self' : ''}>
                      <td className="td-id">#{u.id}</td>
                      <td className="td-user">
                        <div className="user-cell">
                          <div className="user-avatar-sm"
                            style={{ background: u.role === 'admin' ? '#4F46E5' : u.role === 'gestionnaire' ? '#6366F1' : '#8B5CF6' }}>
                            {`${(u.prenom || 'U')[0]}${(u.nom || '')[0] || ''}`.toUpperCase()}
                          </div>
                          <div>
                            <div className="user-fullname">
                              {u.prenom} {u.nom}
                              {isSelf && <span className="self-tag">Vous</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="td-email">{u.email}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td className="td-salaire">
                        {u.salaire != null
                          ? new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(u.salaire)
                          : <span style={{ color: '#ADB5BD' }}>—</span>}
                      </td>
                      <td>
                        <span className={`status-badge ${u.est_actif ? 'active' : 'inactive'}`}>
                          {u.est_actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="td-date">
                        {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="td-actions">
                        <button
                          className="action-btn edit"
                          title="Modifier"
                          onClick={() => setModal({ type: 'edit', user: u })}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="action-btn delete"
                          title={isSelf ? 'Impossible de supprimer votre propre compte' : 'Supprimer'}
                          disabled={isSelf}
                          onClick={() => !isSelf && setModal({ type: 'delete', user: u })}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Modals ── */}
        {modal?.type === 'create' && (
          <UtilisateurModal
            mode="create"
            initial={null}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'edit' && (
          <UtilisateurModal
            mode="edit"
            initial={modal.user}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'delete' && (
          <DeleteModal
            user={modal.user}
            onClose={() => setModal(null)}
            onConfirm={handleDelete}
          />
        )}

        {/* ── Toast notification ── */}
        {toast && (
          <div className={`toast ${toast.ok ? 'toast--ok' : 'toast--err'}`}>
            {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
