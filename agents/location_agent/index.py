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
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import multiprocessing
from geopy.distance import geodesic

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
    max_locations: int = 1000  # High default to not artificially limit
    min_distance_between_banks: float = 0.3  # miles - allow closer spacing for urban areas
    warehouse_budget_ratio: float = 0.3  # 30% of budget for warehouses by default
    max_warehouses: int = 3  # Maximum number of warehouses

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
class WarehouseLocation:
    """Optimized warehouse location"""
    geoid: str
    lat: float
    lon: float
    capacity: int  # Storage capacity in units
    distribution_radius: float  # miles
    efficiency_score: float
    setup_cost: float
    operational_cost_monthly: float
    storage_cost_per_unit: float

@dataclass
class OptimizationResult:
    """Complete optimization result"""
    status: str
    locations: List[FoodBankLocation]
    warehouses: List[WarehouseLocation]
    total_people_served: int
    total_budget_used: float
    food_bank_budget_used: float
    warehouse_budget_used: float
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
            logger.info("Step 1/4: Analyzing population and food insecurity data...")
            analysis_result = await self.data_analyzer.analyze_domain(request.domain)
            if not analysis_result['cells']:
                return OptimizationResult(
                    status="error",
                    locations=[],
                    warehouses=[],
                    total_people_served=0,
                    total_budget_used=0,
                    food_bank_budget_used=0,
                    warehouse_budget_used=0,
                    coverage_percentage=0,
                    optimization_metrics={},
                    timestamp=datetime.now().isoformat()
                )
            # Calculate budget allocation
            warehouse_budget = request.budget * request.warehouse_budget_ratio
            food_bank_budget = request.budget - warehouse_budget
            logger.info(f"Budget allocation: Food banks: ${food_bank_budget:,.2f}, Warehouses: ${warehouse_budget:,.2f}")
            # Step 2: Warehouse Location Optimization (first)
            logger.info("Step 2/4: Optimizing warehouse locations...")
            warehouse_result = await self.optimizer.optimize_warehouses(
                cells=analysis_result['cells'],
                food_banks=[],  # No food banks yet
                budget=warehouse_budget,
                max_warehouses=request.max_warehouses
            )
            # Step 3: Food Bank Location Optimization (must be near a warehouse)
            logger.info("Step 3/4: Optimizing food bank locations around warehouses...")
            food_bank_result = await self.optimizer.optimize_food_banks(
                cells=analysis_result['cells'],
                budget=food_bank_budget,
                max_locations=request.max_locations,
                min_distance=request.min_distance_between_banks,
                warehouses=warehouse_result['warehouses'],
                max_distance_from_warehouse=5.0  # Default 5 miles
            )
            # Step 4: Validation
            logger.info("Step 4/4: Validating proposed locations...")
            validation_result = await self.validator.validate(
                locations=food_bank_result['locations'],
                warehouses=warehouse_result['warehouses'],
                cells=analysis_result['cells'],
                budget=request.budget
            )
            # Compile final result
            result = OptimizationResult(
                status="success",
                locations=validation_result['validated_locations'],
                warehouses=validation_result['validated_warehouses'],
                total_people_served=validation_result['total_impact'],
                total_budget_used=validation_result['budget_used'],
                food_bank_budget_used=validation_result['food_bank_budget_used'],
                warehouse_budget_used=validation_result['warehouse_budget_used'],
                coverage_percentage=validation_result['coverage_percentage'],
                optimization_metrics={
                    'efficiency_score': food_bank_result['efficiency_score'],
                    'warehouse_efficiency_score': warehouse_result['efficiency_score'],
                    'iterations': food_bank_result['iterations'],
                    'convergence_time': food_bank_result['convergence_time'],
                    'validation_adjustments': validation_result['adjustments_made']
                },
                timestamp=datetime.now().isoformat()
            )
            logger.info(f"Optimization complete: {len(result.locations)} food banks, {len(result.warehouses)} warehouses")
            return result
        except Exception as e:
            logger.error(f"Optimization failed: {str(e)}")
            return OptimizationResult(
                status="error",
                locations=[],
                warehouses=[],
                total_people_served=0,
                total_budget_used=0,
                food_bank_budget_used=0,
                warehouse_budget_used=0,
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
        
        # Use batch processing for MongoDB queries
        # Fetch all blocks at once with projection to reduce data transfer
        projection = {
            'properties': 1,
            'geometry.coordinates': 1,
            '_id': 0
        }
        
        blocks = list(collection.find({}, projection))
        logger.info(f"Fetched {len(blocks)} blocks from database")
        
        # Process blocks in parallel
        num_workers = min(multiprocessing.cpu_count(), 8)
        chunk_size = max(1, len(blocks) // num_workers)
        block_chunks = [blocks[i:i + chunk_size] for i in range(0, len(blocks), chunk_size)]
        
        cells = []
        
        # Process blocks in parallel using threads (good for I/O bound operations)
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            future_to_chunk = {
                executor.submit(self._process_blocks_chunk, chunk): chunk 
                for chunk in block_chunks
            }
            
            for future in as_completed(future_to_chunk):
                try:
                    chunk_cells = future.result()
                    cells.extend(chunk_cells)
                except Exception as e:
                    logger.error(f"Error processing block chunk: {e}")
        
        # Calculate statistics
        total_population = sum(c.population for c in cells)
        total_need = sum(c.need for c in cells)
        
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
    
    @staticmethod
    def _process_blocks_chunk(blocks_chunk: List[Dict]) -> List[Cell]:
        """Process a chunk of blocks (for parallel processing)"""
        cells = []
        
        for block in blocks_chunk:
            props = block['properties']
            
            # Extract centroid from geometry
            try:
                coords = block['geometry']['coordinates'][0]
                # Handle case where coords might be nested differently
                if isinstance(coords[0], (int, float)):
                    # Single coordinate pair
                    centroid_lon = coords[0]
                    centroid_lat = coords[1]
                else:
                    # List of coordinate pairs
                    lons = [c[0] for c in coords]
                    lats = [c[1] for c in coords]
                    centroid_lon = sum(lons) / len(lons)
                    centroid_lat = sum(lats) / len(lats)
            except (IndexError, TypeError) as e:
                continue  # Skip problematic blocks
            
            # Calculate need if not present
            population = props.get('pop', 0)
            food_insecurity_score = props.get('food_insecurity_score', 0)
            need = props.get('need', population * food_insecurity_score)
            
            # Ensure numeric types
            population = float(population) if population else 0
            food_insecurity_score = float(food_insecurity_score) if food_insecurity_score else 0
            need = float(need) if need else 0
            
            cell = Cell(
                geoid=props['geoid'],
                lat=float(centroid_lat),
                lon=float(centroid_lon),
                population=int(population),
                food_insecurity_score=float(food_insecurity_score),
                poverty_rate=float(props.get('poverty_rate', 0)),
                snap_rate=float(props.get('snap_rate', 0)),
                vehicle_access_rate=float(props.get('vehicle_access_rate', 1.0)),
                need=float(need),
                geometry=block['geometry']
            )
            
            if cell.population > 0:  # Only include populated cells
                cells.append(cell)
        
        return cells

class OptimizationAgent:
    """Sub-agent for optimizing food bank locations"""
    
    async def optimize_food_banks(self, cells: List[Cell], budget: float, 
                              max_locations: int, min_distance: float, warehouses: Optional[List[WarehouseLocation]] = None, max_distance_from_warehouse: float = 5.0) -> Dict[str, Any]:
        """Optimize food bank locations using advanced algorithms, only within max_distance_from_warehouse of a warehouse"""
        import time
        start_time = time.time()
        # Filter cells to only those within max_distance_from_warehouse of any warehouse
        if warehouses:
            filtered_cells = []
            for cell in cells:
                for warehouse in warehouses:
                    distance = self._calculate_distance((cell.lat, cell.lon), (warehouse.lat, warehouse.lon))
                    if distance <= max_distance_from_warehouse:
                        filtered_cells.append(cell)
                        break
        else:
            filtered_cells = cells
        # Use multiprocessing to calculate efficiency scores in parallel
        num_workers = min(multiprocessing.cpu_count(), 8)  # Cap at 8 workers
        chunk_size = max(1, len(filtered_cells) // num_workers)
        cell_chunks = [filtered_cells[i:i + chunk_size] for i in range(0, len(filtered_cells), chunk_size)]
        scored_cells = []
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            future_to_chunk = {
                executor.submit(self._score_cells_chunk, chunk): chunk 
                for chunk in cell_chunks
            }
            for future in as_completed(future_to_chunk):
                try:
                    chunk_results = future.result()
                    scored_cells.extend(chunk_results)
                except Exception as e:
                    logger.error(f"Error processing chunk: {e}")
        # Sort by efficiency
        scored_cells.sort(key=lambda x: x['efficiency'], reverse=True)
        
        # Greedy selection with distance constraint
        selected_locations = []
        remaining_budget = budget
        total_impact = 0
        used_cells = set()  # Track which cells have been used
        
        # Keep trying to add locations until we can't afford any more
        # or we've exhausted all candidates
        made_progress = True
        iteration = 0
        while made_progress and remaining_budget > 50000 and len(selected_locations) < max_locations:
            made_progress = False
            iteration += 1
            
            for i, scored_cell in enumerate(scored_cells):
                if i in used_cells:  # Skip already used cells
                    continue
                    
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
                
                # Check budget constraint (setup + 12 months operational for sustainability)
                total_cost = scored_cell['setup_cost'] + (12 * scored_cell['operational_cost'])
                if total_cost > remaining_budget:
                    # Try with just setup cost if we have significant budget left
                    if remaining_budget > scored_cell['setup_cost'] * 2 and remaining_budget > budget * 0.1:
                        total_cost = scored_cell['setup_cost'] + (6 * scored_cell['operational_cost'])
                        if total_cost > remaining_budget:
                            continue
                    else:
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
                try:
                    total_impact += scored_cell['impact']
                except TypeError as e:
                    logger.error(f"Type error in optimization accumulation: {e}")
                    logger.error(f"total_impact type: {type(total_impact)}, value: {total_impact}")
                    logger.error(f"scored_cell['impact'] type: {type(scored_cell['impact'])}, value: {scored_cell['impact']}")
                    raise
                used_cells.add(i)  # Mark this cell as used
                made_progress = True  # We added a location, so keep trying
                
                logger.info(f"Added location {len(selected_locations)}: {cell_data.geoid}, "
                           f"impact: {scored_cell['impact']:.0f}, "
                           f"cost: ${total_cost:,.0f}, "
                           f"remaining budget: ${remaining_budget:,.0f}")
        
        logger.info(f"Optimization complete after {iteration} iterations. "
                   f"Selected {len(selected_locations)} locations, "
                   f"total impact: {total_impact:.0f}, "
                   f"budget used: ${budget - remaining_budget:,.0f}")
        
        convergence_time = time.time() - start_time
        
        return {
            'locations': selected_locations,
            'efficiency_score': np.mean([loc.efficiency_score for loc in selected_locations]) if selected_locations else 0,
            'iterations': iteration,
            'convergence_time': convergence_time,
            'budget_remaining': remaining_budget
        }
    
    @staticmethod
    def _score_cells_chunk(cells_chunk: List[Cell]) -> List[Dict[str, Any]]:
        """Score a chunk of cells (for parallel processing)"""
        scored_cells = []
        
        for cell in cells_chunk:
            if cell.population > 0:
                # Multi-factor efficiency score
                need_factor = float(cell.need) / 1000  # Normalize need
                accessibility_factor = 1 - float(cell.vehicle_access_rate)  # Higher score for lower vehicle access
                poverty_factor = float(cell.poverty_rate)
                
                # Weighted efficiency score
                efficiency = (
                    0.5 * need_factor +
                    0.3 * accessibility_factor +
                    0.2 * poverty_factor
                )
                
                # Estimate costs based on expected impact and population density
                # More people served = larger facility needed
                expected_people_served = min(float(cell.need) * 0.4, float(cell.population) * 0.3)
                
                # Ensure expected_people_served is a number
                if isinstance(expected_people_served, (list, tuple)):
                    expected_people_served = float(expected_people_served[0]) if expected_people_served else 0
                
                # Setup cost: $80k-250k based on scale
                # Base cost + scaling factor based on people served
                base_setup = 80000
                scale_factor = min(170000, float(expected_people_served) * 50)  # $50 per person served capacity
                setup_cost = base_setup + scale_factor
                
                # Operational cost: $8k-25k monthly based on people served
                # Base operations + variable cost per person served
                base_operations = 8000
                variable_operations = min(17000, float(expected_people_served) * 2)  # $2/person/month
                operational_cost = base_operations + variable_operations
                
                scored_cells.append({
                    'cell': cell,
                    'efficiency': efficiency,
                    'setup_cost': setup_cost,
                    'operational_cost': operational_cost,
                    'impact': expected_people_served  # Use the calculated impact
                })
        
        return scored_cells
    
    def _calculate_distance(self, coord1: tuple, coord2: tuple) -> float:
        """Calculate distance between two coordinates in miles"""
        return geodesic(coord1, coord2).miles

    async def optimize_warehouses(self, cells: List[Cell], food_banks: List[FoodBankLocation], 
                              budget: float, max_warehouses: int) -> Dict[str, Any]:
        """Optimize warehouse locations using advanced algorithms (one-time setup cost only)"""
        import time
        start_time = time.time()
        num_workers = min(multiprocessing.cpu_count(), 8)
        chunk_size = max(1, len(cells) // num_workers)
        cell_chunks = [cells[i:i + chunk_size] for i in range(0, len(cells), chunk_size)]
        scored_cells = []
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            future_to_chunk = {
                executor.submit(self._score_warehouse_cells_chunk, chunk, food_banks): chunk 
                for chunk in cell_chunks
            }
            for future in as_completed(future_to_chunk):
                try:
                    chunk_results = future.result()
                    scored_cells.extend(chunk_results)
                except Exception as e:
                    logger.error(f"Error processing warehouse chunk: {e}")
        scored_cells.sort(key=lambda x: x['efficiency'], reverse=True)
        selected_warehouses = []
        remaining_budget = budget
        total_capacity = 0
        used_cells = set()
        made_progress = True
        iteration = 0
        while made_progress and len(selected_warehouses) < max_warehouses and iteration < 100:
            made_progress = False
            iteration += 1
            for i, scored_cell in enumerate(scored_cells):
                if i in used_cells:
                    continue
                cell_data = scored_cell['cell']
                too_close = False
                for warehouse in selected_warehouses:
                    distance = self._calculate_distance(
                        (warehouse.lat, warehouse.lon),
                        (cell_data.lat, cell_data.lon)
                    )
                    if distance < 8.0:
                        too_close = True
                        break
                if too_close:
                    continue
                # Only use setup cost for budget
                total_cost = scored_cell['setup_cost']
                if total_cost > remaining_budget:
                    continue
                warehouse = WarehouseLocation(
                    geoid=cell_data.geoid,
                    lat=cell_data.lat,
                    lon=cell_data.lon,
                    capacity=scored_cell['capacity'],
                    distribution_radius=8.0,
                    efficiency_score=scored_cell['efficiency'],
                    setup_cost=scored_cell['setup_cost'],
                    operational_cost_monthly=0.0,  # No operational cost
                    storage_cost_per_unit=scored_cell['storage_cost_per_unit']
                )
                selected_warehouses.append(warehouse)
                remaining_budget -= total_cost
                total_capacity += scored_cell['capacity']
                used_cells.add(i)
                made_progress = True
                logger.info(f"Added warehouse {len(selected_warehouses)}: {cell_data.geoid}, "
                           f"capacity: {scored_cell['capacity']:,}, "
                           f"cost: ${total_cost:,.0f}, "
                           f"remaining budget: ${remaining_budget:,.0f}")
        convergence_time = time.time() - start_time
        logger.info(f"Warehouse optimization complete after {iteration} iterations. "
                   f"Selected {len(selected_warehouses)} warehouses, "
                   f"total capacity: {total_capacity:,}, "
                   f"budget used: ${budget - remaining_budget:,.0f}")
        return {
            'warehouses': selected_warehouses,
            'efficiency_score': np.mean([w.efficiency_score for w in selected_warehouses]) if selected_warehouses else 0,
            'iterations': iteration,
            'convergence_time': convergence_time,
            'budget_remaining': remaining_budget,
            'total_capacity': total_capacity
        }

    @staticmethod
    def _score_warehouse_cells_chunk(cells_chunk: List[Cell], food_banks: List[FoodBankLocation]) -> List[Dict[str, Any]]:
        """Score a chunk of cells for warehouse placement (for parallel processing)"""
        scored_cells = []
        for cell in cells_chunk:
            if cell.population == 0:
                continue
            # Efficiency: prioritize high poverty, low vehicle access, and need
            poverty_factor = float(cell.poverty_rate)  # Higher is better
            accessibility_factor = 1 - float(cell.vehicle_access_rate)  # Higher is better (lower access)
            need_factor = float(cell.need) / 1000  # Normalize need
            efficiency = (
                0.5 * poverty_factor +
                0.3 * accessibility_factor +
                0.2 * need_factor
            )
            # Calculate warehouse costs and capacity
            base_capacity = 5000  # Base capacity in units
            population_density = cell.population / 1000
            capacity_multiplier = 1 + (population_density * 0.1)
            capacity = int(base_capacity * capacity_multiplier)
            setup_cost = 100000 + (capacity * 2)  # $100k base + $2 per unit
            operational_cost = 0  # No operational cost
            storage_cost_per_unit = 0.10  # $0.10 per unit per month
            scored_cells.append({
                'cell': cell,
                'efficiency': efficiency,
                'capacity': capacity,
                'setup_cost': setup_cost,
                'operational_cost': operational_cost,
                'storage_cost_per_unit': storage_cost_per_unit,
                'poverty_factor': poverty_factor,
                'accessibility_factor': accessibility_factor,
                'need_factor': need_factor
            })
        return scored_cells

    def _calculate_distance(self, coord1: tuple, coord2: tuple) -> float:
        """Calculate distance between two coordinates in miles"""
        return geodesic(coord1, coord2).miles

class ValidationAgent:
    """Sub-agent for validating proposed locations"""
    
    async def validate(self, locations: List[FoodBankLocation], 
                      warehouses: List[WarehouseLocation], cells: List[Cell], budget: float) -> Dict[str, Any]:
        """Validate feasibility of proposed locations"""
        adjustments_made = 0
        validated_locations = []
        validated_warehouses = []
        
        # Calculate actual coverage
        covered_cells = set()
        total_impact = 0
        food_bank_budget_used = 0
        warehouse_budget_used = 0
        
        # Validate food banks
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
            
            # Validate budget (use same calculation as optimization)
            total_cost = location.setup_cost + (12 * location.operational_cost_monthly)
            if food_bank_budget_used + total_cost > budget * 0.7:  # 70% of budget for food banks
                # Try with 6 months if we have significant budget left
                if budget * 0.7 - food_bank_budget_used > location.setup_cost * 2:
                    total_cost = location.setup_cost + (6 * location.operational_cost_monthly)
                    if food_bank_budget_used + total_cost > budget * 0.7:
                        valid = False
                        adjustments_made += 1
                else:
                    valid = False
                    adjustments_made += 1
            
            if valid:
                validated_locations.append(location)
                try:
                    total_impact += location.expected_impact
                    food_bank_budget_used += total_cost
                except TypeError as e:
                    logger.error(f"Type error in validation accumulation: {e}")
                    logger.error(f"total_impact type: {type(total_impact)}, value: {total_impact}")
                    logger.error(f"location.expected_impact type: {type(location.expected_impact)}, value: {location.expected_impact}")
                    raise
        
        # Validate warehouses
        for warehouse in warehouses:
            # Validate each warehouse
            valid = True
            
            # Check if warehouse serves any cells
            cells_served = 0
            for cell in cells:
                distance = self._calculate_distance(
                    (warehouse.lat, warehouse.lon),
                    (cell.lat, cell.lon)
                )
                if distance <= warehouse.distribution_radius:
                    cells_served += 1
                    covered_cells.add(cell.geoid)
            
            if cells_served == 0:
                valid = False
                adjustments_made += 1
            
            # Validate budget (use same calculation as optimization)
            total_cost = warehouse.setup_cost + (12 * warehouse.operational_cost_monthly)
            if warehouse_budget_used + total_cost > budget * 0.3:  # 30% of budget for warehouses
                # Try with 6 months if we have significant budget left
                if budget * 0.3 - warehouse_budget_used > warehouse.setup_cost * 2:
                    total_cost = warehouse.setup_cost + (6 * warehouse.operational_cost_monthly)
                    if warehouse_budget_used + total_cost > budget * 0.3:
                        valid = False
                        adjustments_made += 1
                else:
                    valid = False
                    adjustments_made += 1
            
            if valid:
                validated_warehouses.append(warehouse)
                try:
                    warehouse_budget_used += total_cost
                except TypeError as e:
                    logger.error(f"Type error in validation accumulation: {e}")
                    logger.error(f"warehouse_budget_used type: {type(warehouse_budget_used)}, value: {warehouse_budget_used}")
                    logger.error(f"total_cost type: {type(total_cost)}, value: {total_cost}")
                    raise
        
        # Calculate coverage percentage
        coverage_percentage = (len(covered_cells) / len(cells)) * 100 if cells else 0
        
        logger.info(f"Validation complete: {len(validated_locations)} food banks, {len(validated_warehouses)} warehouses validated, "
                   f"{adjustments_made} adjustments made")
        
        return {
            'validated_locations': validated_locations,
            'validated_warehouses': validated_warehouses,
            'total_impact': total_impact,
            'budget_used': food_bank_budget_used + warehouse_budget_used,
            'food_bank_budget_used': food_bank_budget_used,
            'warehouse_budget_used': warehouse_budget_used,
            'coverage_percentage': coverage_percentage,
            'adjustments_made': adjustments_made
        }
    
    def _calculate_distance(self, coord1: tuple, coord2: tuple) -> float:
        """Calculate distance between two coordinates in miles"""
        return geodesic(coord1, coord2).miles

# Export main agent
agent = LocationOptimizationAgent() 