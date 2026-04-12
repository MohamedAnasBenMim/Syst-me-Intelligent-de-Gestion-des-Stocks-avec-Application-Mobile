import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import './index.css'
import './App.css'

// Landing page sections
import Navbar           from './components/Navbar'
import Hero             from './components/Hero'
import SocialProof      from './components/SocialProof'
import Features         from './components/Features'
import HowItWorks       from './components/HowItWorks'
import DashboardPreview from './components/DashboardPreview'
import Pricing          from './components/Pricing'
import Testimonials     from './components/Testimonials'
import FAQ              from './components/FAQ'
import CtaFinal         from './components/CtaFinal'
import Footer           from './components/Footer'

// Pages auth
import Register       from './pages/Register'
import Login          from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import SSOCallback    from './pages/SSOCallback'
import GoogleWelcome  from './pages/GoogleWelcome'

// Pages dashboard
import Dashboard           from './pages/dashboard/Dashboard'
import Reapprovisionnement from './pages/dashboard/Reapprovisionnement'
import IaRag               from './pages/dashboard/IaRag'
import Utilisateurs        from './pages/dashboard/Utilisateurs'
import Entrepots           from './pages/dashboard/Entrepots'
import Produits            from './pages/dashboard/Produits'
import Stocks              from './pages/dashboard/Stocks'
import Mouvements          from './pages/dashboard/Mouvements'
import Alertes             from './pages/dashboard/Alertes'
import Notifications       from './pages/dashboard/Notifications'
import Reporting           from './pages/dashboard/Reporting'
import Parametres          from './pages/dashboard/Parametres'
import Promotions          from './pages/dashboard/Promotions'

function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="landing-main">
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <DashboardPreview />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CtaFinal />
      </main>
      <Footer />
    </>
  )
}

// Route protégée : redirige vers /login si non connecté
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Chargement…</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/"                    element={<LandingPage />} />
            <Route path="/register"            element={<Register />} />
            <Route path="/login"               element={<Login />} />
            <Route path="/forgot-password"     element={<ForgotPassword />} />
            <Route path="/reset-password"      element={<ResetPassword />} />
            <Route path="/sso-callback"        element={<SSOCallback />} />
            <Route path="/google-welcome"      element={<GoogleWelcome />} />
            {/* Routes protégées dashboard */}
            <Route path="/dashboard" element={
              <PrivateRoute><Dashboard /></PrivateRoute>
            } />
            <Route path="/dashboard/reapprovisionnement" element={
              <PrivateRoute><Reapprovisionnement /></PrivateRoute>
            } />
            <Route path="/dashboard/ia" element={
              <PrivateRoute><IaRag /></PrivateRoute>
            } />
            <Route path="/dashboard/utilisateurs" element={
              <PrivateRoute><Utilisateurs /></PrivateRoute>
            } />
            <Route path="/dashboard/entrepots" element={
              <PrivateRoute><Entrepots /></PrivateRoute>
            } />
            <Route path="/dashboard/produits" element={
              <PrivateRoute><Produits /></PrivateRoute>
            } />
            <Route path="/dashboard/stocks" element={
              <PrivateRoute><Stocks /></PrivateRoute>
            } />
            <Route path="/dashboard/mouvements" element={
              <PrivateRoute><Mouvements /></PrivateRoute>
            } />
            <Route path="/dashboard/alertes" element={
              <PrivateRoute><Alertes /></PrivateRoute>
            } />
            <Route path="/dashboard/notifications" element={
              <PrivateRoute><Notifications /></PrivateRoute>
            } />
            <Route path="/dashboard/reporting" element={
              <PrivateRoute><Reporting /></PrivateRoute>
            } />
            <Route path="/dashboard/promotions" element={
              <PrivateRoute><Promotions /></PrivateRoute>
            } />
            <Route path="/dashboard/parametres" element={
              <PrivateRoute><Parametres /></PrivateRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </>
  )
}