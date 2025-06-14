import { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleMap, LoadScript, Polygon, Marker, Circle, InfoWindow } from '@react-google-maps/api'

// Define libraries as a constant to prevent re-renders
const GOOGLE_MAPS_LIBRARIES: ("geometry")[] = ['geometry']

interface OptimizationLocation {
  geoid: string;
  lat: number;
  lon: number;
  expected_impact: number;
  coverage_radius: number;
  efficiency_score: number;
  setup_cost: number;
  operational_cost_monthly: number;
}

interface MapProps {
  blocks: any[]
  visualizationMode: string
  foodBanks?: OptimizationLocation[]
}

// Visualization mode configurations (same as in index.tsx)
const VISUALIZATION_MODES = {
  food_insecurity_score: {
    label: 'Food Insecurity Score',
    property: 'food_insecurity_score',
    ranges: [
      { min: 0, max: 3, color: '#34D399' },
      { min: 3, max: 6, color: '#FBBF24' },
      { min: 6, max: 10, color: '#F87171' }
    ],
    format: (value: number) => `${value.toFixed(1)}/10`
  },
  poverty_rate: {
    label: 'Poverty Rate',
    property: 'poverty_rate',
    ranges: [
      { min: 0, max: 0.15, color: '#34D399' },
      { min: 0.15, max: 0.30, color: '#FBBF24' },
      { min: 0.30, max: 1, color: '#F87171' }
    ],
    format: (value: number) => `${(value * 100).toFixed(1)}%`
  },
  snap_rate: {
    label: 'SNAP Rate',
    property: 'snap_rate',
    ranges: [
      { min: 0, max: 0.10, color: '#34D399' },
      { min: 0.10, max: 0.25, color: '#FBBF24' },
      { min: 0.25, max: 1, color: '#F87171' }
    ],
    format: (value: number) => `${(value * 100).toFixed(1)}%`
  },
  vehicle_access_rate: {
    label: 'Vehicle Access Rate',
    property: 'vehicle_access_rate',
    ranges: [
      { min: 0, max: 0.7, color: '#F87171' },
      { min: 0.7, max: 0.9, color: '#FBBF24' },
      { min: 0.9, max: 1, color: '#34D399' }
    ],
    format: (value: number) => `${(value * 100).toFixed(1)}%`
  },
  population: {
    label: 'Population',
    property: 'pop',
    ranges: [
      { min: 0, max: 1000, color: '#34D399' },
      { min: 1000, max: 3000, color: '#FBBF24' },
      { min: 3000, max: 50000, color: '#F87171' }
    ],
    format: (value: number) => value.toLocaleString()
  }
}

function getColorForVisualization(properties: any, visualizationMode: string): string {
  const config = (VISUALIZATION_MODES as any)[visualizationMode]
  if (!config) return '#60A5FA' // Default blue for no data
  
  const value = properties?.[config.property] || 0
  
  // If no value, return default color
  if (value === 0 || value === null || value === undefined) {
    return '#60A5FA' // Blue for no data
  }
  
  // Find the appropriate range for this value
  for (const range of config.ranges) {
    if (value >= range.min && value < range.max) {
      return range.color
    }
  }
  
  // If value is higher than all ranges, use the highest range color
  return config.ranges[config.ranges.length - 1].color
}

// Convert GeoJSON coordinates to Google Maps paths
function geoJsonToPath(geometry: any): google.maps.LatLngLiteral[] {
  if (!geometry || !geometry.coordinates) return []
  
  const coords = geometry.coordinates[0] // Assuming Polygon
  return coords.map((coord: number[]) => ({
    lat: coord[1],
    lng: coord[0]
  }))
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 34.0522,
  lng: -118.2437
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

export default function GoogleMapComponent({ blocks, visualizationMode, foodBanks }: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<any>(null)
  const [selectedFoodBank, setSelectedFoodBank] = useState<OptimizationLocation | null>(null)
  const [selectedFoodBankIndex, setSelectedFoodBankIndex] = useState<number | null>(null)
  const hasInitializedBounds = useRef<boolean>(false)

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  // Fit bounds when blocks change
  useEffect(() => {
    if (!map || blocks.length === 0) {
      if (blocks.length === 0) {
        hasInitializedBounds.current = false
      }
      return
    }

    if (!hasInitializedBounds.current) {
      const bounds = new google.maps.LatLngBounds()
      
      blocks.forEach(block => {
        if (block.geometry && block.geometry.coordinates) {
          const coords = block.geometry.coordinates[0]
          coords.forEach((coord: number[]) => {
            bounds.extend({ lat: coord[1], lng: coord[0] })
          })
        }
      })

      map.fitBounds(bounds)
      hasInitializedBounds.current = true
    }
  }, [map, blocks])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num))
  }

  // Calculate marker scale
  const getMarkerScale = (impact: number, minImpact: number, maxImpact: number) => {
    const impactRange = maxImpact - minImpact || 1
    const scale = (impact - minImpact) / impactRange
    return 20 + (scale * 30) // Scale from 20 to 50 pixels
  }

  const impacts = foodBanks?.map(fb => fb.expected_impact) || []
  const minImpact = impacts.length > 0 ? Math.min(...impacts) : 0
  const maxImpact = impacts.length > 0 ? Math.max(...impacts) : 1

  return (
    <LoadScript 
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      libraries={GOOGLE_MAPS_LIBRARIES}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={11}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Render census blocks */}
        {blocks.map((block, index) => {
          if (!block.geometry) return null

          const path = geoJsonToPath(block.geometry)
          if (path.length === 0) return null

          const color = getColorForVisualization(block.properties, visualizationMode)
          
          return (
            <Polygon
              key={`block-${index}`}
              paths={path}
              options={{
                fillColor: color,
                fillOpacity: 0.85, // Much more opaque for better visibility
                strokeColor: '#4B5563',
                strokeOpacity: 0.9,
                strokeWeight: 0.5
              }}
              onClick={() => setSelectedBlock(block)}
            />
          )
        })}

        {/* Render food bank coverage circles */}
        {foodBanks?.map((foodBank, index) => (
          <Circle
            key={`circle-${index}`}
            center={{ lat: foodBank.lat, lng: foodBank.lon }}
            radius={foodBank.coverage_radius * 1000} // Convert km to meters
            options={{
              fillColor: '#2D5A2D', // Forest green
              fillOpacity: 0.15,
              strokeColor: '#2D5A2D',
              strokeOpacity: 0.4,
              strokeWeight: 2,
              draggable: false,
              editable: false, // Make circles non-editable
            }}
          />
        ))}

        {/* Render food bank markers */}
        {foodBanks?.map((foodBank, index) => {
          const scale = getMarkerScale(foodBank.expected_impact, minImpact, maxImpact)
          
          // Sort food banks by impact to get ranking
          const sortedFoodBanks = [...foodBanks].sort((a, b) => b.expected_impact - a.expected_impact)
          const ranking = sortedFoodBanks.findIndex(fb => fb.geoid === foodBank.geoid) + 1
          
          return (
            <Marker
              key={`marker-${index}`}
              position={{ lat: foodBank.lat, lng: foodBank.lon }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: scale / 2.5, // Adjust scale for circle
                fillColor: '#2D5A2D', // Forest green
                fillOpacity: 0.9,
                strokeColor: '#FFFFFF',
                strokeWeight: 3,
                anchor: new google.maps.Point(0, 0),
                labelOrigin: new google.maps.Point(0, 0)
              }}
              label={{
                text: ranking.toString(),
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 'bold',
                fontFamily: 'Funnel Display, sans-serif'
              }}
              onClick={() => {
                setSelectedFoodBank(foodBank)
                setSelectedFoodBankIndex(index)
              }}
            />
          )
        })}

        {/* Info window for selected block */}
        {selectedBlock && (
          <InfoWindow
            position={{
              lat: selectedBlock.geometry.coordinates[0][0][1],
              lng: selectedBlock.geometry.coordinates[0][0][0]
            }}
            onCloseClick={() => setSelectedBlock(null)}
          >
            <div className="font-funnel" style={{ minWidth: '280px' }}>
              <div style={{ 
                backgroundColor: '#2D5A2D', 
                color: 'white', 
                padding: '12px 16px', 
                margin: '-14px -14px 12px -14px',
                borderRadius: '8px 8px 0 0'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                  Census Block
                </h3>
                <p style={{ fontSize: '12px', margin: '4px 0 0 0', opacity: 0.9 }}>
                  {selectedBlock.properties?.geoid || 'Unknown'}
                </p>
              </div>
              
              <div style={{ padding: '0 2px 12px 2px' }}>
                <div style={{ 
                  backgroundColor: '#F5F5F4', 
                  padding: '12px', 
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '12px', color: '#57534E', marginBottom: '4px' }}>
                    {(VISUALIZATION_MODES as any)[visualizationMode]?.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#292524' }}>
                    {(VISUALIZATION_MODES as any)[visualizationMode]?.format(
                      selectedBlock.properties?.[(VISUALIZATION_MODES as any)[visualizationMode]?.property] || 0
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ 
                    backgroundColor: '#FAFAF9', 
                    padding: '10px', 
                    borderRadius: '6px',
                    border: '1px solid #E7E5E4'
                  }}>
                    <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '2px' }}>Population</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#292524' }}>
                      {(selectedBlock.properties?.pop || 0).toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#FAFAF9', 
                    padding: '10px', 
                    borderRadius: '6px',
                    border: '1px solid #E7E5E4'
                  }}>
                    <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '2px' }}>Poverty Rate</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#292524' }}>
                      {((selectedBlock.properties?.poverty_rate || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#FAFAF9', 
                    padding: '10px', 
                    borderRadius: '6px',
                    border: '1px solid #E7E5E4'
                  }}>
                    <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '2px' }}>SNAP Rate</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#292524' }}>
                      {((selectedBlock.properties?.snap_rate || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  {selectedBlock.properties?.vehicle_access_rate !== null && (
                    <div style={{ 
                      backgroundColor: '#FAFAF9', 
                      padding: '10px', 
                      borderRadius: '6px',
                      border: '1px solid #E7E5E4'
                    }}>
                      <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '2px' }}>Vehicle Access</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#292524' }}>
                        {(selectedBlock.properties.vehicle_access_rate * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Info window for selected food bank */}
        {selectedFoodBank && selectedFoodBankIndex !== null && (
          <InfoWindow
            position={{ lat: selectedFoodBank.lat, lng: selectedFoodBank.lon }}
            onCloseClick={() => {
              setSelectedFoodBank(null)
              setSelectedFoodBankIndex(null)
            }}
          >
            <div className="font-funnel" style={{ minWidth: '320px' }}>
              {/* Header */}
              <div style={{ 
                background: 'linear-gradient(135deg, #2D5A2D 0%, #1F3F1F 100%)', 
                color: 'white', 
                padding: '16px 20px', 
                margin: '-14px -14px 16px -14px',
                borderRadius: '8px 8px 0 0',
                position: 'relative'
              }}>
                {/* Ranking badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  #{(() => {
                    const sortedFoodBanks = [...(foodBanks || [])].sort((a, b) => b.expected_impact - a.expected_impact)
                    return sortedFoodBanks.findIndex(fb => fb.geoid === selectedFoodBank.geoid) + 1
                  })()}
                </div>
                
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                  Food Bank Location
                </h3>
                <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.9 }}>
                  Optimized for maximum impact
                </p>
              </div>
              
              <div style={{ padding: '0 6px 16px 6px' }}>
                {/* Impact highlight */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                  border: '2px solid #86EFAC',
                  padding: '16px', 
                  borderRadius: '10px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '13px', color: '#166534', marginBottom: '4px', fontWeight: '500' }}>
                    Expected Monthly Impact
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#166534' }}>
                    {formatNumber(selectedFoodBank.expected_impact)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#166534', marginTop: '2px' }}>
                    people served
                  </div>
                </div>
                
                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ 
                    backgroundColor: '#FAFAF9', 
                    padding: '12px', 
                    borderRadius: '8px',
                    border: '1px solid #E7E5E4'
                  }}>
                    <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '4px' }}>Coverage Radius</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#292524' }}>
                      {selectedFoodBank.coverage_radius.toFixed(1)} km
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#FAFAF9', 
                    padding: '12px', 
                    borderRadius: '8px',
                    border: '1px solid #E7E5E4'
                  }}>
                    <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '4px' }}>Efficiency Score</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#292524' }}>
                      {(selectedFoodBank.efficiency_score * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {/* Cost breakdown */}
                <div style={{ 
                  backgroundColor: '#F5F5F4', 
                  padding: '14px', 
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#57534E', marginBottom: '10px' }}>
                    Investment Required
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#78716C' }}>Setup Cost</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#292524' }}>
                      {formatCurrency(selectedFoodBank.setup_cost)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#78716C' }}>Monthly Operations</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#292524' }}>
                      {formatCurrency(selectedFoodBank.operational_cost_monthly)}
                    </span>
                  </div>
                </div>
                
                {/* Location coordinates */}
                <div style={{ 
                  textAlign: 'center',
                  fontSize: '11px', 
                  color: '#A8A29E',
                  paddingTop: '8px',
                  borderTop: '1px solid #E7E5E4'
                }}>
                  📍 {selectedFoodBank.lat.toFixed(4)}, {selectedFoodBank.lon.toFixed(4)}
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Food Bank Legend */}
      {foodBanks && foodBanks.length > 0 && (
        <div className="absolute bottom-6 left-6 bg-white rounded-xl p-4 shadow-lg border border-stone-200 z-50 font-funnel">
          <h4 className="text-sm font-semibold text-stone-700 mb-3">
            Food Bank Locations
          </h4>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div style={{
                width: '36px',
                height: '36px',
                backgroundColor: '#2D5A2D',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '3px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                1
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-700">Highest Impact</div>
                <div className="text-xs text-stone-500">Most people served</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div style={{
                width: '28px',
                height: '28px',
                backgroundColor: '#2D5A2D',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '3px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                n
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-700">Lower Impact</div>
                <div className="text-xs text-stone-500">Fewer people served</div>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-stone-200 text-xs text-stone-500">
              Circle size indicates relative impact
            </div>
          </div>
        </div>
      )}
    </LoadScript>
  )
} 