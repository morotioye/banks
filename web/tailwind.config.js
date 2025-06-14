/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Funnel Display"',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			],
  			funnel: [
  				'Funnel Display"',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			]
  		},
  		colors: {
  			'forest-green': {
  				DEFAULT: 'hsl(140, 30%, 25%)', // Dark pastel forest green
  				light: 'hsl(140, 25%, 35%)',
  				dark: 'hsl(140, 35%, 20%)',
  				pastel: 'hsl(140, 20%, 40%)', // More pastel version
  			},
  			'stone': {
  				DEFAULT: 'hsl(25, 5%, 45%)', // Shadcn stone
  				50: 'hsl(25, 5%, 95%)',
  				100: 'hsl(25, 5%, 90%)',
  				200: 'hsl(25, 5%, 80%)',
  				300: 'hsl(25, 5%, 70%)',
  				400: 'hsl(25, 5%, 60%)',
  				500: 'hsl(25, 5%, 45%)',
  				600: 'hsl(25, 5%, 35%)',
  				700: 'hsl(25, 5%, 25%)',
  				800: 'hsl(25, 5%, 15%)',
  				900: 'hsl(25, 5%, 10%)',
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-foreground': 'hsl(0, 0%, 0%)',
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			'secondary-foreground': 'hsl(0, 0%, 9%)',
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			'accent-foreground': 'hsl(0, 0%, 0%)',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		animation: {
  			'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} 