#!/usr/bin/env python3
"""
Script to create empty cell objects based on a grid of centroid coordinates.
Creates cells with only lat/lon coordinates, no other values yet.
Saves to MongoDB collection in TEST_DB_NAME.
"""

import os
import sys
from typing import List, Dict, Tuple
import numpy as np
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from datetime import datetime
import argparse
from tqdm import tqdm

# Load environment variables
load_dotenv()

def get_mongodb_connection():
    """Establish connection to MongoDB."""
    mongodb_uri = os.getenv('MONGODB_URI')
    if not mongodb_uri:
        raise ValueError("MONGODB_URI not found in environment variables")
    
    try:
        client = MongoClient(mongodb_uri)
        # Test connection
        client.admin.command('ping')
        print(f"✓ Connected to MongoDB")
        return client
    except ConnectionFailure as e:
        print(f"✗ Failed to connect to MongoDB: {e}")
        sys.exit(1)

def create_grid_bounds(
    min_lat: float, 
    max_lat: float, 
    min_lon: float, 
    max_lon: float, 
    cell_size: float
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create grid of centroid coordinates.
    
    Args:
        min_lat: Minimum latitude
        max_lat: Maximum latitude
        min_lon: Minimum longitude
        max_lon: Maximum longitude
        cell_size: Size of each cell in degrees
        
    Returns:
        Tuple of (latitudes, longitudes) arrays
    """
    # Create arrays of coordinates
    lats = np.arange(min_lat + cell_size/2, max_lat, cell_size)
    lons = np.arange(min_lon + cell_size/2, max_lon, cell_size)
    
    return lats, lons

def create_empty_cells(
    lats: np.ndarray, 
    lons: np.ndarray,
    cell_size: float
) -> List[Dict]:
    """
    Create empty cell documents with only centroid coordinates.
    
    Args:
        lats: Array of latitudes
        lons: Array of longitudes
        
    Returns:
        List of cell documents
    """
    cells = []
    total_cells = len(lats) * len(lons)
    
    print(f"Creating {total_cells} cells...")
    
    with tqdm(total=total_cells, desc="Generating cells") as pbar:
        for lat in lats:
            for lon in lons:
                cell = {
                    'centroidLat': float(lat),
                    'centroidLon': float(lon),
                    'cellSizeSquareMeters': 150000,  # 150,000 m²
                    'cellSizeDegrees': cell_size,
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow(),
                    # Placeholder values - will be populated by subsequent scripts
                    'population': None,
                    'foodInsecurityFactors': None,
                    'foodInsecurityScore': None,
                    'need': None
                }
                cells.append(cell)
                pbar.update(1)
    
    return cells

def save_cells_to_mongodb(cells: List[Dict], client: MongoClient, db_name: str, collection_name: str = 'cells'):
    """
    Save cells to MongoDB collection.
    
    Args:
        cells: List of cell documents
        client: MongoDB client
        db_name: Database name
        collection_name: Collection name (default: 'cells')
    """
    db = client[db_name]
    collection = db[collection_name]
    
    # Drop existing collection if it exists
    if collection_name in db.list_collection_names():
        print(f"⚠ Dropping existing collection '{collection_name}'")
        collection.drop()
    
    # Create indexes
    print("Creating indexes...")
    collection.create_index([('centroidLat', ASCENDING), ('centroidLon', ASCENDING)])
    collection.create_index([('centroidLat', ASCENDING)])
    collection.create_index([('centroidLon', ASCENDING)])
    
    # Insert cells in batches
    batch_size = 1000
    total_inserted = 0
    
    print(f"Inserting {len(cells)} cells into MongoDB...")
    
    with tqdm(total=len(cells), desc="Inserting cells") as pbar:
        for i in range(0, len(cells), batch_size):
            batch = cells[i:i + batch_size]
            result = collection.insert_many(batch)
            total_inserted += len(result.inserted_ids)
            pbar.update(len(batch))
    
    print(f"✓ Successfully inserted {total_inserted} cells")
    
    # Print summary statistics
    stats = {
        'total_cells': collection.count_documents({}),
        'lat_range': collection.aggregate([
            {'$group': {
                '_id': None,
                'min': {'$min': '$centroidLat'},
                'max': {'$max': '$centroidLat'}
            }}
        ]).next(),
        'lon_range': collection.aggregate([
            {'$group': {
                '_id': None,
                'min': {'$min': '$centroidLon'},
                'max': {'$max': '$centroidLon'}
            }}
        ]).next()
    }
    
    print("\nCollection Statistics:")
    print(f"  Total cells: {stats['total_cells']}")
    print(f"  Latitude range: {stats['lat_range']['min']:.4f} to {stats['lat_range']['max']:.4f}")
    print(f"  Longitude range: {stats['lon_range']['min']:.4f} to {stats['lon_range']['max']:.4f}")

def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Create empty cell grid for food insecurity analysis')
    
    # Center and radius arguments (alternative to bounds)
    parser.add_argument('--center-lat', type=float, help='Center latitude (default: downtown LA 34.0522)')
    parser.add_argument('--center-lon', type=float, help='Center longitude (default: downtown LA -118.2437)')
    parser.add_argument('--radius-miles', type=float, help='Radius in miles from center (default: 2.0)')
    
    # Grid bounds arguments (override center/radius if provided)
    parser.add_argument('--min-lat', type=float, help='Minimum latitude (overrides center/radius)')
    parser.add_argument('--max-lat', type=float, help='Maximum latitude (overrides center/radius)')
    parser.add_argument('--min-lon', type=float, help='Minimum longitude (overrides center/radius)')
    parser.add_argument('--max-lon', type=float, help='Maximum longitude (overrides center/radius)')
    parser.add_argument('--cell-size', type=float, help='Cell size in degrees (default: 0.00349 for ~150k m²)')
    parser.add_argument('--db-name', type=str, help='Database name (default from env TEST_DB_NAME)')
    parser.add_argument('--collection', type=str, default='cells', help='Collection name (default: cells)')
    
    args = parser.parse_args()
    
    # Get configuration from environment or arguments
    # Calculate cell size: 150,000 m² = 0.15 km²
    # At LA's latitude (~34°), 1 degree ≈ 111 km, so we need ~0.00387 degrees for a square cell
    # sqrt(0.15) ≈ 0.387 km per side, 0.387/111 ≈ 0.00349 degrees
    default_cell_size = 0.00349
    
    # Default center is downtown LA (City Hall)
    default_center_lat = 34.0522
    default_center_lon = -118.2437
    default_radius_miles = 2.0
    
    # Convert radius to degrees (approximate)
    # 1 mile ≈ 1.609 km, at LA latitude: 1 degree ≈ 111 km
    radius_degrees = (default_radius_miles * 1.609) / 111.0
    
    # Calculate bounds from center and radius if not provided
    center_lat = args.center_lat if args.center_lat is not None else float(os.getenv('GRID_CENTER_LAT', str(default_center_lat)))
    center_lon = args.center_lon if args.center_lon is not None else float(os.getenv('GRID_CENTER_LON', str(default_center_lon)))
    radius_miles = args.radius_miles if args.radius_miles is not None else float(os.getenv('GRID_RADIUS_MILES', str(default_radius_miles)))
    
    # Convert radius to degrees
    radius_degrees = (radius_miles * 1.609) / 111.0
    
    # Calculate bounds if not explicitly provided
    min_lat = args.min_lat or float(os.getenv('GRID_MIN_LAT', str(center_lat - radius_degrees)))
    max_lat = args.max_lat or float(os.getenv('GRID_MAX_LAT', str(center_lat + radius_degrees)))
    min_lon = args.min_lon or float(os.getenv('GRID_MIN_LON', str(center_lon - radius_degrees)))
    max_lon = args.max_lon or float(os.getenv('GRID_MAX_LON', str(center_lon + radius_degrees)))
    
    cell_size = args.cell_size or float(os.getenv('GRID_CELL_SIZE', str(default_cell_size)))
    db_name = args.db_name or os.getenv('TEST_DB_NAME', 'food_insecurity_test')
    
    print("Grid Configuration:")
    print(f"  Center: {center_lat}, {center_lon} (downtown LA)" if center_lat == default_center_lat else f"  Center: {center_lat}, {center_lon}")
    print(f"  Radius: {radius_miles} miles")
    print(f"  Latitude: {min_lat:.4f} to {max_lat:.4f}")
    print(f"  Longitude: {min_lon:.4f} to {max_lon:.4f}")
    print(f"  Cell size: {cell_size:.5f} degrees (~150,000 m² per cell)")
    print(f"  Approximate cell dimensions: {cell_size * 111:.2f} km × {cell_size * 111:.2f} km")
    print(f"  Database: {db_name}")
    print(f"  Collection: {args.collection}")
    print()
    
    # Connect to MongoDB
    client = get_mongodb_connection()
    
    try:
        # Create grid
        lats, lons = create_grid_bounds(min_lat, max_lat, min_lon, max_lon, cell_size)
        
        # Create empty cells
        cells = create_empty_cells(lats, lons, cell_size)
        
        # Save to MongoDB
        save_cells_to_mongodb(cells, client, db_name, args.collection)
        
        print("\n✓ Empty cells created successfully!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    main() 