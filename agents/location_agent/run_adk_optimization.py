#!/usr/bin/env python3
"""
Runner script for ADK-based food bank location optimization
"""

import os
import sys
import json
import asyncio
import argparse
import logging
from vertexai.preview.reasoning_engines import AdkApp

# Add the agent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from adk_agent import root_agent, orchestrator_agent, run_optimization

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

async def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', required=True, help='Domain to optimize')
    parser.add_argument('--budget', type=float, required=True, help='Budget for optimization')
    parser.add_argument('--max-locations', type=int, default=1000, help='Maximum number of locations')
    parser.add_argument('--use-app', action='store_true', help='Use AdkApp wrapper for deployment compatibility')
    
    args = parser.parse_args()
    
    try:
        if args.use_app:
            # Use AdkApp wrapper (for deployment to Agent Engine)
            app = AdkApp(agent=root_agent)
            
            # Create a session
            session = app.create_session(user_id="optimization_user")
            
            # Run optimization query
            query = f"""
            Please optimize food bank locations for domain '{args.domain}' with a budget of ${args.budget:,.2f}.
            
            Requirements:
            - Maximum {args.max_locations} food bank locations  
            - Minimum 0.3 miles between food banks
            - Allocate 25% of budget for warehouses, 75% for food banks
            - Focus on areas with highest food insecurity and lowest vehicle access
            
            Please analyze the domain data first, then optimize warehouse and food bank locations.
            """
            
            # Stream the response
            full_response = {
                'status': 'success',
                'messages': [],
                'results': None
            }
            
            for event in app.stream_query(
                user_id="optimization_user",
                session_id=session.id,
                message=query
            ):
                if 'content' in event and 'parts' in event['content']:
                    for part in event['content']['parts']:
                        if 'text' in part:
                            full_response['messages'].append(part['text'])
                        elif 'function_call' in part:
                            # Track function calls
                            func_call = part['function_call']
                            full_response['messages'].append(f"Calling function: {func_call.get('name', 'unknown')}")
                        elif 'function_response' in part:
                            # Track function responses
                            func_response = part['function_response']
                            if 'response' in func_response:
                                full_response['results'] = func_response['response']
            
            # Output the full response as JSON
            print(json.dumps(full_response, indent=2))
            
        else:
            # Direct agent call (simpler, for testing)
            result = await run_optimization(
                domain=args.domain,
                budget=args.budget,
                max_locations=args.max_locations
            )
            
            # Output JSON result
            print(json.dumps(result, indent=2))
            
    except Exception as e:
        # Output error as JSON
        error_result = {
            'status': 'error',
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main()) 