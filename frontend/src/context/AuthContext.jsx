import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

/**
 * Fournit l'état d'authentification à toute l'application.
 * Usage : const { user, token, avatar, login, logout } = useAuth()
 */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // profil utilisateur
  const [token,   setToken]   = useState(localStorage.getItem('sgs_token'))
  const [avatar,  setAvatar]  = useState(null)   // photo de profil base64
  const [loading, setLoading] = useState(true)   // vérification initiale

  // Au démarrage : si un token existe, récupérer le profil
  useEffect(() => {
    if (token) {
      getMe()
        .then(profile => {
          setUser(profile)
          // Charger la photo de profil depuis localStorage
          const savedAvatar = localStorage.getItem(`sgs_avatar_${profile.email?.toLowerCase()}`)
          if (savedAvatar) setAvatar(savedAvatar)
        })
        .catch(() => {
          // Token expiré ou invalide → déconnexion automatique
          localStorage.removeItem('sgs_token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  /** Appelé après un login réussi */
  function saveLogin(tokenValue, userProfile) {
    localStorage.setItem('sgs_token', tokenValue)
    setToken(tokenValue)
    setUser(userProfile)
    // getMe() sera appelé via useEffect[token] qui chargera aussi l'avatar
  }

  /** Déconnexion */
  function logout() {
    localStorage.removeItem('sgs_token')
    setToken(null)
    setUser(null)
    setAvatar(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, avatar, loading, saveLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook raccourci : const { user, avatar, logout } = useAuth() */
export function useAuth() {
  return useContext(AuthContext)
}
