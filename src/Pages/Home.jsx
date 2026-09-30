import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { BriefcaseBusiness, MessageSquareWarning, Store } from 'lucide-react'
import { categoryIcons, defaultIcon } from '../Components/mapIcons'
import logo from '../assets/Logo.svg'
import 'leaflet/dist/leaflet.css'
import './Home.css'

const services = [
  {
    title: 'Marketplace',
    description: 'Find sari-sari stores, local services, and community gardens.',
    icon: Store,
    page: 'marketplace',
  },
  {
    title: 'Report an issue',
    description: 'Share outages, potholes, broken streetlights, and other concerns.',
    icon: MessageSquareWarning,
    page: 'map',
  },
  {
    title: 'Barangay services',
    description: 'Find office hours, service requirements, and contact information.',
    icon: BriefcaseBusiness,
    page: 'map',
  },
]

function getLocationTime(location) {
  if (location.createdAt?.toMillis) return location.createdAt.toMillis()
  const timestamp = location.createdAt?.toDate?.() || (location.startDate ? new Date(location.startDate) : null)
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.getTime() : 0
}

function getLocationDate(location) {
  const date = location.startDate
    ? new Date(`${location.startDate}T00:00:00`)
    : location.createdAt?.toDate?.() || null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'Community update'
}

export default function Home({ locations, locationsStatus, onNavigate, onRequestLogin }) {
  const updates = [...locations]
    .filter((location) => ['Outage', 'Service', 'Marketplace', 'Report', 'Hazard'].includes(location.category))
    .sort((first, second) => getLocationTime(second) - getLocationTime(first))
    .slice(0, 3)

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-kicker">Your neighborhood, connected</p>
          <h1 id="home-title">
            <span>Gabay</span> ang<br />
            kailangan?<br />
            <span>Gabay Go</span> ang<br />
            puntahan!
          </h1>
          <p className="home-hero-intro">A little more guidance makes everyday life in the barangay easier.</p>
          <div className="home-hero-actions">
            <button className="home-primary-action" type="button" onClick={() => onNavigate('map')}>
              Explore the map <span aria-hidden="true">↗</span>
            </button>
            <button className="home-text-action" type="button" onClick={onRequestLogin}>Join the community</button>
          </div>
        </div>
        <div className="home-hero-mark" aria-label="GabayGo">
          <img src={logo} alt="GabayGo" />
          <span className="home-sunburst" aria-hidden="true" />
        </div>
        <span className="home-hero-coordinate" aria-hidden="true">BAGO APLAYA · DAVAO CITY</span>
      </section>

      <section className="home-services" aria-labelledby="home-services-title">
        <header className="home-section-heading">
          <h2 id="home-services-title"><strong>Gabay</strong> <em>Services</em></h2>
          <button className="home-section-link" type="button" onClick={() => onNavigate('map')} aria-label="Explore all services on the map">
            <span aria-hidden="true">↗</span>
          </button>
        </header>
        <div className="home-service-grid">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <button
                className="home-service-card"
                type="button"
                key={service.title}
                onClick={() => onNavigate(service.page)}
                style={{ '--card-order': index }}
              >
                <Icon className="home-service-icon" size={56} strokeWidth={2.5} aria-hidden="true" />
                <span className="home-service-title">{service.title}</span>
                <span className="home-service-description">{service.description}</span>
                <span className="home-service-arrow" aria-hidden="true">↗</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="home-updates" aria-labelledby="home-updates-title">
        <header className="home-section-heading home-section-heading--updates">
          <div>
            <p className="home-kicker">What neighbors should know</p>
            <h2 id="home-updates-title"><strong>Gabay</strong> <em>Updates</em></h2>
          </div>
          <button className="home-section-link" type="button" onClick={() => onNavigate('updates')} aria-label="See all updates">
            <span aria-hidden="true">↗</span>
          </button>
        </header>
        {updates.length ? (
          <div className="home-update-grid">
            {updates.map((update, index) => (
              <button
                className={`home-update-card${index === 1 ? ' home-update-card--featured' : ''}`}
                type="button"
                key={update.id}
                onClick={() => onNavigate('updates')}
              >
                <span className="home-update-category">{update.category}</span>
                <span className="home-update-title">{update.name}</span>
                <span className="home-update-date">{getLocationDate(update)}</span>
                <span className="home-update-description">{update.description || 'Open the updates page for more information.'}</span>
                <span className="home-update-more">See full update <span aria-hidden="true">↗</span></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="home-updates-empty">
            <p>{locationsStatus === 'loading' ? 'Loading neighborhood updates…' : 'No community updates yet.'}</p>
            <button type="button" onClick={() => onNavigate('updates')}>Open updates <span aria-hidden="true">↗</span></button>
          </div>
        )}
        <button className="home-all-updates" type="button" onClick={() => onNavigate('updates')}>View all updates <span aria-hidden="true">↗</span></button>
      </section>

      <section className="home-map-feature" aria-labelledby="home-map-title">
        <div className="home-map-frame">
          <MapContainer center={[7.0435, 125.5315]} zoom={14} scrollWheelZoom={false} dragging={false} className="home-map-preview">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {locations.slice(0, 18).map((location) => (
              <Marker
                key={location.id}
                position={[location.lat, location.lng]}
                icon={categoryIcons[location.category] || defaultIcon}
              >
                <Popup>{location.name}</Popup>
              </Marker>
            ))}
          </MapContainer>
          <span className="home-map-label">Bago Aplaya · Davao</span>
        </div>
        <div className="home-map-copy">
          <p className="home-kicker">Find your way around</p>
          <h2 id="home-map-title">Check out nearby <em>landmarks</em> using <span>Maps</span></h2>
          <p>Filter pins and legends to see services, stores, reports, events, and other points of interest.</p>
          <button className="home-map-action" type="button" onClick={() => onNavigate('map')}>
            Open the neighborhood map <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
    </main>
  )
}