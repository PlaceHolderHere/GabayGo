import logo from '../assets/Logo.svg'
import { useEffect, useRef, useState } from 'react'
import './Navbar.css'

const timeSensitiveCategories = ['Outage', 'Service']
const upcomingWindowMs = 3 * 24 * 60 * 60 * 1000

function getScheduledTimestamp(date, time) {
  if (!date) return null

  const timestamp = Date.parse(`${date}T${time || '00:00'}`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function getNotificationBounds(location) {
  return {
    start: getScheduledTimestamp(
      location.startDate || location.endDate,
      location.startTime || location.endTime,
    ),
    end: getScheduledTimestamp(
      location.endDate || location.startDate,
      location.endTime || location.startTime,
    ),
  }
}

function getNotificationStatus(location, currentTime) {
  const { start, end } = getNotificationBounds(location)
  if (end !== null && end < currentTime) return 'passed'
  if (start !== null && start <= currentTime && (end === null || end >= currentTime)) return 'ongoing'
  if (start !== null) return 'upcoming'
  return 'undated'
}

function getNotificationTimestamp(location) {
  const { start, end } = getNotificationBounds(location)
  if (start !== null) return start
  if (end !== null) return end
  return location.createdAt?.toMillis?.() ?? 0
}

export default function Navbar({ user, locations, onLogin, onSignOut }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [notificationSearch, setNotificationSearch] = useState('')
  const [notificationCategory, setNotificationCategory] = useState('All')
  const [notificationStatus, setNotificationStatus] = useState('upcoming')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const notificationsRef = useRef(null)

  const timeSensitiveLocations = locations.filter((location) => timeSensitiveCategories.includes(location.category))
  const upcomingNotifications = timeSensitiveLocations.filter((location) => {
    const { start } = getNotificationBounds(location)
    return start !== null && start > currentTime && start <= currentTime + upcomingWindowMs
  })
  const normalizedSearch = notificationSearch.trim().toLocaleLowerCase()
  const filteredNotifications = timeSensitiveLocations.filter((location) => {
    const matchesCategory = notificationCategory === 'All' || location.category === notificationCategory
    const searchableText = `${location.name} ${location.category} ${location.description || ''}`.toLocaleLowerCase()
    const hasDates = Boolean(location.startDate || location.endDate)
    const hasTimes = Boolean(location.startTime || location.endTime)
    const firstDate = location.startDate || location.endDate
    const lastDate = location.endDate || location.startDate
    const firstTime = location.startTime || location.endTime
    const lastTime = location.endTime || location.startTime
    const { start } = getNotificationBounds(location)
    const status = getNotificationStatus(location, currentTime)
    const matchesStatus = notificationStatus === 'all'
      || (notificationStatus === 'upcoming'
        ? status === 'upcoming' && start < currentTime + upcomingWindowMs
        : status === notificationStatus)
    const matchesFrom = !dateFrom || !hasDates || lastDate >= dateFrom
    const matchesTo = !dateTo || !hasDates || firstDate <= dateTo
    const matchesTimeFrom = !timeFrom || !hasTimes || lastTime >= timeFrom
    const matchesTimeTo = !timeTo || !hasTimes || firstTime <= timeTo

    return matchesStatus
      && matchesCategory
      && (!normalizedSearch || searchableText.includes(normalizedSearch))
      && matchesFrom
      && matchesTo
      && matchesTimeFrom
      && matchesTimeTo
  })
  const sortedNotifications = [...filteredNotifications].sort(
    (first, second) => getNotificationTimestamp(second) - getNotificationTimestamp(first),
  )

  useEffect(() => {
    if (!notificationsOpen) return undefined

    const handlePointerDown = (event) => {
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  useEffect(() => {
    if (!notificationsOpen) return undefined

    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [notificationsOpen])

  const clearNotificationFilters = () => {
    setNotificationSearch('')
    setNotificationCategory('All')
    setNotificationStatus('upcoming')
    setDateFrom('')
    setDateTo('')
    setTimeFrom('')
    setTimeTo('')
  }

  return (
    <header className="site-nav">
      <div className="site-nav-left">
        <a className="site-brand" href="/" aria-label="GabayGo home">
          <img className="site-brand-logo" src={logo} alt="GabayGo" />
        </a>
        <nav className="site-nav-links" aria-label="Main navigation">
          <a className="nav-map-link" href="#map">Map</a>
          <div className="notification-menu" ref={notificationsRef}>
            <button
              className="notification-trigger"
              type="button"
              onClick={() => {
                setCurrentTime(Date.now())
                setNotificationsOpen((isOpen) => !isOpen)
              }}
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              aria-label={`Notifications, ${upcomingNotifications.length} upcoming locations`}
            >
              <span>Notifications</span>
              <span className="notification-count" aria-hidden="true">{upcomingNotifications.length}</span>
            </button>
            {notificationsOpen && (
              <section className="notification-panel" role="dialog" aria-label="Time-sensitive locations">
                <div className="notification-panel-header">
                  <div>
                    <p className="notification-eyebrow">Community updates</p>
                    <h2>Notifications</h2>
                  </div>
                  <button className="notification-close" type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">
                    ×
                  </button>
                </div>

                <div className="notification-filters">
                  <div className="notification-status-filter" role="group" aria-label="Notification status">
                    {[
                      ['upcoming', 'Upcoming'],
                      ['ongoing', 'Ongoing'],
                      ['passed', 'Passed'],
                      ['all', 'All'],
                    ].map(([value, label]) => (
                      <button
                        className={notificationStatus === value ? 'notification-status-button notification-status-button--active' : 'notification-status-button'}
                        key={value}
                        type="button"
                        onClick={() => setNotificationStatus(value)}
                        aria-pressed={notificationStatus === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label>
                    Search updates
                    <input
                      type="search"
                      value={notificationSearch}
                      onChange={(event) => setNotificationSearch(event.target.value)}
                      placeholder="Name or details"
                    />
                  </label>
                  <label>
                    Type
                    <select value={notificationCategory} onChange={(event) => setNotificationCategory(event.target.value)}>
                      <option value="All">All types</option>
                      {timeSensitiveCategories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <div className="notification-filter-row">
                    <label>
                      From date
                      <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                    </label>
                    <label>
                      To date
                      <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    </label>
                  </div>
                  <div className="notification-filter-row">
                    <label>
                      From time
                      <input type="time" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} />
                    </label>
                    <label>
                      To time
                      <input type="time" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} />
                    </label>
                  </div>
                  <div className="notification-filter-summary">
                    <span>{filteredNotifications.length} updates</span>
                    <button type="button" onClick={clearNotificationFilters}>Clear filters</button>
                  </div>
                </div>

                <div className="notification-list" aria-live="polite">
                  {sortedNotifications.length ? sortedNotifications.map((location) => (
                    <article className="notification-item" key={location.id}>
                      <div className="notification-item-heading">
                        <h3>{location.name}</h3>
                        <div className="notification-item-labels">
                          <span>{location.category}</span>
                          <span className={`notification-status-badge notification-status-badge--${getNotificationStatus(location, currentTime)}`}>
                            {getNotificationStatus(location, currentTime) === 'undated'
                              ? 'No schedule'
                              : getNotificationStatus(location, currentTime)}
                          </span>
                        </div>
                      </div>
                      <p>{location.description}</p>
                      {(location.startDate || location.endDate) && (
                        <p className="notification-datetime">
                          {location.startDate || 'Date not set'}{location.endDate ? ` – ${location.endDate}` : ''}
                          {location.startTime ? ` · ${location.startTime}` : ''}
                          {location.endTime ? ` – ${location.endTime}` : ''}
                        </p>
                      )}
                    </article>
                  )) : (
                    <p className="notification-empty">
                      {notificationStatus === 'upcoming'
                        ? 'No upcoming updates in the next 3 days.'
                        : timeSensitiveLocations.length ? 'No updates match these filters.' : 'No time-sensitive location updates yet.'}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </nav>
      </div>
      <div className="site-nav-account">
        {user ? (
          <>
            <span className="nav-user-name">{user.displayName || user.email}</span>
            <button className="nav-auth-button" onClick={onSignOut} type="button">
              Sign out
            </button>
          </>
        ) : (
          <button className="nav-auth-button" onClick={onLogin} type="button">
            Log in
          </button>
        )}
      </div>
    </header>
  )
}