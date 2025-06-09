# Food Insecurity Grid Visualization

A real-time visualization tool for food insecurity analysis cells stored in MongoDB.

## Features

- **Real-time Updates**: Auto-refresh data at configurable intervals
- **Collection Selection**: Choose from available MongoDB collections
- **Interactive Map**: Click on cells to see detailed information
- **Color-coded Visualization**: 
  - Blue: Empty cells (no data)
  - Green: Low food insecurity (0-3)
  - Yellow: Medium food insecurity (3-7)
  - Red: High food insecurity (7-10)
- **Statistics Dashboard**: View aggregate statistics for the selected collection

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Update `MONGODB_URI` with your MongoDB connection string
   - Update `TEST_DB_NAME` if using a different database name

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Select Collection**: Use the dropdown to choose which MongoDB collection to visualize
2. **Auto-refresh**: Toggle auto-refresh and set the interval (in milliseconds)
3. **View Cell Details**: Click on any cell in the map to see its information
4. **Manual Refresh**: Click "Refresh Now" to manually update the data

## Architecture

- **Frontend**: Next.js 14 with App Router, React, TypeScript
- **Styling**: Tailwind CSS for modern, responsive design
- **Map**: Leaflet for interactive map visualization
- **API**: Next.js API routes for MongoDB connectivity
- **Database**: MongoDB for storing cell data 