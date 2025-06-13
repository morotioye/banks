import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface DomainSelectorProps {
  lat: number
  lon: number
  radius: number
  onLocationChange: (lat: number, lon: number) => void
  onRadiusChange: (radius: number) => void
}

export default function DomainSelector({ lat, lon, radius, onLocationChange, onRadiusChange }: DomainSelectorProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const [isOutOfBounds, setIsOutOfBounds] = useState(false)

  // California bounds (approximate)
  const CA_BOUNDS = {
    north: 42.0,
    south: 32.5,
    east: -114.0,
    west: -124.5
  }

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('domain-selector-map').setView([lat, lon], 10)
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current)

      // Add click handler
      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng
        onLocationChange(lat, lng)
      })
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update marker and circle when props change
  useEffect(() => {
    if (!mapRef.current) return

    // Remove existing marker and circle
    if (markerRef.current) {
      markerRef.current.remove()
    }
    if (circleRef.current) {
      circleRef.current.remove()
    }

    // Add new marker
    markerRef.current = L.marker([lat, lon])
      .addTo(mapRef.current)
      .bindPopup(`Center: ${lat.toFixed(4)}, ${lon.toFixed(4)}`)

    // Add circle to show radius
    const radiusInMeters = radius * 1609.34 // Convert miles to meters
    circleRef.current = L.circle([lat, lon], {
      radius: radiusInMeters,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      color: '#3b82f6',
      weight: 2
    }).addTo(mapRef.current)

    // Check if circle is within California bounds
    const bounds = circleRef.current.getBounds()
    const isInBounds = 
      bounds.getNorth() <= CA_BOUNDS.north &&
      bounds.getSouth() >= CA_BOUNDS.south &&
      bounds.getEast() <= CA_BOUNDS.east &&
      bounds.getWest() >= CA_BOUNDS.west

    setIsOutOfBounds(!isInBounds)

    // Only pan to marker if location changed significantly (avoid zoom changes on refresh)
    const currentCenter = mapRef.current.getCenter()
    const distance = currentCenter.distanceTo(L.latLng(lat, lon))
    if (distance > 1000) { // Only move if more than 1km away
      mapRef.current.setView([lat, lon], mapRef.current.getZoom())
    }
  }, [lat, lon, radius])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div id="domain-selector-map" style={{ 
        width: '100%', 
        height: '100%'
      }} />
      
      {isOutOfBounds && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: '"Funnel Display", system-ui, sans-serif',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 1000
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: '500' }}>Area extends outside California</div>
            <div style={{ fontSize: '13px', marginTop: '2px', color: '#b91c1c' }}>
              Some census blocks may not be available in the selected area.
            </div>
          </div>
        </div>
      )}

      {/* Map Instructions Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#7f8c8d',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: '"Funnel Display", system-ui, sans-serif',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000
      }}>
        <span style={{ fontSize: '16px' }}>📍</span>
        Click anywhere on the map to set the center point
      </div>
    </div>
  )
} 