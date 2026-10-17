import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import CategoryDropdown from '../Components/CategoryDropdown'
import EventDetailsModal from '../Components/EventDetailsModal'
import {
  calendarCategories,
  weekDays,
  dateKey,
  getLocationEvents,
  getWeekSegments,
  describeEvent,
} from '../utils/eventUtils'
import './Calendar.css'

export default function Calendar({
  user,
  locations,
  locationsStatus,
  locationsError,
  schedules = [],
  schedulesStatus,
  schedulesError,
}) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilters, setCategoryFilters] = useState([])

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const gridStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - monthStart.getDay())
  const dates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return {
      date,
      key: dateKey(date),
      isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
    }
  })

  const allEvents = getLocationEvents(locations, schedules)
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()

  const filteredEvents = allEvents.filter((event) => {
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(event.category)
    const matchesSearch = !normalizedSearch ||
      `${event.title} ${event.category} ${event.description}`.toLocaleLowerCase().includes(normalizedSearch)
    return matchesCategory && matchesSearch
  })

  const weeks = Array.from({ length: 6 }, (_, weekIndex) => dates.slice(weekIndex * 7, weekIndex * 7 + 7))
  const selectedEvent = allEvents.find((event) => event.id === selectedEventId)
  const now = new Date(currentTime)
  const todayKey = dateKey(now)

  const changeMonth = (amount) => {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1))
    setSelectedEventId(null)
  }

  const showToday = () => {
    const today = new Date()
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(dateKey(today))
    setSelectedEventId(null)
  }

  const selectEvent = (event) => {
    setSelectedDate(event.startDate)
    setSelectedEventId(event.id)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilters([])
  }

  return (
    <main className="calendar-page">
      <div className="calendar-container">
        <header className="calendar-page-header">
          <div className="calendar-header-titles">
            <h1>Calendar</h1>
            <p className="calendar-subtitle">Browse scheduled events, outages, collections, and activities by date.</p>
          </div>
        </header>

        <section className="calendar-controls-panel" aria-label="Calendar controls and filters">
          <div className="calendar-month-nav-bar">
            <div className="calendar-navigation" aria-label="Month navigation">
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <h2 className="calendar-month-heading" aria-live="polite">
                {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button className="calendar-today-button" type="button" onClick={showToday}>
                Today
              </button>
            </div>

            <div className="calendar-filter-toolbar">
              <div className="calendar-search-wrap">
                <input
                  type="search"
                  className="calendar-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter events…"
                />
              </div>
              <div className="calendar-category-wrap">
                <CategoryDropdown
                  id="calendar-category-filter"
                  categories={calendarCategories}
                  selectedCategories={categoryFilters}
                  onChange={setCategoryFilters}
                  placeholder="All categories"
                />
              </div>
              <button
                type="button"
                className="calendar-clear-filters-btn"
                onClick={clearFilters}
                title="Clear filters"
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="calendar-legend" aria-label="Event categories">
            <span className="calendar-legend-label">Categories:</span>
            {calendarCategories.map((category) => (
              <span className={`calendar-legend-item calendar-legend-item--${category.toLowerCase()}`} key={category}>
                <i aria-hidden="true" />{category}
              </span>
            ))}
          </div>
        </section>

        {(locationsStatus === 'loading' || schedulesStatus === 'loading') && (
          <p className="calendar-status-msg">Loading calendar events…</p>
        )}
        {locationsStatus === 'error' && (
          <p className="calendar-status-msg calendar-status-msg--error">{locationsError}</p>
        )}
        {schedulesStatus === 'error' && (
          <p className="calendar-status-msg calendar-status-msg--error">{schedulesError}</p>
        )}

        <div className="calendar-grid-wrapper">
          <div className="calendar-weekdays" role="row">
            {weekDays.map((day) => (
              <div className="calendar-weekday" role="columnheader" key={day}>
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-weeks" role="grid" aria-label="Monthly location events">
            {weeks.map((week) => {
              const segments = getWeekSegments(filteredEvents, week, currentTime)
              const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1))
              return (
                <div className="calendar-week" key={week[0].key} style={{ '--event-lanes': laneCount }}>
                  <div className="calendar-week-days">
                    {week.map(({ date, key, isCurrentMonth }) => {
                      const isToday = key === todayKey
                      const isSelected = selectedDate === key
                      return (
                        <button
                          className={`calendar-day${isCurrentMonth ? '' : ' calendar-day--outside'}${isToday ? ' calendar-day--today' : ''}${isSelected ? ' calendar-day--selected' : ''}`}
                          type="button"
                          role="gridcell"
                          aria-label={`${date.toLocaleDateString()}`}
                          aria-pressed={isSelected}
                          key={key}
                          onClick={() => {
                            setSelectedDate(key)
                            setSelectedEventId(null)
                          }}
                        >
                          <span className="calendar-day-number">{date.getDate()}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="calendar-week-event-layer">
                    {segments.map(({ event, startIndex, endIndex, lane, continuesBefore, continuesAfter }) => (
                      <button
                        className={`calendar-event calendar-event--${event.category.toLowerCase()} calendar-event--${event.kind}${continuesBefore ? ' calendar-event--continues-before' : ''}${continuesAfter ? ' calendar-event--continues-after' : ''}`}
                        key={`${event.id}-${week[0].key}`}
                        style={{
                          left: `calc(${startIndex * 100 / 7}% + 3px)`,
                          width: `calc(${(endIndex - startIndex + 1) * 100 / 7}% - 6px)`,
                          '--event-lane': lane,
                        }}
                        type="button"
                        title={`${describeEvent(event)} · ${event.startDate}${event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}`}
                        onClick={() => selectEvent(event)}
                      >
                        {continuesBefore ? '‹ ' : ''}
                        {event.kind === 'scheduled' ? event.title : describeEvent(event)}
                        {continuesAfter ? ' ›' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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
