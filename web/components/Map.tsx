import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

export default function Map({ blocks, visualizationMode, foodBanks }: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const foodBankLayerGroupRef = useRef<L.LayerGroup | null>(null)
  const hasInitializedBounds = useRef<boolean>(false)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([34.0522, -118.2437], 11)
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current)

      layerGroupRef.current = L.layerGroup().addTo(mapRef.current)
      foodBankLayerGroupRef.current = L.layerGroup().addTo(mapRef.current)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update map with blocks
  useEffect(() => {
    if (!layerGroupRef.current || !mapRef.current) return

    // Clear existing layers
    layerGroupRef.current.clearLayers()

    if (blocks.length === 0) {
      // Reset bounds when no blocks (domain cleared)
      hasInitializedBounds.current = false
      return
    }

    // Add blocks to map
    blocks.forEach(block => {
      if (!block.geometry) return

      // Handle different property names from Atlas
      const geoid = block.properties?.geoid || block.properties?.GEOID || 'Unknown'
      const population = block.properties?.pop || block.properties?.population || 0
      const povertyRate = block.properties?.poverty_rate || 0
      const snapRate = block.properties?.snap_rate || 0
      const vehicleAccess = block.properties?.vehicle_access_rate || null
      const score = block.properties?.food_insecurity_score || 0
      
      // Get color based on selected visualization mode
      const color = getColorForVisualization(block.properties, visualizationMode)

      try {
        const geoJsonLayer = L.geoJSON(block, {
          style: {
            fillColor: color,
            fillOpacity: 0.6,
            color: '#4B5563',
            weight: 0.5
          }
        })

        // Create dynamic popup content
        const currentConfig = (VISUALIZATION_MODES as any)[visualizationMode]
        const currentValue = block.properties?.[currentConfig?.property] || 0
        const formattedValue = currentConfig?.format ? currentConfig.format(currentValue) : currentValue
        
        geoJsonLayer.bindPopup(`
          <div style="font-size: 14px;">
            <strong>Block ${geoid}</strong><br/>
            <div style="margin: 8px 0; padding: 8px; background-color: #f3f4f6; border-radius: 4px;">
              <strong>${currentConfig?.label}: ${formattedValue}</strong>
            </div>
            Population: ${population.toLocaleString()}<br/>
            Poverty Rate: ${(povertyRate * 100).toFixed(1)}%<br/>
            SNAP Rate: ${(snapRate * 100).toFixed(1)}%<br/>
            ${vehicleAccess !== null ? `Vehicle Access: ${(vehicleAccess * 100).toFixed(1)}%<br/>` : ''}
            ${score > 0 ? `Food Insecurity Score: ${score.toFixed(1)}/10` : 'Score not calculated'}
          </div>
        `)

        geoJsonLayer.addTo(layerGroupRef.current!)
      } catch (e) {
        console.error('Error adding block to map:', e)
      }
    })

    // Fit map to bounds only on first load (not on refreshes)
    if (blocks.length > 0 && !hasInitializedBounds.current) {
      const group = L.featureGroup(layerGroupRef.current!.getLayers())
      if (group.getLayers().length > 0) {
        mapRef.current.fitBounds(group.getBounds().pad(0.1))
        hasInitializedBounds.current = true
      }
    }
  }, [blocks, visualizationMode])

  // Update food bank markers
  useEffect(() => {
    if (!foodBankLayerGroupRef.current || !mapRef.current) return

    // Clear existing food bank markers
    foodBankLayerGroupRef.current.clearLayers()

    if (!foodBanks || foodBanks.length === 0) return

    // Calculate min and max impact for scaling
    const impacts = foodBanks.map(fb => fb.expected_impact)
    const minImpact = Math.min(...impacts)
    const maxImpact = Math.max(...impacts)
    const impactRange = maxImpact - minImpact || 1

    foodBanks.forEach((foodBank, index) => {
      // Scale marker size based on expected impact (20-50 pixels)
      const scale = (foodBank.expected_impact - minImpact) / impactRange
      const markerSize = 20 + (scale * 30)
      
      // Create custom icon with scaling
      const customIcon = L.divIcon({
        className: 'custom-food-bank-marker',
        html: `
          <div style="
            width: ${markerSize}px;
            height: ${markerSize}px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: ${markerSize * 0.4}px;
            position: relative;
            animation: pulse 2s infinite;
          ">
            ${index + 1}
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
        popupAnchor: [0, -markerSize / 2]
      })

      // Create marker
      const marker = L.marker([foodBank.lat, foodBank.lon], { icon: customIcon })

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

      // Create popup content
      marker.bindPopup(`
        <div style="font-size: 14px; min-width: 250px;">
          <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 18px; font-weight: bold;">
            Food Bank ${index + 1}
          </h3>
          <div style="background-color: #eff6ff; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Expected Impact:</span>
              <strong style="color: #059669;">${formatNumber(foodBank.expected_impact)} people/month</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Coverage Radius:</span>
              <strong>${foodBank.coverage_radius.toFixed(1)} km</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Efficiency Score:</span>
              <strong style="color: #2563eb;">${(foodBank.efficiency_score * 100).toFixed(1)}%</strong>
            </div>
          </div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: #6b7280; font-size: 13px;">Setup Cost:</span>
              <strong style="font-size: 13px;">${formatCurrency(foodBank.setup_cost)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280; font-size: 13px;">Monthly Operations:</span>
              <strong style="font-size: 13px;">${formatCurrency(foodBank.operational_cost_monthly)}</strong>
            </div>
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <div style="color: #6b7280; font-size: 12px;">
              Location: ${foodBank.lat.toFixed(4)}, ${foodBank.lon.toFixed(4)}
            </div>
          </div>
        </div>
      `, {
        maxWidth: 300
      })

      marker.addTo(foodBankLayerGroupRef.current!)

      // Add coverage radius circle
      const circle = L.circle([foodBank.lat, foodBank.lon], {
        radius: foodBank.coverage_radius * 1000, // Convert km to meters
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        color: '#3b82f6',
        weight: 2,
        opacity: 0.3
      })

      circle.addTo(foodBankLayerGroupRef.current!)
    })

    // Add CSS for pulse animation
    if (!document.getElementById('food-bank-marker-styles')) {
      const style = document.createElement('style')
      style.id = 'food-bank-marker-styles'
      style.innerHTML = `
        @keyframes pulse {
          0% {
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.6);
          }
          100% {
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          }
        }
        .custom-food-bank-marker {
          z-index: 1000 !important;
        }
      `
      document.head.appendChild(style)
    }
  }, [foodBanks])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map" style={{ width: '100%', height: '100%' }} />
      
      {/* Food Bank Legend */}
      {foodBanks && foodBanks.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          zIndex: 1000,
          fontFamily: '"Funnel Display", system-ui, sans-serif'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151'
          }}>
            Food Bank Locations
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Lower Impact</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '35px',
                height: '35px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                borderRadius: '50%',
                border: '3px solid white',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
              }} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Higher Impact</span>
            </div>
            
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #e5e7eb',
              fontSize: '11px',
              color: '#9ca3af'
            }}>
              Marker size indicates expected monthly impact
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 