import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

/**
 * Fournit l'état d'authentification à toute l'application.
 * Usage : const { user, token, login, logout } = useAuth()
 */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // profil utilisateur
  const [token,   setToken]   = useState(localStorage.getItem('sgs_token'))
  const [loading, setLoading] = useState(true)   // vérification initiale

  // Au démarrage : si un token existe, récupérer le profil
  useEffect(() => {
    if (token) {
      getMe()
        .then(profile => setUser(profile))
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
  }

  /** Déconnexion */
  function logout() {
    localStorage.removeItem('sgs_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, saveLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook raccourci : const { user, logout } = useAuth() */
export function useAuth() {
  return useContext(AuthContext)
}
