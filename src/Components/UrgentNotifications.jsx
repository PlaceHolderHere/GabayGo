import { useEffect, useState } from 'react'
import { defaultHazardRadius, urgentCategories } from '../globals'
import './UrgentNotifications.css'
import { LocalizedContent, PreservedContent } from '../i18n'
import { getDateLocale, useLanguage } from '../language'

function parseLocationDate(date, time) {
  if (!date) return null
  const parsedDate = new Date(`${date}T${time || '00:00'}`)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function getTimestampDate(timestamp) {
  return typeof timestamp?.toDate === 'function' ? timestamp.toDate() : null
}

function formatUrgentUpdatedAt(location, dateLocale) {
  const updatedAt = getTimestampDate(location.updatedAt) || getTimestampDate(location.createdAt)
  return updatedAt ? updatedAt.toLocaleString(dateLocale) : 'Unavailable'
}

function getAlertOrder(location, now, dateLocale) {
  if (['Hazard', 'Evacuation', 'Relief'].includes(location.category)) {
    const updatedAt = getTimestampDate(location.updatedAt) || getTimestampDate(location.createdAt)
    return { priority: 0, sortTime: updatedAt?.getTime() || 0, timing: `Last updated ${formatUrgentUpdatedAt(location, dateLocale)}` }
  }

  const startsAt = parseLocationDate(location.startDate, location.startTime)
  const endsAt = parseLocationDate(location.endDate, location.endTime)
  if (startsAt && startsAt > now) {
    return { priority: 2, sortTime: startsAt.getTime(), timing: `Starts ${startsAt.toLocaleString(dateLocale)}` }
  }
  if ((startsAt && startsAt <= now && (!endsAt || endsAt >= now)) || (!startsAt && endsAt && endsAt >= now)) {
    return { priority: 1, sortTime: endsAt?.getTime() || Number.MAX_SAFE_INTEGER, timing: 'Happening now' }
  }
  if (!startsAt && !endsAt) {
    return { priority: 3, sortTime: Number.MAX_SAFE_INTEGER, timing: 'Timing not specified' }
  }
  return { priority: 4, sortTime: endsAt?.getTime() || startsAt?.getTime() || 0, timing: 'Ended' }
}

/* SVG icons per category */
const categoryIcons = {
  Hazard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Outage: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  Evacuation: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Relief: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0L12 5.34l-.77-.76a5.4 5.4 0 0 0-7.65 0 5.4 5.4 0 0 0 0 7.65L12 20.65l8.42-8.42a5.4 5.4 0 0 0 0-7.65z" />
    </svg>
  ),
}

function getCategoryIcon(category) {
  return categoryIcons[category] || categoryIcons.Hazard
}

export default function UrgentNotifications({
  locations = [],
  locationsStatus,
  locationsError,
  onNavigate,
  onSelectLocation,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(true)
  const [userToggled, setUserToggled] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const { language } = useLanguage()
  const dateLocale = getDateLocale(language)

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  const urgentAlerts = locations
    .filter((location) => urgentCategories.includes(location.category))
    .map((location) => ({ location, ...getAlertOrder(location, currentTime, dateLocale) }))
    .sort((first, second) => {
      if (first.priority !== second.priority) return first.priority - second.priority
      if (first.priority === 0 || first.priority === 4) return second.sortTime - first.sortTime
      return first.sortTime - second.sortTime
    })

  // Urgent notifications open by default when urgent alerts exist; stay closed if 0 alerts and not user-opened
  useEffect(() => {
    if (!userToggled && locationsStatus === 'ready') {
      if (urgentAlerts.length > 0) {
        setNotificationsOpen(true)
      } else {
        setNotificationsOpen(false)
      }
    }
  }, [locationsStatus, urgentAlerts.length, userToggled])

  const toggleOpen = () => {
    setUserToggled(true)
    setNotificationsOpen((isOpen) => !isOpen)
  }

  const handleSelectAlert = (location) => {
    onSelectLocation?.(location)
    setNotificationsOpen(false)
  }

  return (
    <LocalizedContent>
    <div className="urgent-notifications-root">
      <button
        className={`notifications-toggle urgent-alerts-toggle${urgentAlerts.length > 0 ? ' urgent-alerts-toggle--active' : ' urgent-alerts-toggle--empty'}`}
        type="button"
        onClick={toggleOpen}
        aria-expanded={notificationsOpen}
        aria-controls="urgent-alerts-panel"
        aria-label={notificationsOpen
          ? 'Close urgent alerts'
          : `Urgent alerts, ${urgentAlerts.length} active`}
        title={urgentAlerts.length > 0 ? `Urgent alerts (${urgentAlerts.length} active)` : 'Urgent alerts (0 active)'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {notificationsOpen
            ? <path d="m6 6 12 12M18 6 6 18" />
            : <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />}
        </svg>
        <span
          className={`notifications-count ${urgentAlerts.length > 0 ? 'notifications-count--active' : 'notifications-count--empty'}`}
          aria-hidden="true"
        >
          {urgentAlerts.length > 99 ? '99+' : urgentAlerts.length}
        </span>
      </button>

      {notificationsOpen && (
        <aside className="urgent-alerts-panel" id="urgent-alerts-panel" aria-label="Urgent alerts">
          <header className="urgent-alerts-header">
            <div className="urgent-alerts-header-info">
              <h2>Urgent alerts</h2>
            </div>
            <span className={`urgent-alerts-badge ${urgentAlerts.length > 0 ? 'urgent-alerts-badge--active' : 'urgent-alerts-badge--empty'}`}>
              {urgentAlerts.length === 1 ? '1 active' : `${urgentAlerts.length} active`}
            </span>
          </header>

          {locationsStatus === 'loading' && <p className="map-feedback" role="status">Loading alerts…</p>}
          {locationsStatus === 'error' && <p className="map-feedback map-feedback--error" role="alert">{locationsError}</p>}
          {locationsStatus === 'ready' && urgentAlerts.length === 0 && (
            <div className="urgent-alerts-empty-container">
              <p className="urgent-alerts-empty" role="status">No active urgent alerts reported.</p>
              <p className="urgent-alerts-empty-hint">Check all community announcements, events, and schedules below.</p>
            </div>
          )}
          {urgentAlerts.length > 0 && (
            <ul className="urgent-alerts-list" aria-live="polite">
              {urgentAlerts.map(({ location, timing }) => (
                <li className={`urgent-alert-item urgent-alert-item--${location.category.toLowerCase()}`} key={location.id}>
                  <button
                    type="button"
                    className="urgent-alert-select-button"
                    onClick={() => handleSelectAlert(location)}
                    title="View on map"
                  >
                    {/* Icon on the left */}
                    <span className={`urgent-alert-icon urgent-alert-icon--${location.category.toLowerCase()}`}>
                      {getCategoryIcon(location.category)}
                    </span>

                    {/* Content in the center */}
                    <div className="urgent-alert-content">
                      <div className="urgent-alert-title-row">
                        <strong className="urgent-alert-title"><PreservedContent>{location.name}</PreservedContent></strong>
                        <span className={`urgent-alert-type urgent-alert-type--${location.category.toLowerCase()}`}>
                          {location.category}
                        </span>
                      </div>
                      <span className="urgent-alert-timing">{timing}</span>
                      {location.category === 'Hazard' && (
                        <span className="urgent-alert-detail">
                          Coverage radius: {location.hazardRadius || defaultHazardRadius} m
                        </span>
                      )}
                      {location.description && (
                        <p className="urgent-alert-desc"><PreservedContent>{location.description}</PreservedContent></p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <footer className="urgent-alerts-footer">
            <button
              type="button"
              className="urgent-alerts-all-button"
              onClick={() => {
                setNotificationsOpen(false)
                onNavigate?.('updates')
              }}
            >
              <span>See all updates</span>
              <span aria-hidden="true">↗</span>
            </button>
          </footer>
        </aside>
      )}
    </div>
    </LocalizedContent>
  )
}
