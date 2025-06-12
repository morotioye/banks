#!/usr/bin/env python3
"""
Step 3: Fetch vehicle access data and distribute to census blocks.
Uses ACS Table B25044 at block group level to calculate vehicle access rates.
"""

import os
import sys
import logging
import requests
import pandas as pd
import numpy as np
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
import argparse
from datetime import datetime
from collections import defaultdict

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Load environment variables
load_dotenv()

# Configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('TEST_DB_NAME', 'food_insecurity_test')
CENSUS_API_KEY = os.getenv('CENSUS_API_KEY')
CENSUS_API_BASE = 'https://api.census.gov/data'

if not CENSUS_API_KEY:
    raise ValueError("CENSUS_API_KEY environment variable is required")

def extract_counties_from_blocks(collection):
    """Extract unique counties from census blocks in the collection."""
    counties = set()
    
    # Get unique county codes from block GEOIDs
    cursor = collection.find({}, {'properties.geoid': 1})
    
    for block in cursor:
        geoid = block.get('properties', {}).get('geoid', '')
        if len(geoid) >= 5:  # GEOID format: SSCCCTTTTTTBBBB (state+county+tract+block)
            county_fips = geoid[2:5]  # Extract county FIPS
            counties.add(county_fips)
    
    logging.info(f"Found {len(counties)} unique counties in collection")
    return list(counties)

def fetch_vehicle_access_data(county_fips_list, state_fips='06'):
    """
    Fetch vehicle access data from ACS Table B25044 at block group level.
    
    Table B25044: "Tenure by Vehicles Available"
    - B25044_003E: Renter occupied, No vehicle available
    - B25044_010E: Owner occupied, No vehicle available  
    - B25044_001E: Total occupied housing units
    """
    logging.info(f"Fetching vehicle access data for {len(county_fips_list)} counties")
    
    year = "2022"
    dataset = f"{year}/acs/acs5"
    url = f"{CENSUS_API_BASE}/{dataset}"
    
    all_data = []
    
    # Variables for vehicle access
    variables = [
        'B25044_001E',  # Total occupied housing units
        'B25044_003E',  # Renter occupied, No vehicle available
        'B25044_010E',  # Owner occupied, No vehicle available
        'NAME'
    ]
    
    # Fetch data for each county
    for county_fips in county_fips_list:
        params = {
            'get': ','.join(variables),
            'for': 'block group:*',
            'in': f'state:{state_fips} county:{county_fips}',
            'key': CENSUS_API_KEY
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if len(data) > 1:  # Skip if only header row
                all_data.extend(data[1:])  # Skip header
                logging.info(f"  County {county_fips}: {len(data)-1} block groups")
            
        except Exception as e:
            logging.error(f"Error fetching vehicle access data for county {county_fips}: {e}")
            continue
    
    if not all_data:
        raise ValueError("No vehicle access data fetched")
    
    # Convert to DataFrame
    df = pd.DataFrame(all_data, columns=variables + ['state', 'county', 'tract', 'block group'])
    
    # Create block group GEOID
    df['block_group_geoid'] = df['state'] + df['county'] + df['tract'] + df['block group']
    
    # Convert numeric columns
    numeric_cols = ['B25044_001E', 'B25044_003E', 'B25044_010E']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # Calculate vehicle access metrics
    df['total_households'] = df['B25044_001E']
    df['households_no_vehicle'] = df['B25044_003E'] + df['B25044_010E']
    
    # Calculate vehicle access rate (1 - no vehicle rate)
    df['vehicle_access_rate'] = np.where(
        df['total_households'] > 0,
        1 - (df['households_no_vehicle'] / df['total_households']),
        0  # Default to 0 if no household data
    )
    
    # Ensure rate is between 0 and 1
    df['vehicle_access_rate'] = df['vehicle_access_rate'].clip(0, 1)
    
    logging.info(f"Total block groups with vehicle access data: {len(df)}")
    logging.info(f"Average vehicle access rate: {df['vehicle_access_rate'].mean():.3f}")
    logging.info(f"Block groups with 100% vehicle access: {(df['vehicle_access_rate'] == 1.0).sum()}")
    logging.info(f"Block groups with <50% vehicle access: {(df['vehicle_access_rate'] < 0.5).sum()}")
    
    return df

def distribute_vehicle_access_to_blocks(collection, vehicle_access_df):
    """
    Distribute block group vehicle access rates to individual census blocks.
    All blocks within a block group get the same vehicle access rate.
    """
    logging.info("Distributing vehicle access data to census blocks")
    
    # Create lookup dictionary for fast access
    vehicle_lookup = {}
    for _, row in vehicle_access_df.iterrows():
        bg_geoid = row['block_group_geoid']
        vehicle_lookup[bg_geoid] = {
            'vehicle_access_rate': float(row['vehicle_access_rate']),
            'households_no_vehicle': int(row['households_no_vehicle']),
            'total_households': int(row['total_households'])
        }
    
    logging.info(f"Created lookup for {len(vehicle_lookup)} block groups")
    
    # Process all blocks in the collection
    total_blocks = collection.count_documents({})
    logging.info(f"Processing {total_blocks:,} blocks")
    
    updates = []
    blocks_processed = 0
    blocks_with_vehicle_data = 0
    batch_size = 1000
    
    cursor = collection.find({})
    
    for block in cursor:
        geoid = block.get('properties', {}).get('geoid', '')
        
        # Extract block group GEOID from block GEOID
        # Block GEOID format: SSCCCTTTTTTBBBB (15 digits)
        # Block Group GEOID format: SSCCCTTTTTTB (12 digits)
        block_group_geoid = geoid[:12] if len(geoid) >= 12 else ''
        
        # Default values
        vehicle_access_rate = 0.0
        households_no_vehicle = 0
        total_households = 0
        
        # Look up vehicle access data
        if block_group_geoid in vehicle_lookup:
            vehicle_data = vehicle_lookup[block_group_geoid]
            vehicle_access_rate = vehicle_data['vehicle_access_rate']
            households_no_vehicle = vehicle_data['households_no_vehicle']
            total_households = vehicle_data['total_households']
            blocks_with_vehicle_data += 1
        
        # Create update
        update = UpdateOne(
            {'_id': block['_id']},
            {
                '$set': {
                    'properties.vehicle_access_rate': vehicle_access_rate,
                    'properties.households_no_vehicle': households_no_vehicle,
                    'properties.total_households': total_households,
                    'properties.block_group_geoid': block_group_geoid,
                    'properties.vehicle_data_updated_at': datetime.utcnow()
                }
            }
        )
        updates.append(update)
        blocks_processed += 1
        
        # Execute batch updates
        if len(updates) >= batch_size:
            collection.bulk_write(updates)
            logging.info(f"  Processed {blocks_processed:,} blocks...")
            updates = []
    
    # Execute remaining updates
    if updates:
        collection.bulk_write(updates)
    
    # Create indexes for new fields
    logging.info("Creating indexes for vehicle access fields...")
    collection.create_index("properties.vehicle_access_rate")
    collection.create_index("properties.block_group_geoid")
    
    # Calculate and log statistics
    coverage_pct = (blocks_with_vehicle_data / blocks_processed) * 100 if blocks_processed > 0 else 0
    
    logging.info("=" * 60)
    logging.info("VEHICLE ACCESS DATA DISTRIBUTION COMPLETE")
    logging.info("=" * 60)
    logging.info(f"Total blocks processed: {blocks_processed:,}")
    logging.info(f"Blocks with vehicle access data: {blocks_with_vehicle_data:,} ({coverage_pct:.1f}%)")
    
    return {
        'blocks_processed': blocks_processed,
        'blocks_with_vehicle_data': blocks_with_vehicle_data,
        'coverage_percentage': coverage_pct
    }

def process_domain_collection(collection_name):
    """
    Process a domain collection to add vehicle access data.
    
    Args:
        collection_name: Name of the domain collection
    """
    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Check if collection exists
    if collection_name not in db.list_collection_names():
        logging.error(f"Collection '{collection_name}' not found!")
        return False
    
    collection = db[collection_name]
    
    logging.info(f"Processing collection: {collection_name}")
    
    # Extract counties from blocks in this collection
    counties = extract_counties_from_blocks(collection)
    
    if not counties:
        logging.error("No counties found in collection!")
        return False
    
    # Fetch vehicle access data for these counties
    vehicle_access_df = fetch_vehicle_access_data(counties)
    
    # Distribute vehicle access data to blocks
    stats = distribute_vehicle_access_to_blocks(collection, vehicle_access_df)
    
    # Update domain metadata
    metadata_collection = db['domain_metadata']
    metadata_collection.update_one(
        {'collection_name': collection_name},
        {
            '$set': {
                'vehicle_access_stats': stats,
                'last_vehicle_access_update': datetime.utcnow()
            }
        }
    )
    
    logging.info(f"✓ Vehicle access data added to {collection_name}")
    return True

def main():
    """Main function with argument parsing."""
    parser = argparse.ArgumentParser(description='Add vehicle access data to domain collection')
    parser.add_argument('--collection', type=str, required=True,
                       help='Domain collection name')
    
    args = parser.parse_args()
    
    # Process the collection
    success = process_domain_collection(args.collection)
    
    if success:
        print(f"\n✓ Vehicle access data added successfully!")
    else:
        print(f"\n✗ Failed to add vehicle access data")
        sys.exit(1)

if __name__ == "__main__":
    main() 