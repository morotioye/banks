import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapProps {
  blocks: any[]
  visualizationMode: string
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

export default function Map({ blocks, visualizationMode }: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const hasInitializedBounds = useRef<boolean>(false)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([34.0522, -118.2437], 11)
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current)

      layerGroupRef.current = L.layerGroup().addTo(mapRef.current)
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
  }, [blocks])

  return <div id="map" style={{ width: '100%', height: '100%' }} />
} 