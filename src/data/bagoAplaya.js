import boundary from './bago-aplaya-boundary.json'

// OpenStreetMap relation 16904529, fetched through Nominatim as GeoJSON.
// This outline is for community map display, not a cadastral survey.
export const bagoAplayaBoundary = boundary

const ring = boundary.features[0].geometry.coordinates[0]
export const bagoAplayaRing = ring.map(([lng, lat]) => [lat, lng])

const latitudes = ring.map(([, lat]) => lat)
const longitudes = ring.map(([lng]) => lng)
const south = Math.min(...latitudes)
const north = Math.max(...latitudes)
const west = Math.min(...longitudes)
const east = Math.max(...longitudes)

export const bagoAplayaBounds = [[south, west], [north, east]]
export const bagoAplayaViewBounds = [[south - 0.004, west - 0.004], [north + 0.004, east + 0.004]]

// The outer ring and the barangay ring make an even-odd fill that shades nearby areas.
export const bagoAplayaSurroundings = [
  [[6.8, 125.2], [6.8, 125.9], [7.3, 125.9], [7.3, 125.2]],
  bagoAplayaRing,
]

export function isInBagoAplaya({ lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < south || lat > north || lng < west || lng > east) return false

  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [firstLng, firstLat] = ring[index]
    const [lastLng, lastLat] = ring[previous]
    const cross = (lng - firstLng) * (lastLat - firstLat) - (lat - firstLat) * (lastLng - firstLng)
    if (Math.abs(cross) < 1e-10
      && lng >= Math.min(firstLng, lastLng) && lng <= Math.max(firstLng, lastLng)
      && lat >= Math.min(firstLat, lastLat) && lat <= Math.max(firstLat, lastLat)) return true
    if ((firstLat > lat) !== (lastLat > lat)
      && lng < (lastLng - firstLng) * (lat - firstLat) / (lastLat - firstLat) + firstLng) inside = !inside
  }
  return inside
}
