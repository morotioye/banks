import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { ChevronDown, Trash2, Play, X } from 'lucide-react'
import BudgetModal from '../components/BudgetModal'

// Dynamic import to avoid SSR issues with Maps
const Map = dynamic(() => import('../components/GoogleMap'), { ssr: false })
const GoogleDomainSelector = dynamic(() => import('../components/GoogleDomainSelector'), { ssr: false })
const OptimizationFloatingPanel = dynamic(() => import('../components/OptimizationFloatingPanel'), { ssr: false })

interface Region {
  _id?: string
  collection_name: string
  name: string
  domain_name?: string  // Alternative name field
  center?: {
    coordinates: [number, number]
  }
  radius_miles?: number
  total_blocks?: number
  created_at?: string
  stats?: {
    total_blocks: number
    total_population?: number
    blocks_with_poverty_data?: number
    blocks_with_snap_data?: number
    blocks_with_scores?: number
    avg_food_insecurity_score?: number
    min_food_insecurity_score?: number
    max_food_insecurity_score?: number
    total_need?: number
  }
  circles?: Array<{
    lat: number
    lon: number
    radius_miles: number
  }>
}

// Visualization mode configurations
const VISUALIZATION_MODES = {
  food_insecurity_score: {
    label: 'Food Insecurity Score',
    property: 'food_insecurity_score',
    ranges: [
      { min: 0, max: 3, color: '#34D399', label: 'Low (0-3)' },
      { min: 3, max: 6, color: '#FBBF24', label: 'Medium (3-6)' },
      { min: 6, max: 10, color: '#F87171', label: 'High (6-10)' }
    ],
    multiplier: 1,
    format: (value: number) => `${value.toFixed(1)}/10`
  },
  poverty_rate: {
    label: 'Poverty Rate',
    property: 'poverty_rate',
    ranges: [
      { min: 0, max: 0.15, color: '#34D399', label: 'Low (0-15%)' },
      { min: 0.15, max: 0.30, color: '#FBBF24', label: 'Medium (15-30%)' },
      { min: 0.30, max: 1, color: '#F87171', label: 'High (30%+)' }
    ],
    multiplier: 100,
    format: (value: number) => `${(value * 100).toFixed(1)}%`
  },
  snap_rate: {
    label: 'SNAP Rate',
    property: 'snap_rate',
    ranges: [
      { min: 0, max: 0.10, color: '#34D399', label: 'Low (0-10%)' },
      { min: 0.10, max: 0.25, color: '#FBBF24', label: 'Medium (10-25%)' },
      { min: 0.25, max: 1, color: '#F87171', label: 'High (25%+)' }
    ],
    multiplier: 100,
    format: (value: number) => `${(value * 100).toFixed(1)}%`
  },
  vehicle_access_rate: {
    label: 'Vehicle Access Rate',
    property: 'vehicle_access_rate',
    ranges: [
      { min: 0, max: 0.7, color: '#F87171', label: 'Low (0-70%)' },
      { min: 0.7, max: 0.9, color: '#FBBF24', label: 'Medium (70-90%)' },
      { min: 0.9, max: 1, color: '#34D399', label: 'High (90%+)' }
    ],
    multiplier: 100,
    format: (value: number) => `${(value * 100).toFixed(1)}%`
  },
  population: {
    label: 'Population',
    property: 'pop',
    ranges: [
      { min: 0, max: 1000, color: '#34D399', label: 'Low (0-1K)' },
      { min: 1000, max: 3000, color: '#FBBF24', label: 'Medium (1K-3K)' },
      { min: 3000, max: 50000, color: '#F87171', label: 'High (3K+)' }
    ],
    multiplier: 1,
    format: (value: number) => value.toLocaleString()
  }
}

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRegions, setLoadingRegions] = useState(true)
  const [visualizationMode, setVisualizationMode] = useState<string>('food_insecurity_score')
  const [creating, setCreating] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCreatingRegion, setIsCreatingRegion] = useState(false)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [showOptimization, setShowOptimization] = useState(false)
  const [showBudgetInput, setShowBudgetInput] = useState(false)
  const [optimizationBudget, setOptimizationBudget] = useState('')
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [agentSteps, setAgentSteps] = useState<any[]>([])
  // Note: calculatingScores state removed - no longer needed
  const [newRegion, setNewRegion] = useState({
    name: '',
    lat: 34.0522,
    lon: -118.2437,
    radius: 2.0,
    circles: [] as Array<{ center: { lat: number; lng: number }; radius: number }>
  })

  // Store the last valid budget to prevent loss
  const [lastValidBudget, setLastValidBudget] = useState('')

  // Custom setter for optimization budget with logging
  const setOptimizationBudgetWithLog = (value: string) => {
    console.log('[BUDGET] Setting optimizationBudget to:', value, 'from:', optimizationBudget)
    setOptimizationBudget(value)
  }

  // Custom setter for last valid budget with logging
  const setLastValidBudgetWithLog = (value: string) => {
    console.log('[BUDGET] Setting lastValidBudget to:', value, 'from:', lastValidBudget)
    setLastValidBudget(value)
  }

  // Update last valid budget when budget changes
  useEffect(() => {
    console.log('[BUDGET] optimizationBudget changed to:', optimizationBudget)
    if (optimizationBudget && parseFloat(optimizationBudget) >= 500000) {
      console.log('[BUDGET] Valid budget detected, updating lastValidBudget')
      setLastValidBudgetWithLog(optimizationBudget)
    }
  }, [optimizationBudget])

  // Monitor all budget-related state changes
  useEffect(() => {
    console.log('[BUDGET] === STATE UPDATE ===')
    console.log('[BUDGET] optimizationBudget:', optimizationBudget)
    console.log('[BUDGET] lastValidBudget:', lastValidBudget)
    console.log('[BUDGET] showOptimization:', showOptimization)
    console.log('[BUDGET] showBudgetInput:', showBudgetInput)
    console.log('[BUDGET] ===================')
  }, [optimizationBudget, lastValidBudget, showOptimization, showBudgetInput])

  // Fetch regions
  const fetchRegions = async () => {
    setLoadingRegions(true)
    try {
      const response = await fetch('/api/domains')
      const data = await response.json()
      console.log('Fetched regions data:', data.domains)
      setRegions(data.domains || [])
    } catch (error) {
      console.error('Error fetching regions:', error)
    } finally {
      setLoadingRegions(false)
    }
  }

  // Fetch blocks for selected region
  const fetchBlocks = async (collection: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/blocks?collection=${collection}`)
      const data = await response.json()
      setBlocks(data.blocks || [])
    } catch (error) {
      console.error('Error fetching blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  // Delete region
  const deleteRegion = async (regionId: string, collectionName: string) => {
    try {
      const response = await fetch('/api/delete-domain', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domainId: regionId,
          collectionName: collectionName
        })
      })

      if (response.ok) {
        // Clear selection if deleted region was selected
        if (selectedRegion === collectionName) {
          setSelectedRegion('')
        }
        // Refresh regions list
        fetchRegions()
      } else {
        const data = await response.json()
        console.error('Failed to delete region:', data.error)
      }
    } catch (error) {
      console.error('Error deleting region:', error)
    }
  }

  // Create new region
  const createRegion = async () => {
    // Validate that circles have been drawn
    if (!newRegion.circles || newRegion.circles.length === 0) {
      alert('Please draw at least one coverage area before creating the region')
      return
    }

    // Auto-generate name if empty
    const regionName = newRegion.name.trim() || `Region_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}Z`

    // Prepare region data with circles
    const regionData = {
      name: regionName,
      circles: newRegion.circles.map(circle => ({
        lat: circle.center.lat,
        lon: circle.center.lng,
        radius: circle.radius / 1609.34 // Convert meters to miles
      }))
    }

    setCreating(true)
    try {
      const response = await fetch('/api/create-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regionData)
      })

      const data = await response.json()
      
      if (response.ok) {
        // Close the creation interface
        setIsCreatingRegion(false)
        setNewRegion({ name: '', lat: 34.0522, lon: -118.2437, radius: 2.0, circles: [] })
        
        // Immediately refresh regions to get the latest list
        await fetchRegions()
        
        // After refreshing, auto-select the most recently created region
        // Wait a moment for the regions state to update
        setTimeout(() => {
          const newCollectionName = `r_${regionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
          setSelectedRegion(newCollectionName)
          
          // Trigger a manual refresh of the map blocks for the new region
          fetchBlocks(newCollectionName)
        }, 100)
        
        // Show success message
        console.log('Region created successfully:', regionName)
      } else {
        alert(data.error || 'Failed to create region')
      }
    } catch (error) {
      console.error('Error creating region:', error)
      alert('Failed to create region')
    } finally {
      setCreating(false)
    }
  }

  // Note: Score calculation is now done during census block collection
  // No need for on-demand score calculation anymore

  // Initial load
  useEffect(() => {
    fetchRegions()
  }, [])

  // Debug budget changes
  useEffect(() => {
    console.log('optimizationBudget changed:', optimizationBudget)
  }, [optimizationBudget])

  // Fetch blocks when region is selected
  useEffect(() => {
    if (selectedRegion) {
      fetchBlocks(selectedRegion)
    } else {
      setBlocks([])
    }
  }, [selectedRegion])

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (isDropdownOpen && !target.closest('.custom-dropdown')) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  // Start optimization process
  const startOptimization = async (budgetOverride?: string) => {
    console.log('[BUDGET] === START OPTIMIZATION ===')
    console.log('[BUDGET] budgetOverride:', budgetOverride)
    console.log('[BUDGET] Current state:', {
      optimizationBudget,
      optimizationBudgetType: typeof optimizationBudget,
      optimizationBudgetLength: optimizationBudget.length,
      lastValidBudget,
      lastValidBudgetType: typeof lastValidBudget,
      selectedRegion
    })
    
    // Validate inputs before starting
    if (!selectedRegion) {
      console.log('[BUDGET] ERROR: No region selected')
      setOptimizationResult({
        status: 'error',
        error: 'Please select a region first'
      })
      return
    }
    
    // Use override budget first, then current budget, then fall back to last valid budget
    const budgetToUse = budgetOverride || optimizationBudget || lastValidBudget
    console.log('[BUDGET] Budget selection:', {
      usingOverride: !!budgetOverride,
      usingOptimizationBudget: !budgetOverride && !!optimizationBudget,
      usingLastValidBudget: !budgetOverride && !optimizationBudget && !!lastValidBudget,
      budgetToUse
    })
    
    // Parse budget and validate
    const budgetValue = parseFloat(budgetToUse)
    console.log('[BUDGET] Budget validation:', {
      budgetToUse,
      budgetToUseType: typeof budgetToUse,
      budgetValue,
      budgetValueType: typeof budgetValue,
      isValid: budgetValue >= 500000,
      isNaN: isNaN(budgetValue),
      isEmpty: !budgetToUse,
      isEmptyString: budgetToUse === '',
      isZero: budgetValue === 0
    })
    
    if (!budgetToUse || isNaN(budgetValue) || budgetValue < 500000) {
      console.log('[BUDGET] ERROR: Invalid budget, showing error')
      setOptimizationResult({
        status: 'error',
        error: `Budget must be at least $500,000 (current: $${budgetValue || 0})`
      })
      return
    }

    setIsOptimizing(true)
    setOptimizationResult(null)
    setAgentSteps([])

    try {
      // Extract region name from collection name (remove 'r_' prefix)
      const regionName = selectedRegion.startsWith('r_') 
        ? selectedRegion.substring(2) 
        : selectedRegion

      console.log('Starting optimization with:', {
        region: regionName,
        budget: budgetValue,
        selectedRegion: selectedRegion
      })

      const response = await fetch('/api/optimize-locations-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          region: regionName,
          budget: budgetValue,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API error response:', errorData)
        throw new Error(errorData.error || 'Failed to start optimization')
      }

      // Set up SSE reader
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'agent_step') {
                setAgentSteps(prev => [...prev, {
                  ...data,
                  timestamp: new Date()
                }])
              } else if (data.type === 'result') {
                setOptimizationResult({
                  status: 'success',
                  data: data.data
                })
                setIsOptimizing(false)
              } else if (data.type === 'error') {
                setOptimizationResult({
                  status: 'error',
                  error: data.message
                })
                setIsOptimizing(false)
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error starting optimization:', error)
      setOptimizationResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start optimization'
      })
      setIsOptimizing(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '"Funnel Display", system-ui, -apple-system, sans-serif' }}>
      <Head>
        <title>banks</title>
        <meta name="description" content="Geographic data visualization" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

              {/* Sidebar */}
        <div style={{ 
          width: '320px', 
          backgroundColor: 'hsl(25, 5%, 98%)', 
          borderRight: '1px solid hsl(25, 5%, 90%)',
          display: 'flex',
          flexDirection: 'column'
        }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid hsl(25, 5%, 90%)', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 
              onClick={() => window.location.href = '/'}
              style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                margin: 0, 
                color: 'hsl(140, 35%, 20%)', 
                fontFamily: '"Funnel Display", system-ui, sans-serif',
                cursor: 'pointer',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'hsl(140, 30%, 25%)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'hsl(140, 35%, 20%)'
              }}
            >
              banks
            </h1>
            {selectedRegion && (
              <button
                onClick={() => {
                  console.log('Play button clicked:', {
                    optimizationBudget,
                    lastValidBudget,
                    hasOptimizationBudget: !!optimizationBudget,
                    budgetValue: parseFloat(optimizationBudget || lastValidBudget)
                  })
                  
                  // Use current budget or fall back to last valid budget
                  const budgetToUse = optimizationBudget || lastValidBudget
                  console.log('[BUDGET] Play button - budgetToUse:', budgetToUse)
                  
                  if (budgetToUse) {
                    // If we have a budget, start optimization directly
                    setOptimizationBudgetWithLog(budgetToUse) // Ensure budget is set
                    setShowOptimization(true);
                    // Pass the budget directly to avoid closure issues
                    startOptimization(budgetToUse);
                  } else {
                    // Otherwise show the budget input modal
                    console.log('[BUDGET] No budget found, showing budget modal')
                    setShowBudgetInput(true);
                  }
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'hsl(140, 30%, 25%)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(45, 90, 45, 0.3)',
                  marginLeft: 'auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(140, 35%, 20%)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 45, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(140, 30%, 25%)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(45, 90, 45, 0.3)'
                }}
              >
                <Play size={20} style={{ color: 'white', marginLeft: '2px' }} />
              </button>
            )}
          </div>
        </div>

        {/* Visualization Mode Selector */}
        <div style={{ padding: '16px', borderBottom: '1px solid hsl(25, 5%, 90%)', backgroundColor: '#ffffff' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#34495e', margin: '0 0 8px 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
            Heatmap Overlay Layer
          </h3>
          <div className="custom-dropdown" style={{ position: 'relative', width: '220px' }}>
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${isDropdownOpen ? 'hsl(140, 30%, 25%)' : 'hsl(25, 5%, 80%)'}`,
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isDropdownOpen ? '0 0 0 3px rgba(45, 90, 45, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                fontFamily: '"Funnel Display", system-ui, sans-serif'
              }}
            >
              <span style={{ color: '#2c3e50', fontWeight: '500' }}>
                {(VISUALIZATION_MODES as any)[visualizationMode]?.label}
              </span>
              <ChevronDown 
                size={16} 
                style={{ 
                  color: '#7f8c8d',
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }} 
              />
            </div>
            
            {isDropdownOpen && (
              <div style={{
                                 position: 'absolute',
                 top: '100%',
                 left: 0,
                 right: 0,
                 backgroundColor: 'white',
                 border: '1px solid hsl(25, 5%, 90%)',
                 borderRadius: '8px',
                 boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.03)',
                 zIndex: 50,
                 marginTop: '4px',
                 overflow: 'hidden'
              }}>
                {Object.entries(VISUALIZATION_MODES).map(([key, config]) => (
                  <div
                    key={key}
                    onClick={() => {
                      setVisualizationMode(key)
                      setIsDropdownOpen(false)
                    }}
                                         style={{
                       padding: '10px 12px',
                       fontSize: '14px',
                       color: visualizationMode === key ? '#2c3e50' : '#34495e',
                       backgroundColor: visualizationMode === key ? 'hsl(140, 20%, 95%)' : 'transparent',
                       cursor: 'pointer',
                       transition: 'all 0.15s ease',
                       fontWeight: visualizationMode === key ? '500' : '400',
                       borderLeft: visualizationMode === key ? '3px solid hsl(140, 30%, 25%)' : '3px solid transparent',
                       fontFamily: '"Funnel Display", system-ui, sans-serif'
                     }}
                    onMouseEnter={(e) => {
                      if (visualizationMode !== key) {
                        e.currentTarget.style.backgroundColor = '#f9fafb'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (visualizationMode !== key) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    {config.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Dynamic Legend */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#34495e', marginBottom: '8px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
              Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'hsl(25, 5%, 60%)', borderRadius: '3px' }}></div>
                <span style={{ fontSize: '12px', color: '#7f8c8d', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>No data</span>
              </div>
                             {(VISUALIZATION_MODES as any)[visualizationMode]?.ranges.map((range: any, index: number) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: range.color, 
                    borderRadius: '3px' 
                  }}></div>
                  <span style={{ fontSize: '12px', color: '#34495e', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>{range.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Region List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px', backgroundColor: 'hsl(25, 5%, 98%)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', margin: 0, fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
              Recent Regions
            </h2>
            <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '4px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
              {loadingRegions ? 'Loading...' : regions.length === 0 ? 'No regions yet' : `Showing ${Math.min(3, regions.length)} most recent`}
            </p>
          </div>
          
          {loadingRegions ? (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '48px',
              padding: '32px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid hsl(25, 5%, 90%)'
            }}>
              <p style={{ color: '#95a5a6', fontSize: '14px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                Loading regions...
              </p>
            </div>
          ) : regions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ 
                textAlign: 'center', 
                marginTop: '48px',
                padding: '32px 16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid hsl(25, 5%, 90%)'
              }}>
                <p style={{ color: '#95a5a6', fontSize: '14px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                  No regions found
                </p>
              </div>
              
              {/* New Region Button */}
              <button
                onClick={() => window.location.href = '/new'}
                style={{
                  padding: '16px',
                  backgroundColor: 'hsl(140, 20%, 95%)',
                  border: '2px dashed hsl(140, 25%, 40%)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                  fontFamily: '"Funnel Display", system-ui, sans-serif',
                  minHeight: '72px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(140, 25%, 90%)'
                  e.currentTarget.style.borderColor = 'hsl(140, 30%, 25%)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 45, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(140, 20%, 95%)'
                  e.currentTarget.style.borderColor = 'hsl(140, 25%, 40%)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'hsl(140, 30%, 25%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  +
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#2c3e50', marginBottom: '2px' }}>
                    Create New Region
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    Define a new geographic area
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {regions
                .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                .slice(0, 3)
                .map((region) => (
                <div
                  key={region._id}
                  style={{
                    padding: '16px',
                    backgroundColor: selectedRegion === region.collection_name ? 'hsl(140, 20%, 95%)' : 'white',
                    border: `2px solid ${selectedRegion === region.collection_name ? 'hsl(140, 30%, 25%)' : 'hsl(25, 5%, 85%)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                                          boxShadow: selectedRegion === region.collection_name 
                        ? '0 4px 12px rgba(45, 90, 45, 0.15)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.04)',
                    transform: selectedRegion === region.collection_name ? 'translateY(-1px)' : 'translateY(0)',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    setHoveredRegion(region._id || '')
                    if (selectedRegion !== region.collection_name) {
                      e.currentTarget.style.backgroundColor = 'hsl(25, 5%, 97%)'
                      e.currentTarget.style.borderColor = 'hsl(140, 25%, 40%)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    setHoveredRegion(null)
                    if (selectedRegion !== region.collection_name) {
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.borderColor = 'hsl(25, 5%, 85%)'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <div 
                    style={{ flex: 1 }}
                    onClick={() => window.location.href = `/${region.collection_name}`}
                  >
                    <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#2c3e50', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                      {region.name || region.domain_name || region.collection_name.replace(/^r_/, '').replace(/_/g, ' ')}
                    </h3>
                    {(region.center && region.center.coordinates) || region.circles ? (
                      <>
                        <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '6px 0 2px 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                          {region.center && region.center.coordinates 
                            ? `${region.center.coordinates[1].toFixed(4)}, ${region.center.coordinates[0].toFixed(4)}`
                            : region.circles && region.circles.length > 0
                            ? `${region.circles[0].lat.toFixed(4)}, ${region.circles[0].lon.toFixed(4)}`
                            : 'Location not available'
                          }
                        </p>
                        <p style={{ fontSize: '12px', color: '#95a5a6', margin: '2px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                          {region.circles && region.circles.length > 1 
                            ? `${region.circles.length} coverage areas`
                            : region.radius_miles 
                            ? `${region.radius_miles.toFixed(1)} mile radius` 
                            : region.circles && region.circles.length === 1
                            ? `${region.circles[0].radius_miles.toFixed(1)} mile radius`
                            : ''
                          }
                          {region.stats?.total_blocks 
                            ? ` • ${region.stats.total_blocks.toLocaleString()} blocks` 
                            : region.total_blocks
                            ? ` • ${region.total_blocks.toLocaleString()} blocks`
                            : ''
                          }
                        </p>
                        {region.created_at && (
                          <p style={{ fontSize: '11px', color: '#bdc3c7', margin: '4px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                            Created {new Date(region.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '6px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                        No location data available
                      </p>
                    )}
                  </div>

                  {/* Trash Icon - appears on hover */}
                  {hoveredRegion === region._id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteRegion(region._id || '', region.collection_name)
                      }}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fee2e2'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'
                      }}
                    >
                      <Trash2 size={14} style={{ color: '#374151' }} />
                    </button>
                  )}

                  {selectedRegion === region.collection_name && (
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'hsl(140, 30%, 25%)'
                    }}></div>
                  )}
                </div>
              ))}
              
              {/* New Region Button */}
              <button
                onClick={() => window.location.href = '/new'}
                style={{
                  padding: '16px',
                  backgroundColor: 'hsl(140, 20%, 95%)',
                  border: '2px dashed hsl(140, 25%, 40%)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                  fontFamily: '"Funnel Display", system-ui, sans-serif',
                  minHeight: '72px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(140, 25%, 90%)'
                  e.currentTarget.style.borderColor = 'hsl(140, 30%, 25%)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 45, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(140, 20%, 95%)'
                  e.currentTarget.style.borderColor = 'hsl(140, 25%, 40%)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'hsl(140, 30%, 25%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  +
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#2c3e50', marginBottom: '2px' }}>
                    Create New Region
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    Define a new geographic area
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>


      </div>

      {/* Budget Input Modal */}
      <BudgetModal
        open={showBudgetInput}
        onClose={() => {
          // Don't clear the budget when closing - keep it for reuse
          console.log('[BUDGET] BudgetModal closed, keeping budget:', optimizationBudget)
          setShowBudgetInput(false)
        }}
        onSubmit={(budget) => {
          const budgetString = budget.toString()
          console.log('[BUDGET] BudgetModal onSubmit:', { budget, budgetString })
          setOptimizationBudgetWithLog(budgetString)
          setLastValidBudgetWithLog(budgetString) // Also update last valid budget
          setShowBudgetInput(false)
          setShowOptimization(true)
          // Use setTimeout to ensure state updates before starting optimization
          setTimeout(() => {
            console.log('[BUDGET] Starting optimization after timeout')
            console.log('[BUDGET] Budget state in timeout:', {
              optimizationBudget,
              lastValidBudget,
              budgetString // This is captured from closure
            })
            startOptimization(budgetString)
          }, 100)
        }}
      />

      {/* Old Budget Modal - Remove this */}
      {false && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '48px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.2)',
            width: '480px',
            position: 'relative',
            transform: 'translateY(-20px)'
          }}>
            {/* Close button */}
            <button
              onClick={() => {
                setOptimizationBudget('');
                setShowBudgetInput(false);
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
            >
              <X size={18} style={{ color: '#6b7280' }} />
            </button>

            <h2 style={{
              fontSize: '32px',
              fontWeight: '800',
              color: '#000',
              marginBottom: '12px',
              fontFamily: '"Funnel Display", system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}>
              Investment Budget
            </h2>
            <p style={{
              fontSize: '17px',
              color: '#666',
              marginBottom: '40px',
              fontFamily: '"Funnel Display", system-ui, sans-serif',
              lineHeight: '1.5'
            }}>
              How much would you like to invest in establishing food banks? We'll optimize locations to maximize impact within your budget.
            </p>

            {/* Quick select buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {[500000, 1000000, 2500000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setOptimizationBudget(amount.toString())}
                  style={{
                    padding: '12px',
                    backgroundColor: optimizationBudget === amount.toString() ? '#000' : '#f9fafb',
                    color: optimizationBudget === amount.toString() ? '#fff' : '#374151',
                    border: `2px solid ${optimizationBudget === amount.toString() ? '#000' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: '"Funnel Display", system-ui, sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    if (optimizationBudget !== amount.toString()) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (optimizationBudget !== amount.toString()) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  ${amount >= 1000000 ? `${(amount / 1000000).toFixed(1)}M` : '500K'}
                </button>
              ))}
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                color: '#374151',
                marginBottom: '8px',
                fontFamily: '"Funnel Display", system-ui, sans-serif',
                fontWeight: '600'
              }}>
                Custom Amount
              </label>
              <div style={{
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  marginLeft: '-122px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '18px',
                  color: '#9ca3af',
                  fontWeight: '500'
                }}>
                  $
                </span>
                <input
                  type="text"
                  value={optimizationBudget ? parseInt(optimizationBudget).toLocaleString() : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setOptimizationBudget(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const budget = parseFloat(optimizationBudget);
                      if (!isNaN(budget) && budget >= 500000) {
                        setShowBudgetInput(false);
                        setShowOptimization(true);
                        startOptimization();
                      }
                    } else if (e.key === 'Escape') {
                      setOptimizationBudget('');
                      setShowBudgetInput(false);
                    }
                  }}
                  placeholder="1,000,000"
                  style={{
                    width: '280px',
                    padding: '14px 18px 14px 44px',
                    fontSize: '20px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    fontFamily: '"Funnel Display", system-ui, sans-serif',
                    fontWeight: '600',
                    backgroundColor: '#fafafa',
                    margin: '0 auto',
                    display: 'block'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#000';
                    e.currentTarget.style.backgroundColor = '#fff';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = '#fafafa';
                  }}
                  autoFocus
                />
              </div>
              
              {/* Budget info */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: optimizationBudget && parseFloat(optimizationBudget) < 500000 ? '#fef2f2' : '#fffbeb',
                borderRadius: '8px',
                border: `1px solid ${optimizationBudget && parseFloat(optimizationBudget) < 500000 ? '#fecaca' : '#fde68a'}`
              }}>
                {optimizationBudget && parseFloat(optimizationBudget) < 500000 ? (
                  <p style={{
                    fontSize: '13px',
                    color: '#dc2626',
                    margin: 0,
                    fontFamily: '"Funnel Display", system-ui, sans-serif'
                  }}>
                    Minimum budget is $500,000 to establish at least one food bank
                  </p>
                ) : (
                  <p style={{
                    fontSize: '13px',
                    color: '#92400e',
                    margin: 0,
                    fontFamily: '"Funnel Display", system-ui, sans-serif'
                  }}>
                    {optimizationBudget ? 
                      `This budget can establish approximately ${Math.floor(parseFloat(optimizationBudget) / 300000)} food banks` :
                      'Enter a budget to see estimated coverage'
                    }
                  </p>
                )}
              </div>
            </div>
            
            <button
                              onClick={() => {
                  const budget = parseFloat(optimizationBudget);
                  if (!isNaN(budget) && budget >= 500000) {
                    setShowBudgetInput(false);
                    setShowOptimization(true);
                    startOptimization();
                  }
                }}
                disabled={!optimizationBudget || parseFloat(optimizationBudget) < 500000}
              style={{
                width: '100%',
                padding: '16px 32px',
                                  backgroundColor: (!optimizationBudget || parseFloat(optimizationBudget) < 500000) ? '#e5e7eb' : '#000',
                  color: (!optimizationBudget || parseFloat(optimizationBudget) < 500000) ? '#9ca3af' : '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '17px',
                fontWeight: '700',
                                  cursor: (!optimizationBudget || parseFloat(optimizationBudget) < 500000) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: '"Funnel Display", system-ui, sans-serif'
              }}
                              onMouseEnter={(e) => {
                  if (optimizationBudget && parseFloat(optimizationBudget) >= 500000) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (optimizationBudget && parseFloat(optimizationBudget) >= 500000) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {optimizationBudget && parseFloat(optimizationBudget) >= 500000 ? 
                'Start Optimization' : 
                'Enter Valid Budget'
              }
            </button>
            
            <p style={{
              fontSize: '12px',
              color: '#9ca3af',
              textAlign: 'center',
              marginTop: '16px',
              fontFamily: '"Funnel Display", system-ui, sans-serif'
            }}>
              Press Enter to continue • Escape to cancel
            </p>
          </div>
        </div>
      )}

      {/* Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {isCreatingRegion ? (
          /* Region Creation Interface */
          <div style={{
            width: '100%',
            height: '100%',
            position: 'relative'
          }}>
            {/* Full screen map */}
            <GoogleDomainSelector
              lat={newRegion.lat}
              lon={newRegion.lon}
              radius={newRegion.radius}
              onLocationChange={(lat, lon) => setNewRegion({ ...newRegion, lat, lon })}
              onRadiusChange={(radius) => setNewRegion({ ...newRegion, radius })}
              onCirclesChange={(circles) => setNewRegion({ ...newRegion, circles })}
            />

            {/* Region name input - floating top left */}
            <div style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              border: '1px solid hsl(25, 5%, 90%)',
              zIndex: 10
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'hsl(140, 35%, 20%)',
                marginBottom: '8px',
                fontFamily: '"Funnel Display", system-ui, sans-serif'
              }}>
                Region Name
              </label>
              <input
                type="text"
                value={newRegion.name}
                onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })}
                placeholder="Enter name (or leave empty)"
                style={{
                  width: '280px',
                  padding: '10px 14px',
                  border: '2px solid hsl(25, 5%, 85%)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  outline: 'none',
                  fontFamily: '"Funnel Display", system-ui, sans-serif',
                  transition: 'border-color 0.2s ease',
                  color: 'hsl(140, 35%, 20%)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'hsl(140, 30%, 25%)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'hsl(25, 5%, 85%)'}
              />
            </div>

            {/* Create button - floating top right */}
            <div style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              display: 'flex',
              gap: '12px',
              zIndex: 10
            }}>
              <button
                onClick={() => {
                  setIsCreatingRegion(false)
                  setNewRegion({ name: '', lat: 34.0522, lon: -118.2437, radius: 2.0, circles: [] })
                }}
                disabled={creating}
                style={{
                  padding: '12px 24px',
                  backgroundColor: creating ? 'hsl(25, 5%, 85%)' : 'white',
                  color: creating ? 'hsl(25, 5%, 60%)' : 'hsl(25, 5%, 45%)',
                  border: '2px solid hsl(25, 5%, 85%)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: '"Funnel Display", system-ui, sans-serif',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                  opacity: creating ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = 'hsl(25, 5%, 97%)'
                    e.currentTarget.style.borderColor = 'hsl(25, 5%, 70%)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = 'hsl(25, 5%, 85%)'
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={createRegion}
                disabled={creating || !newRegion.circles || newRegion.circles.length === 0}
                style={{
                  padding: '12px 32px',
                  backgroundColor: creating || !newRegion.circles || newRegion.circles.length === 0 ? 'hsl(25, 5%, 60%)' : 'hsl(140, 30%, 25%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: creating || !newRegion.circles || newRegion.circles.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: creating || !newRegion.circles || newRegion.circles.length === 0 ? 'none' : '0 4px 12px rgba(45, 90, 45, 0.2)',
                  fontFamily: '"Funnel Display", system-ui, sans-serif',
                  opacity: !newRegion.circles || newRegion.circles.length === 0 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!creating && newRegion.circles && newRegion.circles.length > 0) {
                    e.currentTarget.style.backgroundColor = 'hsl(140, 35%, 20%)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(45, 90, 45, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creating && newRegion.circles && newRegion.circles.length > 0) {
                    e.currentTarget.style.backgroundColor = 'hsl(140, 30%, 25%)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 45, 0.2)'
                  }
                }}
              >
                {creating && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {creating ? 'Creating Region...' : 'Create Region'}
              </button>
            </div>

            {/* Loading overlay when creating */}
            {creating && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '40px 48px',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                  textAlign: 'center',
                  border: '1px solid hsl(25, 5%, 90%)',
                  maxWidth: '400px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    border: '4px solid hsl(140, 30%, 85%)',
                    borderTop: '4px solid hsl(140, 30%, 25%)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 24px'
                  }} />
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '20px',
                    fontWeight: '600',
                    color: 'hsl(140, 35%, 20%)',
                    fontFamily: '"Funnel Display", system-ui, sans-serif'
                  }}>
                    Creating Region
                  </h3>
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    color: 'hsl(25, 5%, 45%)',
                    fontFamily: '"Funnel Display", system-ui, sans-serif',
                    lineHeight: '1.4'
                  }}>
                    Processing {newRegion.circles?.length || 0} coverage area{(newRegion.circles?.length || 0) !== 1 ? 's' : ''}...
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'hsl(25, 5%, 60%)',
                    fontFamily: '"Funnel Display", system-ui, sans-serif'
                  }}>
                    This may take up to 30 seconds
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : selectedRegion ? (
          <>
            <Map 
              blocks={blocks} 
              visualizationMode={visualizationMode} 
              foodBanks={optimizationResult?.data?.locations}
            />

            {/* Loading indicator */}
            {loading && (
              <div style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                backgroundColor: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '14px',
                color: '#34495e',
                border: '1px solid #e8eaed',
                fontFamily: '"Funnel Display", system-ui, sans-serif',
                fontWeight: '500'
              }}>
                Loading blocks...
              </div>
            )}

            {/* Optimization Floating Panel */}
            {showOptimization && (
              <OptimizationFloatingPanel
                result={optimizationResult}
                isOptimizing={isOptimizing}
                budget={parseFloat(optimizationBudget)}
                agentSteps={agentSteps}
                onClose={() => {
                  setShowOptimization(false);
                  setOptimizationResult(null);
                  setIsOptimizing(false);
                  // Don't clear the budget so it can be reused
                  setAgentSteps([]);
                }}
              />
            )}


          </>
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ textAlign: 'center', color: '#95a5a6' }}>
              <p style={{ fontSize: '18px', marginBottom: '8px', fontFamily: '"Funnel Display", system-ui, sans-serif', fontWeight: '600', color: '#34495e' }}>No region selected</p>
              <p style={{ fontSize: '14px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>Select a region from the sidebar to view blocks</p>
            </div>
          </div>
        )}
      </div>


    </div>
  )
} 