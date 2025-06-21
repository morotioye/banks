import { useCallback, useState, useEffect, useRef } from 'react'
import { GoogleMap, LoadScript, Marker, Circle } from '@react-google-maps/api'

// Define libraries as a constant to prevent re-renders
const GOOGLE_MAPS_LIBRARIES: ("geometry")[] = ['geometry']

interface DomainSelectorProps {
  lat: number
  lon: number
  radius: number
  onLocationChange: (lat: number, lon: number) => void
  onRadiusChange: (radius: number) => void
  onCirclesChange?: (circles: DrawnCircle[]) => void
}

interface DrawnCircle {
  center: google.maps.LatLngLiteral
  radius: number // in meters
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ]
}

export default function GoogleDomainSelector({ lat, lon, radius, onLocationChange, onRadiusChange, onCirclesChange }: DomainSelectorProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [drawnCircles, setDrawnCircles] = useState<DrawnCircle[]>([])
  const [drawingCenter, setDrawingCenter] = useState<google.maps.LatLngLiteral | null>(null)
  const [isOutOfBounds, setIsOutOfBounds] = useState(false)
  const circleRefs = useRef<google.maps.Circle[]>([])

  // California bounds (approximate)
  const CA_BOUNDS = {
    north: 42.0,
    south: 32.5,
    east: -114.0,
    west: -124.5
  }

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const [isDrawing, setIsDrawing] = useState(false)
  const [previewRadius, setPreviewRadius] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState<google.maps.LatLngLiteral | null>(null)

  const handleMouseDown = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !isDrawingMode) return
    
    // Start drawing
    setIsDrawing(true)
    setDrawingCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    setPreviewRadius(0)
  }, [isDrawingMode])



  const handleMouseMove = useCallback((e: google.maps.MapMouseEvent) => {
    if (isDrawing && drawingCenter && e.latLng && map) {
      // Update cursor position for preview
      setMousePosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      
      // Calculate preview radius
      const radius = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(drawingCenter.lat, drawingCenter.lng),
        e.latLng
      )
      setPreviewRadius(radius)
    } else if (!isDrawingMode) {
      setPreviewRadius(null)
      setMousePosition(null)
    }
  }, [isDrawing, isDrawingMode, drawingCenter, map])

  // Update cursor when drawing mode changes
  useEffect(() => {
    if (map) {
      map.setOptions({ 
        draggableCursor: isDrawingMode ? 'crosshair' : null,
        draggable: !isDrawingMode
      })
    }
  }, [isDrawingMode, map])

  // Add global mouse up listener to handle mouse up outside map
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        // Only create circle if we have valid data and radius is meaningful (> 100 meters)
        if (drawingCenter && previewRadius && previewRadius > 100 && drawnCircles.length < 5) {
          const newCircles = [...drawnCircles, { center: drawingCenter, radius: previewRadius }]
          setDrawnCircles(newCircles)
          onCirclesChange?.(newCircles)
          
          if (drawnCircles.length >= 4) { // This will be the 5th circle
            setIsDrawingMode(false)
          }
        }
        
        // Always reset drawing state on mouse up
        setIsDrawing(false)
        setDrawingCenter(null)
        setPreviewRadius(null)
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDrawing, drawingCenter, previewRadius, drawnCircles, onCirclesChange])

  // Check bounds for all circles
  const checkBounds = useCallback(() => {
    let allInBounds = true
    
    drawnCircles.forEach(circle => {
      const radiusInKm = circle.radius / 1000
      const latOffset = (circle.radius / 111320)
      const lngOffset = circle.radius / (111320 * Math.cos(circle.center.lat * Math.PI / 180))
      
      const north = circle.center.lat + latOffset
      const south = circle.center.lat - latOffset
      const east = circle.center.lng + lngOffset
      const west = circle.center.lng - lngOffset
      
      const isInBounds = 
        north <= CA_BOUNDS.north &&
        south >= CA_BOUNDS.south &&
        east <= CA_BOUNDS.east &&
        west >= CA_BOUNDS.west

      if (!isInBounds) allInBounds = false
    })

    setIsOutOfBounds(!allInBounds)
  }, [drawnCircles])

  useEffect(() => {
    checkBounds()
  }, [checkBounds])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} libraries={GOOGLE_MAPS_LIBRARIES}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={{ lat, lng: lon }}
          zoom={10}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          options={{
            ...mapOptions,
            draggable: !isDrawingMode
          }}
        >
          {/* Drawn circles */}
          {drawnCircles.map((circle, index) => (
            <Circle
              key={index}
              center={circle.center}
              radius={circle.radius}
              options={{
                fillColor: 'hsl(140, 30%, 25%)', // Forest green
                fillOpacity: 0.25,
                strokeColor: 'hsl(140, 30%, 25%)',
                strokeOpacity: 1,
                strokeWeight: 3,
                editable: false,
                draggable: false
              }}
            />
          ))}

          {/* Preview circle while drawing */}
          {isDrawing && drawingCenter && (
            <>
              <Marker
                position={drawingCenter}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: 'hsl(140, 30%, 25%)',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2,
                }}
              />
              {previewRadius && previewRadius > 0 && (
                <Circle
                  center={drawingCenter}
                  radius={previewRadius}
                  options={{
                    fillColor: 'hsl(140, 30%, 25%)',
                    fillOpacity: 0.15,
                    strokeColor: 'hsl(140, 30%, 25%)',
                    strokeOpacity: 0.5,
                    strokeWeight: 2
                  }}
                />
              )}
            </>
          )}
        </GoogleMap>
      </LoadScript>

      {/* Draw Radius Button */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <button
          onClick={() => {
            setIsDrawingMode(!isDrawingMode)
            setIsDrawing(false)
            setDrawingCenter(null)
            setPreviewRadius(null)
          }}
          disabled={drawnCircles.length >= 5}
          style={{
            padding: '14px 28px',
            backgroundColor: isDrawingMode ? 'hsl(140, 35%, 20%)' : 'hsl(140, 30%, 25%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: drawnCircles.length >= 5 ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 4px 12px rgba(45, 90, 45, 0.3)',
            fontFamily: '"Funnel Display", system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: drawnCircles.length >= 5 ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (drawnCircles.length < 5 && !isDrawingMode) {
              e.currentTarget.style.backgroundColor = 'hsl(140, 35%, 20%)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(45, 90, 45, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isDrawingMode) {
              e.currentTarget.style.backgroundColor = 'hsl(140, 30%, 25%)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 45, 0.3)'
            }
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {isDrawingMode ? '✓' : '⊕'}
          </span>
          {isDrawingMode ? 'Confirm' : `${drawnCircles.length > 0 ? 'Add Radius' : 'Draw Radius'} (${drawnCircles.length}/5)`}
        </button>
        
        {drawnCircles.length > 0 && (
          <button
            onClick={() => {
              setDrawnCircles([])
              setIsDrawingMode(false)
              setIsDrawing(false)
              setDrawingCenter(null)
              setPreviewRadius(null)
              onCirclesChange?.([])
            }}
            style={{
              marginTop: '8px',
              padding: '10px 20px',
              backgroundColor: 'white',
              color: 'hsl(140, 30%, 25%)',
              border: '2px solid hsl(140, 30%, 25%)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: '"Funnel Display", system-ui, sans-serif',
              minWidth: '120px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(140, 30%, 25%)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.color = 'hsl(140, 30%, 25%)'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Instructions when in drawing mode - only show if no circles drawn yet */}
      {isDrawingMode && drawnCircles.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '20px 32px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          textAlign: 'center',
          zIndex: 20,
          pointerEvents: 'none'
        }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: 'hsl(140, 35%, 20%)',
            fontFamily: '"Funnel Display", system-ui, sans-serif'
          }}>
            Click and drag to draw a circle
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'hsl(25, 5%, 45%)',
            fontFamily: '"Funnel Display", system-ui, sans-serif'
          }}>
            Hold down the mouse button and drag to set the radius
          </p>
        </div>
      )}

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


    </div>
  )
} 