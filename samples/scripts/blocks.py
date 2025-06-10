#!/usr/bin/env python3
"""
Fetch California census blocks with ACS demographic data using hybrid approach:
- Block group level: population and poverty data
- Tract level: SNAP data (distributed to blocks based on poverty-weighted households)
"""

import os
import sys
import requests
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import shape
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
import time
from datetime import datetime
import logging
from multiprocessing import Pool, cpu_count
from functools import partial
import json

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('blocks_processing.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Load environment variables
load_dotenv()

# Constants
TIGER_BASE_URL = "https://www2.census.gov/geo/tiger/TIGER2022/BG/"
CALIFORNIA_FIPS = "06"
CENSUS_API_BASE = "https://api.census.gov/data"
CENSUS_API_KEY = os.getenv('CENSUS_API_KEY')

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('TEST_DB_NAME', 'food_insecurity_test')
COLLECTION_NAME = 'census_blocks'

# Processing configuration
BATCH_SIZE = 1000
NUM_PROCESSES = min(cpu_count(), 8)

def download_california_blocks():
    """Download California census block groups shapefile from TIGER/Line."""
    url = f"{TIGER_BASE_URL}tl_2022_{CALIFORNIA_FIPS}_bg.zip"
    filename = f"tl_2022_{CALIFORNIA_FIPS}_bg.zip"
    
    if os.path.exists(filename.replace('.zip', '.shp')):
        logging.info(f"Shapefile already exists, skipping download")
        return filename.replace('.zip', '.shp')
    
    logging.info(f"Downloading California block groups from {url}")
    
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    # Save the file
    with open(filename, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    logging.info(f"Downloaded {filename}")
    
    # Extract the shapefile
    import zipfile
    with zipfile.ZipFile(filename, 'r') as zip_ref:
        zip_ref.extractall('.')
    
    logging.info("Extracted shapefile")
    os.remove(filename)  # Clean up zip file
    
    return filename.replace('.zip', '.shp')

def fetch_block_group_acs_data(county_fips_list):
    """Fetch ACS data for all block groups in specified counties."""
    logging.info(f"Fetching ACS data for {len(county_fips_list)} counties")
    
    year = "2022"
    dataset = f"{year}/acs/acs5"
    url = f"{CENSUS_API_BASE}/{dataset}"
    
    all_data = []
    
    # Variables to fetch at block group level
    variables = [
        'B01003_001E',  # Total population
        'C17002_001E',  # Total for poverty ratio
        'C17002_002E',  # Under .50 ratio
        'C17002_003E',  # .50 to .99 ratio
        'B11001_001E',  # Total households (needed for SNAP distribution)
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
            logging.error(f"Error fetching data for county {county_fips}: {e}")
            continue
    
    if not all_data:
        raise ValueError("No ACS data fetched")
    
    # Convert to DataFrame
    df = pd.DataFrame(all_data, columns=variables + ['state', 'county', 'tract', 'block group'])
    
    # Create GEOID
    df['GEOID'] = df['state'] + df['county'] + df['tract'] + df['block group']
    df['tract_geoid'] = df['state'] + df['county'] + df['tract']
    
    # Convert numeric columns
    numeric_cols = ['B01003_001E', 'C17002_001E', 'C17002_002E', 'C17002_003E', 'B11001_001E']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Calculate poverty rate
    df['poverty_rate'] = np.where(
        df['C17002_001E'] > 0,
        (df['C17002_002E'] + df['C17002_003E']) / df['C17002_001E'],
        0
    )
    
    logging.info(f"Total block groups with ACS data: {len(df)}")
    logging.info(f"Block groups with poverty data: {(df['poverty_rate'] > 0).sum()}")
    
    return df

def fetch_tract_snap_data(county_fips_list):
    """Fetch SNAP data at tract level for specified counties."""
    logging.info(f"Fetching tract-level SNAP data for {len(county_fips_list)} counties")
    
    year = "2022"
    dataset = f"{year}/acs/acs5"
    url = f"{CENSUS_API_BASE}/{dataset}"
    
    all_data = []
    
    # Variables to fetch at tract level
    variables = [
        'B22001_001E',  # Total households (for SNAP)
        'B22001_002E',  # Households with SNAP
        'NAME'
    ]
    
    # Fetch data for each county
    for county_fips in county_fips_list:
        params = {
            'get': ','.join(variables),
            'for': 'tract:*',
            'in': f'state:{CALIFORNIA_FIPS} county:{county_fips}',
            'key': CENSUS_API_KEY
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if len(data) > 1:
                all_data.extend(data[1:])
                logging.info(f"  County {county_fips}: {len(data)-1} tracts")
            
        except Exception as e:
            logging.error(f"Error fetching SNAP data for county {county_fips}: {e}")
            continue
    
    if not all_data:
        logging.warning("No tract SNAP data fetched")
        return pd.DataFrame()
    
    # Convert to DataFrame
    df = pd.DataFrame(all_data, columns=variables + ['state', 'county', 'tract'])
    
    # Create tract GEOID
    df['tract_geoid'] = df['state'] + df['county'] + df['tract']
    
    # Convert numeric columns
    df['B22001_001E'] = pd.to_numeric(df['B22001_001E'], errors='coerce')
    df['B22001_002E'] = pd.to_numeric(df['B22001_002E'], errors='coerce')
    
    # Calculate SNAP rate and total households
    df['tract_snap_rate'] = np.where(
        df['B22001_001E'] > 0,
        df['B22001_002E'] / df['B22001_001E'],
        0
    )
    df['tract_snap_households'] = df['B22001_002E'].fillna(0)
    
    logging.info(f"Total tracts with SNAP data: {len(df)}")
    logging.info(f"Tracts with valid SNAP rates: {(df['tract_snap_rate'] > 0).sum()}")
    
    return df

def distribute_snap_to_blocks(block_df, tract_df):
    """Distribute tract-level SNAP to blocks based on poverty-weighted households."""
    logging.info("Distributing SNAP data from tracts to block groups")
    
    # Merge tract SNAP data with block data
    merged = block_df.merge(
        tract_df[['tract_geoid', 'tract_snap_rate', 'tract_snap_households']], 
        on='tract_geoid', 
        how='left'
    )
    
    # Fill missing SNAP data with 0
    merged['tract_snap_rate'] = merged['tract_snap_rate'].fillna(0)
    merged['tract_snap_households'] = merged['tract_snap_households'].fillna(0)
    
    # Calculate poverty-weighted households for each block
    merged['poverty_weighted_households'] = merged['poverty_rate'] * merged['B11001_001E']
    
    # Calculate tract totals for poverty-weighted households
    tract_totals = merged.groupby('tract_geoid')['poverty_weighted_households'].sum().reset_index()
    tract_totals.columns = ['tract_geoid', 'tract_total_weighted_hh']
    
    # Merge back to get tract totals
    merged = merged.merge(tract_totals, on='tract_geoid', how='left')
    
    # Calculate block's share of tract SNAP households
    # Handle division by zero - if no poverty variation, distribute equally
    merged['block_snap_share'] = np.where(
        merged['tract_total_weighted_hh'] > 0,
        merged['poverty_weighted_households'] / merged['tract_total_weighted_hh'],
        1.0 / merged.groupby('tract_geoid')['GEOID'].transform('count')
    )
    
    # Calculate block SNAP households
    merged['block_snap_households'] = merged['tract_snap_households'] * merged['block_snap_share']
    
    # Calculate block SNAP rate
    merged['snap_rate'] = np.where(
        merged['B11001_001E'] > 0,
        merged['block_snap_households'] / merged['B11001_001E'],
        0
    )
    
    # Log distribution statistics
    blocks_with_snap = (merged['snap_rate'] > 0).sum()
    logging.info(f"Block groups with SNAP data after distribution: {blocks_with_snap}")
    logging.info(f"Average block SNAP rate: {merged['snap_rate'].mean():.3f}")
    
    return merged

def process_county_batch(county_batch, blocks_gdf, acs_df, tract_snap_df):
    """Process a batch of counties."""
    batch_features = []
    
    for _, block in blocks_gdf[blocks_gdf['COUNTYFP'].isin(county_batch)].iterrows():
        geoid = block['GEOID']
        
        # Get demographic data
        pop = 0
        poverty_rate = 0.0
        snap_rate = 0.0
        
        if geoid in acs_df.index:
            acs_data = acs_df.loc[geoid]
            pop = int(acs_data.get('B01003_001E', 0))
            poverty_rate = float(acs_data.get('poverty_rate', 0))
            snap_rate = float(acs_data.get('snap_rate', 0))
        
        # Create GeoJSON feature
        feature = {
            "type": "Feature",
            "geometry": block.geometry.__geo_interface__,
            "properties": {
                "geoid": geoid,
                "pop": pop,
                "poverty_rate": poverty_rate,
                "snap_rate": snap_rate
            }
        }
        
        batch_features.append(feature)
    
    return batch_features

def main():
    """Main processing function."""
    start_time = time.time()
    
    try:
        # Download shapefile
        shapefile_path = download_california_blocks()
        
        # Load shapefile
        logging.info("Loading shapefile...")
        blocks_gdf = gpd.read_file(shapefile_path)
        blocks_gdf = blocks_gdf.to_crs('EPSG:4326')  # Convert to WGS84
        logging.info(f"Loaded {len(blocks_gdf)} block groups")
        
        # Get list of counties
        counties = blocks_gdf['COUNTYFP'].unique().tolist()
        logging.info(f"Found {len(counties)} counties")
        
        # Fetch ACS data for all counties
        acs_df = fetch_block_group_acs_data(counties)
        
        # Fetch tract-level SNAP data
        tract_snap_df = fetch_tract_snap_data(counties)
        
        # Distribute SNAP to block groups
        if not tract_snap_df.empty:
            acs_df = distribute_snap_to_blocks(acs_df, tract_snap_df)
        else:
            logging.warning("No SNAP data available, setting SNAP rates to 0")
            acs_df['snap_rate'] = 0
        
        # Set GEOID as index for faster lookups
        acs_df.set_index('GEOID', inplace=True)
        
        # Connect to MongoDB
        logging.info("Connecting to MongoDB...")
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        # Clear existing data
        logging.info("Clearing existing data...")
        collection.delete_many({})
        
        # Process in batches using multiprocessing
        logging.info(f"Processing blocks using {NUM_PROCESSES} processes...")
        
        # Split counties into batches for multiprocessing
        county_batches = [counties[i:i+10] for i in range(0, len(counties), 10)]
        
        # Create partial function with shared data
        process_func = partial(process_county_batch, 
                              blocks_gdf=blocks_gdf, 
                              acs_df=acs_df,
                              tract_snap_df=tract_snap_df)
        
        all_features = []
        with Pool(NUM_PROCESSES) as pool:
            results = pool.map(process_func, county_batches)
            for batch_features in results:
                all_features.extend(batch_features)
        
        # Insert into MongoDB in batches
        logging.info(f"Inserting {len(all_features)} features into MongoDB...")
        for i in range(0, len(all_features), BATCH_SIZE):
            batch = all_features[i:i+BATCH_SIZE]
            collection.insert_many(batch)
            logging.info(f"  Inserted batch {i//BATCH_SIZE + 1}/{(len(all_features)-1)//BATCH_SIZE + 1}")
        
        # Create indexes
        logging.info("Creating indexes...")
        collection.create_index("properties.geoid")
        collection.create_index([("geometry", "2dsphere")])
        collection.create_index("properties.pop")
        collection.create_index("properties.poverty_rate")
        collection.create_index("properties.snap_rate")
        
        # Summary statistics
        total_blocks = collection.count_documents({})
        blocks_with_pop = collection.count_documents({"properties.pop": {"$gt": 0}})
        blocks_with_poverty = collection.count_documents({"properties.poverty_rate": {"$gt": 0}})
        blocks_with_snap = collection.count_documents({"properties.snap_rate": {"$gt": 0}})
        
        elapsed_time = time.time() - start_time
        
        logging.info("=" * 60)
        logging.info("PROCESSING COMPLETE")
        logging.info("=" * 60)
        logging.info(f"Total block groups: {total_blocks:,}")
        logging.info(f"Block groups with population data: {blocks_with_pop:,} ({blocks_with_pop/total_blocks*100:.1f}%)")
        logging.info(f"Block groups with poverty data: {blocks_with_poverty:,} ({blocks_with_poverty/total_blocks*100:.1f}%)")
        logging.info(f"Block groups with SNAP data: {blocks_with_snap:,} ({blocks_with_snap/total_blocks*100:.1f}%)")
        logging.info(f"Processing time: {elapsed_time:.1f} seconds")
        logging.info(f"Database: {DB_NAME}")
        logging.info(f"Collection: {COLLECTION_NAME}")
        
    except Exception as e:
        logging.error(f"Error in main processing: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    main()

