import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { ArrowLeft, Plus } from 'lucide-react'
import { useRouter } from 'next/router'

// Dynamic import to avoid SSR issues with Maps
const GoogleDomainSelector = dynamic(() => import('../components/GoogleDomainSelector'), { ssr: false })

export default function NewRegionPage() {
  const router = useRouter()
  
  const [creating, setCreating] = useState(false)
  const [newRegion, setNewRegion] = useState({
    name: '',
    lat: 34.0522,
    lon: -118.2437,
    radius: 2.0,
    circles: [] as Array<{ center: { lat: number; lng: number }; radius: number }>
  })

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
        // Redirect to the new region page using the returned regionId
        const regionId = data.regionId || `d_${regionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        router.push(`/${regionId}`)
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

  const handleCancel = () => {
    router.push('/app')
  }

  return (
    <div className="min-h-screen bg-stone-50 font-funnel">
      <Head>
        <title>Create New Region - banks</title>
        <meta name="description" content="Create a new region for food security analysis" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ display: 'flex', height: '100vh', fontFamily: '"Funnel Display", system-ui, sans-serif' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '320px', 
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={handleCancel}
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
                flex: 1
              }}>
                Create New Region
              </h1>
            </div>
            
            <p style={{ 
              fontSize: '14px', 
              color: '#7f8c8d', 
              margin: 0,
              lineHeight: '1.4'
            }}>
              Draw coverage areas on the map to define your region, then give it a name.
            </p>
          </div>

          {/* Region Setup Form */}
          <div style={{ padding: '20px 16px', flex: 1 }}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#34495e', 
                marginBottom: '8px' 
              }}>
                Region Name
              </label>
              <input
                type="text"
                value={newRegion.name}
                onChange={(e) => setNewRegion(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter region name (optional)"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid hsl(25, 5%, 80%)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(140, 30%, 25%)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45, 90, 45, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(25, 5%, 80%)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <p style={{ 
                fontSize: '12px', 
                color: '#7f8c8d', 
                margin: '4px 0 0 0',
                lineHeight: '1.3'
              }}>
                If left empty, a name will be generated automatically
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#34495e', 
                margin: '0 0 8px 0' 
              }}>
                Coverage Areas
              </h3>
              <p style={{ 
                fontSize: '12px', 
                color: '#7f8c8d', 
                margin: '0 0 12px 0',
                lineHeight: '1.3'
              }}>
                Click on the map to add circular coverage areas. You can add multiple areas to define your region.
              </p>
              
              <div style={{
                padding: '12px',
                backgroundColor: 'hsl(25, 5%, 98%)',
                borderRadius: '6px',
                border: '1px solid hsl(25, 5%, 90%)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>
                  Coverage Areas: {newRegion.circles.length}
                </div>
                {newRegion.circles.length === 0 ? (
                  <div style={{ fontSize: '14px', color: '#95a5a6', fontStyle: 'italic' }}>
                    No areas drawn yet
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: '#34495e', fontWeight: '500' }}>
                    {newRegion.circles.length} area{newRegion.circles.length !== 1 ? 's' : ''} defined
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div style={{
              padding: '16px',
              backgroundColor: 'hsl(140, 20%, 95%)',
              borderRadius: '8px',
              border: '1px solid hsl(140, 25%, 80%)',
              marginBottom: '24px'
            }}>
              <h4 style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                color: 'hsl(140, 30%, 25%)', 
                margin: '0 0 8px 0' 
              }}>
                How to create your region:
              </h4>
              <ol style={{ 
                fontSize: '12px', 
                color: 'hsl(140, 30%, 35%)', 
                margin: 0,
                paddingLeft: '16px',
                lineHeight: '1.4'
              }}>
                <li style={{ marginBottom: '4px' }}>Click anywhere on the map to add a coverage area</li>
                <li style={{ marginBottom: '4px' }}>Draw multiple circles to cover your desired region</li>
                <li style={{ marginBottom: '4px' }}>Optionally name your region above</li>
                <li>Click "Create Region" to finish</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              marginTop: 'auto'
            }}>
              <button
                onClick={createRegion}
                disabled={creating || newRegion.circles.length === 0}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: newRegion.circles.length > 0 ? 'hsl(140, 30%, 25%)' : 'hsl(25, 5%, 80%)',
                  color: newRegion.circles.length > 0 ? 'white' : 'hsl(25, 5%, 60%)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: newRegion.circles.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (newRegion.circles.length > 0 && !creating) {
                    e.currentTarget.style.backgroundColor = 'hsl(140, 35%, 20%)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 45, 0.25)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (newRegion.circles.length > 0 && !creating) {
                    e.currentTarget.style.backgroundColor = 'hsl(140, 30%, 25%)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {creating ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid currentColor',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Region
                  </>
                )}
              </button>
              
              <button
                onClick={handleCancel}
                disabled={creating}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: '#7f8c8d',
                  border: '1px solid hsl(25, 5%, 80%)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = 'hsl(25, 5%, 95%)'
                    e.currentTarget.style.borderColor = 'hsl(25, 5%, 70%)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'hsl(25, 5%, 80%)'
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <GoogleDomainSelector
            lat={newRegion.lat}
            lon={newRegion.lon}
            radius={newRegion.radius}
            onLocationChange={(lat, lon) => setNewRegion(prev => ({ ...prev, lat, lon }))}
            onRadiusChange={(radius) => setNewRegion(prev => ({ ...prev, radius }))}
            onCirclesChange={(circles) => setNewRegion(prev => ({ ...prev, circles }))}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
} 