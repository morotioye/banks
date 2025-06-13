import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Drumstick, MapPin, Users, TrendingUp, ArrowRight, BarChart3, Globe, Heart } from 'lucide-react'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{ fontFamily: '"Funnel Display", system-ui, -apple-system, sans-serif' }}>
      <Head>
        <title>banks - Optimizing Food Security Through Data</title>
        <meta name="description" content="Using AI and geospatial analysis to optimize food bank locations and reduce food insecurity" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid #e8eaed' : 'none',
        transition: 'all 0.3s ease',
        zIndex: 1000,
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Drumstick size={32} style={{ color: '#e67e22' }} />
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              margin: 0, 
              color: scrolled ? '#2c3e50' : 'white'
            }}>
              banks
            </h1>
          </div>
          <Link href="/app">
            <button style={{
              padding: '12px 24px',
              backgroundColor: '#74b9ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0984e3'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#74b9ff'
              e.currentTarget.style.transform = 'translateY(0)'
            }}>
              Launch App
              <ArrowRight size={18} />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.1
        }} />
        
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: '64px',
            fontWeight: '800',
            color: 'white',
            marginBottom: '24px',
            lineHeight: 1.1
          }}>
            Optimizing Food Security<br />Through Data
          </h2>
          <p style={{
            fontSize: '24px',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '48px',
            maxWidth: '800px',
            margin: '0 auto 48px'
          }}>
            Using AI-powered geospatial analysis to strategically place food banks
            where they're needed most, ensuring no one goes hungry.
          </p>
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <Link href="/app">
              <button style={{
                padding: '16px 32px',
                backgroundColor: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)'
              }}>
                Get Started
              </button>
            </Link>
            <button style={{
              padding: '16px 32px',
              backgroundColor: 'transparent',
              color: 'white',
              border: '2px solid white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(-3px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.transform = 'translateY(0)'
            }}>
              Learn More
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'bounce 2s infinite'
        }}>
          <div style={{
            width: '30px',
            height: '50px',
            border: '2px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '25px',
            position: 'relative'
          }}>
            <div style={{
              width: '4px',
              height: '10px',
              backgroundColor: 'white',
              borderRadius: '2px',
              position: 'absolute',
              top: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              animation: 'scroll 2s infinite'
            }} />
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section style={{
        padding: '120px 0',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '80px'
          }}>
            <h3 style={{
              fontSize: '48px',
              fontWeight: '700',
              color: '#2c3e50',
              marginBottom: '24px'
            }}>
              Our Mission
            </h3>
            <p style={{
              fontSize: '20px',
              color: '#7f8c8d',
              maxWidth: '800px',
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              We believe that hunger is a solvable problem. By leveraging cutting-edge AI and 
              geospatial analysis, we help communities optimize their food distribution networks 
              to ensure resources reach those who need them most.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '40px'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <MapPin size={48} style={{ color: '#74b9ff', marginBottom: '20px' }} />
              <h4 style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>
                Strategic Placement
              </h4>
              <p style={{ fontSize: '16px', color: '#7f8c8d', lineHeight: 1.6 }}>
                Our AI analyzes population density, poverty rates, and transportation access 
                to identify optimal food bank locations.
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <BarChart3 size={48} style={{ color: '#e67e22', marginBottom: '20px' }} />
              <h4 style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>
                Data-Driven Insights
              </h4>
              <p style={{ fontSize: '16px', color: '#7f8c8d', lineHeight: 1.6 }}>
                Real-time analysis of food insecurity scores, SNAP participation, and 
                demographic data guides our recommendations.
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <Heart size={48} style={{ color: '#e74c3c', marginBottom: '20px' }} />
              <h4 style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>
                Maximum Impact
              </h4>
              <p style={{ fontSize: '16px', color: '#7f8c8d', lineHeight: 1.6 }}>
                Every dollar counts. Our optimization ensures resources are allocated 
                efficiently to serve the maximum number of people.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{
        padding: '120px 0',
        background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
        color: 'white'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '60px',
            textAlign: 'center'
          }}>
            <div>
              <h3 style={{ fontSize: '56px', fontWeight: '800', marginBottom: '16px' }}>
                38M+
              </h3>
              <p style={{ fontSize: '20px', opacity: 0.9 }}>
                Americans face food insecurity
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '56px', fontWeight: '800', marginBottom: '16px' }}>
                $1M
              </h3>
              <p style={{ fontSize: '20px', opacity: 0.9 }}>
                Can serve 15,000+ people monthly
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '56px', fontWeight: '800', marginBottom: '16px' }}>
                85%
              </h3>
              <p style={{ fontSize: '20px', opacity: 0.9 }}>
                Coverage improvement possible
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '56px', fontWeight: '800', marginBottom: '16px' }}>
                3x
              </h3>
              <p style={{ fontSize: '20px', opacity: 0.9 }}>
                More efficient than traditional planning
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '120px 0',
        backgroundColor: 'white'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0 24px',
          textAlign: 'center'
        }}>
          <h3 style={{
            fontSize: '48px',
            fontWeight: '700',
            color: '#2c3e50',
            marginBottom: '24px'
          }}>
            Ready to Make a Difference?
          </h3>
          <p style={{
            fontSize: '20px',
            color: '#7f8c8d',
            marginBottom: '48px',
            lineHeight: 1.6
          }}>
            Join us in the fight against hunger. Use our platform to optimize food bank 
            placement in your community and ensure no one goes without a meal.
          </p>
          <Link href="/app">
            <button style={{
              padding: '20px 48px',
              backgroundColor: '#74b9ff',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '20px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 10px 30px rgba(116, 185, 255, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0984e3'
              e.currentTarget.style.transform = 'translateY(-3px)'
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(116, 185, 255, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#74b9ff'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(116, 185, 255, 0.3)'
            }}>
              Start Optimizing Now
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 0',
        backgroundColor: '#2c3e50',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <Drumstick size={24} style={{ color: '#e67e22' }} />
            <span style={{ fontSize: '20px', fontWeight: '600' }}>banks</span>
          </div>
          <p style={{ opacity: 0.8 }}>
            © 2024 banks. Optimizing food security through data.
          </p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          40% {
            transform: translateX(-50%) translateY(-10px);
          }
          60% {
            transform: translateX(-50%) translateY(-5px);
          }
        }

        @keyframes scroll {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(0);
          }
          40% {
            opacity: 1;
          }
          80% {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
        }
      `}</style>
    </div>
  )
} 