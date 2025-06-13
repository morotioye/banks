import Head from 'next/head'
import { useRouter } from 'next/router'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: '"Funnel Display", system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      <Head>
        <title>banks - Optimizing Food Security Through Data</title>
        <meta name="description" content="Using AI and geospatial analysis to optimize food bank locations and reduce food insecurity" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* Global gradient background */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, #fff5f0 0%, #fffaf5 25%, #fff8f3 50%, #fef6ee 75%, #fdf4e7 100%)',
        zIndex: -2
      }} />

      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(251, 146, 60, 0.1)',
        zIndex: 1000,
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            margin: 0,
            color: '#000',
            letterSpacing: '-0.02em'
          }}>
            banks
          </h1>
                      <button
              onClick={() => router.push('/app')}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(251, 146, 60, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(251, 146, 60, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 146, 60, 0.3)'
              }}
            >
              Launch App
              <ArrowRight size={16} />
            </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 40px 80px',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: 'clamp(48px, 8vw, 80px)',
            fontWeight: '800',
            lineHeight: '0.95',
            letterSpacing: '-0.03em',
            marginBottom: '32px',
            color: '#000'
          }}>
            Food security
            <br />
            <span style={{ 
              background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>optimized by data</span>
          </h2>
          
          <p style={{
            fontSize: '20px',
            lineHeight: '1.6',
            color: '#444',
            maxWidth: '600px',
            margin: '0 auto 48px',
            fontWeight: '400'
          }}>
            Leveraging Google's Gemini AI agents and geospatial analysis to determine optimal food bank locations, 
            ensuring help reaches those who need it most efficiently.
          </p>

          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => router.push('/app')}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(251, 146, 60, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(251, 146, 60, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(251, 146, 60, 0.3)'
              }}
            >
              Start Optimizing
            </button>
            
            <button
              onClick={() => document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                padding: '16px 32px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: '#ea580c',
                border: '2px solid rgba(251, 146, 60, 0.3)',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fff'
                e.currentTarget.style.borderColor = '#fb923c'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'
                e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Subtle gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at top right, rgba(251, 146, 60, 0.08) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: -1
        }} />
      </section>

      {/* Mission Section */}
      <section id="mission" style={{
        padding: '120px 40px',
        backgroundColor: 'transparent',
        position: 'relative'
      }}>
        {/* Warm gradient background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(254, 215, 170, 0.15) 0%, rgba(251, 146, 60, 0.08) 100%)',
          zIndex: -1
        }} />

        <div style={{
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#666',
            marginBottom: '24px'
          }}>
            Our Mission
          </h3>
          
          <h2 style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: '700',
            lineHeight: '1.2',
            marginBottom: '48px',
            color: '#000',
            maxWidth: '800px'
          }}>
            Every community deserves access to food assistance within reach
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '48px'
          }}>
            <div>
              <h4 style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#000'
              }}>
                Data-Driven Decisions
              </h4>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#666'
              }}>
                We analyze census data, poverty rates, and transportation access 
                to identify communities with the highest need for food assistance.
              </p>
            </div>

            <div>
              <h4 style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#000'
              }}>
                Optimal Placement
              </h4>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#666'
              }}>
                Our AI algorithms determine the best locations for food banks 
                to maximize coverage and minimize travel distance for those in need.
              </p>
            </div>

            <div>
              <h4 style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#000'
              }}>
                Budget Efficiency
              </h4>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#666'
              }}>
                We help organizations make the most of their resources by 
                optimizing location selection within budget constraints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section style={{
        padding: '120px 40px',
        backgroundColor: 'transparent',
        position: 'relative'
      }}>
        {/* Soft peach gradient */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at center, rgba(255, 237, 213, 0.3) 0%, transparent 70%)',
          zIndex: -1
        }} />

        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: '700',
            lineHeight: '1.2',
            marginBottom: '64px',
            color: '#000'
          }}>
            Making real impact
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '48px',
            marginBottom: '80px'
          }}>
            <div>
              <div style={{
                fontSize: '48px',
                fontWeight: '800',
                color: '#000',
                marginBottom: '8px'
              }}>
                42M
              </div>
              <p style={{
                fontSize: '16px',
                color: '#666'
              }}>
                Americans face food insecurity
              </p>
            </div>

            <div>
              <div style={{
                fontSize: '48px',
                fontWeight: '800',
                color: '#000',
                marginBottom: '8px'
              }}>
                13M
              </div>
              <p style={{
                fontSize: '16px',
                color: '#666'
              }}>
                Children affected by hunger
              </p>
            </div>

            <div>
              <div style={{
                fontSize: '48px',
                fontWeight: '800',
                color: '#000',
                marginBottom: '8px'
              }}>
                200+
              </div>
              <p style={{
                fontSize: '16px',
                color: '#666'
              }}>
                Food banks nationwide
              </p>
            </div>

            <div>
              <div style={{
                fontSize: '48px',
                fontWeight: '800',
                color: '#000',
                marginBottom: '8px'
              }}>
                $149B
              </div>
              <p style={{
                fontSize: '16px',
                color: '#666'
              }}>
                Annual food waste in America
              </p>
            </div>
          </div>

          <p style={{
            fontSize: '20px',
            lineHeight: '1.6',
            color: '#444',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Together, we can ensure that nutritious food is always within reach—
            no family should have to choose between gas money and groceries.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '120px 40px',
        background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
        color: '#fff',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated gradient overlay */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          right: '-50%',
          bottom: '-50%',
          background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
          animation: 'pulse 4s ease-in-out infinite',
          zIndex: 0
        }} />

        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: '700',
            lineHeight: '1.2',
            marginBottom: '24px'
          }}>
            Want to see how we can solve food insecurity in your area?
          </h2>
          
          <p style={{
            fontSize: '20px',
            lineHeight: '1.6',
            marginBottom: '48px',
            opacity: 0.8
          }}>
            Try our platform to visualize and optimize food assistance coverage.
            <br />
            <span style={{ fontSize: '16px', opacity: 0.7 }}>Currently available for California</span>
          </p>

          <button
            onClick={() => router.push('/app')}
            style={{
              padding: '16px 40px',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '17px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 255, 255, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Try It Now
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px',
        borderTop: '1px solid rgba(251, 146, 60, 0.2)',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 251, 245, 0.5)'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#92400e',
          margin: 0
        }}>
          © 2025 banks. All food reserved. 🥫
        </p>
      </footer>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  )
} 