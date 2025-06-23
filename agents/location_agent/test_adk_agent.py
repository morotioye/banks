#!/usr/bin/env python3
"""
Test script for the ADK-based food bank location optimization agent
"""

import os
import asyncio
import logging
from dotenv import load_dotenv
from google.adk.agents import Agent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_simple_agent():
    """Test a simple ADK agent"""
    print("\n=== Testing Simple ADK Agent ===")
    
    # Create a simple test agent
    test_agent = Agent(
        name="test_agent",
        model="gemini-2.0-flash",
        instruction="You are a helpful assistant."
    )
    
    # Test the agent
    response = await test_agent.run("Hello, can you tell me about food banks?")
    print(f"Response: {response}")

async def test_adk_tools():
    """Test ADK agent with tools"""
    print("\n=== Testing ADK Agent with Tools ===")
    
    # Import our agent
    from adk_agent import analyze_domain_data, optimize_food_bank_locations
    
    # Test analyze_domain_data function directly
    print("\n1. Testing analyze_domain_data function:")
    result = analyze_domain_data("downtown_la")
    print(f"Domain analysis result: {result['status']}")
    if result['status'] == 'success':
        print(f"  - Total cells: {result['statistics']['total_cells']}")
        print(f"  - Total population: {result['statistics']['total_population']:,}")
        print(f"  - Average food insecurity: {result['statistics']['avg_food_insecurity']:.2f}")
    
    # Test optimize_food_bank_locations function
    if result['status'] == 'success' and result['cells']:
        print("\n2. Testing optimize_food_bank_locations function:")
        optimization_result = optimize_food_bank_locations(
            cells=result['cells'],
            budget=500000,
            max_locations=10
        )
        print(f"Optimization result: {optimization_result['status']}")
        if optimization_result['status'] == 'success':
            print(f"  - Locations selected: {optimization_result['location_count']}")
            print(f"  - Total impact: {optimization_result['total_impact']:,} people")
            print(f"  - Budget used: ${optimization_result['budget_used']:,.2f}")

async def test_orchestrator_agent():
    """Test the orchestrator agent"""
    print("\n=== Testing Orchestrator Agent ===")
    
    from adk_agent import orchestrator_agent
    
    # Test with a natural language query
    query = """
    I need to optimize food bank locations for downtown_la with a budget of $1,000,000.
    Please analyze the area and suggest the best locations for both warehouses and food banks.
    """
    
    print("Query:", query)
    print("\nAgent response:")
    
    response = await orchestrator_agent.run(query)
    print(response)

async def test_adk_app():
    """Test using AdkApp wrapper"""
    print("\n=== Testing AdkApp Wrapper ===")
    
    from vertexai.preview.reasoning_engines import AdkApp
    from adk_agent import root_agent
    
    # Create app
    app = AdkApp(agent=root_agent)
    
    # Create session
    session = app.create_session(user_id="test_user")
    print(f"Created session: {session.id}")
    
    # Test query
    query = "What food bank optimization capabilities do you have?"
    
    print(f"\nQuery: {query}")
    print("Streaming response:")
    
    for event in app.stream_query(
        user_id="test_user",
        session_id=session.id,
        message=query
    ):
        if 'content' in event and 'parts' in event['content']:
            for part in event['content']['parts']:
                if 'text' in part:
                    print(part['text'])

async def main():
    """Run all tests"""
    try:
        # Check if Google Cloud credentials are set
        if not os.getenv('GOOGLE_CLOUD_PROJECT'):
            print("WARNING: GOOGLE_CLOUD_PROJECT not set in environment")
            print("Please set it in your .env file or environment variables")
            return
        
        print(f"Using Google Cloud Project: {os.getenv('GOOGLE_CLOUD_PROJECT')}")
        print(f"Using location: {os.getenv('GOOGLE_CLOUD_LOCATION', 'us-central1')}")
        
        # Run tests
        await test_simple_agent()
        await test_adk_tools()
        await test_orchestrator_agent()
        await test_adk_app()
        
        print("\n=== All tests completed ===")
        
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        raise

if __name__ == '__main__':
    asyncio.run(main()) 