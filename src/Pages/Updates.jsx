import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import CategoryDropdown from '../Components/CategoryDropdown'
import EventDetailsModal from '../Components/EventDetailsModal'
import {
  categories,
  reportStatuses,
  dateKey,
  getLocationEvents,
  getEventTimestamp,
  getEventPeriod,
  getReportStatus,
} from '../utils/eventUtils'
import './Updates.css'

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
  Location: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Service: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Marketplace: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2 3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z" />
      <line x1="3" y1="7" x2="21" y2="7" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  Garden: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22V8" />
      <path d="M5 12c0-4 3-7 7-7s7 3 7 7" />
      <path d="M7 20c0-3 2.2-5 5-5s5 2 5 5" />
    </svg>
  ),
  Event: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Schedule: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Report: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
}

function getCategoryIcon(category) {
  return categoryIcons[category] || categoryIcons.Location
}


const activityTabs = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'this-week', label: 'This week' },
  { id: 'last-week', label: 'Last week' },
]

export default function Updates({
  user,
  locations,
  locationsStatus,
  locationsError,
  schedules = [],
  schedulesStatus,
  schedulesError,
}) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [activeTab, setActiveTab] = useState('all')
  const [selectedEventId, setSelectedEventId] = useState(null)
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

  const allEvents = getLocationEvents(locations, schedules)
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()

  const now = new Date(currentTime)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayKey = dateKey(today)

  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const tomorrowKey = dateKey(tomorrow)

  const dayOfWeek = today.getDay()
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek)
  const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - dayOfWeek))
  const startOfWeekKey = dateKey(startOfWeek)
  const endOfWeekKey = dateKey(endOfWeek)

  const startOfLastWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() - 7)
  const endOfLastWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() - 1)
  const startOfLastWeekKey = dateKey(startOfLastWeek)
  const endOfLastWeekKey = dateKey(endOfLastWeek)

  const matchesTab = (event) => {
    if (activeTab === 'all') return true
    if (activeTab === 'today') {
      return event.startDate <= todayKey && event.endDate >= todayKey
    }
    if (activeTab === 'tomorrow') {
      return event.startDate <= tomorrowKey && event.endDate >= tomorrowKey
    }
    if (activeTab === 'this-week') {
      return event.startDate <= endOfWeekKey && event.endDate >= startOfWeekKey
    }
    if (activeTab === 'last-week') {
      return event.startDate <= endOfLastWeekKey && event.endDate >= startOfLastWeekKey
    }
    return true
  }

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

    return matchesTab(event)
      && matchesCategory && matchesSearch && matchesReportStatus && matchesPeriod
      && matchesFrom && matchesTo && matchesTimeFrom && matchesTimeTo
  })

  const dailyUpdates = [...filteredEvents].sort((first, second) => getEventTimestamp(second) - getEventTimestamp(first))
  const dailyUpdatesToShow = showAllUpdates ? dailyUpdates : dailyUpdates.slice(0, 6)
  const selectedEvent = allEvents.find((event) => event.id === selectedEventId)

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

  const hasActiveFilters = Boolean(
    searchQuery ||
    categoryFilters.length > 0 ||
    reportStatusFilter !== 'All' ||
    periodFilter !== 'all' ||
    dateFrom ||
    dateTo ||
    timeFrom ||
    timeTo
  )

  return (
    <main className="updates-page">
      <div className="updates-container">
        <header className="updates-page-header">
          <div className="updates-header-titles">
            <h1>Updates</h1>
            <p>Local announcements, community reports, and service alerts.</p>
          </div>
        </header>

        <nav className="updates-tabs" role="tablist" aria-label="Activity timeframes">
          {activityTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                className={`updates-tab${isActive ? ' updates-tab--active' : ''}`}
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <section className="updates-filters-panel" aria-label="Updates filters">
          <div className="updates-filters">
            <label className="updates-search-label">
              Search updates
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
            <div className="updates-filter-field updates-category-dropdown-field">
              <span className="updates-filter-field-label" id="updates-categories-label">Categories</span>
              <CategoryDropdown
                id="updates-categories-dropdown"
                ariaLabelledBy="updates-categories-label"
                categories={categories}
                selectedCategories={categoryFilters}
                onChange={setCategoryFilters}
                placeholder="All categories"
              />
            </div>
            {hasActiveFilters && (
              <button className="updates-clear-filters" type="button" onClick={clearFilters}>
                <RotateCcw size={14} aria-hidden="true" />
                <span>Clear filters</span>
              </button>
            )}
          </div>
        </section>

        {(locationsStatus === 'loading' || schedulesStatus === 'loading') && (
          <p className="updates-empty">Loading updates…</p>
        )}
        {locationsStatus === 'error' && (
          <p className="updates-empty updates-empty--error">{locationsError}</p>
        )}
        {schedulesStatus === 'error' && (
          <p className="updates-empty updates-empty--error">{schedulesError}</p>
        )}
        {locationsStatus === 'ready' && schedulesStatus !== 'loading' && dailyUpdates.length === 0 && (
          <div className="updates-empty-state">
            <p>No updates match your filters.</p>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="updates-reset-btn">
                Reset filters
              </button>
            )}
          </div>
        )}

        {locationsStatus === 'ready' && schedulesStatus !== 'loading' && dailyUpdates.length > 0 && (
          <div className="updates-feed-wrapper">
            <div className="updates-feed">
              {dailyUpdatesToShow.map((event) => (
                <button
                  className={`updates-feed-item updates-feed-item--${event.category.toLowerCase()} updates-feed-item--${event.kind}`}
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                >
                  {/* Icon on the left */}
                  <span className={`updates-feed-icon updates-feed-icon--${event.category.toLowerCase()}`}>
                    {getCategoryIcon(event.category)}
                  </span>

                  {/* Content in the center */}
                  <div className="updates-feed-content">
                    <div className="updates-feed-title-row">
                      <h3 className="updates-feed-title">{event.title}</h3>
                      <span className={`updates-feed-type-badge updates-feed-type-badge--${event.category.toLowerCase()}`}>
                        {event.activity || event.category}
                      </span>
                      {event.category === 'Report' && (
                        <span className={`updates-report-status updates-report-status--${getReportStatus(event.location).toLowerCase().replace(' ', '-')}`}>
                          {getReportStatus(event.location)}
                        </span>
                      )}
                    </div>
                    <span className="updates-feed-date">
                      {event.startDate}{event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}
                      {event.startTime ? ` · ${event.startTime}` : ''}
                    </span>
                    {event.description && (
                      <p className="updates-feed-description">{event.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {dailyUpdates.length > 12 && (
              <div className="updates-pagination">
                <button
                  className="updates-show-more"
                  type="button"
                  onClick={() => setShowAllUpdates((show) => !show)}
                >
                  {showAllUpdates ? 'Show fewer updates' : `Show all ${dailyUpdates.length} updates`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetailsModal
          selectedEvent={selectedEvent}
          user={user}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </main>
  )
}