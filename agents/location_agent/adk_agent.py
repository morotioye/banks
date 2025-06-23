#!/usr/bin/env python3
"""
Food Bank Location Optimization Agent using Google ADK
"""

import os
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from google.adk.agents import Agent
from google.genai import types
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'testbank')

# Google Cloud configuration
GOOGLE_CLOUD_PROJECT = os.getenv('GOOGLE_CLOUD_PROJECT')
GOOGLE_CLOUD_LOCATION = os.getenv('GOOGLE_CLOUD_LOCATION', 'us-central1')

@dataclass
class OptimizationRequest:
    """Request parameters for optimization"""
    domain: str
    budget: float
    max_locations: int = 1000
    min_distance_between_banks: float = 0.3

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
    capacity: int
    distribution_radius: float
    efficiency_score: float
    setup_cost: float
    operational_cost_monthly: float
    food_banks_served: List[str]

# Tool functions that the agent can use
def analyze_domain_data(domain: str) -> Dict[str, Any]:
    """
    Analyzes population and food insecurity data for a given domain.
    
    Args:
        domain: The domain name to analyze
        
    Returns:
        dict: Contains analyzed cells and statistics
    """
    try:
        db_client = MongoClient(MONGO_URI)
        db = db_client[DB_NAME]
        collection_name = f"d_{domain}"
        
        if collection_name not in db.list_collection_names():
            return {
                'status': 'error',
                'message': f"Domain collection '{collection_name}' not found",
                'cells': [],
                'statistics': {}
            }
        
        collection = db[collection_name]
        
        # Fetch blocks
        projection = {
            'properties': 1,
            'geometry.coordinates': 1,
            '_id': 0
        }
        
        blocks = list(collection.find({}, projection))
        logger.info(f"Fetched {len(blocks)} blocks from database")
        
        cells = []
        for block in blocks:
            props = block['properties']
            
            # Extract centroid
            try:
                coords = block['geometry']['coordinates'][0]
                if isinstance(coords[0], (int, float)):
                    centroid_lon = coords[0]
                    centroid_lat = coords[1]
                else:
                    lons = [c[0] for c in coords]
                    lats = [c[1] for c in coords]
                    centroid_lon = sum(lons) / len(lons)
                    centroid_lat = sum(lats) / len(lats)
            except (IndexError, TypeError):
                continue
            
            population = props.get('pop', 0)
            food_insecurity_score = props.get('food_insecurity_score', 0)
            need = props.get('need', population * food_insecurity_score)
            
            cell = {
                'geoid': props['geoid'],
                'lat': float(centroid_lat),
                'lon': float(centroid_lon),
                'population': int(population),
                'food_insecurity_score': float(food_insecurity_score),
                'poverty_rate': float(props.get('poverty_rate', 0)),
                'snap_rate': float(props.get('snap_rate', 0)),
                'vehicle_access_rate': float(props.get('vehicle_access_rate', 1.0)),
                'need': float(need),
                'geometry': block['geometry']
            }
            
            if cell['population'] > 0:
                cells.append(cell)
        
        # Calculate statistics
        total_population = sum(c['population'] for c in cells)
        total_need = sum(c['need'] for c in cells)
        
        statistics = {
            'total_cells': len(cells),
            'total_population': total_population,
            'total_need': total_need,
            'avg_food_insecurity': np.mean([c['food_insecurity_score'] for c in cells]) if cells else 0,
            'high_need_cells': len([c for c in cells if c['food_insecurity_score'] > 4])
        }
        
        db_client.close()
        
        return {
            'status': 'success',
            'cells': cells,
            'statistics': statistics
        }
        
    except Exception as e:
        logger.error(f"Error analyzing domain: {str(e)}")
        return {
            'status': 'error',
            'message': str(e),
            'cells': [],
            'statistics': {}
        }

def optimize_food_bank_locations(
    cells: List[Dict[str, Any]], 
    budget: float, 
    max_locations: int = 1000,
    min_distance: float = 0.3
) -> Dict[str, Any]:
    """
    Optimizes food bank locations based on need and budget constraints.
    
    Args:
        cells: List of geographic cells with population data
        budget: Total budget available
        max_locations: Maximum number of locations
        min_distance: Minimum distance between food banks in miles
        
    Returns:
        dict: Optimized locations and metrics
    """
    try:
        from geopy.distance import geodesic
        
        # Sort cells by need
        sorted_cells = sorted(cells, key=lambda c: c['need'], reverse=True)
        
        selected_locations = []
        remaining_budget = budget
        used_cells = set()
        
        for cell in sorted_cells:
            if cell['geoid'] in used_cells:
                continue
                
            if len(selected_locations) >= max_locations:
                break
            
            # Check minimum distance
            too_close = False
            for loc in selected_locations:
                distance = geodesic(
                    (cell['lat'], cell['lon']),
                    (loc['lat'], loc['lon'])
                ).miles
                if distance < min_distance:
                    too_close = True
                    break
            
            if too_close:
                continue
            
            # Calculate costs
            setup_cost = 150000  # $150k setup
            operational_cost = 15000  # $15k/month
            total_cost = setup_cost + (6 * operational_cost)
            
            if total_cost > remaining_budget:
                continue
            
            # Create food bank location
            location = {
                'geoid': cell['geoid'],
                'lat': cell['lat'],
                'lon': cell['lon'],
                'expected_impact': min(int(cell['need']), 2000),
                'coverage_radius': 1.5,
                'efficiency_score': 0.85,
                'setup_cost': setup_cost,
                'operational_cost_monthly': operational_cost
            }
            
            selected_locations.append(location)
            used_cells.add(cell['geoid'])
            remaining_budget -= total_cost
        
        # Calculate metrics
        total_impact = sum(loc['expected_impact'] for loc in selected_locations)
        budget_used = budget - remaining_budget
        
        return {
            'status': 'success',
            'locations': selected_locations,
            'total_impact': total_impact,
            'budget_used': budget_used,
            'budget_remaining': remaining_budget,
            'location_count': len(selected_locations)
        }
        
    except Exception as e:
        logger.error(f"Error optimizing locations: {str(e)}")
        return {
            'status': 'error',
            'message': str(e),
            'locations': [],
            'total_impact': 0,
            'budget_used': 0
        }

def optimize_warehouse_locations(
    cells: List[Dict[str, Any]], 
    budget: float
) -> Dict[str, Any]:
    """
    Optimizes warehouse locations for distribution efficiency.
    
    Args:
        cells: List of geographic cells
        budget: Budget for warehouses
        
    Returns:
        dict: Optimized warehouse locations
    """
    try:
        if not cells:
            return {
                'status': 'error',
                'message': 'No cells provided',
                'warehouses': []
            }
        
        # Calculate centroid
        center_lat = sum(cell['lat'] for cell in cells) / len(cells)
        center_lon = sum(cell['lon'] for cell in cells) / len(cells)
        
        # Create 2 strategic warehouse locations
        warehouses = [
            {
                'geoid': 'warehouse_1',
                'lat': center_lat + 0.01,
                'lon': center_lon + 0.01,
                'capacity': 10000,
                'distribution_radius': 3.0,
                'efficiency_score': 0.92,
                'setup_cost': 100000,
                'operational_cost_monthly': 5000,
                'food_banks_served': []
            },
            {
                'geoid': 'warehouse_2',
                'lat': center_lat - 0.01,
                'lon': center_lon - 0.01,
                'capacity': 8000,
                'distribution_radius': 2.5,
                'efficiency_score': 0.88,
                'setup_cost': 80000,
                'operational_cost_monthly': 4000,
                'food_banks_served': []
            }
        ]
        
        # Filter warehouses by budget
        selected_warehouses = []
        remaining_budget = budget
        
        for warehouse in warehouses:
            total_cost = warehouse['setup_cost'] + (6 * warehouse['operational_cost_monthly'])
            if total_cost <= remaining_budget:
                selected_warehouses.append(warehouse)
                remaining_budget -= total_cost
        
        return {
            'status': 'success',
            'warehouses': selected_warehouses,
            'total_capacity': sum(w['capacity'] for w in selected_warehouses),
            'budget_used': budget - remaining_budget
        }
        
    except Exception as e:
        logger.error(f"Error optimizing warehouses: {str(e)}")
        return {
            'status': 'error',
            'message': str(e),
            'warehouses': []
        }

# Create the main orchestrator agent
orchestrator_agent = Agent(
    name="food_bank_optimization_orchestrator",
    model="gemini-2.0-flash",
    description="Orchestrates the food bank location optimization process",
    instruction="""You are an AI assistant that helps optimize food bank locations.
    
    When given a domain and budget, you should:
    1. First analyze the domain data to understand the population and food insecurity
    2. Allocate 25% of the budget for warehouses
    3. Use the remaining 75% for food bank locations
    4. Optimize warehouse locations first
    5. Then optimize food bank locations within warehouse coverage areas
    6. Provide a summary of the optimization results
    
    Always provide clear explanations of your decisions and the results.""",
    tools=[analyze_domain_data, optimize_food_bank_locations, optimize_warehouse_locations]
)

# Create specialized sub-agents
data_analysis_agent = Agent(
    name="data_analysis_agent",
    model="gemini-2.0-flash",
    description="Specializes in analyzing geographic and demographic data",
    instruction="You analyze population, food insecurity, and geographic data to identify areas of highest need.",
    tools=[analyze_domain_data]
)

location_optimization_agent = Agent(
    name="location_optimization_agent", 
    model="gemini-2.0-flash",
    description="Specializes in optimizing food bank and warehouse locations",
    instruction="You optimize the placement of food banks and warehouses based on need, budget, and geographic constraints.",
    tools=[optimize_food_bank_locations, optimize_warehouse_locations]
)

# Create the root agent that can delegate to sub-agents
root_agent = Agent(
    name="food_bank_system",
    model="gemini-2.0-flash",
    description="Food Bank Location Optimization System",
    instruction="""You are the main food bank optimization system. You coordinate the optimization process by:
    1. Using the data analysis agent to understand the domain
    2. Using the location optimization agent to find optimal locations
    3. Providing comprehensive results and recommendations
    
    For any optimization request, provide:
    - Number of food banks and warehouses selected
    - Total people served
    - Budget utilization
    - Coverage metrics
    - Key insights and recommendations""",
    tools=[analyze_domain_data, optimize_food_bank_locations, optimize_warehouse_locations]
)

# Helper function to run optimization
async def run_optimization(domain: str, budget: float, max_locations: int = 1000) -> Dict[str, Any]:
    """
    Runs the full optimization process using the ADK agent.
    
    Args:
        domain: Domain to optimize
        budget: Total budget
        max_locations: Maximum number of locations
        
    Returns:
        dict: Optimization results
    """
    prompt = f"""
    Please optimize food bank locations for domain '{domain}' with a budget of ${budget:,.2f}.
    
    Requirements:
    - Maximum {max_locations} food bank locations
    - Minimum 0.3 miles between food banks
    - Allocate 25% of budget for warehouses, 75% for food banks
    - Focus on areas with highest food insecurity and lowest vehicle access
    
    Please provide a complete optimization plan.
    """
    
    try:
        # Use the orchestrator agent directly
        response = await orchestrator_agent.run(prompt)
        return response
    except Exception as e:
        logger.error(f"Error running optimization: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

# Safety settings (optional)
# safety_settings = [
#     types.SafetySetting(
#         category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
#         threshold=types.HarmBlockThreshold.OFF,
#     ),
# ]

# Content generation config (optional)
# generate_content_config = types.GenerateContentConfig(
#     safety_settings=safety_settings,
#     temperature=0.2,  # Lower temperature for more consistent results
#     max_output_tokens=2000,
#     top_p=0.95,
# )

# Configure agents with safety settings
# for agent in [orchestrator_agent, data_analysis_agent, location_optimization_agent, root_agent]:
#     agent.generate_content_config = generate_content_config 