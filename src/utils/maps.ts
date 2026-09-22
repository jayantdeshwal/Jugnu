export function buildGoogleMapsDirectionsUrl(address: string | null | undefined): string | null {
  const destination = address?.trim()
  if (!destination) return null

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
