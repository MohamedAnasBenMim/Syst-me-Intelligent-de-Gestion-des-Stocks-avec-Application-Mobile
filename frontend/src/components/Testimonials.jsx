import './Testimonials.css'

const allTestimonials = [
  {
    name: 'Karim Benhaddou',
    role: 'Resp. Logistique', company: 'MG Group',
    photo: 'https://i.pravatar.cc/60?u=karim.benhaddou',
    text: 'Les ruptures ont chuté de 70%. Les alertes IA nous préviennent avant même qu\'on réalise qu\'il y a un problème. Indispensable.',
  },
  {
    name: 'Amira Touati',
    role: 'Dir. Opérations', company: 'Poulina',
    photo: 'https://i.pravatar.cc/60?u=amira.touati',
    text: 'En une journée, tous nos entrepôts étaient configurés. Le dashboard est clair, les données fiables. Un outil de grande qualité.',
  },
  {
    name: 'Youssef El Mansouri',
    role: 'CEO', company: 'PME Industrielle',
    photo: 'https://i.pravatar.cc/60?u=youssef.mansouri',
    text: 'Avoir un outil ML à ce tarif était impensable avant SGS SaaS. Les prévisions à 30 jours ont changé notre façon de planifier.',
  },
  {
    name: 'Fatima Zohra',
    role: 'Acheteuse Senior', company: 'Carrefour TN',
    photo: 'https://i.pravatar.cc/60?u=fatima.zohra.achat',
    text: 'Interface intuitive et support réactif. Notre équipe a été opérationnelle en quelques heures. Je recommande vivement.',
  },
  {
    name: 'Mohamed Karray',
    role: 'DSI', company: 'STEG',
    photo: 'https://i.pravatar.cc/60?u=mohamed.karray.dsi',
    text: 'L\'API REST nous a permis d\'intégrer SGS SaaS à notre ERP en deux jours. La documentation est excellente et l\'équipe disponible.',
  },
  {
    name: 'Sana Mejri',
    role: 'Gérante', company: 'Sfax Trading',
    photo: 'https://i.pravatar.cc/60?u=sana.mejri.trading',
    text: 'Fini les tableurs Excel ! Maintenant j\'ai une vision temps réel de tout mon stock. C\'est exactement ce dont j\'avais besoin.',
  },
]

const row1 = allTestimonials.slice(0, 3)
const row2 = allTestimonials.slice(3)

function TestimonialCard({ t }) {
  return (
    <div className="testi-card">
      <p className="testi-text">"{t.text}"</p>
      <div className="testi-author">
        <img
          src={t.photo}
          alt={t.name}
          className="testi-avatar-img"
          onError={e => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextSibling.style.display = 'flex'
          }}
        />
        <div className="testi-avatar-fallback">
          {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
        <div>
          <div className="testi-name">{t.name}</div>
          <div className="testi-role">{t.role} · {t.company}</div>
        </div>
      </div>
    </div>
  )
}

export default function Testimonials() {
  return (
    <section className="testimonials-section">
      <div className="container">
        <div className="section-header">
          <span className="badge-pill">Témoignages</span>
          <h2>Ce que disent nos clients</h2>
          <p>Plus de 500 entreprises de la région MENA nous font confiance</p>
        </div>
      </div>

      {/* Row 1 — scroll left */}
      <div className="testi-marquee-outer">
        <div className="testi-track testi-track--left">
          {[...row1, ...row1, ...row1].map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>

      {/* Row 2 — scroll right */}
      <div className="testi-marquee-outer" style={{ marginTop: 20 }}>
        <div className="testi-track testi-track--right">
          {[...row2, ...row2, ...row2].map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  )
}
