# Food Bank Location Optimization Agent

This agent implements a hierarchical multi-agent system for optimizing food bank locations based on population density, food insecurity scores, and budget constraints.

## Architecture

The system consists of a root orchestrator agent and three specialized sub-agents:

### 1. **Data Analysis Agent**
- Analyzes population density and food insecurity data from MongoDB
- Extracts geographic cells with relevant metrics
- Calculates domain-wide statistics

### 2. **Optimization Agent**
- Determines optimal food bank locations using multi-factor scoring
- Considers:
  - Food insecurity need
  - Vehicle access rates (prioritizes areas with low vehicle access)
  - Poverty rates
  - Population density
- Enforces constraints:
  - Budget limitations
  - Minimum distance between food banks
  - Maximum number of locations

### 3. **Validation Agent**
- Validates feasibility of proposed locations
- Ensures budget compliance
- Calculates coverage metrics
- Makes adjustments if needed

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env`:
```
MONGO_DB_URI=mongodb://localhost:27017/
DB_NAME=testbank
```

## Usage

### Direct Python Usage

```python
from index import LocationOptimizationAgent, OptimizationRequest

# Initialize agent
agent = LocationOptimizationAgent()

# Create optimization request
request = OptimizationRequest(
    domain="downtown_la",
    budget=500000,
    max_locations=10,
    min_distance_between_banks=0.5
)

# Run optimization
result = await agent.optimize_locations(request)
```

### API Usage

The agent is designed to be called from the Next.js API endpoint:

```bash
python run_optimization.py --domain downtown_la --budget 500000
```

## Output Format

The optimization returns:
- List of optimal food bank locations with coordinates
- Expected impact (people served)
- Efficiency scores
- Setup and operational costs
- Coverage percentage
- Optimization metrics

## Algorithm Details

The optimization uses a greedy algorithm with multi-factor scoring:

1. **Efficiency Score Calculation**:
   - 50% weight: Food insecurity need
   - 30% weight: Low vehicle access (accessibility factor)
   - 20% weight: Poverty rate

2. **Cost Estimation**:
   - Setup cost: $50,000 base + $10 per capita
   - Operational cost: $5,000 base + $2 per capita monthly

3. **Constraints**:
   - Minimum 0.5 miles between food banks
   - Budget includes setup + 6 months operational costs
   - Maximum 10 locations per optimization 