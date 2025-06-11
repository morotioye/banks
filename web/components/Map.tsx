import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapProps {
  blocks: any[]
}

export default function Map({ blocks }: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

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

    if (blocks.length === 0) return

    // Add blocks to map
    blocks.forEach(block => {
      if (!block.geometry) return

      // Handle different property names from Atlas
      const geoid = block.properties?.geoid || block.properties?.GEOID || 'Unknown'
      const population = block.properties?.pop || block.properties?.population || 0
      const povertyRate = block.properties?.poverty_rate || 0
      const snapRate = block.properties?.snap_rate || 0
      const score = block.properties?.food_insecurity_score || 0
      
      // Color based on score or poverty/snap rates
      let color = '#60A5FA' // Blue for no data
      if (score > 0) {
        if (score <= 3) color = '#34D399' // Green
        else if (score <= 7) color = '#FBBF24' // Yellow
        else color = '#F87171' // Red
      } else if (povertyRate > 0 || snapRate > 0) {
        // If no score, color based on poverty/snap rates
        const combinedRate = (povertyRate + snapRate) / 2
        if (combinedRate <= 0.1) color = '#34D399' // Green
        else if (combinedRate <= 0.2) color = '#FBBF24' // Yellow
        else color = '#F87171' // Red
      }

      try {
        const geoJsonLayer = L.geoJSON(block, {
          style: {
            fillColor: color,
            fillOpacity: 0.6,
            color: '#4B5563',
            weight: 0.5
          }
        })

        geoJsonLayer.bindPopup(`
          <div style="font-size: 14px;">
            <strong>Block ${geoid}</strong><br/>
            Population: ${population}<br/>
            Poverty Rate: ${(povertyRate * 100).toFixed(1)}%<br/>
            SNAP Rate: ${(snapRate * 100).toFixed(1)}%<br/>
            ${score > 0 ? `Food Insecurity Score: ${score.toFixed(1)}/10` : 'Score not calculated'}
          </div>
        `)

        geoJsonLayer.addTo(layerGroupRef.current!)
      } catch (e) {
        console.error('Error adding block to map:', e)
      }
    })

    // Fit map to bounds if blocks exist
    if (blocks.length > 0) {
      const group = L.featureGroup(layerGroupRef.current!.getLayers())
      if (group.getLayers().length > 0) {
        mapRef.current.fitBounds(group.getBounds().pad(0.1))
      }
    }
  }, [blocks])

  return <div id="map" style={{ width: '100%', height: '100%' }} />
} 