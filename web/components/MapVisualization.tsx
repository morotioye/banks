'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Cell } from '@/types/cell';

interface MapVisualizationProps {
  cells: Cell[];
  stats: any;
}

// We're using rectangles, not markers, so no icon fix needed

export default function MapVisualization({ cells, stats }: MapVisualizationProps) {
  const mapRef = useRef<L.Map | null>(null);
  const cellLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      // Create map centered on NYC
      const map = L.map('map', {
        center: [40.7128, -74.0060],
        zoom: 11,
        zoomControl: true,
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Create layer group for cells
      const cellLayer = L.layerGroup().addTo(map);
      
      mapRef.current = map;
      cellLayerRef.current = cellLayer;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        cellLayerRef.current = null;
      }
    };
  }, []);

  // Update cells on map
  useEffect(() => {
    if (!mapRef.current || !cellLayerRef.current) return;

    // Clear existing cells
    cellLayerRef.current.clearLayers();

    // Add new cells
    cells.forEach((cell) => {
      const color = getColorForCell(cell);
      const opacity = cell.foodInsecurityScore ? 0.7 : 0.3;
      
      // Create rectangle for cell
      const bounds: L.LatLngBoundsExpression = [
        [cell.centroidLat - 0.005, cell.centroidLon - 0.005],
        [cell.centroidLat + 0.005, cell.centroidLon + 0.005]
      ];

      const rectangle = L.rectangle(bounds, {
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        weight: 1,
      });

      // Add popup with cell info
      const popupContent = `
        <div class="p-2">
          <h3 class="font-bold text-sm mb-1">Cell Information</h3>
          <div class="text-xs space-y-1">
            <div><strong>Location:</strong> ${cell.centroidLat.toFixed(4)}, ${cell.centroidLon.toFixed(4)}</div>
            <div><strong>Population:</strong> ${cell.population || 'N/A'}</div>
            ${cell.foodInsecurityScore !== null ? `
              <div><strong>Food Insecurity Score:</strong> ${cell.foodInsecurityScore.toFixed(2)}/10</div>
              <div><strong>Need:</strong> ${cell.need?.toFixed(0) || 'N/A'}</div>
            ` : '<div class="text-gray-500">No data available yet</div>'}
          </div>
        </div>
      `;

      rectangle.bindPopup(popupContent);
      cellLayerRef.current?.addLayer(rectangle);
    });

    // Fit map to bounds if we have stats
    if (stats.minLat && stats.maxLat && stats.minLon && stats.maxLon) {
      const bounds = L.latLngBounds(
        [stats.minLat, stats.minLon],
        [stats.maxLat, stats.maxLon]
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [cells, stats]);

  return (
    <div id="map" className="w-full h-full" />
  );
}

function getColorForCell(cell: Cell): string {
  if (cell.foodInsecurityScore === null) {
    return '#3B82F6'; // Blue for empty cells
  }
  
  const score = cell.foodInsecurityScore;
  if (score < 3) return '#10B981'; // Green
  if (score < 7) return '#F59E0B'; // Yellow
  return '#EF4444'; // Red
} 