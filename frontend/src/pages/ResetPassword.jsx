import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Ce flux est désormais géré entièrement dans /forgot-password (OTP 3 étapes). */
export default function ResetPassword() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/forgot-password', { replace: true }) }, [navigate])
  return null
}
