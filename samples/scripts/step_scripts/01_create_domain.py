#!/usr/bin/env python3
"""
Step 1: Create a domain collection from census blocks within a specified area.
Creates a new collection with prefix 'd_' containing copies of census blocks.
"""

import os
import sys
import logging
from pymongo import MongoClient
from dotenv import load_dotenv
import argparse
from datetime import datetime
import re

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Load environment variables
load_dotenv()

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('TEST_DB_NAME', 'food_insecurity_test')

def sanitize_domain_name(name):
    """Sanitize domain name for MongoDB collection naming."""
    # Replace spaces and special characters with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
    # Remove consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    return sanitized

def create_domain(domain_name, center_lat, center_lon, radius_miles):
    """
    Create a domain collection by copying census blocks within radius.
    
    Args:
        domain_name: Name for the domain (will be prefixed with 'd_')
        center_lat: Latitude of center point
        center_lon: Longitude of center point
        radius_miles: Radius in miles
    """
    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Sanitize and create collection name
    sanitized_name = sanitize_domain_name(domain_name)
    collection_name = f"d_{sanitized_name}"
    
    logging.info(f"Creating domain collection: {collection_name}")
    logging.info(f"Center: ({center_lat}, {center_lon})")
    logging.info(f"Radius: {radius_miles} miles")
    
    # Check if domain already exists
    if collection_name in db.list_collection_names():
        logging.warning(f"Domain collection {collection_name} already exists. Dropping and recreating...")
        db[collection_name].drop()
    
    # Get source collection
    source_collection = db['census_blocks']
    
    # Find blocks within radius using geospatial query
    radius_meters = radius_miles * 1609.34
    
    blocks_cursor = source_collection.find({
        "geometry": {
            "$nearSphere": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [center_lon, center_lat]
                },
                "$maxDistance": radius_meters
            }
        }
    })
    
    # Copy blocks to domain collection
    domain_collection = db[collection_name]
    blocks_copied = 0
    total_population = 0
    
    blocks_list = list(blocks_cursor)
    
    if not blocks_list:
        logging.error("No blocks found within the specified radius!")
        return None
    
    # Insert blocks in batches
    batch_size = 1000
    for i in range(0, len(blocks_list), batch_size):
        batch = blocks_list[i:i+batch_size]
        
        # Add domain metadata to each block
        for block in batch:
            block['domain_metadata'] = {
                'domain_name': domain_name,
                'center_lat': center_lat,
                'center_lon': center_lon,
                'radius_miles': radius_miles,
                'added_at': datetime.utcnow()
            }
            # Remove _id to avoid conflicts
            if '_id' in block:
                del block['_id']
            
            # Track statistics
            total_population += block.get('properties', {}).get('pop', 0)
        
        domain_collection.insert_many(batch)
        blocks_copied += len(batch)
        logging.info(f"  Copied {blocks_copied} blocks so far...")
    
    # Create indexes
    logging.info("Creating indexes...")
    domain_collection.create_index("properties.geoid")
    domain_collection.create_index([("geometry", "2dsphere")])
    domain_collection.create_index("properties.pop")
    domain_collection.create_index("properties.poverty_rate")
    domain_collection.create_index("properties.snap_rate")
    
    # Calculate domain statistics
    stats = {
        'total_blocks': blocks_copied,
        'total_population': total_population,
        'blocks_with_poverty_data': domain_collection.count_documents({"properties.poverty_rate": {"$gt": 0}}),
        'blocks_with_snap_data': domain_collection.count_documents({"properties.snap_rate": {"$gt": 0}})
    }
    
    # Create domain metadata document
    metadata_collection = db['domain_metadata']
    metadata_collection.update_one(
        {'collection_name': collection_name},
        {
            '$set': {
                'collection_name': collection_name,
                'domain_name': domain_name,
                'center_lat': center_lat,
                'center_lon': center_lon,
                'radius_miles': radius_miles,
                'created_at': datetime.utcnow(),
                'stats': stats
            }
        },
        upsert=True
    )
    
    logging.info("=" * 60)
    logging.info("DOMAIN CREATION COMPLETE")
    logging.info("=" * 60)
    logging.info(f"Collection name: {collection_name}")
    logging.info(f"Total blocks: {blocks_copied:,}")
    logging.info(f"Total population: {total_population:,}")
    logging.info(f"Blocks with poverty data: {stats['blocks_with_poverty_data']:,}")
    logging.info(f"Blocks with SNAP data: {stats['blocks_with_snap_data']:,}")
    
    return collection_name

def main():
    """Main function with argument parsing."""
    parser = argparse.ArgumentParser(description='Create a domain collection from census blocks')
    parser.add_argument('--name', type=str, default='downtown_la',
                       help='Name for the domain (will be prefixed with d_)')
    parser.add_argument('--lat', type=float, default=34.0522,
                       help='Latitude of center point')
    parser.add_argument('--lon', type=float, default=-118.2437,
                       help='Longitude of center point')
    parser.add_argument('--radius', type=float, default=2.0,
                       help='Radius in miles')
    
    args = parser.parse_args()
    
    # Create domain
    collection_name = create_domain(
        domain_name=args.name,
        center_lat=args.lat,
        center_lon=args.lon,
        radius_miles=args.radius
    )
    
    if collection_name:
        print(f"\nDomain collection '{collection_name}' created successfully!")
        print(f"You can now run subsequent steps using:")
        print(f"  --collection {collection_name}")

if __name__ == "__main__":
    main() 