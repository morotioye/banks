# Food Bank Optimization System - Setup Guide

This guide will help you set up and run the food bank location optimization system with real data.

## Prerequisites

1. **Python 3.8+** installed
2. **Node.js 14+** and npm installed
3. **MongoDB** running locally or accessible remotely
4. **Git** for version control

## Quick Start

### 1. Install Python Dependencies

```bash
# Run the setup script
./setup_agents.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r agents/location_agent/requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# MongoDB Configuration
MONGO_DB_URI=mongodb://localhost:27017/
DB_NAME=testbank

# Python Path (optional)
PYTHON_PATH=python3
```

### 3. Install Web Dependencies

```bash
cd web
npm install
```

### 4. Test the Setup

```bash
# Test Python agent setup
python test_agent_setup.py

# Test domain data format
python agents/location_agent/test_domain_data.py --domain test
```

### 5. Run the Application

```bash
# Start the web server
cd web
npm run dev
```

Visit http://localhost:3000

## Using the Optimization System

1. **Select a Domain**: Choose a domain from the sidebar
2. **Start Optimization**: Click the blue play button in the header
3. **Enter Budget**: Input your optimization budget (minimum $50,000)
4. **View Results**: The system will show:
   - Optimal food bank locations
   - Expected impact (people served)
   - Budget utilization
   - Coverage percentage
   - Detailed metrics for each location

## Troubleshooting

### MongoDB Connection Issues

If you see "MongoDB connection failed":

1. Ensure MongoDB is running:
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   
   # Windows
   net start MongoDB
   ```

2. Check your MongoDB URI in `.env`

### Python Module Not Found

If you see "Agent import failed":

1. Ensure you're in the virtual environment:
   ```bash
   source venv/bin/activate
   ```

2. Reinstall dependencies:
   ```bash
   pip install -r agents/location_agent/requirements.txt
   ```

### No Domain Data

If optimization returns no results:

1. Check if domain exists:
   ```bash
   python agents/location_agent/test_domain_data.py
   ```

2. Ensure domain has food insecurity scores calculated

## Data Requirements

Each domain collection should have documents with:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], ...]]
  },
  "properties": {
    "geoid": "unique_id",
    "pop": 1234,
    "food_insecurity_score": 5.2,
    "poverty_rate": 0.15,
    "snap_rate": 0.12,
    "vehicle_access_rate": 0.85
  }
}
```

## Algorithm Details

The optimization considers:

1. **Food Insecurity Need** (50% weight)
2. **Vehicle Access** (30% weight) - Prioritizes areas with low vehicle access
3. **Poverty Rate** (20% weight)

Constraints:
- Minimum 0.5 miles between food banks
- Budget includes setup + 6 months operational costs
- Maximum 10 locations per optimization

## Development

### Running Tests

```bash
# Test agent setup
python test_agent_setup.py

# Test specific domain
python agents/location_agent/test_domain_data.py --domain downtown_la

# Run optimization manually
python agents/location_agent/run_optimization.py \
  --domain test \
  --budget 500000 \
  --max-locations 10 \
  --min-distance 0.5
```

### Debugging

1. Check API logs in the browser console
2. Check Python logs in the terminal running `npm run dev`
3. Use `test_domain_data.py` to verify data format

## Production Deployment

1. Set production environment variables
2. Use a process manager (PM2, systemd) for the Node.js server
3. Ensure MongoDB has proper authentication
4. Consider using a reverse proxy (nginx) for the web server 