// Categories
export const categories = [
  'Location',
  'Service',
  'Marketplace',
  'Garden',
  'Event',
  'Schedule',
  'Report',
  'Outage',
  'Hazard',
  'Evacuation',
  'Relief',
]

export const urgentCategories = ['Hazard', 'Outage', 'Evacuation', 'Relief']

export const timeSensitiveCategories = [
  'Marketplace',
  'Outage',
  'Service',
  'Garden',
  'Event',
  'Schedule',
  'Evacuation',
  'Relief',
]
export const scheduledCategories = timeSensitiveCategories

export const timeStampedCategories = ['Report']

export const calendarCategories = [
  'Marketplace',
  'Service',
  'Garden',
  'Event',
  'Schedule',
  'Report',
  'Outage',
  'Evacuation',
  'Relief',
]

export const listingCategories = [
  'Food',
  'Produce',
  'Retail',
  'Crafts',
  'Services',
  'Other',
]

// Statuses and labels
export const reportStatuses = ['Submitted', 'Under review', 'Resolved']

export const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Map & Hazard defaults
export const defaultHazardRadius = 500
