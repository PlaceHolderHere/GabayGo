export const scheduledCategories = ['Marketplace', 'Outage', 'Service', 'Garden', 'Event', 'Schedule', 'Evacuation', 'Relief']
export const allCategories = ['Location', 'Service', 'Marketplace', 'Garden', 'Event', 'Schedule', 'Report', 'Outage', 'Hazard', 'Evacuation', 'Relief']
export const calendarCategories = ['Marketplace', 'Service', 'Garden', 'Event', 'Schedule', 'Report', 'Outage', 'Evacuation', 'Relief']
export const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const reportStatuses = ['Submitted', 'Under review', 'Resolved']

export function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export function timestampDateKey(timestamp) {
  if (!timestamp) return null
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : dateKey(date)
}

export function timestampMillis(timestamp) {
  if (!timestamp) return null
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : null
}

export function getReportStatus(location) {
  return location.status || (location.resolvedAt ? 'Resolved' : location.underReviewAt ? 'Under review' : 'Submitted')
}

export function makeEvent(location, kind, date, extra = {}) {
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

export function getLocationEvents(locations, schedules = []) {
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

  schedules.forEach((schedule) => {
    const startDate = schedule.startDate || schedule.endDate
    const endDate = schedule.endDate || schedule.startDate
    if (parseDateKey(startDate) && parseDateKey(endDate)) {
      events.push(makeEvent(schedule, 'scheduled', startDate, {
        id: `schedule-${schedule.id}-scheduled`,
        startDate,
        endDate,
        startTime: schedule.startTime || '',
        endTime: schedule.endTime || '',
        createdAt: schedule.createdAt,
      }))
    }
  })

  return events
}

export function getEventTimestamp(event) {
  if (event.activityAt !== null && event.activityAt !== undefined) return event.activityAt
  const time = event.startTime || '00:00'
  const timestamp = Date.parse(`${event.startDate}T${time}`)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function getEventPeriod(event, now) {
  const start = Date.parse(`${event.startDate}T${event.startTime || '00:00'}`)
  const end = Date.parse(`${event.endDate || event.startDate}T${event.endTime || '23:59'}`)
  if (Number.isFinite(end) && end < now) return 'past'
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end >= now)) return 'ongoing'
  return 'upcoming'
}

export function getWeekSegments(events, weekDates, now) {
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

export function describeEvent(event) {
  if (event.kind === 'submitted') return `Submitted: ${event.title}`
  if (event.kind === 'under-review') return `Under review: ${event.title}`
  if (event.kind === 'resolved') return `Resolved: ${event.title}`
  return event.title
}

export function reportHistory(location) {
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
