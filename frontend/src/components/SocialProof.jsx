import './SocialProof.css'

const logos = [
  'Carrefour TN', 'MG Group', 'Poulina', 'STEG', 'Monoprix',
  'Tunisair', 'Delice', 'Sfax Ceramics', 'BIAT', 'Orange TN',
]

const stats = [
  { value: '500+',   label: 'Entreprises actives' },
  { value: '98%',    label: 'Taux de satisfaction' },
  { value: '50K+',   label: 'Mouvements / jour' },
  { value: '99.9%',  label: 'Disponibilité SLA' },
]

export default function SocialProof() {
  return (
    <section className="social-proof">
      <div className="container">
        <p className="sp-title">Ils nous font confiance</p>
      </div>

      {/* Marquee logos */}
      <div className="marquee-outer">
        <div className="marquee-track">
          {[...logos, ...logos].map((l, i) => (
            <div key={i} className="logo-chip">{l}</div>
          ))}
        </div>
      </div>
      <div className='box'>

      </div>
      {/* Stats */}
      <div className="container">
        <div className="stats-row">
          {stats.map(s => (
            <div key={s.label} className="stat-item">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
