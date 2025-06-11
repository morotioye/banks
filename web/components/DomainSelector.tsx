import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

    // Pan to marker
    mapRef.current.setView([lat, lon], mapRef.current.getZoom())
  }, [lat, lon, radius])

  return (
    <div>
      <div id="domain-selector-map" style={{ 
        width: '100%', 
        height: '400px', 
        borderRadius: '12px', 
        marginBottom: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }} />
      
      {isOutOfBounds && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
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

      <div style={{ 
        backgroundColor: '#f9fafb', 
        padding: '16px', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>📍</span>
          Click anywhere on the map to set the center point
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Domain Radius
            </label>
            <div style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {radius} miles
            </div>
          </div>
          
          <div style={{ position: 'relative', height: '40px', display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={radius}
              onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
              style={{ 
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(radius - 0.5) / 9.5 * 100}%, #e5e7eb ${(radius - 0.5) / 9.5 * 100}%, #e5e7eb 100%)`,
                outline: 'none',
                WebkitAppearance: 'none',
                cursor: 'pointer'
              }}
            />

          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '8px',
            fontSize: '12px',
            color: '#9ca3af'
          }}>
            <span>0.5 mi</span>
            <span>5 mi</span>
            <span>10 mi</span>
          </div>
        </div>
      </div>
    </div>
  )
} 