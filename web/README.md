# Food Insecurity Analysis Web UI

A simple web interface for visualizing food insecurity data by domain.

## Features

- List available domains from `domain_metadata` collection
- Display census blocks from selected domain collections (d_*)
- Color-coded visualization based on food insecurity scores:
  - Blue: No data
  - Green: Low (0-3)
  - Yellow: Medium (3-7)
  - Red: High (7-10)
- Real-time updates with auto-refresh option

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```
MONGODB_URI=your_uri
DB_NAME=dbname
CENSUS_API_KEY=key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Select a domain from the sidebar
2. View the census blocks on the map with color coding
3. Click on blocks to see details
4. Enable auto-refresh to see updates as the orchestrator runs 