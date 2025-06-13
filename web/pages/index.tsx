import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { Drumstick, ChevronDown, Trash2 } from 'lucide-react'

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import('../components/Map'), { ssr: false })
const DomainSelector = dynamic(() => import('../components/DomainSelector'), { ssr: false })

interface Domain {
  _id?: string
  collection_name: string
  name: string
  center?: {
    coordinates: [number, number]
  }
  radius_miles?: number
  total_blocks?: number
  created_at?: string
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
  const [domains, setDomains] = useState<Domain[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visualizationMode, setVisualizationMode] = useState<string>('food_insecurity_score')
  const [creating, setCreating] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCreatingDomain, setIsCreatingDomain] = useState(false)
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null)
  // Note: calculatingScores state removed - no longer needed
  const [newDomain, setNewDomain] = useState({
    name: '',
    lat: 34.0522,
    lon: -118.2437,
    radius: 2.0
  })

  // Fetch domains
  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/domains')
      const data = await response.json()
      setDomains(data.domains || [])
    } catch (error) {
      console.error('Error fetching domains:', error)
    }
  }

  // Fetch blocks for selected domain
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

  // Delete domain
  const deleteDomain = async (domainId: string, collectionName: string) => {
    try {
      const response = await fetch('/api/delete-domain', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domainId: domainId,
          collectionName: collectionName
        })
      })

      if (response.ok) {
        // Clear selection if deleted domain was selected
        if (selectedDomain === collectionName) {
          setSelectedDomain('')
        }
        // Refresh domains list
        fetchDomains()
      } else {
        const data = await response.json()
        console.error('Failed to delete domain:', data.error)
      }
    } catch (error) {
      console.error('Error deleting domain:', error)
    }
  }

  // Create new domain
  const createDomain = async () => {
    // Auto-generate name if empty
    const domainName = newDomain.name.trim() || `Domain_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}Z`

    setCreating(true)
    try {
      const response = await fetch('/api/create-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newDomain, name: domainName })
      })

      const data = await response.json()
      
      if (response.ok) {
        setIsCreatingDomain(false)
        setNewDomain({ name: '', lat: 34.0522, lon: -118.2437, radius: 2.0 })
        // Refresh domains after a short delay
        setTimeout(() => fetchDomains(), 2000)
      } else {
        alert(data.error || 'Failed to create domain')
      }
    } catch (error) {
      console.error('Error creating domain:', error)
      alert('Failed to create domain')
    } finally {
      setCreating(false)
    }
  }

  // Note: Score calculation is now done during census block collection
  // No need for on-demand score calculation anymore

  // Initial load
  useEffect(() => {
    fetchDomains()
  }, [])

  // Fetch blocks when domain is selected
  useEffect(() => {
    if (selectedDomain) {
      fetchBlocks(selectedDomain)
    } else {
      setBlocks([])
    }
  }, [selectedDomain])

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
          backgroundColor: '#fafbfc', 
          borderRight: '1px solid #e8eaed',
          display: 'flex',
          flexDirection: 'column'
        }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e8eaed', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Drumstick size={28} style={{ color: '#e67e22' }} />
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#2c3e50', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
              banks
            </h1>
          </div>
        </div>

        {/* Visualization Mode Selector */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e8eaed', backgroundColor: '#ffffff' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#34495e', margin: '0 0 8px 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
            Heatmap Overlay Layer
          </h3>
          <div className="custom-dropdown" style={{ position: 'relative', width: '180px' }}>
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${isDropdownOpen ? '#74b9ff' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isDropdownOpen ? '0 0 0 3px rgba(116, 185, 255, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
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
                 border: '1px solid #e8eaed',
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
                       backgroundColor: visualizationMode === key ? '#ecf8ff' : 'transparent',
                       cursor: 'pointer',
                       transition: 'all 0.15s ease',
                       fontWeight: visualizationMode === key ? '500' : '400',
                       borderLeft: visualizationMode === key ? '3px solid #74b9ff' : '3px solid transparent',
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
                <div style={{ width: '12px', height: '12px', backgroundColor: '#74b9ff', borderRadius: '3px' }}></div>
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

        {/* Domain List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px', backgroundColor: '#fafbfc' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', margin: 0, fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
              Recent Domains
            </h2>
            <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '4px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
              Showing 3 most recent
            </p>
          </div>
          
          {domains.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ 
                textAlign: 'center', 
                marginTop: '48px',
                padding: '32px 16px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e8eaed'
              }}>
                <p style={{ color: '#95a5a6', fontSize: '14px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                                  No domains found
              </p>
              </div>
              
              {/* New Domain Button */}
              <button
                onClick={() => {
                  setSelectedDomain('')
                  setIsCreatingDomain(true)
                }}
                style={{
                  padding: '16px',
                  backgroundColor: '#e8f4fd',
                  border: '2px dashed #74b9ff',
                  borderRadius: '12px',
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
                  e.currentTarget.style.backgroundColor = '#d6f0ff'
                  e.currentTarget.style.borderColor = '#0984e3'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(116, 185, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e8f4fd'
                  e.currentTarget.style.borderColor = '#74b9ff'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#74b9ff',
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
                    Create New Domain
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    Define a new geographic area
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {domains
                .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                .slice(0, 3)
                .map((domain) => (
                <div
                  key={domain._id}
                  style={{
                    padding: '16px',
                    backgroundColor: selectedDomain === domain.collection_name ? '#ecf8ff' : 'white',
                    border: `2px solid ${selectedDomain === domain.collection_name ? '#74b9ff' : '#e8eaed'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: selectedDomain === domain.collection_name 
                      ? '0 4px 12px rgba(116, 185, 255, 0.15)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.04)',
                    transform: selectedDomain === domain.collection_name ? 'translateY(-1px)' : 'translateY(0)',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    setHoveredDomain(domain._id || '')
                    if (selectedDomain !== domain.collection_name) {
                      e.currentTarget.style.backgroundColor = '#f8f9fc'
                      e.currentTarget.style.borderColor = '#c3d9ff'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    setHoveredDomain(null)
                    if (selectedDomain !== domain.collection_name) {
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.borderColor = '#e8eaed'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <div 
                    style={{ flex: 1 }}
                    onClick={() => setSelectedDomain(domain.collection_name)}
                  >
                    <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#2c3e50', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                      {domain.name}
                    </h3>
                    {domain.center && domain.center.coordinates ? (
                      <>
                        <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '6px 0 2px 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                          📍 {domain.center.coordinates[1].toFixed(4)}, {domain.center.coordinates[0].toFixed(4)}
                        </p>
                        <p style={{ fontSize: '12px', color: '#95a5a6', margin: '2px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                          🎯 {domain.radius_miles} mile radius • {domain.total_blocks} blocks
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '6px 0 0 0', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                        {domain.collection_name.replace(/^d_/, '')}
                      </p>
                    )}
                  </div>

                  {/* Trash Icon - appears on hover */}
                  {hoveredDomain === domain._id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteDomain(domain._id || '', domain.collection_name)
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

                  {selectedDomain === domain.collection_name && (
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: '#74b9ff'
                    }}></div>
                  )}
                </div>
              ))}
              
              {/* New Domain Button */}
              <button
                onClick={() => {
                  setSelectedDomain('')
                  setIsCreatingDomain(true)
                }}
                style={{
                  padding: '16px',
                  backgroundColor: '#e8f4fd',
                  border: '2px dashed #74b9ff',
                  borderRadius: '12px',
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
                  e.currentTarget.style.backgroundColor = '#d6f0ff'
                  e.currentTarget.style.borderColor = '#0984e3'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(116, 185, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e8f4fd'
                  e.currentTarget.style.borderColor = '#74b9ff'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#74b9ff',
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
                    Create New Domain
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

      {/* Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {isCreatingDomain ? (
          /* Domain Creation Interface */
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#fafbfc',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header with Domain Name */}
            <div style={{
              padding: '20px 32px',
              borderBottom: '1px solid #e8eaed',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={newDomain.name}
                  onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                  placeholder="Domain name (auto-generated if empty)"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e8eaed',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: '600',
                    outline: 'none',
                    fontFamily: '"Funnel Display", system-ui, sans-serif',
                    transition: 'border-color 0.2s ease',
                    color: '#2c3e50'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#74b9ff'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e8eaed'}
                />
              </div>
            </div>
            
            {/* Controls and Map Layout */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '20px' }}>
              
              {/* Top Controls Row */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                
                {/* Radius Selector */}
                <div style={{ 
                  flex: 1,
                  backgroundColor: '#ffffff', 
                  padding: '20px', 
                  borderRadius: '12px',
                  border: '1px solid #e8eaed',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginBottom: '12px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                    🎯 Domain Radius
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#7f8c8d', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                      Coverage Area
                    </span>
                    <div style={{
                      backgroundColor: '#74b9ff',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      fontFamily: '"Funnel Display", system-ui, sans-serif'
                    }}>
                      {newDomain.radius} miles
                    </div>
                  </div>
                  
                  <input
                    type="range"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={newDomain.radius}
                    onChange={(e) => setNewDomain({ ...newDomain, radius: parseFloat(e.target.value) })}
                    style={{ 
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      background: `linear-gradient(to right, #74b9ff 0%, #74b9ff ${(newDomain.radius - 0.5) / 49.5 * 100}%, #e8eaed ${(newDomain.radius - 0.5) / 49.5 * 100}%, #e8eaed 100%)`,
                      outline: 'none',
                      WebkitAppearance: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#95a5a6',
                    fontFamily: '"Funnel Display", system-ui, sans-serif'
                  }}>
                    <span>0.5 mi</span>
                    <span>25 mi</span>
                    <span>50 mi</span>
                  </div>
                </div>

                {/* Location Data Card */}
                <div style={{ 
                  width: '280px',
                  backgroundColor: '#ffffff', 
                  padding: '20px', 
                  borderRadius: '12px',
                  border: '1px solid #e8eaed',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                    📍 Selected Location
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#95a5a6' }}>Latitude:</span> 
                      <span style={{ color: '#2c3e50', fontWeight: '500' }}>{newDomain.lat.toFixed(4)}°</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#95a5a6' }}>Longitude:</span> 
                      <span style={{ color: '#2c3e50', fontWeight: '500' }}>{newDomain.lon.toFixed(4)}°</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#95a5a6' }}>Radius:</span> 
                      <span style={{ color: '#2c3e50', fontWeight: '500' }}>{newDomain.radius} miles</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#95a5a6' }}>Area:</span> 
                      <span style={{ color: '#2c3e50', fontWeight: '500' }}>~{(Math.PI * newDomain.radius * newDomain.radius).toFixed(1)} sq mi</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Large Map Area */}
              <div style={{ 
                flex: 1, 
                backgroundColor: '#ffffff', 
                borderRadius: '12px',
                border: '1px solid #e8eaed',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}>
                <DomainSelector
                  lat={newDomain.lat}
                  lon={newDomain.lon}
                  radius={newDomain.radius}
                  onLocationChange={(lat, lon) => setNewDomain({ ...newDomain, lat, lon })}
                  onRadiusChange={(radius) => setNewDomain({ ...newDomain, radius })}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{
              padding: '24px 32px',
              borderTop: '1px solid #e8eaed',
              backgroundColor: '#ffffff',
              display: 'flex',
              gap: '16px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setIsCreatingDomain(false)
                  setNewDomain({ name: '', lat: 34.0522, lon: -118.2437, radius: 2.0 })
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#34495e',
                  border: '2px solid #e8eaed',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: '"Funnel Display", system-ui, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fc'
                  e.currentTarget.style.borderColor = '#c3d9ff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                  e.currentTarget.style.borderColor = '#e8eaed'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createDomain}
                disabled={creating}
                style={{
                  padding: '12px 32px',
                  backgroundColor: creating ? '#95a5a6' : '#74b9ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: creating ? 'none' : '0 4px 12px rgba(116, 185, 255, 0.2)',
                  fontFamily: '"Funnel Display", system-ui, sans-serif'
                }}
                onMouseEnter={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = '#0984e3'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(116, 185, 255, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = '#74b9ff'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(116, 185, 255, 0.2)'
                  }
                }}
              >
                {creating ? 'Creating Domain...' : 'Create Domain'}
              </button>
            </div>
          </div>
        ) : selectedDomain ? (
          <>
            <Map blocks={blocks} visualizationMode={visualizationMode} />

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
              <p style={{ fontSize: '18px', marginBottom: '8px', fontFamily: '"Funnel Display", system-ui, sans-serif', fontWeight: '600', color: '#34495e' }}>No domain selected</p>
              <p style={{ fontSize: '14px', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>Select a domain from the sidebar to view blocks</p>
            </div>
          </div>
        )}
      </div>


    </div>
  )
} 