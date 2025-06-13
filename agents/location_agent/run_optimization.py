#!/usr/bin/env python3
"""
Runner script for food bank location optimization
Outputs JSON results to stdout for API consumption
"""

import os
import sys
import json
import asyncio
import argparse
import logging
from dataclasses import asdict

# Add the agent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from index import LocationOptimizationAgent, OptimizationRequest

# Configure logging to stderr so it doesn't interfere with JSON output
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
    parser.add_argument('--max-locations', type=int, default=10, help='Maximum number of locations')
    parser.add_argument('--min-distance', type=float, default=0.5, help='Minimum distance between banks (miles)')
    
    args = parser.parse_args()
    
    try:
        # Create optimization request
        request = OptimizationRequest(
            domain=args.domain,
            budget=args.budget,
            max_locations=args.max_locations,
            min_distance_between_banks=args.min_distance
        )
        
        # Initialize agent and run optimization
        agent = LocationOptimizationAgent()
        result = await agent.optimize_locations(request)
        
        # Convert result to JSON-serializable format
        result_dict = {
            'status': result.status,
            'locations': [asdict(loc) for loc in result.locations],
            'total_people_served': result.total_people_served,
            'total_budget_used': result.total_budget_used,
            'coverage_percentage': result.coverage_percentage,
            'optimization_metrics': result.optimization_metrics,
            'timestamp': result.timestamp
        }
        
        # Output JSON to stdout
        print(json.dumps(result_dict))
        
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