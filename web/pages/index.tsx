import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'

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

export default function Home() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [calculatingScores, setCalculatingScores] = useState<string | null>(null)
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

  // Create new domain
  const createDomain = async () => {
    if (!newDomain.name.trim()) {
      alert('Please enter a domain name')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/create-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDomain)
      })

      const data = await response.json()
      
      if (response.ok) {
        setShowCreateForm(false)
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

  // Calculate food insecurity scores
  const calculateScores = async (collection: string) => {
    setCalculatingScores(collection)
    try {
      const response = await fetch('/api/calculate-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection })
      })

      const data = await response.json()
      
      if (response.ok) {
        alert('Food insecurity scores calculated successfully!')
        // Refresh blocks if this is the selected domain
        if (selectedDomain === collection) {
          fetchBlocks(collection)
        }
      } else {
        alert(data.error || 'Failed to calculate scores')
      }
    } catch (error) {
      console.error('Error calculating scores:', error)
      alert('Failed to calculate scores')
    } finally {
      setCalculatingScores(null)
    }
  }

  // Initial load
  useEffect(() => {
    fetchDomains()
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchDomains()
      if (selectedDomain) {
        fetchBlocks(selectedDomain)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh, selectedDomain])

  // Fetch blocks when domain is selected
  useEffect(() => {
    if (selectedDomain) {
      fetchBlocks(selectedDomain)
    } else {
      setBlocks([])
    }
  }, [selectedDomain])

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Head>
        <title>Food Insecurity Analysis</title>
        <meta name="description" content="Domain-based food insecurity visualization" />
      </Head>

      {/* Sidebar */}
      <div style={{ 
        width: '320px', 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
            Food Insecurity Analysis
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            Domain-based visualization
          </p>
        </div>

        {/* Domain List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: 0 }}>
              Available Domains
            </h2>
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              + New Domain
            </button>
          </div>
          
          {domains.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', marginTop: '32px' }}>
              No domains found
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {domains.map((domain) => (
                <div
                  key={domain._id}
                  onClick={() => setSelectedDomain(domain.collection_name)}
                  style={{
                    padding: '12px',
                    backgroundColor: selectedDomain === domain.collection_name ? '#dbeafe' : 'white',
                    border: `1px solid ${selectedDomain === domain.collection_name ? '#60a5fa' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: '#1f2937' }}>
                      {domain.name}
                    </h3>
                    {domain.center && domain.center.coordinates ? (
                      <>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                          {domain.center.coordinates[1].toFixed(4)}, {domain.center.coordinates[0].toFixed(4)}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>
                          {domain.radius_miles} mile radius • {domain.total_blocks} blocks
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                        Collection: {domain.collection_name}
                      </p>
                    )}
                  </div>
                  {selectedDomain === domain.collection_name && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        calculateScores(domain.collection_name)
                      }}
                      disabled={calculatingScores === domain.collection_name}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: calculatingScores === domain.collection_name ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: calculatingScores === domain.collection_name ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => !calculatingScores && (e.currentTarget.style.backgroundColor = '#059669')}
                      onMouseLeave={(e) => !calculatingScores && (e.currentTarget.style.backgroundColor = '#10b981')}
                    >
                      {calculatingScores === domain.collection_name ? 'Calculating...' : 'Calculate Scores'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span style={{ fontSize: '14px', color: '#374151' }}>Auto-refresh (5s)</span>
          </label>
          
          <button
            onClick={() => {
              fetchDomains()
              if (selectedDomain) fetchBlocks(selectedDomain)
            }}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '8px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {selectedDomain ? (
          <>
            <Map blocks={blocks} />
            
            {/* Legend */}
            <div style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              fontSize: '14px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Food Insecurity Score
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#60A5FA', borderRadius: '2px' }}></div>
                  <span>No data</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#34D399', borderRadius: '2px' }}></div>
                  <span>Low (0-3)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#FBBF24', borderRadius: '2px' }}></div>
                  <span>Medium (3-7)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#F87171', borderRadius: '2px' }}></div>
                  <span>High (7-10)</span>
                </div>
              </div>
            </div>

            {/* Loading indicator */}
            {loading && (
              <div style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                backgroundColor: 'white',
                padding: '12px 16px',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontSize: '14px',
                color: '#6b7280'
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
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>No domain selected</p>
              <p style={{ fontSize: '14px' }}>Select a domain from the sidebar to view blocks</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Domain Modal */}
      {showCreateForm && (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '0',
            width: '700px',
            maxWidth: '90%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(to right, #f9fafb, #f3f4f6)'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#111827' }}>
                Create New Domain
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                Define a geographic area for food insecurity analysis
              </p>
            </div>
            
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                Domain Name
              </label>
              <input
                type="text"
                value={newDomain.name}
                onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                placeholder="e.g., Downtown LA"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                Select Location and Radius
              </label>
              <DomainSelector
                lat={newDomain.lat}
                lon={newDomain.lon}
                radius={newDomain.radius}
                onLocationChange={(lat, lon) => setNewDomain({ ...newDomain, lat, lon })}
                onRadiusChange={(radius) => setNewDomain({ ...newDomain, radius })}
              />
            </div>

            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                📍 Selected Location
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
                <div>
                  <span style={{ color: '#9ca3af' }}>Latitude:</span> {newDomain.lat.toFixed(4)}°
                </div>
                <div>
                  <span style={{ color: '#9ca3af' }}>Longitude:</span> {newDomain.lon.toFixed(4)}°
                </div>
                <div>
                  <span style={{ color: '#9ca3af' }}>Radius:</span> {newDomain.radius} miles
                </div>
                <div>
                  <span style={{ color: '#9ca3af' }}>Area:</span> ~{(Math.PI * newDomain.radius * newDomain.radius).toFixed(1)} sq mi
                </div>
              </div>
            </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              padding: '24px 32px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}>
              <button
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                  e.currentTarget.style.borderColor = '#9ca3af'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createDomain}
                disabled={creating}
                style={{
                  flex: 1,
                  padding: '10px 24px',
                  backgroundColor: creating ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: creating ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = '#2563eb'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = '#3b82f6'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }
                }}
              >
                {creating ? 'Creating Domain...' : 'Create Domain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 