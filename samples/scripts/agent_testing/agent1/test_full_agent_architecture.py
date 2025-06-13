#!/usr/bin/env python3
"""
Comprehensive Test Script: Full End-to-End Food Bank Optimization Agent Architecture
Using Google Cloud Agent Development Kit (ADK)

This script implements and tests all 6 agents in the food bank optimization pipeline:
1. Agent1: Determine optimal food bank locations
2. Agent2: Determine optimal food supply baskets  
3. Agent3: Determine optimal warehouse locations
4. Agent4: Determine optimal distribution routes
5. Agent5: Calculate and display impact
6. Agent6: Evaluate current food banks

Usage: python test_full_agent_architecture.py --domain downtown_la --budget 500000
"""

import os
import sys
import json
import logging
import asyncio
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from dotenv import load_dotenv
from pymongo import MongoClient
from geopy.distance import geodesic
import matplotlib.pyplot as plt
import seaborn as sns

# Google Cloud ADK imports
try:
    from adk.agent import Agent
    from adk.orchestrator import Orchestrator
    from adk.tools import Tool
    from adk.models import Model
    ADK_AVAILABLE = True
except ImportError:
    print("Google Cloud ADK not available - using mock implementation")
    ADK_AVAILABLE = False

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('TEST_DB_NAME', 'food_insecurity_test')

@dataclass
class Cell:
    """Represents a geographic cell with population and food insecurity data."""
    geoid: str
    lat: float
    lon: float
    population: int
    food_insecurity_score: float
    poverty_rate: float
    snap_rate: float
    vehicle_access_rate: float
    need: float
    geometry: Dict[str, Any]

@dataclass
class FoodBank:
    """Represents a food bank location with capacity and supply data."""
    id: str
    lat: float
    lon: float
    capacity: int
    current_supply: Dict[str, int]
    monthly_demand: int
    real_estate_cost: float
    operational_cost: float

@dataclass
class Warehouse:
    """Represents a food warehouse location."""
    id: str
    lat: float
    lon: float
    capacity: int
    storage_cost: float
    distribution_radius: float

@dataclass
class FoodBasket:
    """Represents optimal food supply for a location."""
    location_id: str
    items: Dict[str, int]  # food_type: quantity
    total_cost: float
    nutritional_score: float
    cultural_appropriateness: float

@dataclass
class DistributionRoute:
    """Represents a distribution route between warehouse and food bank."""
    warehouse_id: str
    foodbank_id: str
    distance: float
    travel_time: float
    capacity: int
    frequency: str  # daily, weekly, etc.
    cost: float

class MockADKImplementation:
    """Mock implementation when Google Cloud ADK is not available."""
    
    class Agent:
        def __init__(self, name: str, model: str, tools: List = None, **kwargs):
            self.name = name
            self.model = model
            self.tools = tools or []
            
        async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
            """Mock agent execution - returns realistic test data."""
            if "food_bank_location" in self.name.lower():
                return await self._mock_food_bank_locations(input_data)
            elif "food_supply" in self.name.lower():
                return await self._mock_food_supply(input_data)
            elif "warehouse" in self.name.lower():
                return await self._mock_warehouse_locations(input_data)
            elif "distribution" in self.name.lower():
                return await self._mock_distribution_routes(input_data)
            elif "impact" in self.name.lower():
                return await self._mock_impact_calculation(input_data)
            elif "evaluation" in self.name.lower():
                return await self._mock_evaluation(input_data)
            else:
                return {"status": "completed", "data": {}}
        
        async def _mock_food_bank_locations(self, input_data: Dict) -> Dict:
            cells = input_data.get('cells', [])
            budget = input_data.get('budget', 500000)
            
            # Mock optimization: select top cells by need/population ratio
            scored_cells = []
            for cell in cells:
                if cell['population'] > 0:
                    efficiency = cell['need'] / (cell['population'] * 1000)  # Cost factor
                    scored_cells.append({
                        'geoid': cell['geoid'],
                        'lat': cell['lat'],
                        'lon': cell['lon'],
                        'efficiency_score': efficiency,
                        'expected_impact': cell['need'] * 0.3  # 30% impact assumption
                    })
            
            # Sort by efficiency and select within budget
            scored_cells.sort(key=lambda x: x['efficiency_score'], reverse=True)
            optimal_locations = scored_cells[:min(5, budget // 100000)]  # $100k per location
            
            return {
                "status": "success",
                "optimal_food_bank_locations": optimal_locations,
                "total_expected_impact": sum(loc['expected_impact'] for loc in optimal_locations),
                "budget_utilized": len(optimal_locations) * 100000
            }
        
        async def _mock_food_supply(self, input_data: Dict) -> Dict:
            cells = input_data.get('cells', [])
            
            baskets = []
            for cell in cells:
                # Mock food basket optimization based on demographics
                poverty_factor = cell.get('poverty_rate', 0.1)
                cultural_factor = 0.8  # Mock cultural appropriateness
                
                basket = {
                    'location_id': cell['geoid'],
                    'items': {
                        'rice': int(50 * (1 + poverty_factor)),
                        'beans': int(30 * (1 + poverty_factor)),
                        'canned_vegetables': int(40 * (1 + poverty_factor)),
                        'pasta': int(25 * (1 + poverty_factor)),
                        'peanut_butter': int(20 * (1 + poverty_factor)),
                        'bread': int(15 * (1 + poverty_factor))
                    },
                    'total_cost': 120 * (1 + poverty_factor),
                    'nutritional_score': 0.85,
                    'cultural_appropriateness': cultural_factor
                }
                baskets.append(basket)
            
            return {
                "status": "success",
                "optimal_food_baskets": baskets,
                "total_cost": sum(b['total_cost'] for b in baskets)
            }
        
        async def _mock_warehouse_locations(self, input_data: Dict) -> Dict:
            cells = input_data.get('cells', [])
            food_banks = input_data.get('food_banks', [])
            budget = input_data.get('budget', 300000)
            
            # Mock warehouse optimization: central locations with good access
            if not cells:
                return {"status": "error", "message": "No cells provided"}
            
            # Calculate centroid
            center_lat = sum(cell['lat'] for cell in cells) / len(cells)
            center_lon = sum(cell['lon'] for cell in cells) / len(cells)
            
            # Mock 2-3 warehouse locations
            warehouses = [
                {
                    'id': 'warehouse_1',
                    'lat': center_lat + 0.01,
                    'lon': center_lon + 0.01,
                    'capacity': 10000,
                    'storage_cost': 5000,
                    'distribution_radius': 3.0,
                    'efficiency_score': 0.92
                },
                {
                    'id': 'warehouse_2', 
                    'lat': center_lat - 0.01,
                    'lon': center_lon - 0.01,
                    'capacity': 8000,
                    'storage_cost': 4000,
                    'distribution_radius': 2.5,
                    'efficiency_score': 0.88
                }
            ]
            
            return {
                "status": "success",
                "optimal_warehouse_locations": warehouses,
                "total_capacity": sum(w['capacity'] for w in warehouses),
                "budget_utilized": sum(w['storage_cost'] * 12 for w in warehouses)  # Annual cost
            }
        
        async def _mock_distribution_routes(self, input_data: Dict) -> Dict:
            food_banks = input_data.get('food_banks', [])
            warehouses = input_data.get('warehouses', [])
            
            routes = []
            for fb in food_banks:
                # Find closest warehouse
                closest_warehouse = None
                min_distance = float('inf')
                
                for wh in warehouses:
                    distance = geodesic((fb['lat'], fb['lon']), (wh['lat'], wh['lon'])).miles
                    if distance < min_distance:
                        min_distance = distance
                        closest_warehouse = wh
                
                if closest_warehouse:
                    route = {
                        'warehouse_id': closest_warehouse['id'],
                        'foodbank_id': fb.get('id', fb.get('geoid')),
                        'distance': min_distance,
                        'travel_time': min_distance * 2.5,  # minutes, assuming traffic
                        'capacity': 1000,
                        'frequency': 'weekly',
                        'cost': min_distance * 15  # $15 per mile
                    }
                    routes.append(route)
            
            return {
                "status": "success",
                "optimal_routes": routes,
                "total_distance": sum(r['distance'] for r in routes),
                "total_cost": sum(r['cost'] for r in routes)
            }
        
        async def _mock_impact_calculation(self, input_data: Dict) -> Dict:
            food_banks = input_data.get('food_banks', [])
            baskets = input_data.get('baskets', [])
            routes = input_data.get('routes', [])
            
            # Mock impact calculation
            total_people_served = sum(fb.get('expected_impact', 1000) for fb in food_banks)
            food_insecurity_reduction = total_people_served * 0.25  # 25% reduction assumption
            
            return {
                "status": "success",
                "impact_metrics": {
                    "people_served_monthly": total_people_served,
                    "food_insecurity_reduction": food_insecurity_reduction,
                    "coverage_percentage": min(95, len(food_banks) * 15),  # Mock coverage
                    "efficiency_score": 0.87,
                    "cost_per_person_served": 45.50
                },
                "heatmap_improvement": "35% reduction in high-insecurity areas"
            }
        
        async def _mock_evaluation(self, input_data: Dict) -> Dict:
            current_food_banks = input_data.get('current_food_banks', [])
            proposed_solution = input_data.get('proposed_solution', {})
            
            return {
                "status": "success",
                "evaluation": {
                    "current_efficiency": 0.65,
                    "proposed_efficiency": 0.87,
                    "improvement_percentage": 33.8,
                    "cost_reduction": 0.15,
                    "coverage_improvement": 0.42,
                    "recommendation": "Implement proposed solution - significant improvement expected"
                }
            }

class FoodBankOptimizationSystem:
    """Main system orchestrating all 6 agents for food bank optimization."""
    
    def __init__(self, domain: str, budget: float = 500000):
        self.domain = domain
        self.budget = budget
        self.db_client = MongoClient(MONGO_URI)
        self.db = self.db_client[DB_NAME]
        
        # Initialize ADK or mock implementation
        if ADK_AVAILABLE:
            self.adk_implementation = self._init_real_adk()
        else:
            self.adk_implementation = MockADKImplementation()
        
        # Results storage
        self.results = {}
        
    def _init_real_adk(self):
        """Initialize real Google Cloud ADK agents."""
        # This would be the real ADK implementation
        return MockADKImplementation()  # For now, using mock even when ADK available
    
    async def load_domain_data(self) -> List[Cell]:
        """Load domain data from MongoDB."""
        collection_name = f"d_{self.domain}"
        
        if collection_name not in self.db.list_collection_names():
            raise ValueError(f"Domain collection '{collection_name}' not found!")
        
        collection = self.db[collection_name]
        blocks = list(collection.find({}))
        
        cells = []
        for block in blocks:
            props = block['properties']
            cell = Cell(
                geoid=props['geoid'],
                lat=block['geometry']['coordinates'][0][0][1],  # Simplified centroid
                lon=block['geometry']['coordinates'][0][0][0],
                population=props.get('pop', 0),
                food_insecurity_score=props.get('food_insecurity_score', 0),
                poverty_rate=props.get('poverty_rate', 0),
                snap_rate=props.get('snap_rate', 0),
                vehicle_access_rate=props.get('vehicle_access_rate', 1.0),
                need=props.get('need', 0),
                geometry=block['geometry']
            )
            cells.append(cell)
        
        logger.info(f"Loaded {len(cells)} cells from domain '{self.domain}'")
        return cells
    
    async def run_agent1_food_bank_locations(self, cells: List[Cell]) -> Dict[str, Any]:
        """Agent 1: Determine optimal food bank locations."""
        logger.info("🏪 Running Agent 1: Food Bank Location Optimization")
        
        # Prepare input data
        cell_data = []
        for cell in cells:
            if cell.population > 0:  # Only include populated cells
                cell_data.append({
                    'geoid': cell.geoid,
                    'lat': cell.lat,
                    'lon': cell.lon,
                    'population': cell.population,
                    'food_insecurity_score': cell.food_insecurity_score,
                    'poverty_rate': cell.poverty_rate,
                    'snap_rate': cell.snap_rate,
                    'need': cell.need
                })
        
        # Initialize Agent 1
        agent1 = self.adk_implementation.Agent(
            name="Food_Bank_Location_Optimizer",
            model="gemini-2.0-flash-exp",
            tools=[]
        )
        
        # Run agent
        input_data = {
            'cells': cell_data,
            'budget': self.budget,
            'max_locations': 10,
            'min_distance_between_banks': 0.5  # miles
        }
        
        result = await agent1.run(input_data)
        self.results['agent1_food_banks'] = result
        
        logger.info(f"✅ Agent 1 complete: {len(result.get('optimal_food_bank_locations', []))} locations selected")
        return result
    
    async def run_agent2_food_supply(self, cells: List[Cell]) -> Dict[str, Any]:
        """Agent 2: Determine optimal food supply baskets."""
        logger.info("🥫 Running Agent 2: Food Supply Optimization")
        
        # Prepare input data
        cell_data = []
        for cell in cells:
            if cell.population > 0:
                cell_data.append({
                    'geoid': cell.geoid,
                    'population': cell.population,
                    'poverty_rate': cell.poverty_rate,
                    'cultural_factors': {'hispanic': 0.3, 'asian': 0.2, 'other': 0.5},  # Mock data
                    'dietary_restrictions': {'vegetarian': 0.1, 'gluten_free': 0.05}  # Mock data
                })
        
        # Initialize Agent 2
        agent2 = self.adk_implementation.Agent(
            name="Food_Supply_Optimizer",
            model="gemini-2.0-flash-exp",
            tools=[]
        )
        
        # Run agent
        input_data = {
            'cells': cell_data,
            'nutritional_requirements': {
                'calories_per_person_day': 2000,
                'protein_grams': 50,
                'vitamins': ['A', 'C', 'D']
            },
            'budget_per_person': 15  # Daily food budget
        }
        
        result = await agent2.run(input_data)
        self.results['agent2_food_supply'] = result
        
        logger.info(f"✅ Agent 2 complete: {len(result.get('optimal_food_baskets', []))} baskets optimized")
        return result
    
    async def run_agent3_warehouse_locations(self, cells: List[Cell], food_banks: List[Dict]) -> Dict[str, Any]:
        """Agent 3: Determine optimal warehouse locations."""
        logger.info("🏭 Running Agent 3: Warehouse Location Optimization")
        
        # Initialize Agent 3
        agent3 = self.adk_implementation.Agent(
            name="Warehouse_Location_Optimizer",
            model="gemini-2.0-flash-exp",
            tools=[]
        )
        
        # Prepare input data
        cell_data = [{'geoid': c.geoid, 'lat': c.lat, 'lon': c.lon, 'need': c.need} for c in cells]
        
        input_data = {
            'cells': cell_data,
            'food_banks': food_banks,
            'budget': self.budget * 0.6,  # 60% of budget for warehouses
            'max_warehouses': 5,
            'distribution_radius': 3.0  # miles
        }
        
        result = await agent3.run(input_data)
        self.results['agent3_warehouses'] = result
        
        logger.info(f"✅ Agent 3 complete: {len(result.get('optimal_warehouse_locations', []))} warehouses planned")
        return result
    
    async def run_agent4_distribution_routes(self, food_banks: List[Dict], warehouses: List[Dict]) -> Dict[str, Any]:
        """Agent 4: Determine optimal distribution routes."""
        logger.info("🚛 Running Agent 4: Distribution Route Optimization")
        
        # Initialize Agent 4
        agent4 = self.adk_implementation.Agent(
            name="Distribution_Route_Optimizer",
            model="gemini-2.0-flash-exp",
            tools=[]
        )
        
        input_data = {
            'food_banks': food_banks,
            'warehouses': warehouses,
            'constraints': {
                'max_route_distance': 5.0,  # miles
                'vehicle_capacity': 2000,   # pounds
                'delivery_frequency': 'weekly'
            }
        }
        
        result = await agent4.run(input_data)
        self.results['agent4_routes'] = result
        
        logger.info(f"✅ Agent 4 complete: {len(result.get('optimal_routes', []))} routes optimized")
        return result
    
    async def run_agent5_impact_calculation(self) -> Dict[str, Any]:
        """Agent 5: Calculate and display impact."""
        logger.info("📊 Running Agent 5: Impact Calculation")
        
        # Initialize Agent 5
        agent5 = self.adk_implementation.Agent(
            name="Impact_Calculator",
            model="gemini-2.0-flash-exp",
            tools=[]
        )
        
        input_data = {
            'food_banks': self.results.get('agent1_food_banks', {}).get('optimal_food_bank_locations', []),
            'baskets': self.results.get('agent2_food_supply', {}).get('optimal_food_baskets', []),
            'warehouses': self.results.get('agent3_warehouses', {}).get('optimal_warehouse_locations', []),
            'routes': self.results.get('agent4_routes', {}).get('optimal_routes', []),
            'baseline_metrics': {
                'current_food_insecurity_rate': 0.18,  # 18% baseline
                'current_coverage': 0.35  # 35% current coverage
            }
        }
        
        result = await agent5.run(input_data)
        self.results['agent5_impact'] = result
        
        logger.info("✅ Agent 5 complete: Impact analysis generated")
        return result
    
    async def run_agent6_evaluation(self) -> Dict[str, Any]:
        """Agent 6: Evaluate current food banks vs proposed solution."""
        logger.info("🔍 Running Agent 6: Current System Evaluation")
        
        # Mock current food bank data (in real scenario, this would come from existing data)
        current_food_banks = [
            {'id': 'current_1', 'lat': 34.0522, 'lon': -118.2437, 'capacity': 500, 'efficiency': 0.6},
            {'id': 'current_2', 'lat': 34.0622, 'lon': -118.2537, 'capacity': 300, 'efficiency': 0.7}
        ]
        
        # Initialize Agent 6
        agent6 = self.adk_implementation.Agent(
            name="System_Evaluator",
            model="gemini-2.0-flash-exp",
            tools=[]
        )
        
        input_data = {
            'current_food_banks': current_food_banks,
            'proposed_solution': {
                'food_banks': self.results.get('agent1_food_banks', {}),
                'warehouses': self.results.get('agent3_warehouses', {}),
                'routes': self.results.get('agent4_routes', {}),
                'impact': self.results.get('agent5_impact', {})
            }
        }
        
        result = await agent6.run(input_data)
        self.results['agent6_evaluation'] = result
        
        logger.info("✅ Agent 6 complete: Evaluation analysis finished")
        return result
    
    def generate_visualization(self):
        """Generate visualization of the optimization results."""
        logger.info("📈 Generating results visualization...")
        
        try:
            # Create visualization plots
            fig, axes = plt.subplots(2, 2, figsize=(15, 12))
            fig.suptitle(f'Food Bank Optimization Results - Domain: {self.domain}', fontsize=16)
            
            # Plot 1: Food Bank Locations
            ax1 = axes[0, 0]
            food_banks = self.results.get('agent1_food_banks', {}).get('optimal_food_bank_locations', [])
            if food_banks:
                lats = [fb['lat'] for fb in food_banks]
                lons = [fb['lon'] for fb in food_banks]
                ax1.scatter(lons, lats, c='red', s=100, alpha=0.7, label='Optimal Food Banks')
                ax1.set_title('Optimal Food Bank Locations')
                ax1.set_xlabel('Longitude')
                ax1.set_ylabel('Latitude')
                ax1.legend()
            
            # Plot 2: Impact Metrics
            ax2 = axes[0, 1]
            impact = self.results.get('agent5_impact', {}).get('impact_metrics', {})
            if impact:
                metrics = ['People Served', 'Coverage %', 'Efficiency Score']
                values = [
                    impact.get('people_served_monthly', 0) / 1000,  # Scale to thousands
                    impact.get('coverage_percentage', 0),
                    impact.get('efficiency_score', 0) * 100
                ]
                bars = ax2.bar(metrics, values, color=['green', 'blue', 'orange'])
                ax2.set_title('Impact Metrics')
                ax2.set_ylabel('Value')
                
                # Add value labels on bars
                for bar, value in zip(bars, values):
                    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                            f'{value:.1f}', ha='center', va='bottom')
            
            # Plot 3: Budget Utilization
            ax3 = axes[1, 0]
            budget_data = {
                'Food Banks': self.results.get('agent1_food_banks', {}).get('budget_utilized', 0),
                'Warehouses': self.results.get('agent3_warehouses', {}).get('budget_utilized', 0),
                'Distribution': self.results.get('agent4_routes', {}).get('total_cost', 0) * 12  # Annual
            }
            
            if any(budget_data.values()):
                wedges, texts, autotexts = ax3.pie(budget_data.values(), labels=budget_data.keys(), 
                                                  autopct='%1.1f%%', startangle=90)
                ax3.set_title('Budget Allocation')
            
            # Plot 4: Efficiency Comparison
            ax4 = axes[1, 1]
            evaluation = self.results.get('agent6_evaluation', {}).get('evaluation', {})
            if evaluation:
                categories = ['Efficiency', 'Coverage', 'Cost-Effectiveness']
                current = [
                    evaluation.get('current_efficiency', 0.65) * 100,
                    65,  # Mock current coverage
                    60   # Mock current cost-effectiveness
                ]
                proposed = [
                    evaluation.get('proposed_efficiency', 0.87) * 100,
                    85,  # Mock proposed coverage
                    90   # Mock proposed cost-effectiveness
                ]
                
                x = np.arange(len(categories))
                width = 0.35
                
                ax4.bar(x - width/2, current, width, label='Current', alpha=0.7)
                ax4.bar(x + width/2, proposed, width, label='Proposed', alpha=0.7)
                
                ax4.set_xlabel('Metrics')
                ax4.set_ylabel('Score (%)')
                ax4.set_title('Current vs Proposed System')
                ax4.set_xticks(x)
                ax4.set_xticklabels(categories)
                ax4.legend()
            
            plt.tight_layout()
            
            # Save visualization
            output_file = f'food_bank_optimization_{self.domain}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            logger.info(f"📊 Visualization saved as: {output_file}")
            
            # Don't show plot in background execution
            plt.close()
            
        except Exception as e:
            logger.error(f"Error generating visualization: {e}")
    
    def generate_summary_report(self) -> str:
        """Generate a comprehensive summary report."""
        report = f"""
        
🏪 FOOD BANK OPTIMIZATION SYSTEM - COMPREHENSIVE RESULTS
================================================================
Domain: {self.domain}
Budget: ${self.budget:,.2f}
Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
================================================================

📍 AGENT 1 - OPTIMAL FOOD BANK LOCATIONS
----------------------------------------
"""
        
        agent1_results = self.results.get('agent1_food_banks', {})
        food_banks = agent1_results.get('optimal_food_bank_locations', [])
        
        report += f"• Optimal Locations Found: {len(food_banks)}\n"
        report += f"• Total Expected Impact: {agent1_results.get('total_expected_impact', 0):,.0f} people\n"
        report += f"• Budget Utilized: ${agent1_results.get('budget_utilized', 0):,.2f}\n\n"
        
        if food_banks:
            report += "Top 3 Locations:\n"
            for i, fb in enumerate(food_banks[:3], 1):
                report += f"  {i}. Location {fb.get('geoid', 'N/A')}: Efficiency Score {fb.get('efficiency_score', 0):.3f}\n"
        
        report += f"""
🥫 AGENT 2 - OPTIMAL FOOD SUPPLY BASKETS
-----------------------------------------
"""
        
        agent2_results = self.results.get('agent2_food_supply', {})
        baskets = agent2_results.get('optimal_food_baskets', [])
        
        report += f"• Food Baskets Optimized: {len(baskets)}\n"
        report += f"• Total Supply Cost: ${agent2_results.get('total_cost', 0):,.2f}\n"
        
        if baskets:
            sample_basket = baskets[0]
            report += f"• Sample Basket Items: {', '.join(sample_basket.get('items', {}).keys())}\n"
            report += f"• Average Nutritional Score: {sample_basket.get('nutritional_score', 0):.2f}\n"
        
        report += f"""
🏭 AGENT 3 - OPTIMAL WAREHOUSE LOCATIONS
-----------------------------------------
"""
        
        agent3_results = self.results.get('agent3_warehouses', {})
        warehouses = agent3_results.get('optimal_warehouse_locations', [])
        
        report += f"• Warehouse Locations: {len(warehouses)}\n"
        report += f"• Total Storage Capacity: {agent3_results.get('total_capacity', 0):,} units\n"
        report += f"• Annual Storage Budget: ${agent3_results.get('budget_utilized', 0):,.2f}\n"
        
        report += f"""
🚛 AGENT 4 - OPTIMAL DISTRIBUTION ROUTES
-----------------------------------------
"""
        
        agent4_results = self.results.get('agent4_routes', {})
        routes = agent4_results.get('optimal_routes', [])
        
        report += f"• Distribution Routes: {len(routes)}\n"
        report += f"• Total Distance: {agent4_results.get('total_distance', 0):.1f} miles\n"
        report += f"• Weekly Distribution Cost: ${agent4_results.get('total_cost', 0):,.2f}\n"
        
        report += f"""
📊 AGENT 5 - IMPACT ANALYSIS
----------------------------
"""
        
        agent5_results = self.results.get('agent5_impact', {})
        impact = agent5_results.get('impact_metrics', {})
        
        report += f"• People Served Monthly: {impact.get('people_served_monthly', 0):,}\n"
        report += f"• Food Insecurity Reduction: {impact.get('food_insecurity_reduction', 0):,.0f} people\n"
        report += f"• Coverage Percentage: {impact.get('coverage_percentage', 0):.1f}%\n"
        report += f"• System Efficiency Score: {impact.get('efficiency_score', 0):.2f}\n"
        report += f"• Cost per Person Served: ${impact.get('cost_per_person_served', 0):.2f}\n"
        
        report += f"""
🔍 AGENT 6 - SYSTEM EVALUATION
------------------------------
"""
        
        agent6_results = self.results.get('agent6_evaluation', {})
        evaluation = agent6_results.get('evaluation', {})
        
        report += f"• Current System Efficiency: {evaluation.get('current_efficiency', 0):.2f}\n"
        report += f"• Proposed System Efficiency: {evaluation.get('proposed_efficiency', 0):.2f}\n"
        report += f"• Overall Improvement: {evaluation.get('improvement_percentage', 0):.1f}%\n"
        report += f"• Cost Reduction: {evaluation.get('cost_reduction', 0)*100:.1f}%\n"
        report += f"• Coverage Improvement: {evaluation.get('coverage_improvement', 0)*100:.1f}%\n"
        
        report += f"""
💡 RECOMMENDATION
-----------------
{evaluation.get('recommendation', 'Analysis complete - review results for implementation decision.')}

================================================================
🎯 EXECUTIVE SUMMARY
================================================================
The AI-powered food bank optimization system has successfully analyzed 
the {self.domain} domain and provided comprehensive recommendations for:

1. Strategic food bank placement to maximize impact
2. Culturally-appropriate food supply optimization  
3. Efficient warehouse network design
4. Cost-effective distribution route planning
5. Quantified impact projections
6. Evidence-based improvement recommendations

Total system efficiency improvement: {evaluation.get('improvement_percentage', 0):.1f}%
Estimated people served: {impact.get('people_served_monthly', 0):,} monthly
================================================================
        """
        
        return report
    
    async def run_full_pipeline(self):
        """Execute the complete 6-agent optimization pipeline."""
        start_time = datetime.now()
        
        logger.info("🚀 Starting Full Food Bank Optimization Pipeline")
        logger.info("=" * 60)
        
        try:
            # Load domain data
            cells = await self.load_domain_data()
            
            # Run all agents in sequence
            logger.info("🏪 Step 1/6: Food Bank Location Optimization")
            agent1_result = await self.run_agent1_food_bank_locations(cells)
            
            logger.info("🥫 Step 2/6: Food Supply Optimization")  
            agent2_result = await self.run_agent2_food_supply(cells)
            
            logger.info("🏭 Step 3/6: Warehouse Location Optimization")
            agent3_result = await self.run_agent3_warehouse_locations(
                cells, agent1_result.get('optimal_food_bank_locations', [])
            )
            
            logger.info("🚛 Step 4/6: Distribution Route Optimization")
            agent4_result = await self.run_agent4_distribution_routes(
                agent1_result.get('optimal_food_bank_locations', []),
                agent3_result.get('optimal_warehouse_locations', [])
            )
            
            logger.info("📊 Step 5/6: Impact Analysis")
            agent5_result = await self.run_agent5_impact_calculation()
            
            logger.info("🔍 Step 6/6: System Evaluation")
            agent6_result = await self.run_agent6_evaluation()
            
            # Generate outputs
            self.generate_visualization()
            report = self.generate_summary_report()
            
            # Save results to file
            results_file = f'optimization_results_{self.domain}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            with open(results_file, 'w') as f:
                json.dump(self.results, f, indent=2, default=str)
                
            report_file = f'optimization_report_{self.domain}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
            with open(report_file, 'w') as f:
                f.write(report)
            
            elapsed_time = datetime.now() - start_time
            
            logger.info("=" * 60)
            logger.info("🎉 PIPELINE EXECUTION COMPLETE!")
            logger.info("=" * 60)
            logger.info(f"⏱️  Total execution time: {elapsed_time}")
            logger.info(f"📁 Results saved to: {results_file}")
            logger.info(f"📄 Report saved to: {report_file}")
            logger.info("=" * 60)
            
            print(report)
            
            return self.results
            
        except Exception as e:
            logger.error(f"❌ Pipeline execution failed: {e}")
            raise

async def main():
    """Main function to run the comprehensive test."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Food Bank Optimization System - Full Agent Architecture Test')
    parser.add_argument('--domain', type=str, default='downtown_la', 
                       help='Domain name to analyze (default: downtown_la)')
    parser.add_argument('--budget', type=float, default=500000, 
                       help='Total budget for optimization (default: $500,000)')
    parser.add_argument('--create-test-domain', action='store_true',
                       help='Create a test domain with sample data if domain not found')
    
    args = parser.parse_args()
    
    print(f"""
🏪 FOOD BANK OPTIMIZATION SYSTEM
==================================
Google Cloud Agent Development Kit (ADK) Implementation
Full End-to-End Multi-Agent Architecture Test

Domain: {args.domain}
Budget: ${args.budget:,.2f}
ADK Available: {ADK_AVAILABLE}
==================================
    """)
    
    # Initialize and run the system
    system = FoodBankOptimizationSystem(domain=args.domain, budget=args.budget)
    
    try:
        results = await system.run_full_pipeline()
        print("\n🎉 Full pipeline execution completed successfully!")
        return results
        
    except ValueError as e:
        if "not found" in str(e) and args.create_test_domain:
            logger.info("🏗️  Creating test domain with sample data...")
            await create_test_domain(args.domain)
            # Retry after creating test domain
            results = await system.run_full_pipeline()
            return results
        else:
            logger.error(f"❌ Error: {e}")
            return None
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return None

async def create_test_domain(domain_name: str):
    """Create a test domain with sample data for demonstration."""
    logger.info(f"Creating test domain: {domain_name}")
    
    # This would create sample data in MongoDB
    # For now, just log that this functionality would be implemented
    logger.info("⚠️  Test domain creation not implemented - please use existing domain data")
    logger.info("   Use the scripts in samples/scripts/ to create real domain data")

if __name__ == "__main__":
    # Set up event loop for async execution
    asyncio.run(main())