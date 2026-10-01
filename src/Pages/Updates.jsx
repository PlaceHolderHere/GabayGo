import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import BagoAplayaBorder from '../Components/BagoAplayaBorder'
import { categoryIcons, defaultIcon } from '../Components/mapIcons'
import 'leaflet/dist/leaflet.css'
import './Updates.css'

const scheduledCategories = ['Marketplace', 'Outage', 'Service']
const allCategories = ['Marketplace', 'Outage', 'Service', 'Report']
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const reportStatuses = ['Submitted', 'Under review', 'Resolved']

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function timestampDateKey(timestamp) {
  if (!timestamp) return null
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : dateKey(date)
}

function timestampMillis(timestamp) {
  if (!timestamp) return null
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : null
}

function getReportStatus(location) {
  return location.status || (location.resolvedAt ? 'Resolved' : location.underReviewAt ? 'Under review' : 'Submitted')
}

function makeEvent(location, kind, date, extra = {}) {
  if (!date) return null
  return {
    id: `${location.id}-${kind}`,
    locationId: location.id,
    location,
    kind,
    date,
    startDate: date,
    endDate: date,
    category: location.category,
    title: location.name,
    description: location.description || '',
    startTime: '',
    endTime: '',
    ...extra,
  }
}

function getLocationEvents(locations) {
  const events = []

  locations.forEach((location) => {
    if (scheduledCategories.includes(location.category)) {
      const startDate = location.startDate || location.endDate
      const endDate = location.endDate || location.startDate
      if (parseDateKey(startDate) && parseDateKey(endDate)) {
        events.push(makeEvent(location, 'scheduled', startDate, {
          startDate,
          endDate,
          startTime: location.startTime || '',
          endTime: location.endTime || '',
          createdAt: location.createdAt,
        }))
      }
    }

    if (location.category === 'Report') {
      const submittedDate = timestampDateKey(location.createdAt) || location.startDate
      const submittedAt = timestampMillis(location.createdAt)
      const submittedEvent = makeEvent(location, 'submitted', submittedDate, {
        activity: 'Report submitted',
        activityAt: submittedAt,
        reportStatus: getReportStatus(location),
      })
      if (submittedEvent) events.push(submittedEvent)

      const reviewDate = timestampDateKey(location.underReviewAt)
      const reviewEvent = makeEvent(location, 'under-review', reviewDate, {
        activity: 'Report moved under review',
        activityAt: timestampMillis(location.underReviewAt),
        reportStatus: getReportStatus(location),
        updatedBy: location.underReviewBy,
      })
      if (reviewEvent) events.push(reviewEvent)

      const resolvedDate = timestampDateKey(location.resolvedAt)
      const resolvedEvent = makeEvent(location, 'resolved', resolvedDate, {
        activity: 'Report resolved',
        activityAt: timestampMillis(location.resolvedAt),
        reportStatus: getReportStatus(location),
        updatedBy: location.resolvedBy,
      })
      if (resolvedEvent) events.push(resolvedEvent)
    }
  })

  return events
}

function getEventTimestamp(event) {
  if (event.activityAt !== null && event.activityAt !== undefined) return event.activityAt
  const time = event.startTime || '00:00'
  const timestamp = Date.parse(`${event.startDate}T${time}`)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getEventPeriod(event, now) {
  const start = Date.parse(`${event.startDate}T${event.startTime || '00:00'}`)
  const end = Date.parse(`${event.endDate || event.startDate}T${event.endTime || '23:59'}`)
  if (Number.isFinite(end) && end < now) return 'past'
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end >= now)) return 'ongoing'
  return 'upcoming'
}

function getWeekSegments(events, weekDates, now) {
  const firstDate = weekDates[0].key
  const lastDate = weekDates[6].key
  const candidateSegments = events.flatMap((event) => {
    if (event.endDate < firstDate || event.startDate > lastDate) return []
    const clippedStart = event.startDate < firstDate ? firstDate : event.startDate
    const clippedEnd = event.endDate > lastDate ? lastDate : event.endDate
    const startIndex = weekDates.findIndex((day) => day.key === clippedStart)
    const endIndex = weekDates.findIndex((day) => day.key === clippedEnd)
    if (startIndex < 0 || endIndex < 0) return []
    return [{
      event,
      startIndex,
      endIndex,
      continuesBefore: event.startDate < firstDate,
      continuesAfter: event.endDate > lastDate,
      period: event.kind === 'scheduled' ? getEventPeriod(event, now) : event.kind,
    }]
  }).sort((first, second) => first.startIndex - second.startIndex || second.endIndex - first.endIndex)

  const laneEnds = []
  return candidateSegments.map((segment) => {
    let lane = laneEnds.findIndex((lastColumn) => lastColumn < segment.startIndex)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = segment.endIndex
    return { ...segment, lane }
  })
}

function describeEvent(event) {
  if (event.kind === 'submitted') return `Submitted: ${event.title}`
  if (event.kind === 'under-review') return `Under review: ${event.title}`
  if (event.kind === 'resolved') return `Resolved: ${event.title}`
  return event.title
}

function reportHistory(location) {
  return [
    {
      label: 'Submitted',
      timestamp: location.createdAt,
      fallbackDate: location.startDate,
      by: location.createdBy,
      status: 'Submitted',
    },
    {
      label: 'Under review',
      timestamp: location.underReviewAt,
      by: location.underReviewBy,
      status: 'Under review',
    },
    {
      label: 'Resolved',
      timestamp: location.resolvedAt,
      by: location.resolvedBy,
      status: 'Resolved',
    },
  ].filter((item) => item.timestamp || item.fallbackDate)
}

export default function Updates({ locations, locationsStatus, locationsError }) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilters, setCategoryFilters] = useState([])
  const [reportStatusFilter, setReportStatusFilter] = useState('All')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [showAllUpdates, setShowAllUpdates] = useState(false)

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedLocationId) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedLocationId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLocationId])

  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const gridStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - monthStart.getDay())
  const dates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return { date, key: dateKey(date), isCurrentMonth: date.getMonth() === visibleMonth.getMonth() }
  })
  const allEvents = getLocationEvents(locations)
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()
  const filteredEvents = allEvents.filter((event) => {
    const { location } = event
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(event.category)
    const matchesSearch = `${event.title} ${event.category} ${event.description}`.toLocaleLowerCase().includes(normalizedSearch)
    const matchesReportStatus = location.category !== 'Report'
      || reportStatusFilter === 'All'
      || getReportStatus(location) === reportStatusFilter
    const matchesPeriod = periodFilter === 'all'
      || (event.kind === 'scheduled' && getEventPeriod(event, currentTime) === periodFilter)
    const matchesFrom = !dateFrom || event.endDate >= dateFrom
    const matchesTo = !dateTo || event.startDate <= dateTo
    const matchesTimeFrom = !timeFrom || !event.startTime || (event.endTime || event.startTime) >= timeFrom
    const matchesTimeTo = !timeTo || !event.startTime || event.startTime <= timeTo

    return matchesCategory && matchesSearch && matchesReportStatus && matchesPeriod
      && matchesFrom && matchesTo && matchesTimeFrom && matchesTimeTo
  })
  const dailyUpdates = [...filteredEvents].sort((first, second) => getEventTimestamp(second) - getEventTimestamp(first))
  const dailyUpdatesToShow = showAllUpdates ? dailyUpdates : dailyUpdates.slice(0, 8)
  const weeks = Array.from({ length: 6 }, (_, weekIndex) => dates.slice(weekIndex * 7, weekIndex * 7 + 7))
  const selectedLocation = locations.find((location) => location.id === selectedLocationId)
  const now = new Date(currentTime)

  const changeMonth = (amount) => {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1))
    setSelectedLocationId(null)
  }

  const showToday = () => {
    const today = new Date()
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(dateKey(today))
    setSelectedLocationId(null)
  }

  const selectEvent = (event) => {
    setSelectedDate(event.startDate)
    setSelectedLocationId(event.locationId)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilters([])
    setReportStatusFilter('All')
    setPeriodFilter('all')
    setDateFrom('')
    setDateTo('')
    setTimeFrom('')
    setTimeTo('')
  }

  return (
    <main className="updates-page">
      <section className="updates-daily" aria-labelledby="daily-updates-title">
        <header className="updates-page-header">
          <div>
            <h1>Updates</h1>
            <p>Local events and community report activity.</p>
          </div>
          <span className="updates-total">{dailyUpdates.length} updates</span>
        </header>

        <div className="updates-daily-header">
          <h2 id="daily-updates-title">Daily updates</h2>
          <span>Newest activity first</span>
        </div>

        <div className="updates-filters">
          <label className="updates-search-label">
            Search locations
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search names or details"
            />
          </label>
          <label>
            Report status
            <select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value)}>
              <option>All</option>
              {reportStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Event timing
            <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
              <option value="all">All dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="past">Past</option>
            </select>
          </label>
          <div className="updates-filter-row">
            <label>
              From date
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              To date
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
          <div className="updates-filter-row">
            <label>
              From time
              <input type="time" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} />
            </label>
            <label>
              To time
              <input type="time" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} />
            </label>
          </div>
          <fieldset className="updates-category-filter">
            <legend>Categories</legend>
            <div>
              {allCategories.map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={categoryFilters.includes(category)}
                    onChange={(event) => setCategoryFilters((selected) => event.target.checked
                      ? [...selected, category]
                      : selected.filter((item) => item !== category))}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="updates-clear-filters" type="button" onClick={clearFilters}>Clear filters</button>
        </div>

        {locationsStatus === 'loading' && <p className="updates-empty">Loading updates…</p>}
        {locationsStatus === 'error' && <p className="updates-empty updates-empty--error">{locationsError}</p>}
        {locationsStatus === 'ready' && dailyUpdates.length === 0 && <p className="updates-empty">No updates match these filters.</p>}

        {locationsStatus === 'ready' && dailyUpdates.length > 0 && (
          <div className="updates-feed">
            {dailyUpdatesToShow.map((event) => (
              <button
                className={`updates-feed-item updates-feed-item--${event.category.toLowerCase()} updates-feed-item--${event.kind}`}
                key={event.id}
                type="button"
                onClick={() => selectEvent(event)}
              >
                <span className="updates-feed-type">{event.activity || event.category}</span>
                <span className="updates-feed-title">{event.title}</span>
                <span className="updates-feed-description">{event.description}</span>
                <span className="updates-feed-date">
                  {event.startDate}{event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}
                  {event.startTime ? ` · ${event.startTime}` : ''}
                </span>
                {event.category === 'Report' && (
                  <span className={`updates-report-status updates-report-status--${getReportStatus(event.location).toLowerCase().replace(' ', '-')}`}>
                    {getReportStatus(event.location)}
                  </span>
                )}
              </button>
            ))}
            {dailyUpdates.length > 8 && (
              <button className="updates-show-more" type="button" onClick={() => setShowAllUpdates((show) => !show)}>
                {showAllUpdates ? 'Show fewer updates' : `Show all ${dailyUpdates.length} updates`}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="updates-calendar" aria-labelledby="updates-calendar-title">
        <header className="updates-calendar-header">
          <div>
            <p className="updates-eyebrow">Browse by date</p>
            <h2 id="updates-calendar-title">Calendar</h2>
          </div>
          <div className="updates-calendar-navigation" aria-label="Calendar month navigation">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <button className="updates-today-button" type="button" onClick={showToday}>Today</button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>
        </header>

        <div className="updates-month-title" aria-live="polite">
          {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <div className="updates-legend" aria-label="Event categories">
          {[
            ['marketplace', 'Marketplace'], ['outage', 'Outage'], ['service', 'Service'], ['report', 'Report'],
          ].map(([category, label]) => (
            <span className={`updates-legend-item updates-legend-item--${category}`} key={category}>
              <i aria-hidden="true" />{label}
            </span>
          ))}
        </div>

        <div className="updates-weekdays" role="row">
          {weekDays.map((day) => <div className="updates-weekday" role="columnheader" key={day}>{day}</div>)}
        </div>
        <div className="updates-weeks" role="grid" aria-label="Monthly location events">
          {weeks.map((week) => {
            const segments = getWeekSegments(filteredEvents, week, now.getTime())
            const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1))
            return (
              <div className="updates-week" key={week[0].key} style={{ '--event-lanes': laneCount }}>
                <div className="updates-week-days">
                  {week.map(({ date, key, isCurrentMonth }) => (
                    <button
                      className={`updates-day${isCurrentMonth ? '' : ' updates-day--outside'}${key === dateKey(now) ? ' updates-day--today' : ''}${selectedDate === key ? ' updates-day--selected' : ''}`}
                      type="button"
                      role="gridcell"
                      aria-label={`${date.toLocaleDateString()}`}
                      aria-pressed={selectedDate === key}
                      key={key}
                      onClick={() => {
                        setSelectedDate(key)
                        setSelectedLocationId(null)
                      }}
                    >
                      <span>{date.getDate()}</span>
                    </button>
                  ))}
                </div>
                <div className="updates-week-event-layer">
                  {segments.map(({ event, startIndex, endIndex, lane, continuesBefore, continuesAfter }) => (
                    <button
                      className={`updates-calendar-event updates-calendar-event--${event.category.toLowerCase()} updates-calendar-event--${event.kind}${continuesBefore ? ' updates-calendar-event--continues-before' : ''}${continuesAfter ? ' updates-calendar-event--continues-after' : ''}`}
                      key={`${event.id}-${week[0].key}`}
                      style={{
                        left: `calc(${startIndex * 100 / 7}% + 2px)`,
                        width: `calc(${(endIndex - startIndex + 1) * 100 / 7}% - 4px)`,
                        '--event-lane': lane,
                      }}
                      type="button"
                      title={`${describeEvent(event)} · ${event.startDate}${event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}`}
                      onClick={() => selectEvent(event)}
                    >
                      {continuesBefore ? '‹ ' : ''}{event.kind === 'scheduled' ? event.title : describeEvent(event)}{continuesAfter ? ' ›' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {selectedLocation && (
          <div className="updates-details-backdrop" onClick={() => setSelectedLocationId(null)}>
            <aside
              className="updates-details"
              role="dialog"
              aria-modal="true"
              aria-live="polite"
              aria-labelledby="updates-details-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="updates-details-header">
                <div>
                  <p className={`updates-detail-category updates-detail-category--${selectedLocation.category.toLowerCase()}`}>
                    {selectedLocation.category}
                  </p>
                  <h2 id="updates-details-title">{selectedLocation.name}</h2>
                </div>
                <div className="updates-details-actions">
                  {selectedLocation.category === 'Report' && (
                    <span className={`updates-report-status updates-report-status--${getReportStatus(selectedLocation).toLowerCase().replace(' ', '-')}`}>
                      {getReportStatus(selectedLocation)}
                    </span>
                  )}
                  <button className="updates-details-close" type="button" onClick={() => setSelectedLocationId(null)} aria-label="Close location details">
                    ×
                  </button>
                </div>
              </header>
              <div className="updates-detail-map" aria-label={`Map location for ${selectedLocation.name}`}>
                <MapContainer
                  center={[selectedLocation.lat, selectedLocation.lng]}
                  zoom={15}
                  scrollWheelZoom={false}
                  zoomControl
                  className="updates-detail-leaflet"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <BagoAplayaBorder />
                  <Marker
                    position={[selectedLocation.lat, selectedLocation.lng]}
                    icon={categoryIcons[selectedLocation.category] || defaultIcon}
                  />
                </MapContainer>
              </div>
              <p className="updates-detail-description">{selectedLocation.description}</p>
              {scheduledCategories.includes(selectedLocation.category) && (
                <p className="updates-detail-date">
                  <strong>Date: </strong>{selectedLocation.startDate || 'Date not set'}{selectedLocation.endDate && selectedLocation.endDate !== selectedLocation.startDate ? ` – ${selectedLocation.endDate}` : ''}
                  <br/>
                  <strong>Time: </strong>{selectedLocation.startTime ? `${selectedLocation.startTime}` : ''}
                  {selectedLocation.endTime ? ` – ${selectedLocation.endTime}` : ''}
                </p>
              )}
              {selectedLocation.category === 'Report' && (
                <ol className="updates-report-history">
                  {reportHistory(selectedLocation).map((item) => {
                    const itemDate = timestampDateKey(item.timestamp) || item.fallbackDate
                    const itemTime = item.status === 'Submitted'
                      ? null
                      : item.timestamp?.toDate?.().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    return (
                      <li className={`updates-report-history-item${getReportStatus(selectedLocation) === item.status ? ' updates-report-history-item--current' : ''}`} key={item.label}>
                        <span className="updates-history-dot" />
                        <div>
                          <strong>{item.label}</strong>
                          <span>{itemDate || 'Date unavailable'}{itemTime ? ` · ${itemTime}` : ''}</span>
                          {item.by && <span>Account {item.by}</span>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
              <p className="updates-detail-latitude"><strong>Latitude:</strong> {selectedLocation.lat.toFixed(5)}</p>
              <p className="updates-detail-longitude"><strong>Longitude:</strong> {selectedLocation.lng.toFixed(5)}</p>
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}