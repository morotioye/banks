import Head from 'next/head'
import { useRouter } from 'next/router'
import { ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-stone-50 font-funnel">
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
        background: 'linear-gradient(180deg, hsl(25, 5%, 97%) 0%, hsl(25, 5%, 95%) 25%, hsl(140, 15%, 96%) 50%, hsl(140, 20%, 94%) 75%, hsl(140, 25%, 92%) 100%)',
        zIndex: -2
      }} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-stone-200 z-50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-forest-green">banks</h1>
          <Button 
            onClick={() => router.push('/app')}
            className="bg-forest-green hover:bg-forest-green-dark text-stone-50 font-semibold px-6"
          >
            Launch App
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-7xl font-extrabold leading-tight mb-8">
            Food security
            <br />
            <span className="text-forest-green-pastel">optimized by data</span>
          </h2>
          
          <p className="text-xl text-stone-700 max-w-2xl mx-auto mb-12 leading-relaxed">
            Leveraging Google's Gemini AI agents and geospatial analysis to determine optimal food bank locations, 
            ensuring help reaches those who need it most efficiently.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/app')}
              size="lg"
              className="bg-forest-green hover:bg-forest-green-dark text-stone-50 font-bold text-lg px-8 py-6"
            >
              Start Optimizing
            </Button>
            
            <Button
              onClick={() => document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })}
              variant="outline"
              size="lg"
              className="border-2 border-forest-green text-forest-green hover:bg-forest-green hover:text-stone-50 font-bold text-lg px-8 py-6"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section id="mission" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-600 mb-4">
            Our Mission
          </h3>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-12 max-w-4xl text-forest-green">
            Every community deserves access to food assistance within reach
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h4 className="text-2xl font-bold text-forest-green-dark">
                Data-Driven Decisions
              </h4>
              <p className="text-stone-600 leading-relaxed">
                We analyze census data, poverty rates, and transportation access 
                to identify communities with the highest need for food assistance.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-2xl font-bold text-forest-green-dark">
                Optimal Placement
              </h4>
              <p className="text-stone-600 leading-relaxed">
                Our AI agents determine the best locations for food banks 
                to maximize coverage and minimize travel distance for those in need.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-2xl font-bold text-forest-green-dark">
                Budget Efficiency
              </h4>
              <p className="text-stone-600 leading-relaxed">
                We help organizations make the most of their resources by 
                optimizing location selection within budget constraints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-24 px-6 bg-stone-100">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-16 text-forest-green">
            Making real impact
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <div>
              <div className="text-5xl font-extrabold text-forest-green-dark mb-2">
                42M
              </div>
              <p className="text-stone-600">
                Americans face food insecurity
              </p>
            </div>

            <div>
              <div className="text-5xl font-extrabold text-forest-green-dark mb-2">
                13M
              </div>
              <p className="text-stone-600">
                Children affected by hunger
              </p>
            </div>

            <div>
              <div className="text-5xl font-extrabold text-forest-green-dark mb-2">
                200+
              </div>
              <p className="text-stone-600">
                Food banks nationwide
              </p>
            </div>

            <div>
              <div className="text-5xl font-extrabold text-forest-green-dark mb-2">
                $149B
              </div>
              <p className="text-stone-600">
                Annual food waste in America
              </p>
            </div>
          </div>

          <p className="text-xl text-stone-700 max-w-3xl mx-auto">
            Together, we can ensure that nutritious food is always within reach—
            no family should have to choose between gas money and groceries.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-forest-green text-stone-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Want to see how we can solve food insecurity in your area?
          </h2>
          
          <p className="text-xl mb-12 opacity-90">
            Try our platform to visualize and optimize food assistance coverage.
            <br />
            <span className="text-base opacity-80">Currently available for California</span>
          </p>

          <Button
            onClick={() => router.push('/app')}
            size="lg"
            className="bg-stone-100 hover:bg-stone-200 text-forest-green font-bold text-lg px-8 py-6"
          >
            Try It Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-stone-200 bg-white">
        <p className="text-center text-stone-600">
          © 2025 banks. All food reserved. 🥫
        </p>
      </footer>
    </div>
  )
} 