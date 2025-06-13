# 🏪 Food Bank Optimization AI Agent System

## Overview

This is a comprehensive implementation of a multi-agent AI system for optimizing food bank locations and operations using Google Cloud's Agent Development Kit (ADK). The system consists of 6 specialized agents that work together to solve the complex problem of food insecurity relief.

## 🤖 Agent Architecture

### Agent 1: Food Bank Location Optimizer
- **Input**: Array of geographic cells with population density and food insecurity scores
- **Goal**: Determine optimal food bank locations to maximize impact within budget constraints
- **Output**: Array of optimal cell locations for food banks with efficiency scores

### Agent 2: Food Supply Optimizer  
- **Input**: Cell data with population, location, and demographic information
- **Goal**: Determine optimal food supply baskets considering cultural preferences and nutritional needs
- **Output**: Basket objects containing optimal food items for each location

### Agent 3: Warehouse Location Optimizer
- **Input**: 2-mile radius of cells and array of food bank locations
- **Goal**: Determine optimal warehouse locations for food distribution based on budget
- **Output**: Array of optimal warehouse locations with capacity and cost data

### Agent 4: Distribution Route Optimizer
- **Input**: Array of food bank and warehouse locations
- **Goal**: Determine optimal routes between warehouses and food banks
- **Output**: Distribution plan with routes, schedules, and costs

### Agent 5: Impact Calculator
- **Input**: Complete system configuration (food banks, warehouses, routes)
- **Goal**: Calculate and visualize the impact of the optimized system
- **Output**: Impact metrics, coverage analysis, and heatmap improvements

### Agent 6: System Evaluator
- **Input**: Current food bank system data and proposed optimization
- **Goal**: Compare current vs optimized system performance
- **Output**: Evaluation report with improvement recommendations

## 🚀 Quick Start

### Option 1: Automated Setup and Test
```bash
python setup_and_test.py
```

This will:
1. Install all dependencies
2. Check environment configuration
3. Run the full agent system test with mock data

### Option 2: Manual Setup

1. **Install Dependencies**
```bash
pip install -r requirements.txt
```

2. **Configure Environment**
```bash
cp .env.template .env
# Edit .env file with your API keys
```

3. **Run Full Agent System**
```bash
python test_full_agent_architecture.py --domain downtown_la --budget 500000
```

## 📁 Project Structure

```
├── test_full_agent_architecture.py  # Main agent system implementation
├── setup_and_test.py               # Automated setup and testing
├── requirements.txt                # Python dependencies
├── README_AGENT_SYSTEM.md          # This documentation
├── research_findings.md            # Research on ADK implementation
├── samples/                        # Sample scripts and data
│   └── scripts/                   # Data processing scripts
└── web/                           # Web interface (optional)
```

## 🔧 Configuration

### Environment Variables (.env file)
```bash
# MongoDB Configuration
MONGO_DB_URI=mongodb://localhost:27017/
TEST_DB_NAME=food_insecurity_test

# Google Cloud APIs
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Alternative AI APIs
OPENAI_API_KEY=your_openai_api_key_here

# System Configuration
MAX_CONCURRENT_AGENTS=6
RESULT_OUTPUT_DIR=./results
```

## 📊 Sample Usage

### Basic Test Run
```bash
python test_full_agent_architecture.py --domain downtown_la --budget 500000
```

### Advanced Configuration
```bash
python test_full_agent_architecture.py \
  --domain custom_region \
  --budget 750000 \
  --create-test-domain
```

## 📈 Output Files

The system generates several output files:

1. **optimization_results_[domain]_[timestamp].json** - Complete results data
2. **optimization_report_[domain]_[timestamp].txt** - Human-readable summary report
3. **food_bank_optimization_[domain]_[timestamp].png** - Visualization charts

### Sample Report Output
```
🏪 FOOD BANK OPTIMIZATION SYSTEM - COMPREHENSIVE RESULTS
================================================================
Domain: downtown_la
Budget: $500,000.00
Analysis Date: 2024-01-15 14:30:22
================================================================

📍 AGENT 1 - OPTIMAL FOOD BANK LOCATIONS
----------------------------------------
• Optimal Locations Found: 5
• Total Expected Impact: 12,500 people
• Budget Utilized: $500,000.00

🥫 AGENT 2 - OPTIMAL FOOD SUPPLY BASKETS
-----------------------------------------
• Food Baskets Optimized: 150
• Total Supply Cost: $18,000.00
• Sample Basket Items: rice, beans, canned_vegetables, pasta
• Average Nutritional Score: 0.85

[... additional sections ...]

🎯 EXECUTIVE SUMMARY
================================================================
Total system efficiency improvement: 33.8%
Estimated people served: 12,500 monthly
================================================================
```

## 🤝 Google Cloud ADK Integration

The system is designed to work with Google Cloud's Agent Development Kit:

### Real ADK Integration
When ADK is available, agents use:
- **Agent2Agent (A2A) Protocol** for inter-agent communication
- **Gemini 2.0 Flash** as the primary reasoning model
- **Google Maps API** for geospatial analysis
- **Vertex AI** for advanced optimizations

### Mock Implementation
When ADK is not available, the system uses:
- Realistic mock implementations for each agent
- Sophisticated optimization algorithms
- Complete end-to-end testing capability

## 🏗️ Architecture Details

### Multi-Agent Orchestration
```python
# Hierarchical agent execution
Agent1 (Location) → Agent2 (Supply) → Agent3 (Warehouse) → 
Agent4 (Routes) → Agent5 (Impact) → Agent6 (Evaluation)
```

### Data Flow
1. **Domain Data Loading**: Census blocks with demographic data
2. **Sequential Agent Execution**: Each agent builds on previous results
3. **Result Aggregation**: Combined optimization results
4. **Impact Analysis**: Quantified improvements and recommendations
5. **Visualization**: Charts, maps, and reports

## 🔬 Testing and Validation

### Mock Data Testing
The system includes comprehensive mock data generation for:
- Geographic cells with realistic demographics
- Food insecurity scores based on poverty/SNAP data
- Distance calculations and route optimization
- Budget allocation and cost modeling

### Real Data Integration
When connected to real data sources:
- MongoDB collections with census block data
- Google Maps API for accurate routing
- Real-time demographic and economic indicators

## 🎯 Use Cases

### Hackathon Development
- **Rapid Prototyping**: Complete system in single script
- **Demo Ready**: Generates visualizations and reports
- **Extensible**: Easy to add new agents or modify algorithms

### Production Deployment
- **Scalable Architecture**: Supports real Google Cloud ADK
- **Data Integration**: Works with existing GIS and demographic data
- **API Ready**: Can be wrapped in REST/GraphQL APIs

### Research and Analysis
- **Algorithm Testing**: Compare different optimization approaches
- **Impact Modeling**: Quantify food insecurity interventions
- **Policy Planning**: Support evidence-based decision making

## 🛠️ Advanced Features

### Optimization Algorithms
- **Facility Location**: P-median and P-center problems
- **Supply Chain**: Multi-objective optimization
- **Route Planning**: Vehicle routing with capacity constraints
- **Budget Allocation**: Knapsack optimization variants

### Visualization
- **Interactive Maps**: Food bank and warehouse locations
- **Heatmaps**: Food insecurity reduction visualization
- **Charts**: Budget allocation, efficiency comparisons
- **Reports**: Executive summaries and detailed analysis

### Extensibility
- **Plugin Architecture**: Easy to add new agents
- **Custom Optimization**: Swap in different algorithms
- **Data Sources**: Connect to various demographic databases
- **Export Options**: Multiple output formats (JSON, CSV, PDF)

## 🤔 Troubleshooting

### Common Issues

1. **Dependencies Missing**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

2. **MongoDB Connection Failed**
   - Check `MONGO_DB_URI` in .env file
   - Ensure MongoDB is running
   - Verify database permissions

3. **API Keys Not Working**
   - Check Google Maps API key permissions
   - Verify Gemini API key is active
   - Ensure billing is enabled for Google Cloud

4. **No Domain Data Found**
   ```bash
   python test_full_agent_architecture.py --create-test-domain
   ```

### Debug Mode
```bash
export LOG_LEVEL=DEBUG
python test_full_agent_architecture.py --domain test --budget 100000
```

## 📚 Additional Resources

- [Google Cloud ADK Documentation](https://googlecloudmultiagents.devpost.com/)
- [Research Findings](./research_findings.md) - Detailed ADK analysis
- [Sample Scripts](./samples/scripts/) - Data processing utilities
- [Web Interface](./web/) - Optional visualization dashboard

## 🏆 Competition Ready

This implementation is optimized for the **Agent Development Kit Hackathon with Google Cloud**:

- ✅ **Multi-Agent Architecture**: 6 specialized agents
- ✅ **Google Cloud Integration**: ADK, Gemini, Maps API
- ✅ **Real-World Problem**: Food insecurity optimization
- ✅ **Complete Solution**: End-to-end pipeline
- ✅ **Scalable Design**: Production-ready architecture
- ✅ **Documentation**: Comprehensive guides and examples

## 📄 License

This project is developed for the Google Cloud ADK Hackathon. Please check competition rules for usage terms.

---

**Ready to revolutionize food insecurity relief with AI agents?** 🚀

Run `python setup_and_test.py` to get started!