#!/usr/bin/env python3
"""
Run food bank location optimization with streaming progress updates
"""

import sys
import json
import asyncio
import argparse
import time
from typing import Dict, Any
from datetime import datetime
import logging

# Configure logging to stderr so it doesn't interfere with stdout JSON
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

# Import the modified agent
from index import LocationOptimizationAgent, OptimizationRequest

class StreamingLocationOptimizationAgent(LocationOptimizationAgent):
    """Extended agent that streams progress updates"""
    
    def __init__(self):
        super().__init__()
        self.min_step_duration = 0.5  # Reduced from 2.0 to 0.5 seconds per step
    
    async def optimize_locations(self, request: OptimizationRequest) -> Dict[str, Any]:
        """
        Main orchestration method with streaming updates
        """
        start_time = time.time()
        
        # Send initial message
        self._send_update({
            'type': 'agent_step',
            'agent': 'Orchestrator',
            'step': 'initialization',
            'status': 'starting',
            'message': 'Initializing food bank location optimization system...',
            'input': {
                'domain': request.domain,
                'budget': request.budget,
                'max_locations': request.max_locations
            }
        })
        
        await asyncio.sleep(self.min_step_duration)
        
        try:
            # Step 1: Data Analysis Agent
            step1_start = time.time()
            self._send_update({
                'type': 'agent_step',
                'agent': 'Data Analysis Agent',
                'step': 'data_collection',
                'status': 'in_progress',
                'message': 'Analyzing population and food insecurity data for the selected domain...',
                'input': {
                    'domain': request.domain,
                    'task': 'Fetch census blocks and calculate food insecurity metrics'
                }
            })
            
            analysis_result = await self.data_analyzer.analyze_domain(request.domain)
            
            # Ensure minimum step duration
            elapsed = time.time() - step1_start
            if elapsed < self.min_step_duration:
                await asyncio.sleep(self.min_step_duration - elapsed)
            
            self._send_update({
                'type': 'agent_step',
                'agent': 'Data Analysis Agent',
                'step': 'data_collection',
                'status': 'completed',
                'message': f'Successfully analyzed {len(analysis_result["cells"])} census blocks',
                'output': {
                    'total_cells': analysis_result['statistics']['total_cells'],
                    'total_population': analysis_result['statistics']['total_population'],
                    'avg_food_insecurity': round(analysis_result['statistics']['avg_food_insecurity'], 2),
                    'high_need_cells': analysis_result['statistics']['high_need_cells']
                }
            })
            
            if not analysis_result['cells']:
                return self._create_error_result("No data found for the specified domain")
            
            await asyncio.sleep(0.5)  # Brief pause between agents
            
            # Step 2: Warehouse Optimization Agent (25% budget)
            step2_start = time.time()
            warehouse_budget = request.budget * 0.25
            self._send_update({
                'type': 'agent_step',
                'agent': 'Warehouse Optimization Agent',
                'step': 'warehouse_optimization',
                'status': 'in_progress',
                'message': 'Optimizing warehouse locations for regional distribution...',
                'input': {
                    'budget': warehouse_budget,
                    'strategy': 'quadrant-based placement'
                }
            })
            
            warehouse_result = await self.warehouse_optimizer.optimize_warehouses_simple(
                cells=analysis_result['cells'],
                budget=warehouse_budget
            )
            
            # Ensure minimum step duration
            elapsed = time.time() - step2_start
            if elapsed < self.min_step_duration:
                await asyncio.sleep(self.min_step_duration - elapsed)
            
            self._send_update({
                'type': 'agent_step',
                'agent': 'Warehouse Optimization Agent',
                'step': 'warehouse_optimization',
                'status': 'completed',
                'message': f'Identified {len(warehouse_result["warehouses"])} optimal warehouse locations',
                'output': {
                    'warehouses_found': len(warehouse_result['warehouses']),
                    'efficiency_score': round(warehouse_result['efficiency_score'], 3),
                    'coverage_percentage': round(warehouse_result['coverage_percentage'], 1),
                    'convergence_time': round(warehouse_result['convergence_time'], 2),
                    'budget_remaining': warehouse_result['budget_remaining']
                }
            })
            
            await asyncio.sleep(0.5)  # Brief pause between agents
            
            # Step 3: Food Bank Optimization within warehouse coverage
            step3_start = time.time()
            food_bank_budget = request.budget * 0.75
            self._send_update({
                'type': 'agent_step',
                'agent': 'Food Bank Optimization Agent',
                'step': 'foodbank_optimization',
                'status': 'in_progress',
                'message': 'Optimizing food bank locations within warehouse coverage areas...',
                'input': {
                    'cells_to_analyze': len(analysis_result['cells']),
                    'budget': food_bank_budget,
                    'warehouses': len(warehouse_result['warehouses']),
                    'constraints': {
                        'max_locations': request.max_locations,
                        'min_distance_miles': request.min_distance_between_banks
                    }
                }
            })
            
            optimization_result = await self.optimizer.optimize_within_warehouse_coverage(
                cells=analysis_result['cells'],
                warehouses=warehouse_result['warehouses'],
                budget=food_bank_budget,
                max_locations=request.max_locations,
                min_distance=request.min_distance_between_banks
            )
            
            # Ensure minimum step duration
            elapsed = time.time() - step3_start
            if elapsed < self.min_step_duration:
                await asyncio.sleep(self.min_step_duration - elapsed)
            
            self._send_update({
                'type': 'agent_step',
                'agent': 'Food Bank Optimization Agent',
                'step': 'foodbank_optimization',
                'status': 'completed',
                'message': f'Identified {len(optimization_result["locations"])} optimal food bank locations',
                'output': {
                    'locations_found': len(optimization_result['locations']),
                    'efficiency_score': round(optimization_result['efficiency_score'], 3),
                    'iterations': optimization_result['iterations'],
                    'convergence_time': round(optimization_result['convergence_time'], 2),
                    'budget_remaining': optimization_result['budget_remaining']
                }
            })
            
            await asyncio.sleep(0.5)  # Brief pause between agents
            
            # Step 4: Validation Agent
            step4_start = time.time()
            self._send_update({
                'type': 'agent_step',
                'agent': 'Validation Agent',
                'step': 'feasibility_validation',
                'status': 'in_progress',
                'message': 'Validating proposed locations for feasibility and coverage...',
                'input': {
                    'locations_to_validate': len(optimization_result['locations']),
                    'warehouses_to_validate': len(warehouse_result['warehouses']),
                    'budget_constraint': request.budget,
                    'coverage_analysis': True
                }
            })
            
            validation_result = await self.validator.validate(
                locations=optimization_result['locations'],
                warehouses=warehouse_result['warehouses'],
                cells=analysis_result['cells'],
                budget=request.budget
            )
            
            # Ensure minimum step duration
            elapsed = time.time() - step4_start
            if elapsed < self.min_step_duration:
                await asyncio.sleep(self.min_step_duration - elapsed)
            
            self._send_update({
                'type': 'agent_step',
                'agent': 'Validation Agent',
                'step': 'feasibility_validation',
                'status': 'completed',
                'message': f'Validation complete: {len(validation_result["validated_locations"])} locations approved',
                'output': {
                    'locations_validated': len(validation_result['validated_locations']),
                    'total_impact': validation_result['total_impact'],
                    'budget_used': validation_result['budget_used'],
                    'coverage_percentage': round(validation_result['coverage_percentage'], 1),
                    'cells_covered': validation_result['cells_covered'],
                    'adjustments_made': validation_result['adjustments_made']
                }
            })
            
            await asyncio.sleep(0.5)
            
            # Final orchestrator summary
            self._send_update({
                'type': 'agent_step',
                'agent': 'Orchestrator',
                'step': 'finalization',
                'status': 'completed',
                'message': 'Optimization complete! Compiling final results...',
                'output': {
                    'total_time': round(time.time() - start_time, 2),
                    'agents_used': 4,
                    'success': True
                }
            })
            
            # Compile and send final result
            result = {
                'status': 'success',
                'locations': [self._location_to_dict(loc) for loc in validation_result['validated_locations']],
                'warehouses': [self._warehouse_to_dict(wh) for wh in validation_result['validated_warehouses']],
                'total_people_served': validation_result['total_impact'],
                'total_budget_used': validation_result['budget_used'],
                'coverage_percentage': validation_result['coverage_percentage'],
                'optimization_metrics': {
                    'efficiency_score': optimization_result['efficiency_score'],
                    'iterations': optimization_result['iterations'],
                    'convergence_time': optimization_result['convergence_time'],
                    'warehouse_efficiency': warehouse_result['efficiency_score'],
                    'warehouse_coverage': warehouse_result['coverage_percentage'],
                    'validation_adjustments': validation_result['adjustments_made']
                },
                'timestamp': datetime.now().isoformat()
            }
            
            self._send_update({
                'type': 'result',
                'data': result
            })
            
            return result
            
        except Exception as e:
            logging.error(f"Optimization failed: {str(e)}")
            self._send_update({
                'type': 'agent_step',
                'agent': 'Orchestrator',
                'step': 'error_handling',
                'status': 'error',
                'message': f'Optimization failed: {str(e)}',
                'error': str(e)
            })
            return self._create_error_result(str(e))
    
    def _send_update(self, data: Dict[str, Any]):
        """Send a JSON update to stdout"""
        print(json.dumps(data), flush=True)
    
    def _location_to_dict(self, location) -> Dict[str, Any]:
        """Convert FoodBankLocation to dict"""
        return {
            'geoid': location.geoid,
            'lat': location.lat,
            'lon': location.lon,
            'expected_impact': location.expected_impact,
            'coverage_radius': location.coverage_radius,
            'efficiency_score': location.efficiency_score,
            'setup_cost': location.setup_cost,
            'operational_cost_monthly': location.operational_cost_monthly
        }
    
    def _warehouse_to_dict(self, warehouse) -> Dict[str, Any]:
        """Convert WarehouseLocation to dict"""
        return {
            'geoid': warehouse.geoid,
            'lat': warehouse.lat,
            'lon': warehouse.lon,
            'capacity': warehouse.capacity,
            'distribution_radius': warehouse.distribution_radius,
            'efficiency_score': warehouse.efficiency_score,
            'setup_cost': warehouse.setup_cost,
            'operational_cost_monthly': warehouse.operational_cost_monthly,
            'food_banks_served': warehouse.food_banks_served
        }
    
    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """Create an error result"""
        return {
            'status': 'error',
            'locations': [],
            'warehouses': [],
            'total_people_served': 0,
            'total_budget_used': 0,
            'coverage_percentage': 0,
            'optimization_metrics': {'error': error_message},
            'timestamp': datetime.now().isoformat()
        }

async def main():
    parser = argparse.ArgumentParser(description='Run food bank location optimization')
    parser.add_argument('--domain', required=True, help='Domain name')
    parser.add_argument('--budget', type=float, required=True, help='Budget in dollars')
    parser.add_argument('--max-locations', type=int, default=10, help='Maximum number of locations')
    parser.add_argument('--min-distance', type=float, default=0.5, help='Minimum distance between banks (miles)')
    
    args = parser.parse_args()
    
    # Create request
    request = OptimizationRequest(
        domain=args.domain,
        budget=args.budget,
        max_locations=args.max_locations,
        min_distance_between_banks=args.min_distance
    )
    
    # Run optimization with streaming
    agent = StreamingLocationOptimizationAgent()
    result = await agent.optimize_locations(request)
    
    # The result is already sent via streaming, just exit successfully
    sys.exit(0 if result['status'] == 'success' else 1)

if __name__ == '__main__':
    asyncio.run(main()) 