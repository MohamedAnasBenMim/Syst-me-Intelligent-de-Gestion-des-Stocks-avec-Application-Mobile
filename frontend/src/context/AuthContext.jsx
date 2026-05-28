import { createContext, useContext, useState, useEffect, useRef } from 'react'
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
  // Vrai juste après saveLogin — empêche l'auto-logout si getMe() échoue immédiatement après login
  const justSavedLogin = useRef(false)

  // Au démarrage ou après changement de token : récupérer le profil complet
  useEffect(() => {
    if (token) {
      getMe()
        .then(profile => {
          setUser(profile)
          const savedAvatar = localStorage.getItem(`sgs_avatar_${profile.email?.toLowerCase()}`)
          if (savedAvatar) setAvatar(savedAvatar)
        })
        .catch(() => {
          if (justSavedLogin.current) {
            // Juste après login : token valide mais getMe() indisponible (service momentanément lent)
            // On garde l'utilisateur connecté avec le profil partiel de saveLogin
            return
          }
          // Token expiré ou invalide lors d'un rechargement de page → déconnexion
          localStorage.removeItem('sgs_token')
          setToken(null)
          setUser(null)
        })
        .finally(() => {
          justSavedLogin.current = false
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [token])

  /** Appelé après un login réussi */
  function saveLogin(tokenValue, userProfile) {
    localStorage.setItem('sgs_token', tokenValue)
    justSavedLogin.current = true  // protège contre l'auto-logout dans le useEffect suivant
    setToken(tokenValue)
    setUser(userProfile)
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
