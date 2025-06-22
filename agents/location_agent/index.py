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
    capacity: int  # Capacity in units of food
    distribution_radius: float  # miles
    efficiency_score: float
    setup_cost: float
    operational_cost_monthly: float
    food_banks_served: List[str]  # List of food bank geoids served

@dataclass
class OptimizationResult:
    """Complete optimization result"""
    status: str
    locations: List[FoodBankLocation]
    warehouses: List[WarehouseLocation]
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
        self.warehouse_optimizer = WarehouseOptimizationAgent()
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
                    coverage_percentage=0,
                    optimization_metrics={},
                    timestamp=datetime.now().isoformat()
                )
            
            # Step 2: Warehouse Location Optimization First (25% of budget)
            warehouse_budget = request.budget * 0.25
            logger.info(f"Step 2/4: Optimizing warehouse locations with ${warehouse_budget:,.0f}...")
            warehouse_result = await self.warehouse_optimizer.optimize_warehouses_first(
                cells=analysis_result['cells'],
                budget=warehouse_budget
            )
            
            # Step 3: Food Bank Location Optimization within warehouse coverage (75% of budget)
            food_bank_budget = request.budget * 0.75
            logger.info(f"Step 3/4: Optimizing food bank locations within warehouse coverage with ${food_bank_budget:,.0f}...")
            optimization_result = await self.optimizer.optimize_within_warehouse_coverage(
                cells=analysis_result['cells'],
                warehouses=warehouse_result['warehouses'],
                budget=food_bank_budget,
                max_locations=request.max_locations,
                min_distance=request.min_distance_between_banks
            )
            
            # Step 4: Validation
            logger.info("Step 4/4: Validating proposed locations...")
            validation_result = await self.validator.validate(
                locations=optimization_result['locations'],
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
                coverage_percentage=validation_result['coverage_percentage'],
                optimization_metrics={
                    'efficiency_score': optimization_result['efficiency_score'],
                    'iterations': optimization_result['iterations'],
                    'convergence_time': optimization_result['convergence_time'],
                    'warehouse_efficiency': warehouse_result['efficiency_score'],
                    'warehouse_coverage': warehouse_result['coverage_percentage'],
                    'validation_adjustments': validation_result['adjustments_made']
                },
                timestamp=datetime.now().isoformat()
            )
            
            logger.info(f"Optimization complete: {len(result.locations)} food banks, {len(result.warehouses)} warehouses selected")
            return result
            
        except Exception as e:
            logger.error(f"Optimization failed: {str(e)}")
            return OptimizationResult(
                status="error",
                locations=[],
                warehouses=[],
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
    
    async def optimize(self, cells: List[Cell], budget: float, 
                      max_locations: int, min_distance: float) -> Dict[str, Any]:
        """Optimize food bank locations using advanced algorithms"""
        import time
        
        start_time = time.time()
        
        # Use multiprocessing to calculate efficiency scores in parallel
        num_workers = min(multiprocessing.cpu_count(), 8)  # Cap at 8 workers
        
        # Split cells into chunks for parallel processing
        chunk_size = max(1, len(cells) // num_workers)
        cell_chunks = [cells[i:i + chunk_size] for i in range(0, len(cells), chunk_size)]
        
        scored_cells = []
        
        # Process cells in parallel
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            # Submit all chunks for processing
            future_to_chunk = {
                executor.submit(self._score_cells_chunk, chunk): chunk 
                for chunk in cell_chunks
            }
            
            # Collect results as they complete
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
    
    async def optimize_within_warehouse_coverage(self, cells: List[Cell], warehouses: List[WarehouseLocation], 
                                                budget: float, max_locations: int, min_distance: float) -> Dict[str, Any]:
        """Optimize food bank locations within warehouse coverage areas"""
        import time
        from geopy.distance import geodesic
        
        start_time = time.time()
        
        if not warehouses:
            # Fallback to regular optimization if no warehouses
            return await self.optimize(cells, budget, max_locations, min_distance)
        
        # Filter cells to only those within warehouse coverage areas
        covered_cells = {}  # cell_geoid -> warehouse that covers it
        
        for warehouse in warehouses:
            for cell in cells:
                distance = geodesic((warehouse.lat, warehouse.lon), (cell.lat, cell.lon)).miles
                if distance <= warehouse.distribution_radius:
                    # Associate cell with the closest warehouse or highest capacity one
                    if cell.geoid not in covered_cells:
                        covered_cells[cell.geoid] = warehouse
                    else:
                        # Choose warehouse with higher capacity
                        current_warehouse = covered_cells[cell.geoid]
                        if warehouse.capacity > current_warehouse.capacity:
                            covered_cells[cell.geoid] = warehouse
        
        # Only optimize within covered cells
        viable_cells = [cell for cell in cells if cell.geoid in covered_cells]
        
        if not viable_cells:
            logger.warning("No cells within warehouse coverage areas")
            return {
                'locations': [],
                'efficiency_score': 0,
                'iterations': 0,
                'convergence_time': 0,
                'budget_remaining': budget
            }
        
        logger.info(f"Optimizing food banks within {len(viable_cells)} cells covered by {len(warehouses)} warehouses")
        
        # Use the existing optimization logic on the filtered cells
        result = await self.optimize(viable_cells, budget, max_locations, min_distance)
        
        # Link food banks to their covering warehouses
        if result['locations']:
            for location in result['locations']:
                covering_warehouse = covered_cells.get(location.geoid)
                if covering_warehouse:
                    if location.geoid not in covering_warehouse.food_banks_served:
                        covering_warehouse.food_banks_served.append(location.geoid)
        
        convergence_time = time.time() - start_time
        result['convergence_time'] = convergence_time
        
        logger.info(f"Food bank optimization within warehouse coverage complete: "
                   f"{len(result['locations'])} food banks placed")
        
        return result
    
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
        from geopy.distance import geodesic
        return geodesic(coord1, coord2).miles

class WarehouseOptimizationAgent:
    """Sub-agent for optimizing warehouse locations based on strategic placement and coverage"""
    
    async def optimize_warehouses_first(self, cells: List[Cell], budget: float) -> Dict[str, Any]:
        """Optimize warehouse locations first based on strategic coverage and logistics efficiency"""
        import time
        
        start_time = time.time()
        
        if not cells:
            logger.warning("No cells provided for warehouse optimization")
            return {
                'warehouses': [],
                'efficiency_score': 0,
                'coverage_percentage': 0,
                'iterations': 0,
                'convergence_time': 0,
                'budget_remaining': budget
            }
        
        # Calculate optimal warehouse locations based on strategic coverage
        warehouse_candidates = self._identify_strategic_warehouse_locations(cells)
        
        # Score warehouse candidates
        scored_warehouses = self._score_strategic_warehouses(warehouse_candidates, cells)
        
        # Select optimal warehouses within budget
        selected_warehouses = self._select_strategic_warehouses(scored_warehouses, budget)
        
        # Calculate coverage metrics
        coverage_percentage = self._calculate_strategic_coverage(selected_warehouses, cells)
        
        convergence_time = time.time() - start_time
        budget_used = sum(w.setup_cost + (8 * w.operational_cost_monthly) for w in selected_warehouses)
        
        logger.info(f"Strategic warehouse optimization complete: {len(selected_warehouses)} warehouses selected, "
                   f"covering {coverage_percentage:.1f}% of domain area, "
                   f"budget used: ${budget_used:,.0f}")
        
        return {
            'warehouses': selected_warehouses,
            'efficiency_score': np.mean([w.efficiency_score for w in selected_warehouses]) if selected_warehouses else 0,
            'coverage_percentage': coverage_percentage,
            'iterations': 1,
            'convergence_time': convergence_time,
            'budget_remaining': budget - budget_used
        }
    
    async def optimize(self, cells: List[Cell], food_banks: List[FoodBankLocation], budget: float) -> Dict[str, Any]:
        """Optimize warehouse locations based on food bank locations and demand patterns"""
        import time
        
        start_time = time.time()
        
        if not food_banks:
            logger.warning("No food banks provided for warehouse optimization")
            return {
                'warehouses': [],
                'efficiency_score': 0,
                'coverage_percentage': 0,
                'iterations': 0,
                'convergence_time': 0,
                'budget_remaining': budget
            }
        
        # Calculate optimal warehouse locations based on food bank clustering
        warehouse_candidates = self._identify_warehouse_candidates(food_banks, cells)
        
        # Score warehouse candidates
        scored_warehouses = self._score_warehouse_candidates(warehouse_candidates, food_banks)
        
        # Select optimal warehouses within budget
        selected_warehouses = self._select_optimal_warehouses(scored_warehouses, budget)
        
        # Calculate coverage metrics
        coverage_percentage = self._calculate_coverage(selected_warehouses, food_banks)
        
        convergence_time = time.time() - start_time
        budget_used = sum(w.setup_cost + (12 * w.operational_cost_monthly) for w in selected_warehouses)
        
        logger.info(f"Warehouse optimization complete: {len(selected_warehouses)} warehouses selected, "
                   f"covering {coverage_percentage:.1f}% of food banks, "
                   f"budget used: ${budget_used:,.0f}")
        
        return {
            'warehouses': selected_warehouses,
            'efficiency_score': np.mean([w.efficiency_score for w in selected_warehouses]) if selected_warehouses else 0,
            'coverage_percentage': coverage_percentage,
            'iterations': 1,
            'convergence_time': convergence_time,
            'budget_remaining': budget - budget_used
        }
    
    def _identify_warehouse_candidates(self, food_banks: List[FoodBankLocation], cells: List[Cell]) -> List[Dict[str, Any]]:
        """Identify potential warehouse locations based on food bank clusters with distance constraints"""
        from geopy.distance import geodesic
        
        candidates = []
        max_warehouse_radius = 2.0  # Reduced from 3.0 miles - warehouses should serve smaller areas
        max_banks_per_warehouse = 3  # Maximum food banks one warehouse should serve
        
        # Strategy 1: Create multiple regional warehouses instead of one central one
        # Use a simple clustering approach based on geographic proximity
        unassigned_banks = food_banks.copy()
        cluster_id = 0
        
        while unassigned_banks and cluster_id < 6:  # Maximum 6 potential warehouse locations
            # Pick the food bank with the most nearby unassigned banks
            best_anchor = None
            best_nearby = []
            best_score = 0
            
            for anchor_bank in unassigned_banks:
                nearby_banks = [anchor_bank]  # Include the anchor itself
                
                for other_bank in unassigned_banks:
                    if other_bank.geoid != anchor_bank.geoid:
                        distance = geodesic((anchor_bank.lat, anchor_bank.lon), (other_bank.lat, other_bank.lon)).miles
                        if distance <= max_warehouse_radius and len(nearby_banks) < max_banks_per_warehouse:
                            nearby_banks.append(other_bank)
                
                # Score based on number of banks served and their total impact
                total_impact = sum(bank.expected_impact for bank in nearby_banks)
                score = len(nearby_banks) * 1000 + total_impact  # Prioritize serving more banks
                
                if score > best_score:
                    best_score = score
                    best_anchor = anchor_bank
                    best_nearby = nearby_banks
            
            if best_anchor and len(best_nearby) >= 1:  # At least serve the anchor bank
                # Calculate centroid of this cluster
                cluster_lat = sum(bank.lat for bank in best_nearby) / len(best_nearby)
                cluster_lon = sum(bank.lon for bank in best_nearby) / len(best_nearby)
                
                # Find the cell closest to this cluster centroid
                closest_cell = None
                min_distance = float('inf')
                
                for cell in cells:
                    distance = geodesic((cluster_lat, cluster_lon), (cell.lat, cell.lon)).miles
                    if distance < min_distance:
                        min_distance = distance
                        closest_cell = cell
                
                if closest_cell:
                    candidates.append({
                        'cell': closest_cell,
                        'type': f'regional_cluster_{cluster_id}',
                        'food_banks_served': [bank.geoid for bank in best_nearby],
                        'coverage_score': len(best_nearby),
                        'centroid_distance': min_distance,
                        'cluster_impact': sum(bank.expected_impact for bank in best_nearby)
                    })
                    
                    # Remove assigned banks from unassigned list
                    for bank in best_nearby:
                        if bank in unassigned_banks:
                            unassigned_banks.remove(bank)
                    
                    cluster_id += 1
            else:
                break  # No more viable clusters
        
        # Strategy 2: Individual warehouses for remaining isolated food banks
        for food_bank in unassigned_banks:
            # Find the cell closest to this isolated food bank
            closest_cell = None
            min_distance = float('inf')
            
            for cell in cells:
                distance = geodesic((food_bank.lat, food_bank.lon), (cell.lat, cell.lon)).miles
                if distance < min_distance:
                    min_distance = distance
                    closest_cell = cell
            
            if closest_cell:
                candidates.append({
                    'cell': closest_cell,
                    'type': 'isolated',
                    'food_banks_served': [food_bank.geoid],
                    'coverage_score': 1,
                    'centroid_distance': min_distance,
                    'cluster_impact': food_bank.expected_impact
                })
        
        return candidates
    
    def _score_warehouse_candidates(self, candidates: List[Dict[str, Any]], food_banks: List[FoodBankLocation]) -> List[Dict[str, Any]]:
        """Score warehouse candidates based on efficiency metrics with cost optimization"""
        scored_candidates = []
        
        for candidate in candidates:
            cell = candidate['cell']
            coverage_score = candidate['coverage_score']
            cluster_impact = candidate.get('cluster_impact', 0)
            
            # Base efficiency on coverage and location quality, but penalize overly large warehouses
            location_efficiency = max(0.1, 1.0 - (candidate['centroid_distance'] / 5.0))  # Normalize distance over 5 miles
            
            # Efficiency favors moderate coverage (2-3 food banks) over single or too many
            if coverage_score == 1:
                coverage_efficiency = 0.7  # Decent for isolated locations
            elif coverage_score <= 3:
                coverage_efficiency = 1.0  # Optimal range
            else:
                coverage_efficiency = 0.8 - (coverage_score - 3) * 0.1  # Penalize oversized warehouses
            
            # Combined efficiency score with distance weighting
            efficiency = 0.4 * coverage_efficiency + 0.6 * location_efficiency
            
            # Calculate warehouse costs - smaller warehouses are more cost-effective per unit
            capacity = sum(fb.expected_impact for fb in food_banks if fb.geoid in candidate['food_banks_served'])
            
            # More realistic warehouse costs - smaller fixed costs, higher variable costs
            base_setup_cost = 120000  # $120k base setup cost (reduced)
            # Economies of scale diminish for larger warehouses
            capacity_cost_per_unit = 15 if coverage_score <= 2 else 20 if coverage_score <= 3 else 25
            setup_cost = base_setup_cost + (capacity * capacity_cost_per_unit)
            
            # Operational costs scale with complexity of serving multiple locations
            base_operations = 8000  # $8k base monthly operations
            variable_operations = capacity * 2.0  # $2/unit/month
            coordination_cost = (coverage_score - 1) * 1500  # $1.5k per additional food bank served
            operational_cost = base_operations + variable_operations + coordination_cost
            
            # Distribution radius based on coverage
            distribution_radius = min(2.5, 1.5 + (coverage_score - 1) * 0.3)  # 1.5-2.5 miles
            
            warehouse = WarehouseLocation(
                geoid=f"warehouse_{cell.geoid}",
                lat=cell.lat,
                lon=cell.lon,
                capacity=int(capacity),
                distribution_radius=distribution_radius,
                efficiency_score=efficiency,
                setup_cost=setup_cost,
                operational_cost_monthly=operational_cost,
                food_banks_served=candidate['food_banks_served']
            )
            
            # Score considers efficiency and cost-effectiveness
            cost_effectiveness = cluster_impact / max(setup_cost, 1)  # Impact per setup dollar
            final_score = efficiency * 0.7 + cost_effectiveness * 0.3
            
            scored_candidates.append({
                'warehouse': warehouse,
                'score': final_score,
                'coverage': coverage_score,
                'type': candidate['type'],
                'cost_effectiveness': cost_effectiveness
            })
        
        return sorted(scored_candidates, key=lambda x: x['score'], reverse=True)
    
    def _select_optimal_warehouses(self, scored_candidates: List[Dict[str, Any]], budget: float) -> List[WarehouseLocation]:
        """Select optimal subset of warehouses within budget constraints, favoring multiple smaller warehouses"""
        selected = []
        remaining_budget = budget
        served_food_banks = set()
        
        # First pass: Select warehouses that don't overlap with already served food banks
        for candidate in scored_candidates:
            warehouse = candidate['warehouse']
            
            # Calculate total cost (setup + 8 months operational for quicker ROI)
            total_cost = warehouse.setup_cost + (8 * warehouse.operational_cost_monthly)
            
            if total_cost <= remaining_budget:
                # Check if this warehouse serves any new food banks
                new_banks_served = set(warehouse.food_banks_served) - served_food_banks
                
                # Accept if it serves new banks or if we don't have any warehouses yet
                if new_banks_served or len(selected) == 0:
                    selected.append(warehouse)
                    remaining_budget -= total_cost
                    served_food_banks.update(warehouse.food_banks_served)
                    
                    logger.info(f"Selected {candidate['type']} warehouse: capacity {warehouse.capacity}, "
                               f"serves {len(warehouse.food_banks_served)} food banks, "
                               f"cost: ${total_cost:,.0f}, remaining budget: ${remaining_budget:,.0f}")
        
        # Second pass: If we have budget left and unserved food banks, try to add more warehouses
        all_food_banks = set()
        for candidate in scored_candidates:
            all_food_banks.update(candidate['warehouse'].food_banks_served)
        
        unserved_banks = all_food_banks - served_food_banks
        
        if unserved_banks and remaining_budget > 200000:  # If significant budget remains and unserved banks exist
            logger.info(f"Second pass: {len(unserved_banks)} unserved food banks, ${remaining_budget:,.0f} budget remaining")
            
            for candidate in scored_candidates:
                warehouse = candidate['warehouse']
                
                # Skip if already selected
                if warehouse.geoid in [w.geoid for w in selected]:
                    continue
                
                # Calculate cost with shorter operational period
                total_cost = warehouse.setup_cost + (6 * warehouse.operational_cost_monthly)
                
                if total_cost <= remaining_budget:
                    # Check if this warehouse serves any currently unserved banks
                    banks_served_by_warehouse = set(warehouse.food_banks_served)
                    new_coverage = banks_served_by_warehouse.intersection(unserved_banks)
                    
                    if new_coverage:
                        selected.append(warehouse)
                        remaining_budget -= total_cost
                        served_food_banks.update(warehouse.food_banks_served)
                        unserved_banks -= banks_served_by_warehouse
                        
                        logger.info(f"Second pass selected {candidate['type']} warehouse: "
                                   f"serves {len(new_coverage)} additional food banks, "
                                   f"cost: ${total_cost:,.0f}")
                        
                        # Stop if we've covered all food banks or budget is low
                        if not unserved_banks or remaining_budget < 150000:
                            break
        
        return selected
    
    def _identify_strategic_warehouse_locations(self, cells: List[Cell]) -> List[Dict[str, Any]]:
        """Identify strategic warehouse locations with large coverage areas"""
        from geopy.distance import geodesic
        import numpy as np
        
        candidates = []
        warehouse_service_radius = 6.0  # Large 6-mile service radius for warehouses
        
        # Filter cells with significant need/population
        viable_cells = [cell for cell in cells if cell.need > 50 and cell.population > 100]
        
        if not viable_cells:
            viable_cells = sorted(cells, key=lambda c: c.need, reverse=True)[:10]
        
        # Strategy: Place warehouses to maximize coverage with minimal overlap
        for cell in viable_cells:
            # Check if this area is already well-covered by existing candidates
            is_well_covered = False
            for existing in candidates:
                distance = geodesic((cell.lat, cell.lon), (existing['cell'].lat, existing['cell'].lon)).miles
                if distance < warehouse_service_radius * 0.7:  # 70% overlap threshold
                    is_well_covered = True
                    break
            
            if not is_well_covered:
                # Calculate cells within service radius
                cells_within_radius = []
                total_need_served = 0
                total_population_served = 0
                
                for other_cell in cells:
                    distance = geodesic((cell.lat, cell.lon), (other_cell.lat, other_cell.lon)).miles
                    if distance <= warehouse_service_radius:
                        cells_within_radius.append(other_cell)
                        total_need_served += other_cell.need
                        total_population_served += other_cell.population
                
                if len(cells_within_radius) >= 5:  # Minimum coverage requirement
                    candidates.append({
                        'cell': cell,
                        'type': 'strategic_hub',
                        'cells_covered': cells_within_radius,
                        'coverage_count': len(cells_within_radius),
                        'total_need_served': total_need_served,
                        'total_population_served': total_population_served,
                        'service_radius': warehouse_service_radius
                    })
        
        # Sort by coverage efficiency
        candidates.sort(key=lambda x: x['total_need_served'], reverse=True)
        
        return candidates[:6]  # Maximum 6 warehouse candidates
    
    def _score_strategic_warehouses(self, candidates: List[Dict[str, Any]], cells: List[Cell]) -> List[Dict[str, Any]]:
        """Score strategic warehouse candidates"""
        scored_candidates = []
        total_domain_need = sum(cell.need for cell in cells)
        
        for candidate in candidates:
            cell = candidate['cell']
            coverage_need = candidate['total_need_served']
            coverage_population = candidate['total_population_served']
            
            # Strategic scoring based on coverage and logistics efficiency
            coverage_efficiency = min(1.0, coverage_need / max(total_domain_need * 0.4, 1))  # Up to 40% of domain need
            population_density = coverage_population / max(candidate['coverage_count'], 1)
            logistics_score = min(1.0, population_density / 500)  # Normalize around 500 people per cell
            
            # Combined efficiency
            efficiency = 0.6 * coverage_efficiency + 0.4 * logistics_score
            
            # Calculate warehouse costs - larger strategic warehouses
            base_setup_cost = 180000  # $180k base setup for strategic warehouse
            capacity = int(coverage_need * 0.6)  # Serve 60% of covered need
            capacity_cost = capacity * 12  # $12 per unit capacity
            setup_cost = base_setup_cost + capacity_cost
            
            # Operational costs scale with coverage area
            base_operations = 15000  # $15k base monthly operations
            coverage_operations = candidate['coverage_count'] * 100  # $100 per cell covered
            operational_cost = base_operations + coverage_operations
            
            warehouse = WarehouseLocation(
                geoid=f"strategic_warehouse_{cell.geoid}",
                lat=cell.lat,
                lon=cell.lon,
                capacity=capacity,
                distribution_radius=candidate['service_radius'],
                efficiency_score=efficiency,
                setup_cost=setup_cost,
                operational_cost_monthly=operational_cost,
                food_banks_served=[]  # Will be populated when food banks are placed
            )
            
            scored_candidates.append({
                'warehouse': warehouse,
                'score': efficiency,
                'coverage_need': coverage_need,
                'coverage_count': candidate['coverage_count'],
                'type': candidate['type']
            })
        
        return sorted(scored_candidates, key=lambda x: x['score'], reverse=True)
    
    def _select_strategic_warehouses(self, scored_candidates: List[Dict[str, Any]], budget: float) -> List[WarehouseLocation]:
        """Select strategic warehouses within budget"""
        selected = []
        remaining_budget = budget
        
        for candidate in scored_candidates:
            warehouse = candidate['warehouse']
            total_cost = warehouse.setup_cost + (8 * warehouse.operational_cost_monthly)
            
            if total_cost <= remaining_budget:
                selected.append(warehouse)
                remaining_budget -= total_cost
                
                logger.info(f"Selected strategic warehouse: coverage {candidate['coverage_count']} cells, "
                           f"serves {candidate['coverage_need']:.0f} need, "
                           f"cost: ${total_cost:,.0f}")
                
                # Stop if we have good coverage or limited budget
                if len(selected) >= 4 or remaining_budget < 200000:
                    break
        
        return selected
    
    def _calculate_strategic_coverage(self, warehouses: List[WarehouseLocation], cells: List[Cell]) -> float:
        """Calculate percentage of domain area covered by warehouses"""
        if not warehouses or not cells:
            return 0.0
        
        from geopy.distance import geodesic
        covered_cells = set()
        
        for warehouse in warehouses:
            for cell in cells:
                distance = geodesic((warehouse.lat, warehouse.lon), (cell.lat, cell.lon)).miles
                if distance <= warehouse.distribution_radius:
                    covered_cells.add(cell.geoid)
        
        return (len(covered_cells) / len(cells)) * 100
    
    def _calculate_coverage(self, warehouses: List[WarehouseLocation], food_banks: List[FoodBankLocation]) -> float:
        """Calculate percentage of food banks covered by warehouses"""
        if not food_banks:
            return 0.0
        
        covered_banks = set()
        for warehouse in warehouses:
            covered_banks.update(warehouse.food_banks_served)
        
        return (len(covered_banks) / len(food_banks)) * 100.0

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
            
            # Validate budget (use same calculation as optimization)
            total_cost = location.setup_cost + (12 * location.operational_cost_monthly)
            if budget_used + total_cost > budget:
                # Try with 6 months if we have significant budget left
                if budget - budget_used > location.setup_cost * 2:
                    total_cost = location.setup_cost + (6 * location.operational_cost_monthly)
                    if budget_used + total_cost > budget:
                        valid = False
                        adjustments_made += 1
                else:
                    valid = False
                    adjustments_made += 1
            
            if valid:
                validated_locations.append(location)
                try:
                    total_impact += location.expected_impact
                    budget_used += total_cost
                except TypeError as e:
                    logger.error(f"Type error in validation accumulation: {e}")
                    logger.error(f"total_impact type: {type(total_impact)}, value: {total_impact}")
                    logger.error(f"location.expected_impact type: {type(location.expected_impact)}, value: {location.expected_impact}")
                    logger.error(f"budget_used type: {type(budget_used)}, value: {budget_used}")
                    logger.error(f"total_cost type: {type(total_cost)}, value: {total_cost}")
                    raise
        
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
            if budget_used + total_cost > budget:
                # Try with 6 months if we have significant budget left
                if budget - budget_used > warehouse.setup_cost * 2:
                    total_cost = warehouse.setup_cost + (6 * warehouse.operational_cost_monthly)
                    if budget_used + total_cost > budget:
                        valid = False
                        adjustments_made += 1
                else:
                    valid = False
                    adjustments_made += 1
            
            if valid:
                validated_warehouses.append(warehouse)
                try:
                    total_impact += total_cost
                    budget_used += total_cost
                except TypeError as e:
                    logger.error(f"Type error in validation accumulation: {e}")
                    logger.error(f"total_impact type: {type(total_impact)}, value: {total_impact}")
                    logger.error(f"total_cost type: {type(total_cost)}, value: {total_cost}")
                    logger.error(f"budget_used type: {type(budget_used)}, value: {budget_used}")
                    raise
        
        # Calculate coverage percentage
        coverage_percentage = (len(covered_cells) / len(cells)) * 100 if cells else 0
        
        logger.info(f"Validation complete: {len(validated_locations)} food banks, {len(validated_warehouses)} warehouses validated, "
                   f"{adjustments_made} adjustments made")
        
        return {
            'validated_locations': validated_locations,
            'validated_warehouses': validated_warehouses,
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