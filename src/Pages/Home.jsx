import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { BriefcaseBusiness, CloudRain, ExternalLink, MessageSquareWarning, PhoneCall, RefreshCcw, Store, Waves, Wind } from 'lucide-react'
import BagoAplayaBorder from '../Components/BagoAplayaBorder'
import EventDetailsModal from '../Components/EventDetailsModal'
import { categoryIcons, defaultIcon } from '../Components/mapIcons'
import { bagoAplayaMaxBounds } from '../data/bagoAplaya'
import { officialContacts, officialServices } from '../data/officialResources'
import { makeEvent } from '../utils/eventUtils'
import { LocalizedContent, PreservedContent } from '../i18n'
import { getDateLocale, useLanguage } from '../language'
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

const BAGO_APLAYA_COORDS = { lat: 7.0435, lng: 125.5315 }

const weatherCodeLabels = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Heavy showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
}

const weatherTranslations = {
  filipino: {
    'Clear sky': 'Malinaw na langit',
    'Mostly clear': 'Kalahati ay malinaw',
    'Partly cloudy': 'May bahagyang ulap',
    'Cloudy': 'Maulap',
    'Foggy': 'Makulimlim',
    'Rime fog': 'Rime fog',
    'Light drizzle': 'Magkikitang ambon',
    'Drizzle': 'Ambon',
    'Heavy drizzle': 'Mabigat na ambon',
    'Freezing drizzle': 'Nagyeyelong ambon',
    'Heavy freezing drizzle': 'Mabigat na nagyeyelong ambon',
    'Light rain': 'Magkikitang ulan',
    'Rain': 'Ulan',
    'Heavy rain': 'Mabigat na ulan',
    'Freezing rain': 'Nagyeyelong ulan',
    'Heavy freezing rain': 'Mabigat na nagyeyelong ulan',
    'Light snow': 'Magkikitang niyebe',
    'Snow': 'Niyebe',
    'Heavy snow': 'Mabigat na niyebe',
    'Snow grains': 'Maliit na niyebe',
    'Rain showers': 'Maulap na pag-ulan',
    'Heavy showers': 'Mabigat na pag-ulan',
    'Violent showers': 'Mabagsik na pag-ulan',
    'Snow showers': 'Pag-ulan ng niyebe',
    'Heavy snow showers': 'Mabigat na pag-ulan ng niyebe',
    'Thunderstorm': 'Bagyo',
    'Thunderstorm with hail': 'Bagyo na may granizo',
    'Severe thunderstorm': 'Malakas na bagyo',
    'Conditions changing': 'Nagbabago ang kondisyon',
  },
  bisaya: {
    'Clear sky': 'Hayag nga langit',
    'Mostly clear': 'Kadaghanan hayag',
    'Partly cloudy': 'Medyo maulap',
    'Cloudy': 'Maulap',
    'Foggy': 'Mabukob',
    'Rime fog': 'Rime fog',
    'Light drizzle': 'Halin nga ambon',
    'Drizzle': 'Ambon',
    'Heavy drizzle': 'Bug-at nga ambon',
    'Freezing drizzle': 'Nagyelo nga ambon',
    'Heavy freezing drizzle': 'Bug-at nga nagyelo nga ambon',
    'Light rain': 'Halin nga ulan',
    'Rain': 'Ulan',
    'Heavy rain': 'Bug-at nga ulan',
    'Freezing rain': 'Nagyelo nga ulan',
    'Heavy freezing rain': 'Bug-at nga nagyelo nga ulan',
    'Light snow': 'Halin nga niyebe',
    'Snow': 'Niyebe',
    'Heavy snow': 'Bug-at nga niyebe',
    'Snow grains': 'Gamay nga niyebe',
    'Rain showers': 'Pag-ulan',
    'Heavy showers': 'Bug-at nga pag-ulan',
    'Violent showers': 'Grabe nga pag-ulan',
    'Snow showers': 'Pag-ulan sa niyebe',
    'Heavy snow showers': 'Bug-at nga pag-ulan sa niyebe',
    'Thunderstorm': 'Bagyo',
    'Thunderstorm with hail': 'Bagyo nga adunay graniso',
    'Severe thunderstorm': 'Grabe nga bagyo',
    'Conditions changing': 'Nagbag-o ang kahimtang',
  },
}

const tideTranslations = {
  filipino: {
    'High tide': 'Mataas na tubig',
    'Low tide': 'Mababang tubig',
    'Rising tide': 'Tumataas na tubig',
    'Falling tide': 'Bumababa na tubig',
    'Sea level is steadily easing upward.': 'Patuloy na tumataas ang antas ng dagat.',
    'The water is peaking near the shore.': 'Nasa taas na ang tubig sa baybayin.',
    'The shoreline is at its lowest point.': 'Nasa pinakamababang punto ang baybayin.',
    'Sea level is climbing and moving back up.': 'Patuloy na tumataas ang antas ng dagat.',
    'Sea level is going out after the peak.': 'Bababa ang tubig pagkatapos ng mataas na punto.',
    'Next high tide': 'Susunod na mataas na tubig',
    'Next low tide': 'Susunod na mababang tubig',
    'Tide pattern is being updated.': 'Ina-update ang pattern ng tubig.',
    'Tide info currently unavailable': 'Hindi kasalukuyang available ang impormasyon ng tubig',
    'Tide info unavailable': 'Hindi available ang impormasyon ng tubig',
    'This public local weather feed does not include a live tide station for Bago Aplaya yet.': 'Ang pampublikong lokal na feed ng panahon na ito ay wala pang live tide station para sa Bago Aplaya.',
    'Check a local marine bulletin or barangay update for exact tide timing.': 'Suriin ang lokal na marine bulletin o update ng barangay para sa eksaktong oras ng tubig.',
  },
  bisaya: {
    'High tide': 'Taas nga tubig',
    'Low tide': 'Ubos nga tubig',
    'Rising tide': 'Nagsaka nga tubig',
    'Falling tide': 'Nagpaubos nga tubig',
    'Sea level is steadily easing upward.': 'Padayon nga nagsaka ang lebel sa dagat.',
    'The water is peaking near the shore.': 'Nakasaka na ang tubig duol sa baybayon.',
    'The shoreline is at its lowest point.': 'Nakasaka ang baybayon sa ubos nga punto.',
    'Sea level is climbing and moving back up.': 'Padayon nga nagsaka ang lebel sa dagat.',
    'Sea level is going out after the peak.': 'Mopaubos ang tubig human sa taas nga punto.',
    'Next high tide': 'Sunod nga taas nga tubig',
    'Next low tide': 'Sunod nga ubos nga tubig',
    'Tide pattern is being updated.': 'Gi-update ang pattern sa tubig.',
    'Tide info currently unavailable': 'Wala kasamtangan magamit ang impormasyon sa tubig',
    'Tide info unavailable': 'Wala magamit ang impormasyon sa tubig',   
    'This public local weather feed does not include a live tide station for Bago Aplaya yet.': 'Kini nga pampublikong lokal nga feed sa panahon wala pa gyud naglakip og live tide station para sa Bago Aplaya.',
    'Check a local marine bulletin or barangay update for exact tide timing.': 'Susiha ang lokal nga marine bulletin o update sa barangay para sa eksaktong oras sa tubig.',
  },
}

function translateTextWithDictionary(value, language, dictionary) {
  if (!value || !dictionary[language]) return value
  return dictionary[language][value] || value
}

function getNearestIndex(times, targetDate) {
  if (!times?.length) return 0
  let bestIndex = 0
  let bestDifference = Number.POSITIVE_INFINITY

  times.forEach((time, index) => {
    const difference = Math.abs(new Date(time).getTime() - targetDate.getTime())
    if (difference < bestDifference) {
      bestDifference = difference
      bestIndex = index
    }
  })

  return bestIndex
}

function formatClock(timeValue) {
  const date = new Date(timeValue)
  if (Number.isNaN(date.getTime())) return 'Now'

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getTideStatus(values, times) {
  if (!values?.length || !times?.length) return null

  const currentIndex = getNearestIndex(times, new Date())
  const currentValue = Number(values[currentIndex])
  const windowStart = Math.max(0, currentIndex - 6)
  const windowEnd = Math.min(values.length, currentIndex + 7)
  const window = values.slice(windowStart, windowEnd).map(Number)
  const max = Math.max(...window)
  const min = Math.min(...window)
  const spread = Math.max(max - min, 0.08)
  const tolerance = Math.max(0.12, spread * 0.18)

  if (Number.isNaN(currentValue)) return null

  const localExtremes = []
  for (let index = 1; index < values.length - 1; index += 1) {
    const current = Number(values[index])
    const previous = Number(values[index - 1])
    const next = Number(values[index + 1])

    if (Number.isNaN(current) || Number.isNaN(previous) || Number.isNaN(next)) continue

    if (current >= previous && current >= next) {
      localExtremes.push({ index, type: 'high', value: current })
    }
    if (current <= previous && current <= next) {
      localExtremes.push({ index, type: 'low', value: current })
    }
  }

  const nextExtreme = localExtremes.find((extreme) => extreme.index >= currentIndex) || localExtremes[0]

  let status
  let detail
  if (currentValue >= max - tolerance) {
    status = 'High tide'
    detail = 'The water is peaking near the shore.'
  } else if (currentValue <= min + tolerance) {
    status = 'Low tide'
    detail = 'The shoreline is at its lowest point.'
  } else if (currentValue > (max + min) / 2) {
    status = 'Rising tide'
    detail = 'Sea level is climbing and moving back up.'
  } else {
    status = 'Falling tide'
    detail = 'Sea level is going out after the peak.'
  }

  const nextText = nextExtreme
    ? `${nextExtreme.type === 'high' ? 'Next high tide' : 'Next low tide'} ${formatClock(times[nextExtreme.index])}`
    : 'Tide pattern is being updated.'

  return {
    status,
    detail,
    height: `${currentValue.toFixed(2)} m`,
    nextText,
    nextExtreme,
    nextTime: nextExtreme ? times[nextExtreme.index] : null,
  }
}

function getWeatherDescription(code) {
  return weatherCodeLabels[code] || 'Conditions changing'
}

function getFallbackTide() {
  return {
    status: 'Tide info currently unavailable',
    detail: 'This public local weather feed does not include a live tide station for Bago Aplaya yet.',
    height: '--',
    nextText: 'Check a local marine bulletin or barangay update for exact tide timing.',
  }
}

async function fetchCoastalStatus() {
  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${BAGO_APLAYA_COORDS.lat}&longitude=${BAGO_APLAYA_COORDS.lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto&forecast_days=2`,
  )

  const marineResponse = await fetch(
    `https://marine-api.open-meteo.com/v1/marine?latitude=${BAGO_APLAYA_COORDS.lat}&longitude=${BAGO_APLAYA_COORDS.lng}&hourly=wave_height,wave_period&timezone=auto&forecast_days=2`,
  )

  const weatherData = weatherResponse.ok ? await weatherResponse.json() : null
  const marineData = marineResponse.ok ? await marineResponse.json() : null

  const hourlyTimes = weatherData?.hourly?.time || []
  const hourlyTemps = weatherData?.hourly?.temperature_2m || []
  const hourlyRain = weatherData?.hourly?.precipitation_probability || []
  const hourlyWind = weatherData?.hourly?.wind_speed_10m || []
  const hourlyHumidity = weatherData?.hourly?.relative_humidity_2m || []
  const hourlyCodes = weatherData?.hourly?.weather_code || []
  const currentIndex = getNearestIndex(hourlyTimes, new Date())

  const weatherSummary = weatherData ? {
    now: weatherData.current?.temperature_2m ?? hourlyTemps[currentIndex] ?? null,
    humidity: weatherData.current?.relative_humidity_2m ?? hourlyHumidity[currentIndex] ?? null,
    precipitationChance: hourlyRain[currentIndex] ?? 0,
    wind: weatherData.current?.wind_speed_10m ?? hourlyWind[currentIndex] ?? 0,
    description: getWeatherDescription(hourlyCodes[currentIndex] ?? weatherData.current?.weather_code ?? 0),
    waveHeight: marineData?.hourly?.wave_height?.[getNearestIndex(marineData.hourly?.time || [], new Date())] ?? 0,
  } : null

  const tide = marineData?.hourly?.sea_level_height_m
    ? getTideStatus(marineData.hourly.sea_level_height_m, marineData.hourly.time)
    : getFallbackTide()

  return { loading: false, weather: weatherSummary, tide, error: !weatherSummary }
}

function getLocationTime(location) {
  if (location.createdAt?.toMillis) return location.createdAt.toMillis()
  const timestamp = location.createdAt?.toDate?.() || (location.startDate ? new Date(location.startDate) : null)
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.getTime() : 0
}

function getLocationDate(location, dateLocale) {
  const date = location.startDate
    ? new Date(`${location.startDate}T00:00:00`)
    : location.createdAt?.toDate?.() || null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
    : 'Community update'
}

function phoneHref(number) {
  return `tel:${number.split('/')[0].replace(/[^\d+]/g, '')}`
}

export default function Home({ user, locations, locationsStatus, onNavigate, onRequestLogin }) {
  const { language } = useLanguage()
  const dateLocale = getDateLocale(language)
  const [selectedUpdate, setSelectedUpdate] = useState(null)
  const [coastalStatus, setCoastalStatus] = useState({ loading: true })
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const nextStatus = await fetchCoastalStatus()
      setCoastalStatus(nextStatus)
    } catch {
      setCoastalStatus({ loading: false, error: true })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let ignore = false
    fetchCoastalStatus()
      .then((status) => {
        if (!ignore) setCoastalStatus(status)
      })
      .catch(() => {
        if (!ignore) setCoastalStatus({ loading: false, error: true })
      })
    return () => {
      ignore = true
    }
  }, [])

  const updates = [...locations]
    .filter((location) => ['Outage', 'Service', 'Marketplace', 'Report', 'Hazard', 'Community engagement'].includes(location.category))
    .sort((first, second) => getLocationTime(second) - getLocationTime(first))
    .slice(0, 3)

  return (
    <LocalizedContent>
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
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
        <div className="home-hero-map" aria-label="Bago Aplaya map preview">
          <div className="home-hero-map-frame">
            <MapContainer
              center={[7.0435, 125.5315]}
              zoom={14}
              minZoom={14}
              maxBounds={bagoAplayaMaxBounds}
              maxBoundsViscosity={0.9}
              scrollWheelZoom={false}
              dragging={false}
              className="home-hero-map-preview"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <BagoAplayaBorder blurOutside={false} />
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
            <span className="home-hero-map-label">Bago Aplaya · Davao</span>
          </div>
        </div>
      </section>

      <section className="home-coastal-conditions" aria-labelledby="home-coastal-title">
        <div className="home-coastal-header">
          <h2 id="home-coastal-title">Local weather &amp; tide</h2>
          <button
            type="button"
            className="home-coastal-refresh"
            onClick={handleRefresh}
            disabled={refreshing || coastalStatus.loading}
            aria-label={refreshing ? 'Refreshing coastal condition data' : 'Refresh coastal condition data'}
            title={refreshing ? 'Refreshing coastal condition data' : 'Refresh coastal condition data'}
          >
            <RefreshCcw size={16} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        {coastalStatus.loading ? (
          <div className="home-coastal-grid home-coastal-grid--loading">
            <div className="home-condition-card home-condition-card--loading" aria-live="polite" />
            <div className="home-condition-card home-condition-card--loading" aria-live="polite" />
            <div className="home-condition-card home-condition-card--loading" aria-live="polite" />
            <div className="home-condition-card home-condition-card--loading" aria-live="polite" />
          </div>
        ) : coastalStatus.error ? (
          <p className="home-coastal-empty">Live coastal data is currently unavailable. Please check back shortly.</p>
        ) : (
          <div className="home-coastal-grid">
            <div className="home-condition-card home-condition-card--featured">
              <div className="home-condition-icon" aria-hidden="true"><Waves size={20} /></div>
              <span className="home-condition-label">Tide</span>
              <strong className="home-condition-value">
                {translateTextWithDictionary(coastalStatus.tide?.status, language, tideTranslations) || 'Updating…'}
              </strong>
              <span className="home-condition-detail">{coastalStatus.tide?.height || '--'}</span>
              <small>
                {translateTextWithDictionary(coastalStatus.tide?.detail, language, tideTranslations) || 'Checking local tide patterns.'}
              </small>
            </div>

            <div className="home-condition-card">
              <div className="home-condition-icon" aria-hidden="true"><CloudRain size={20} /></div>
              <span className="home-condition-label">Weather</span>
              <strong className="home-condition-value">{coastalStatus.weather?.now ?? '--'}°C</strong>
              <span className="home-condition-detail">
                {translateTextWithDictionary(coastalStatus.weather?.description, language, weatherTranslations) || 'Weather info'}
              </span>
              <small>{coastalStatus.weather?.precipitationChance ?? 0}% rain chance</small>
            </div>

            <div className="home-condition-card">
              <div className="home-condition-icon" aria-hidden="true"><Wind size={20} /></div>
              <span className="home-condition-label">Wind</span>
              <strong className="home-condition-value">{coastalStatus.weather?.wind ?? '--'} km/h</strong>
              <span className="home-condition-detail">Coastal breeze</span>
              <small>{coastalStatus.weather?.humidity ?? '--'}% humidity</small>
            </div>

            <div className="home-condition-card">
              <div className="home-condition-icon" aria-hidden="true"><Waves size={20} /></div>
              <span className="home-condition-label">Sea</span>
              <strong className="home-condition-value">{coastalStatus.weather?.waveHeight ? `${Number(coastalStatus.weather.waveHeight).toFixed(1)} m` : '--'}</strong>
              <span className="home-condition-detail">Wave height</span>
              <small>
                {coastalStatus.tide?.nextExtreme
                  ? `${translateTextWithDictionary(coastalStatus.tide.nextExtreme.type === 'high' ? 'Next high tide' : 'Next low tide', language, tideTranslations)} ${formatClock(coastalStatus.tide.nextTime)}`
                  : translateTextWithDictionary(coastalStatus.tide?.nextText, language, tideTranslations) || 'Tide pattern updating'}
              </small>
            </div>
          </div>
        )}
      </section>

      <section className="home-services" aria-labelledby="home-services-title">
        <header className="home-section-heading">
          <h2 id="home-services-title"><strong>Gabay</strong> <em>Services</em></h2>
        </header>
        <div className="home-service-grid">
          {services.map((service) => {
            const Icon = service.icon
            return (
              <button
                className="home-service-card"
                type="button"
                key={service.title}
                onClick={() => onNavigate(service.page)}
              >
                <Icon className="home-service-icon" size={56} strokeWidth={2.5} aria-hidden="true" />
                <span className="home-service-title">{service.title}</span>
                <span className="home-service-description">{service.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="home-resources" aria-labelledby="home-resources-title">
        <header className="home-resources-heading">
          <h2 id="home-resources-title">Emergency resources <em>&amp; services</em></h2>
          <p>Contact details and service information sourced from Davao City and local agencies. Please confirm availability before visiting.</p>
        </header>
        <div className="home-resources-grid">
          <section className="home-resource-group" aria-labelledby="home-emergency-contacts-title">
            <h3 id="home-emergency-contacts-title">Emergency contacts</h3>
            <ul className="home-contact-list">
              {officialContacts.map((contact) => (
                <li className="home-contact-item" key={contact.name}>
                  <div>
                    <h4>{contact.name}</h4>
                    <a className="home-contact-number" href={phoneHref(contact.number)}>
                      <PhoneCall size={15} aria-hidden="true" />{contact.number}
                    </a>
                    <p>{contact.note}</p>
                  </div>
                  <a className="home-resource-source" href={contact.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open official source for ${contact.name}`}>
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="home-resource-group" aria-labelledby="home-city-services-title">
            <h3 id="home-city-services-title">City services</h3>
            <ul className="home-service-list">
              {officialServices.map((service) => (
                <li className="home-official-service" key={service.name}>
                  <div className="home-official-service-heading">
                    <h4>{service.name}</h4>
                    {service.contact && <a href={phoneHref(service.contact)}>{service.contact}</a>}
                  </div>
                  <p>{service.description}</p>
                  {service.hours && <p className="home-service-hours"><strong>Hours:</strong> {service.hours}</p>}
                  <div className="home-service-links">
                    <a href={service.sourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink size={13} aria-hidden="true" /></a>
                    {service.actionUrl && <a href={service.actionUrl} target="_blank" rel="noreferrer">Open city portal <ExternalLink size={13} aria-hidden="true" /></a>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className="home-updates" aria-labelledby="home-updates-title">
        <header className="home-section-heading home-section-heading--updates">
          <div>
            <h2 id="home-updates-title"><strong>Gabay</strong> <em>Updates</em></h2>
          </div>

        </header>
        {updates.length ? (
          <div className="home-update-grid">
            {updates.map((update, index) => (
              <button
                className={`home-update-card${index === 1 ? ' home-update-card--featured' : ''}`}
                type="button"
                key={update.id}
                onClick={() => setSelectedUpdate(update)}
              >
                <span className="home-update-category">{update.category}</span>
                <span className="home-update-title"><PreservedContent>{update.name}</PreservedContent></span>
                <span className="home-update-date">{getLocationDate(update, dateLocale)}</span>
                <span className="home-update-description">
                  {update.description
                    ? <PreservedContent>{update.description}</PreservedContent>
                    : 'Open the updates page for more information.'}
                </span>
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

      {selectedUpdate && (
        <EventDetailsModal
          selectedEvent={makeEvent(selectedUpdate, 'location', selectedUpdate.startDate || '', {
            startDate: selectedUpdate.startDate || '',
            endDate: selectedUpdate.endDate || '',
            startTime: selectedUpdate.startTime || '',
            endTime: selectedUpdate.endTime || '',
          })}
          user={user}
          onClose={() => setSelectedUpdate(null)}
          onRequestLogin={onRequestLogin}
          onNavigate={onNavigate}
        />
      )}
    </main>
    </LocalizedContent>
  )
}