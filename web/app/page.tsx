'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Cell } from '@/types/cell';

// Dynamically import map component to avoid SSR issues
const MapVisualization = dynamic(
  () => import('@/components/MapVisualization'),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
  }
);

export default function Home() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('cells');
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(1000);

  // Fetch available collections
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/cells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: true }),
      });
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }, []);

  // Fetch cells from selected collection
  const fetchCells = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cells?collection=${selectedCollection}&limit=5000`);
      const data = await response.json();
      
      setCells(data.cells || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Error fetching cells:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCollection]);

  // Initial load
  useEffect(() => {
    fetchCollections();
    fetchCells();
  }, [fetchCollections, fetchCells]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchCells();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchCells]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg p-6 overflow-y-auto scrollbar-thin">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Food Insecurity Grid
        </h1>

        {/* Collection Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Collection
          </label>
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {collections.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        {/* Auto Refresh Controls */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Auto Refresh
            </label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {autoRefresh && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Refresh Interval (ms)
              </label>
              <input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 1000)}
                min="500"
                step="500"
                className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Statistics</h2>
          <div className="space-y-2">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-xs text-gray-600">Total Cells</div>
              <div className="text-xl font-semibold text-gray-800">
                {cells.length.toLocaleString()}
              </div>
            </div>
            
            {stats.avgPopulation !== null && (
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-xs text-gray-600">Avg Population</div>
                <div className="text-xl font-semibold text-blue-800">
                  {stats.avgPopulation?.toFixed(0) || 'N/A'}
                </div>
              </div>
            )}
            
            {stats.avgFoodInsecurityScore !== null && (
              <div className="bg-orange-50 p-3 rounded-md">
                <div className="text-xs text-gray-600">Avg Insecurity Score</div>
                <div className="text-xl font-semibold text-orange-800">
                  {stats.avgFoodInsecurityScore?.toFixed(2) || 'N/A'}
                </div>
              </div>
            )}
            
            {stats.totalNeed !== null && (
              <div className="bg-red-50 p-3 rounded-md">
                <div className="text-xs text-gray-600">Total Need</div>
                <div className="text-xl font-semibold text-red-800">
                  {stats.totalNeed?.toFixed(0) || 'N/A'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Legend</h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">Empty Cell</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">Low Insecurity (0-3)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">Medium Insecurity (3-7)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">High Insecurity (7-10)</span>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchCells}
          disabled={loading}
          className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh Now'}
        </button>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 z-10 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading cells...</p>
            </div>
          </div>
        )}
        <MapVisualization cells={cells} stats={stats} />
      </div>
    </div>
  );
} 