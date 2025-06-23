#!/usr/bin/env python3
"""
Streaming runner script for ADK-based food bank location optimization
Outputs real-time agent messages for UI display
"""

import os
import sys
import json
import asyncio
import argparse
import logging
import time
from typing import Dict, Any
from datetime import datetime

# Add the agent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

try:
    from adk_agent import root_agent, orchestrator_agent, analyze_domain_data, optimize_food_bank_locations, optimize_warehouse_locations
    logger.info("Successfully imported ADK agent modules")
except ImportError as e:
    logger.error(f"Import error: {str(e)}")
    print(json.dumps({
        'type': 'error',
        'error': f'Failed to import required modules: {str(e)}'
    }), flush=True)
    sys.exit(1)

def emit_message(msg_type: str, content: Dict[str, Any]):
    """Emit a JSON message to stdout for streaming"""
    message = {
        'type': msg_type,
        'timestamp': datetime.now().isoformat(),
        **content
    }
    message_str = json.dumps(message)
    print(message_str, flush=True)
    sys.stdout.flush()  # Extra flush to ensure message is sent
    logger.info(f"Emitted message: {msg_type} - {content.get('content', content.get('phase', content.get('function', 'N/A')))}")

async def stream_optimization(domain: str, budget: float, max_locations: int = 1000):
    """Run optimization with streaming output using direct function calls"""
    
    logger.info(f"Starting stream optimization for domain: {domain}, budget: ${budget:,.2f}")
    emit_message('phase', {'phase': 'Starting optimization process...'})
    emit_message('agent_message', {'content': f'Initializing optimization for {domain} with budget ${budget:,.2f}'})
    
    # Add a small delay to ensure messages are sent
    await asyncio.sleep(0.1)
    
    try:
        # Step 1: Analyze domain data
        logger.info("Step 1: Starting domain analysis")
        emit_message('agent_message', {'content': f'Step 1: Analyzing domain data for {domain}...'})
        emit_message('function_call', {
            'function': 'analyze_domain_data',
            'args': {'domain': domain}
        })
        
        # Add delay to ensure message is sent
        await asyncio.sleep(0.1)
        
        start_time = time.time()
        analysis_result = analyze_domain_data(domain)
        analysis_time = time.time() - start_time
        logger.info(f"Domain analysis completed in {analysis_time:.2f}s with status: {analysis_result.get('status')}")
        
        emit_message('function_result', {
            'function': 'analyze_domain_data',
            'result': {
                'status': analysis_result.get('status', 'unknown'),
                'summary': extract_summary('analyze_domain_data', analysis_result)
            }
        })
        
        if analysis_result.get('status') != 'success' or not analysis_result.get('cells'):
            error_msg = analysis_result.get('message', 'Failed to analyze domain data')
            logger.error(f"Domain analysis failed: {error_msg}")
            emit_message('error', {'error': error_msg})
            emit_message('agent_message', {'content': f'Error: {error_msg}'})
            
            # Send error result
            error_result = {
                'status': 'error',
                'error': error_msg,
                'locations': [],
                'warehouses': [],
                'total_people_served': 0,
                'total_budget_used': 0,
                'coverage_percentage': 0,
                'optimization_metrics': {},
                'timestamp': datetime.now().isoformat()
            }
            
            print('FINAL_RESULT_START', flush=True)
            print(json.dumps(error_result), flush=True)
            print('FINAL_RESULT_END', flush=True)
            return
        
        cells_count = len(analysis_result['cells'])
        stats = analysis_result.get('statistics', {})
        logger.info(f"Domain has {cells_count} cells with {stats.get('total_population', 0):,} population")
        emit_message('agent_message', {'content': f'Found {cells_count} cells with {stats.get("total_population", 0):,} total population'})
        
        # Step 2: Optimize warehouse locations (25% of budget)
        warehouse_budget = budget * 0.25
        logger.info(f"Step 2: Starting warehouse optimization with budget ${warehouse_budget:,.2f}")
        emit_message('phase', {'phase': 'Optimizing warehouse locations...'})
        emit_message('agent_message', {'content': f'Step 2: Optimizing warehouse locations with ${warehouse_budget:,.0f} budget (25% of total)...'})
        emit_message('function_call', {
            'function': 'optimize_warehouse_locations',
            'args': {'cells': cells_count, 'budget': warehouse_budget}
        })
        
        await asyncio.sleep(0.1)
        
        start_time = time.time()
        warehouse_result = optimize_warehouse_locations(
            cells=analysis_result['cells'],
            budget=warehouse_budget
        )
        warehouse_time = time.time() - start_time
        logger.info(f"Warehouse optimization completed in {warehouse_time:.2f}s with status: {warehouse_result.get('status')}")
        
        emit_message('function_result', {
            'function': 'optimize_warehouse_locations',
            'result': {
                'status': warehouse_result.get('status', 'unknown'),
                'summary': extract_summary('optimize_warehouse_locations', warehouse_result)
            }
        })
        
        warehouses_count = len(warehouse_result.get('warehouses', []))
        emit_message('agent_message', {'content': f'Selected {warehouses_count} warehouse locations'})
        
        # Step 3: Optimize food bank locations (75% of budget)
        foodbank_budget = budget * 0.75
        logger.info(f"Step 3: Starting food bank optimization with budget ${foodbank_budget:,.2f}")
        emit_message('phase', {'phase': 'Optimizing food bank locations...'})
        emit_message('agent_message', {'content': f'Step 3: Optimizing food bank locations with ${foodbank_budget:,.0f} budget (75% of total)...'})
        emit_message('function_call', {
            'function': 'optimize_food_bank_locations',
            'args': {
                'cells': cells_count,
                'budget': foodbank_budget,
                'max_locations': max_locations,
                'min_distance': 0.3
            }
        })
        
        await asyncio.sleep(0.1)
        
        start_time = time.time()
        foodbank_result = optimize_food_bank_locations(
            cells=analysis_result['cells'],
            budget=foodbank_budget,
            max_locations=max_locations,
            min_distance=0.3
        )
        foodbank_time = time.time() - start_time
        logger.info(f"Food bank optimization completed in {foodbank_time:.2f}s with status: {foodbank_result.get('status')}")
        
        emit_message('function_result', {
            'function': 'optimize_food_bank_locations',
            'result': {
                'status': foodbank_result.get('status', 'unknown'),
                'summary': extract_summary('optimize_food_bank_locations', foodbank_result)
            }
        })
        
        foodbanks_count = foodbank_result.get('location_count', 0)
        people_served = foodbank_result.get('total_impact', 0)
        emit_message('agent_message', {'content': f'Selected {foodbanks_count} food bank locations serving {people_served:,} people'})
        
        # Compile final results
        logger.info("Compiling final results")
        emit_message('phase', {'phase': 'Compiling results...'})
        emit_message('agent_message', {'content': 'Optimization complete! Compiling final results...'})
        
        await asyncio.sleep(0.1)
        
        final_result = compile_results({
            'analyze_domain_data': analysis_result,
            'optimize_warehouse_locations': warehouse_result,
            'optimize_food_bank_locations': foodbank_result
        }, domain, budget)
        
        logger.info(f"Final result: {foodbanks_count} food banks, {warehouses_count} warehouses, {people_served:,} people served")
        
        # Add summary message
        emit_message('agent_message', {
            'content': f'✅ Optimization complete! Selected {foodbanks_count} food banks and {warehouses_count} warehouses to serve {people_served:,} people with ${final_result["total_budget_used"]:,.2f} budget'
        })
        
        # Calculate how long the optimization took
        total_time = time.time() - start_program_time
        
        # Add a delay to ensure users can read the messages
        # Delay for the difference between 10 seconds and actual time, or at least 2 seconds
        delay_time = max(2.0, 10.0 - total_time)
        logger.info(f"Optimization took {total_time:.2f}s, delaying {delay_time:.2f}s before showing results")
        
        emit_message('agent_message', {
            'content': f'⏳ Preparing final results... (showing in {delay_time:.0f} seconds)'
        })
        
        await asyncio.sleep(delay_time)
        
        # Send final result
        logger.info("Sending final result")
        print('FINAL_RESULT_START', flush=True)
        print(json.dumps(final_result), flush=True)
        print('FINAL_RESULT_END', flush=True)
        logger.info("Final result sent")
        
    except Exception as e:
        logger.error(f"Optimization failed: {str(e)}", exc_info=True)
        emit_message('error', {'error': str(e)})
        emit_message('agent_message', {'content': f'❌ Error: {str(e)}'})
        
        # Send error result
        error_result = {
            'status': 'error',
            'error': str(e),
            'locations': [],
            'warehouses': [],
            'total_people_served': 0,
            'total_budget_used': 0,
            'coverage_percentage': 0,
            'optimization_metrics': {},
            'timestamp': datetime.now().isoformat()
        }
        
        print('FINAL_RESULT_START', flush=True)
        print(json.dumps(error_result), flush=True)
        print('FINAL_RESULT_END', flush=True)

def extract_summary(func_name: str, result: Dict[str, Any]) -> str:
    """Extract a summary from function results"""
    if func_name == 'analyze_domain_data':
        if result.get('status') == 'success':
            stats = result.get('statistics', {})
            return f"Analyzed {stats.get('total_cells', 0)} cells with {stats.get('total_population', 0):,} total population"
        else:
            return result.get('message', 'Analysis failed')
            
    elif func_name == 'optimize_warehouse_locations':
        if result.get('status') == 'success':
            warehouses = result.get('warehouses', [])
            return f"Selected {len(warehouses)} warehouse locations"
        else:
            return result.get('message', 'Warehouse optimization failed')
            
    elif func_name == 'optimize_food_bank_locations':
        if result.get('status') == 'success':
            return f"Selected {result.get('location_count', 0)} food bank locations serving {result.get('total_impact', 0):,} people"
        else:
            return result.get('message', 'Food bank optimization failed')
            
    return 'Completed'

def compile_results(function_results: Dict[str, Any], domain: str, budget: float) -> Dict[str, Any]:
    """Compile function results into final optimization result"""
    
    # Extract results from each function
    analysis = function_results.get('analyze_domain_data', {})
    warehouse_result = function_results.get('optimize_warehouse_locations', {})
    foodbank_result = function_results.get('optimize_food_bank_locations', {})
    
    # Calculate totals
    total_people_served = foodbank_result.get('total_impact', 0)
    warehouse_budget = warehouse_result.get('budget_used', 0)
    foodbank_budget = foodbank_result.get('budget_used', 0)
    total_budget_used = warehouse_budget + foodbank_budget
    
    # Calculate coverage (simplified)
    total_population = analysis.get('statistics', {}).get('total_population', 1)
    coverage_percentage = (total_people_served / total_population * 100) if total_population > 0 else 0
    
    # Calculate total time
    total_time = time.time() - start_program_time if 'start_program_time' in globals() else 5.0
    
    return {
        'status': 'success',
        'locations': foodbank_result.get('locations', []),
        'warehouses': warehouse_result.get('warehouses', []),
        'total_people_served': total_people_served,
        'total_budget_used': total_budget_used,
        'coverage_percentage': min(coverage_percentage, 100),
        'optimization_metrics': {
            'efficiency_score': 0.85,  # Default efficiency
            'warehouse_efficiency': 0.90,
            'iterations': 1,
            'convergence_time': total_time,
            'total_cells_analyzed': analysis.get('statistics', {}).get('total_cells', 0),
            'high_need_cells': analysis.get('statistics', {}).get('high_need_cells', 0),
            'validation_adjustments': 0
        },
        'timestamp': datetime.now().isoformat()
    }

# Global start time
start_program_time = time.time()

async def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', required=True, help='Domain to optimize')
    parser.add_argument('--budget', type=float, required=True, help='Budget for optimization')
    parser.add_argument('--max-locations', type=int, default=1000, help='Maximum number of locations')
    parser.add_argument('--stream', action='store_true', help='Enable streaming mode')
    
    args = parser.parse_args()
    
    logger.info(f"Starting ADK optimization stream with args: {args}")
    
    # Run streaming optimization
    await stream_optimization(
        domain=args.domain,
        budget=args.budget,
        max_locations=args.max_locations
    )

if __name__ == '__main__':
    asyncio.run(main()) 