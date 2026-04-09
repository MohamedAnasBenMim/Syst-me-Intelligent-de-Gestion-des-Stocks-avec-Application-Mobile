import biatImg        from '../assets/BIAT.png'
import carrefourImg   from '../assets/carrefour.png'
import deliceImg      from '../assets/délice.jpg'
import monoprixImg    from '../assets/Logo-Monoprix.webp'
import mgGroupImg     from '../assets/MG-GROUP.jpeg'
import orangeImg      from '../assets/orange-tunisie.png'
import poulinaImg     from '../assets/poulina.webp'
import sfaxImg        from '../assets/sfax-ceramics.png'
import stegImg        from '../assets/steg.png'
import tunisairImg    from '../assets/tunisair.png'
import './SocialProof.css'

const logos = [
  { name: 'Tunisair',        img: tunisairImg,  h: 36 },
  { name: 'Delice',          img: deliceImg,    h: 36 },
  { name: 'Sfax Ceramics',   img: sfaxImg,      h: 52 },
  { name: 'BIAT',            img: biatImg,      h: 36 },
  { name: 'Orange TN',       img: orangeImg,    h: 36 },
  { name: 'Carrefour TN',    img: carrefourImg, h: 52 },
  { name: 'MG Group',        img: mgGroupImg,   h: 36 },
  { name: 'Poulina',         img: poulinaImg,   h: 52 },
  { name: 'STEG',            img: stegImg,      h: 52 },
  { name: 'Monoprix',        img: monoprixImg,  h: 52 },
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
            <div key={i} className="logo-chip">
              <img src={l.img} alt={l.name} className="logo-chip-img"
                style={{ maxHeight: l.h }} />
            </div>
          ))}
        </div>
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
