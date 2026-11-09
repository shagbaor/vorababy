export type LatLng = { lat: number; lng: number }

// Straight-line distance; good enough for fees and "1.2 km away". Road routes
// are drawn in the app with the Google Directions API.
export function distanceKm(a: LatLng, b: LatLng) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10
}

// City traffic: about 20 km/h door to door.
export function travelMinutes(km: number) {
  return Math.max(5, Math.round((km / 20) * 60))
}

// Lagos is UTC+1 all year.
export function lagosNow(now = new Date()) {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  return { weekday: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][lagos.getUTCDay()], minutes: lagos.getUTCHours() * 60 + lagos.getUTCMinutes() }
}

export type OpeningHours = Record<string, { open: string; close: string } | null> | null | undefined

export function isOpenNow(isOpen: boolean | undefined, hours: OpeningHours, now = new Date()) {
  if (isOpen === false) return false
  if (!hours) return true
  const { weekday, minutes } = lagosNow(now)
  const today = hours[weekday]
  if (!today) return false
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const open = toMin(today.open)
  const close = toMin(today.close)
  return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close
}
