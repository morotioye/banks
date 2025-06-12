#!/usr/bin/env python3
"""
One-time migration script to add vehicle access data to all existing California census blocks.
This script fetches ACS Table B25044 data and updates existing blocks with vehicle access information.
"""

import os
import sys
import logging
import requests
import pandas as pd
import numpy as np
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime
from collections import defaultdict

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
CALIFORNIA_FIPS = '06'

if not CENSUS_API_KEY:
    raise ValueError("CENSUS_API_KEY environment variable is required")

def get_collections_to_migrate():
    """Get list of collections that need vehicle access data migration."""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    collections_to_migrate = []
    
    # Check census_blocks collection
    if 'census_blocks' in db.list_collection_names():
        collections_to_migrate.append('census_blocks')
    
    # Check domain collections (d_*)
    for collection_name in db.list_collection_names():
        if collection_name.startswith('d_'):
            collections_to_migrate.append(collection_name)
    
    logging.info(f"Found {len(collections_to_migrate)} collections to migrate:")
    for collection_name in collections_to_migrate:
        count = db[collection_name].count_documents({})
        logging.info(f"  {collection_name}: {count:,} blocks")
    
    return collections_to_migrate

def extract_counties_from_collection(collection):
    """Extract unique counties from census blocks in the collection."""
    counties = set()
    
    # Get unique county codes from block GEOIDs
    cursor = collection.find({}, {'properties.geoid': 1})
    
    for block in cursor:
        geoid = block.get('properties', {}).get('geoid', '')
        if len(geoid) >= 5:  # GEOID format: SSCCCTTTTTTBBBB (state+county+tract+block)
            county_fips = geoid[2:5]  # Extract county FIPS
            counties.add(county_fips)
    
    return list(counties)

def fetch_vehicle_access_data(county_fips_list):
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
            'in': f'state:{CALIFORNIA_FIPS} county:{county_fips}',
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

def migrate_collection(collection_name, vehicle_access_df):
    """
    Migrate a single collection to add vehicle access data.
    """
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[collection_name]
    
    logging.info(f"Migrating collection: {collection_name}")
    
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
    blocks_already_have_data = 0
    batch_size = 1000
    
    cursor = collection.find({})
    
    for block in cursor:
        # Check if block already has vehicle access data
        existing_vehicle_rate = block.get('properties', {}).get('vehicle_access_rate')
        if existing_vehicle_rate is not None:
            blocks_already_have_data += 1
            blocks_processed += 1
            continue
            
        geoid = block.get('properties', {}).get('geoid', '')
        
        # Extract block group GEOID from block GEOID
        # For block groups, the GEOID is already at block group level
        # For census blocks, we need to truncate to block group level
        if len(geoid) == 12:
            # This is already a block group GEOID
            block_group_geoid = geoid
        elif len(geoid) >= 12:
            # This is a census block GEOID, truncate to block group
            block_group_geoid = geoid[:12]
        else:
            block_group_geoid = ''
        
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
    
    # Create indexes for new fields (if not already existing)
    logging.info("Creating/updating indexes for vehicle access fields...")
    try:
        collection.create_index("properties.vehicle_access_rate")
        collection.create_index("properties.block_group_geoid")
    except Exception as e:
        logging.info(f"Indexes may already exist: {e}")
    
    # Calculate and log statistics
    coverage_pct = (blocks_with_vehicle_data / (blocks_processed - blocks_already_have_data)) * 100 if (blocks_processed - blocks_already_have_data) > 0 else 0
    
    logging.info("=" * 50)
    logging.info(f"MIGRATION COMPLETE FOR {collection_name}")
    logging.info("=" * 50)
    logging.info(f"Total blocks processed: {blocks_processed:,}")
    logging.info(f"Blocks that already had vehicle data: {blocks_already_have_data:,}")
    logging.info(f"Blocks updated with new vehicle data: {blocks_with_vehicle_data:,} ({coverage_pct:.1f}%)")
    
    return {
        'blocks_processed': blocks_processed,
        'blocks_with_vehicle_data': blocks_with_vehicle_data,
        'blocks_already_have_data': blocks_already_have_data,
        'coverage_percentage': coverage_pct
    }

def main():
    """Main migration function."""
    start_time = datetime.now()
    
    logging.info("=" * 60)
    logging.info("VEHICLE ACCESS DATA MIGRATION")
    logging.info("=" * 60)
    
    try:
        # Get list of collections to migrate
        collections_to_migrate = get_collections_to_migrate()
        
        if not collections_to_migrate:
            logging.info("No collections found to migrate.")
            return
        
        # Get all unique counties from all collections
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        all_counties = set()
        
        for collection_name in collections_to_migrate:
            collection = db[collection_name]
            counties = extract_counties_from_collection(collection)
            all_counties.update(counties)
            logging.info(f"Collection {collection_name}: {len(counties)} counties")
        
        logging.info(f"Total unique counties across all collections: {len(all_counties)}")
        
        # Fetch vehicle access data for all counties
        vehicle_access_df = fetch_vehicle_access_data(list(all_counties))
        
        # Migrate each collection
        migration_stats = {}
        for collection_name in collections_to_migrate:
            stats = migrate_collection(collection_name, vehicle_access_df)
            migration_stats[collection_name] = stats
        
        # Final summary
        elapsed_time = datetime.now() - start_time
        total_blocks_processed = sum(stats['blocks_processed'] for stats in migration_stats.values())
        total_blocks_updated = sum(stats['blocks_with_vehicle_data'] for stats in migration_stats.values())
        
        logging.info("=" * 60)
        logging.info("MIGRATION SUMMARY")
        logging.info("=" * 60)
        logging.info(f"Collections migrated: {len(collections_to_migrate)}")
        logging.info(f"Total blocks processed: {total_blocks_processed:,}")
        logging.info(f"Total blocks updated with vehicle access data: {total_blocks_updated:,}")
        logging.info(f"Migration time: {elapsed_time}")
        
        for collection_name, stats in migration_stats.items():
            logging.info(f"  {collection_name}: {stats['blocks_with_vehicle_data']:,} blocks updated")
        
        logging.info("\n✓ Migration completed successfully!")
        logging.info("You can now run score calculations that will use the vehicle access data.")
        
    except Exception as e:
        logging.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    main() 