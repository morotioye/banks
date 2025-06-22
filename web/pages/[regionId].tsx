import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { ChevronDown, Trash2, Play, X, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/router'
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

export default function RegionPage() {
  const router = useRouter()
  const { regionId } = router.query
  
  const [region, setRegion] = useState<Region | null>(null)
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRegion, setLoadingRegion] = useState(true)
  const [visualizationMode, setVisualizationMode] = useState<string>('food_insecurity_score')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showOptimization, setShowOptimization] = useState(false)
  const [showBudgetInput, setShowBudgetInput] = useState(false)
  const [optimizationBudget, setOptimizationBudget] = useState('')
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [agentSteps, setAgentSteps] = useState<any[]>([])
  const [lastValidBudget, setLastValidBudget] = useState('')

  // Fetch region details
  const fetchRegion = async (collection: string) => {
    setLoadingRegion(true)
    try {
      const response = await fetch('/api/domains')
      const data = await response.json()
      const foundRegion = data.domains?.find((r: Region) => r.collection_name === collection)
      setRegion(foundRegion || null)
      
      if (foundRegion) {
        fetchBlocks(collection)
      }
    } catch (error) {
      console.error('Error fetching region:', error)
      setRegion(null)
    } finally {
      setLoadingRegion(false)
    }
  }

  // Fetch blocks for region
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
    if (!confirm(`Are you sure you want to delete "${region?.name || collectionName}"? This cannot be undone.`)) {
      return
    }

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
        // Redirect to main app after deletion
        router.push('/app')
      } else {
        const data = await response.json()
        console.error('Failed to delete region:', data.error)
        alert('Failed to delete region: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting region:', error)
      alert('Failed to delete region')
    }
  }

  // Start optimization process
  const startOptimization = async (budgetOverride?: string) => {
    if (!region) {
      setOptimizationResult({
        status: 'error',
        error: 'No region selected'
      })
      return
    }
    
    const budgetToUse = budgetOverride || optimizationBudget || lastValidBudget
    const budgetValue = parseFloat(budgetToUse)
    
    if (!budgetToUse || isNaN(budgetValue) || budgetValue < 500000) {
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
      const regionName = region.collection_name.startsWith('r_') 
        ? region.collection_name.substring(2) 
        : region.collection_name

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
        throw new Error(errorData.error || 'Failed to start optimization')
      }

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
      console.error('Optimization error:', error)
      setOptimizationResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
      setIsOptimizing(false)
    }
  }

  // Initialize page
  useEffect(() => {
    if (regionId && typeof regionId === 'string') {
      fetchRegion(regionId)
    }
  }, [regionId])

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

  // Update last valid budget when budget changes
  useEffect(() => {
    if (optimizationBudget && parseFloat(optimizationBudget) >= 500000) {
      setLastValidBudget(optimizationBudget)
    }
  }, [optimizationBudget])

  if (loadingRegion) {
    return (
      <div className="min-h-screen bg-stone-50 font-funnel flex items-center justify-center">
        <Head>
          <title>Loading Region - banks</title>
        </Head>
        <div className="text-center">
          <p className="text-lg text-stone-600">Loading region...</p>
        </div>
      </div>
    )
  }

  if (!region) {
    return (
      <div className="min-h-screen bg-stone-50 font-funnel flex items-center justify-center">
        <Head>
          <title>Region Not Found - banks</title>
        </Head>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-800 mb-4">Region Not Found</h1>
          <p className="text-stone-600 mb-4">The region you're looking for could not be found.</p>
          <button
            onClick={() => router.push('/app')}
            className="px-4 py-2 bg-forest-green text-white rounded-lg hover:bg-forest-green-dark transition-colors"
          >
            Back to App
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 font-funnel">
      <Head>
        <title>{region.name} - banks</title>
        <meta name="description" content={`Analyzing food security data for ${region.name}`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ display: 'flex', height: '100vh', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '280px', 
          backgroundColor: 'white', 
          borderRight: '1px solid hsl(25, 5%, 90%)', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
          boxShadow: '4px 0 8px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Header */}
          <div style={{ padding: '20px 16px', borderBottom: '1px solid hsl(25, 5%, 90%)', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <button
                onClick={() => router.push('/app')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'hsl(25, 5%, 95%)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(25, 5%, 88%)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(25, 5%, 95%)'
                }}
              >
                <ArrowLeft size={16} style={{ color: '#7f8c8d' }} />
              </button>
              
              <h1 style={{ 
                fontSize: '18px', 
                fontWeight: '700', 
                color: '#2c3e50', 
                margin: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {region.name}
              </h1>
              
              <button
                onClick={() => {
                  const budgetToUse = optimizationBudget || lastValidBudget
                  
                  if (budgetToUse) {
                    setShowOptimization(true);
                    startOptimization(budgetToUse);
                  } else {
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
                  boxShadow: '0 2px 8px rgba(45, 90, 45, 0.3)'
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
            </div>
            
            {/* Region Stats */}
            {region.stats && (
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'hsl(25, 5%, 98%)', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Region Stats</div>
                <div style={{ fontSize: '14px', color: '#34495e', fontWeight: '500' }}>
                  {region.stats.total_blocks?.toLocaleString() || 0} blocks
                </div>
                {region.stats.total_population && (
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    {region.stats.total_population.toLocaleString()} people
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visualization Mode Selector */}
          <div style={{ padding: '16px', borderBottom: '1px solid hsl(25, 5%, 90%)', backgroundColor: '#ffffff' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#34495e', margin: '0 0 8px 0' }}>
              Heatmap Overlay Layer
            </h3>
            <div className="custom-dropdown" style={{ position: 'relative', width: '100%' }}>
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
                  boxShadow: isDropdownOpen ? '0 0 0 3px rgba(45, 90, 45, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
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
                        borderLeft: visualizationMode === key ? '3px solid hsl(140, 30%, 25%)' : '3px solid transparent'
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
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#34495e', marginBottom: '8px' }}>
                Legend
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'hsl(25, 5%, 60%)', borderRadius: '3px' }}></div>
                  <span style={{ fontSize: '12px', color: '#7f8c8d' }}>No data</span>
                </div>
                {(VISUALIZATION_MODES as any)[visualizationMode]?.ranges.map((range: any, index: number) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: range.color, 
                      borderRadius: '3px' 
                    }}></div>
                    <span style={{ fontSize: '12px', color: '#34495e' }}>{range.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '16px', backgroundColor: 'hsl(25, 5%, 98%)', flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#34495e', margin: '0 0 8px 0' }}>
                Actions
              </h3>
              <button
                onClick={() => deleteRegion(region._id || '', region.collection_name)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '6px',
                  color: '#c33',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fdd'
                  e.currentTarget.style.borderColor = '#fbb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee'
                  e.currentTarget.style.borderColor = '#fcc'
                }}
              >
                <Trash2 size={14} />
                Delete Region
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Map 
            blocks={blocks} 
            visualizationMode={visualizationMode} 
            foodBanks={optimizationResult?.data?.locations}
          />

          {/* Optimization Panel */}
          {showOptimization && (
            <OptimizationFloatingPanel
              result={optimizationResult}
              isOptimizing={isOptimizing}
              budget={parseFloat(optimizationBudget || lastValidBudget)}
              agentSteps={agentSteps}
              onClose={() => {
                setShowOptimization(false)
                setOptimizationResult(null)
                setAgentSteps([])
              }}
            />
          )}

          {/* Budget Input Modal */}
          {showBudgetInput && (
            <BudgetModal
              open={showBudgetInput}
              onClose={() => setShowBudgetInput(false)}
              onSubmit={(budget: number) => {
                setShowBudgetInput(false)
                setShowOptimization(true)
                setOptimizationBudget(budget.toString())
                startOptimization(budget.toString())
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
} 