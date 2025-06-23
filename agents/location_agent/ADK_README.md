# Food Bank Location Optimization with Google ADK

This implementation uses Google's Agent Development Kit (ADK) to create an intelligent multi-agent system for optimizing food bank locations.

## Architecture

The ADK implementation includes:

1. **Orchestrator Agent** - Coordinates the optimization process
2. **Data Analysis Agent** - Analyzes geographic and demographic data
3. **Location Optimization Agent** - Optimizes food bank and warehouse placement
4. **Root Agent** - Main system agent that can delegate to sub-agents

## Key Features

- **Natural Language Interface**: Use conversational queries to optimize locations
- **Tool Integration**: Agents can call functions to analyze data and optimize locations
- **Session Management**: Track conversations and maintain context
- **Streaming Responses**: Real-time feedback during optimization
- **Multi-Agent Coordination**: Specialized agents work together

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `env.template` to `.env` and fill in your credentials:

```bash
cp env.template .env
```

Required variables:
- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID
- `GOOGLE_CLOUD_LOCATION`: Region (e.g., us-central1)
- `MONGO_DB_URI`: MongoDB connection string
- `DB_NAME`: Database name

### 3. Authenticate with Google Cloud

```bash
gcloud auth application-default login
```

## Usage

### Command Line Interface

Run optimization directly:

```bash
python run_adk_optimization.py --domain downtown_la --budget 1000000
```

With AdkApp wrapper (for deployment):

```bash
python run_adk_optimization.py --domain downtown_la --budget 1000000 --use-app
```

### Interactive ADK Web UI

From the parent directory:

```bash
cd ../..  # Go to parent of agents folder
adk web
```

Then select `location_agent` in the web UI.

### Testing

Run the test suite:

```bash
python test_adk_agent.py
```

### API Integration

The agent can be called from the Next.js API:

```javascript
const response = await fetch('/api/optimize-locations-adk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'downtown_la',
    budget: 1000000,
    useApp: true  // Use AdkApp wrapper
  })
});
```

## Agent Capabilities

### Natural Language Queries

The agents understand queries like:
- "Optimize food banks for downtown LA with $1M budget"
- "Find the best locations for 5 food banks in this area"
- "Where should we place warehouses to serve these neighborhoods?"

### Tool Functions

1. **analyze_domain_data(domain)**
   - Analyzes population and food insecurity data
   - Returns cells with demographics and statistics

2. **optimize_food_bank_locations(cells, budget, max_locations, min_distance)**
   - Optimizes food bank placement
   - Considers need, distance constraints, and budget

3. **optimize_warehouse_locations(cells, budget)**
   - Determines optimal warehouse locations
   - Maximizes distribution efficiency

## Deployment

### Local Development

The agent runs locally with in-memory sessions:

```bash
python run_adk_optimization.py --domain test --budget 500000
```

### Google Cloud Deployment

Deploy to Vertex AI Agent Engine:

```bash
# Build and deploy (from ADK documentation)
gcloud builds submit --config cloudbuild.yaml
```

### Integration with Existing System

The ADK agent can work alongside your existing optimization system:

1. Use the same MongoDB database
2. Return results in compatible format
3. Share the same API endpoints

## Advanced Features

### Multi-Agent Coordination

```python
# The root agent can delegate to specialized agents
root_agent = Agent(
    name="food_bank_system",
    agents=[data_analysis_agent, location_optimization_agent],
    tools=[analyze_domain_data, optimize_food_bank_locations]
)
```

### Session Management

```python
# Create and use sessions
app = AdkApp(agent=root_agent)
session = app.create_session(user_id="user123")

# Continue conversation
for event in app.stream_query(
    user_id="user123",
    session_id=session.id,
    message="What about areas with low vehicle access?"
):
    # Process streaming response
```

### Safety Settings

```python
# Configure content safety
safety_settings = [
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=types.HarmBlockThreshold.OFF,
    ),
]
```

## Troubleshooting

### Common Issues

1. **Authentication Error**
   ```bash
   gcloud auth application-default login
   ```

2. **Module Not Found**
   ```bash
   pip install google-adk google-cloud-aiplatform[agent_engines,adk]
   ```

3. **MongoDB Connection**
   - Ensure MongoDB is running
   - Check connection string in .env

4. **API Key vs Vertex AI**
   - Set `GOOGLE_GENAI_USE_VERTEXAI=True` for Vertex AI
   - Set `GOOGLE_GENAI_USE_VERTEXAI=False` for API key

## Benefits of ADK

1. **Conversational Interface**: Natural language queries instead of structured API calls
2. **Intelligent Orchestration**: Agents decide how to fulfill requests
3. **Built-in Memory**: Sessions maintain context across queries
4. **Streaming Responses**: Real-time feedback during processing
5. **Google Integration**: Seamless use of Gemini models and Google Cloud services
6. **Deployment Ready**: Easy deployment to Vertex AI Agent Engine

## Next Steps

1. Customize agent instructions for your specific needs
2. Add more specialized sub-agents
3. Integrate with additional Google Cloud services
4. Deploy to production with Vertex AI Agent Engine
5. Add custom tools for specific optimization strategies 