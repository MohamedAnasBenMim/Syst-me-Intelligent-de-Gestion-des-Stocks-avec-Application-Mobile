import { AuthenticateWithRedirectCallback } from '@clerk/react'

/**
 * Page intermédiaire — Clerk traite le retour OAuth Google ici,
 * puis redirige vers /google-welcome pour l'échange du token backend.
 */
export default function SSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      afterSignInUrl="/google-welcome"
      afterSignUpUrl="/google-welcome"
    />
  )
}
