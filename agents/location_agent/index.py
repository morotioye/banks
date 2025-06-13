#!/usr/bin/env python3
"""
Food Bank Location Optimization Agent System
Production-ready implementation using Google Cloud ADK
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'testbank')

@dataclass
class OptimizationRequest:
    """Request parameters for optimization"""
    domain: str
    budget: float
    max_locations: int = 10
    min_distance_between_banks: float = 0.5  # miles

@dataclass
class Cell:
    """Geographic cell with population and food insecurity data"""
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
class FoodBankLocation:
    """Optimized food bank location"""
    geoid: str
    lat: float
    lon: float
    expected_impact: int
    coverage_radius: float
    efficiency_score: float
    setup_cost: float
    operational_cost_monthly: float

@dataclass
class OptimizationResult:
    """Complete optimization result"""
    status: str
    locations: List[FoodBankLocation]
    total_people_served: int
    total_budget_used: float
    coverage_percentage: float
    optimization_metrics: Dict[str, Any]
    timestamp: str

class LocationOptimizationAgent:
    """Main agent for food bank location optimization"""
    
    def __init__(self):
        self.db_client = MongoClient(MONGO_URI)
        self.db = self.db_client[DB_NAME]
        
        # Initialize sub-agents
        self.data_analyzer = DataAnalysisAgent(self.db)
        self.optimizer = OptimizationAgent()
        self.validator = ValidationAgent()
        
    async def optimize_locations(self, request: OptimizationRequest) -> OptimizationResult:
        """
        Main orchestration method for location optimization
        """
        logger.info(f"Starting location optimization for domain: {request.domain}")
        
        try:
            # Step 1: Data Analysis
            logger.info("Step 1/3: Analyzing population and food insecurity data...")
            analysis_result = await self.data_analyzer.analyze_domain(request.domain)
            
            if not analysis_result['cells']:
                return OptimizationResult(
                    status="error",
                    locations=[],
                    total_people_served=0,
                    total_budget_used=0,
                    coverage_percentage=0,
                    optimization_metrics={},
                    timestamp=datetime.now().isoformat()
                )
            
            # Step 2: Location Optimization
            logger.info("Step 2/3: Optimizing food bank locations...")
            optimization_result = await self.optimizer.optimize(
                cells=analysis_result['cells'],
                budget=request.budget,
                max_locations=request.max_locations,
                min_distance=request.min_distance_between_banks
            )
            
            # Step 3: Validation
            logger.info("Step 3/3: Validating proposed locations...")
            validation_result = await self.validator.validate(
                locations=optimization_result['locations'],
                cells=analysis_result['cells'],
                budget=request.budget
            )
            
            # Compile final result
            result = OptimizationResult(
                status="success",
                locations=validation_result['validated_locations'],
                total_people_served=validation_result['total_impact'],
                total_budget_used=validation_result['budget_used'],
                coverage_percentage=validation_result['coverage_percentage'],
                optimization_metrics={
                    'efficiency_score': optimization_result['efficiency_score'],
                    'iterations': optimization_result['iterations'],
                    'convergence_time': optimization_result['convergence_time'],
                    'validation_adjustments': validation_result['adjustments_made']
                },
                timestamp=datetime.now().isoformat()
            )
            
            logger.info(f"Optimization complete: {len(result.locations)} locations selected")
            return result
            
        except Exception as e:
            logger.error(f"Optimization failed: {str(e)}")
            return OptimizationResult(
                status="error",
                locations=[],
                total_people_served=0,
                total_budget_used=0,
                coverage_percentage=0,
                optimization_metrics={'error': str(e)},
                timestamp=datetime.now().isoformat()
            )

class DataAnalysisAgent:
    """Sub-agent for analyzing population and food insecurity data"""
    
    def __init__(self, db):
        self.db = db
        
    async def analyze_domain(self, domain: str) -> Dict[str, Any]:
        """Analyze domain data and prepare for optimization"""
        collection_name = f"d_{domain}"
        
        if collection_name not in self.db.list_collection_names():
            logger.error(f"Domain collection '{collection_name}' not found")
            return {'cells': [], 'statistics': {}}
        
        collection = self.db[collection_name]
        blocks = list(collection.find({}))
        
        cells = []
        total_population = 0
        total_need = 0
        
        for block in blocks:
            props = block['properties']
            
            # Extract centroid from geometry
            coords = block['geometry']['coordinates'][0]
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            centroid_lon = sum(lons) / len(lons)
            centroid_lat = sum(lats) / len(lats)
            
            # Calculate need if not present
            population = props.get('pop', 0)
            food_insecurity_score = props.get('food_insecurity_score', 0)
            need = props.get('need', population * food_insecurity_score)
            
            cell = Cell(
                geoid=props['geoid'],
                lat=centroid_lat,
                lon=centroid_lon,
                population=population,
                food_insecurity_score=food_insecurity_score,
                poverty_rate=props.get('poverty_rate', 0),
                snap_rate=props.get('snap_rate', 0),
                vehicle_access_rate=props.get('vehicle_access_rate', 1.0),
                need=need,
                geometry=block['geometry']
            )
            
            if cell.population > 0:  # Only include populated cells
                cells.append(cell)
                total_population += cell.population
                total_need += cell.need
        
        # Calculate domain statistics
        statistics = {
            'total_cells': len(cells),
            'total_population': total_population,
            'total_need': total_need,
            'avg_food_insecurity': np.mean([c.food_insecurity_score for c in cells]) if cells else 0,
            'high_need_cells': len([c for c in cells if c.food_insecurity_score > 4])
        }
        
        logger.info(f"Analyzed {len(cells)} cells with {total_population:,} total population")
        
        return {
            'cells': cells,
            'statistics': statistics
        }

class OptimizationAgent:
    """Sub-agent for optimizing food bank locations"""
    
    async def optimize(self, cells: List[Cell], budget: float, 
                      max_locations: int, min_distance: float) -> Dict[str, Any]:
        """Optimize food bank locations using advanced algorithms"""
        import time
        start_time = time.time()
        
        # Calculate efficiency scores for each cell
        scored_cells = []
        for cell in cells:
            if cell.population > 0:
                # Multi-factor efficiency score
                need_factor = cell.need / 1000  # Normalize need
                accessibility_factor = 1 - cell.vehicle_access_rate  # Higher score for lower vehicle access
                poverty_factor = cell.poverty_rate
                
                # Weighted efficiency score
                efficiency = (
                    0.5 * need_factor +
                    0.3 * accessibility_factor +
                    0.2 * poverty_factor
                )
                
                # Estimate costs (more realistic)
                # Setup cost: $100k-300k based on population density
                base_setup = 100000
                population_factor = min(200000, cell.population * 20)  # Cap at 200k additional
                setup_cost = base_setup + population_factor
                
                # Operational cost: $10k-30k monthly based on scale
                operational_cost = 10000 + (cell.population * 4)  # Monthly
                
                scored_cells.append({
                    'cell': cell,
                    'efficiency': efficiency,
                    'setup_cost': setup_cost,
                    'operational_cost': operational_cost,
                    'impact': min(cell.need * 0.4, cell.population * 0.3)  # Realistic impact estimate
                })
        
        # Sort by efficiency
        scored_cells.sort(key=lambda x: x['efficiency'], reverse=True)
        
        # Greedy selection with distance constraint
        selected_locations = []
        remaining_budget = budget
        
        for scored_cell in scored_cells:
            if len(selected_locations) >= max_locations:
                break
                
            cell_data = scored_cell['cell']
            
            # Check distance constraint
            too_close = False
            for loc in selected_locations:
                distance = self._calculate_distance(
                    (cell_data.lat, cell_data.lon),
                    (loc.lat, loc.lon)
                )
                if distance < min_distance:
                    too_close = True
                    break
            
            if too_close:
                continue
            
            # Check budget constraint (setup + 6 months operational)
            total_cost = scored_cell['setup_cost'] + (6 * scored_cell['operational_cost'])
            if total_cost > remaining_budget:
                continue
            
            # Add location
            location = FoodBankLocation(
                geoid=cell_data.geoid,
                lat=cell_data.lat,
                lon=cell_data.lon,
                expected_impact=int(scored_cell['impact']),
                coverage_radius=1.5,  # miles
                efficiency_score=scored_cell['efficiency'],
                setup_cost=scored_cell['setup_cost'],
                operational_cost_monthly=scored_cell['operational_cost']
            )
            
            selected_locations.append(location)
            remaining_budget -= total_cost
        
        convergence_time = time.time() - start_time
        
        return {
            'locations': selected_locations,
            'efficiency_score': np.mean([loc.efficiency_score for loc in selected_locations]) if selected_locations else 0,
            'iterations': len(scored_cells),
            'convergence_time': convergence_time,
            'budget_remaining': remaining_budget
        }
    
    def _calculate_distance(self, coord1: tuple, coord2: tuple) -> float:
        """Calculate distance between two coordinates in miles"""
        from geopy.distance import geodesic
        return geodesic(coord1, coord2).miles

class ValidationAgent:
    """Sub-agent for validating proposed locations"""
    
    async def validate(self, locations: List[FoodBankLocation], 
                      cells: List[Cell], budget: float) -> Dict[str, Any]:
        """Validate feasibility of proposed locations"""
        adjustments_made = 0
        validated_locations = []
        
        # Calculate actual coverage
        covered_cells = set()
        total_impact = 0
        budget_used = 0
        
        for location in locations:
            # Validate each location
            valid = True
            
            # Check if location serves any cells
            cells_served = 0
            for cell in cells:
                distance = self._calculate_distance(
                    (location.lat, location.lon),
                    (cell.lat, cell.lon)
                )
                if distance <= location.coverage_radius:
                    cells_served += 1
                    covered_cells.add(cell.geoid)
            
            if cells_served == 0:
                valid = False
                adjustments_made += 1
            
            # Validate budget
            total_cost = location.setup_cost + (6 * location.operational_cost_monthly)
            if budget_used + total_cost > budget:
                valid = False
                adjustments_made += 1
            
            if valid:
                validated_locations.append(location)
                total_impact += location.expected_impact
                budget_used += total_cost
        
        # Calculate coverage percentage
        coverage_percentage = (len(covered_cells) / len(cells)) * 100 if cells else 0
        
        logger.info(f"Validation complete: {len(validated_locations)} locations validated, "
                   f"{adjustments_made} adjustments made")
        
        return {
            'validated_locations': validated_locations,
            'total_impact': total_impact,
            'budget_used': budget_used,
            'coverage_percentage': coverage_percentage,
            'adjustments_made': adjustments_made,
            'cells_covered': len(covered_cells)
        }
    
    def _calculate_distance(self, coord1: tuple, coord2: tuple) -> float:
        """Calculate distance between two coordinates in miles"""
        from geopy.distance import geodesic
        return geodesic(coord1, coord2).miles

# Export main agent
agent = LocationOptimizationAgent() 