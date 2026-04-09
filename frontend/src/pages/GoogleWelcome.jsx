import { useEffect, useRef, useState } from 'react'
import { useAuth as useClerkAuth, useUser } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { useAuth as useAppAuth } from '../context/AuthContext'
import { clerkLogin } from '../services/api'

export default function GoogleWelcome() {
  const { isSignedIn, getToken } = useClerkAuth()
  const { user }                 = useUser()
  const { saveLogin }            = useAppAuth()
  const navigate                 = useNavigate()
  const done                     = useRef(false)
  const [errMsg, setErrMsg]      = useState(null)

  useEffect(() => {
    if (!isSignedIn || !user || done.current) return
    done.current = true

    const sync = async () => {
      try {
        const clerkToken   = await getToken()
        const clerk_user_id = user.id
        const email  = user.primaryEmailAddress?.emailAddress || ''
        const prenom = user.firstName  || email.split('@')[0]
        const nom    = user.lastName   || ''

        console.log('[GoogleWelcome] Appel backend — user_id:', clerk_user_id, 'email:', email)
        const data = await clerkLogin({ clerk_user_id, clerk_token: clerkToken, email, prenom, nom })
        saveLogin(data.access_token, { id: data.user_id, role: data.role })
        navigate('/dashboard', { replace: true })
      } catch (err) {
        console.error('[GoogleWelcome] Erreur backend:', err)
        setErrMsg(err.message || 'Erreur inconnue')
      }
    }

    sync()
  }, [isSignedIn, user])

  if (errMsg) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', background: '#f1f5f9', gap: 16,
      }}>
        <p style={{ color: '#DC2626', fontSize: 15, fontWeight: 600 }}>
          Erreur : {errMsg}
        </p>
        <button onClick={() => navigate('/login')}
          style={{ padding: '8px 20px', background: '#5784BA', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Retour à la connexion
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#f1f5f9', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, border: '4px solid #5784BA',
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
        Connexion Google en cours…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
