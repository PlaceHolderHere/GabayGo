import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import CategoryDropdown from '../Components/CategoryDropdown'
import EventDetailsModal from '../Components/EventDetailsModal'
import {
  allCategories,
  reportStatuses,
  dateKey,
  getLocationEvents,
  getEventTimestamp,
  getEventPeriod,
  getReportStatus,
} from '../utils/eventUtils'
import './Updates.css'

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
                categories={allCategories}
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
                  <div className="updates-feed-item-top">
                    <span className="updates-feed-type">{event.activity || event.category}</span>
                    {event.category === 'Report' && (
                      <span className={`updates-report-status updates-report-status--${getReportStatus(event.location).toLowerCase().replace(' ', '-')}`}>
                        {getReportStatus(event.location)}
                      </span>
                    )}
                  </div>
                  <h3 className="updates-feed-title">{event.title}</h3>
                  <p className="updates-feed-description">{event.description || 'Click to view location and details.'}</p>
                  <div className="updates-feed-meta">
                    <span className="updates-feed-date">
                      {event.startDate}{event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}
                      {event.startTime ? ` · ${event.startTime}` : ''}
                    </span>
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