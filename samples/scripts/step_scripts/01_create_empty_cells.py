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
    lons: np.ndarray
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
    
    # Grid bounds arguments
    parser.add_argument('--min-lat', type=float, help='Minimum latitude (default from env or 40.4774)')
    parser.add_argument('--max-lat', type=float, help='Maximum latitude (default from env or 40.9176)')
    parser.add_argument('--min-lon', type=float, help='Minimum longitude (default from env or -74.2591)')
    parser.add_argument('--max-lon', type=float, help='Maximum longitude (default from env or -73.7004)')
    parser.add_argument('--cell-size', type=float, help='Cell size in degrees (default from env or 0.01)')
    parser.add_argument('--db-name', type=str, help='Database name (default from env TEST_DB_NAME)')
    parser.add_argument('--collection', type=str, default='cells', help='Collection name (default: cells)')
    
    args = parser.parse_args()
    
    # Get configuration from environment or arguments
    # Default bounds are for NYC area
    min_lat = args.min_lat or float(os.getenv('GRID_MIN_LAT', '40.4774'))
    max_lat = args.max_lat or float(os.getenv('GRID_MAX_LAT', '40.9176'))
    min_lon = args.min_lon or float(os.getenv('GRID_MIN_LON', '-74.2591'))
    max_lon = args.max_lon or float(os.getenv('GRID_MAX_LON', '-73.7004'))
    cell_size = args.cell_size or float(os.getenv('GRID_CELL_SIZE', '0.01'))
    db_name = args.db_name or os.getenv('TEST_DB_NAME', 'food_insecurity_test')
    
    print("Grid Configuration:")
    print(f"  Latitude: {min_lat} to {max_lat}")
    print(f"  Longitude: {min_lon} to {max_lon}")
    print(f"  Cell size: {cell_size} degrees")
    print(f"  Database: {db_name}")
    print(f"  Collection: {args.collection}")
    print()
    
    # Connect to MongoDB
    client = get_mongodb_connection()
    
    try:
        # Create grid
        lats, lons = create_grid_bounds(min_lat, max_lat, min_lon, max_lon, cell_size)
        
        # Create empty cells
        cells = create_empty_cells(lats, lons)
        
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