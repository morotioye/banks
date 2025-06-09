#!/usr/bin/env python3
"""
Script to download California census blocks, fetch ACS demographic data,
and store as GeoJSON in MongoDB with 2dsphere indexing.
"""

import os
import sys
import zipfile
import tempfile
import json
from typing import Dict, List, Any, Optional
import requests
import geopandas as gpd
import pandas as pd
from pymongo import MongoClient, GEOSPHERE, InsertOne
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv
from tqdm import tqdm
import warnings
from multiprocessing import Pool, cpu_count
from functools import partial
warnings.filterwarnings('ignore', category=FutureWarning)

# Load environment variables
load_dotenv()

# Constants
CENSUS_API_BASE = "https://api.census.gov/data"
TIGER_BASE_URL = "https://www2.census.gov/geo/tiger/TIGER2020/TABBLOCK20"
CALIFORNIA_FIPS = "06"

# Census API key (get one from https://api.census.gov/data/key_signup.html)
CENSUS_API_KEY = os.getenv('CENSUS_API_KEY', 'YOUR_API_KEY_HERE')

def download_tiger_blocks(state_fips: str = CALIFORNIA_FIPS) -> str:
    """
    Download TIGER/Line Census Blocks shapefile for California.
    
    Args:
        state_fips: State FIPS code (06 for California)
        
    Returns:
        Path to the extracted shapefile
    """
    print(f"Downloading TIGER/Line Census Blocks for state {state_fips}...")
    
    # Create temp directory
    temp_dir = tempfile.mkdtemp()
    
    # Construct URL for California blocks
    filename = f"tl_2020_{state_fips}_tabblock20.zip"
    url = f"{TIGER_BASE_URL}/{filename}"
    
    # Download the file
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    zip_path = os.path.join(temp_dir, filename)
    total_size = int(response.headers.get('content-length', 0))
    
    with open(zip_path, 'wb') as f:
        with tqdm(total=total_size, unit='B', unit_scale=True, desc="Downloading") as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                pbar.update(len(chunk))
    
    # Extract the shapefile
    print("Extracting shapefile...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    
    # Find the .shp file
    shp_file = None
    for file in os.listdir(temp_dir):
        if file.endswith('.shp'):
            shp_file = os.path.join(temp_dir, file)
            break
    
    if not shp_file:
        raise FileNotFoundError("No shapefile found in downloaded archive")
    
    print(f"Shapefile extracted to: {shp_file}")
    return shp_file

def fetch_acs_data_for_blocks(state_fips: str = CALIFORNIA_FIPS) -> pd.DataFrame:
    """
    Fetch ACS 5-year estimates for California block groups.
    Note: ACS data is typically at block group level, not block level.
    
    Args:
        state_fips: State FIPS code
        
    Returns:
        DataFrame with GEOID and demographic data
    """
    print("Fetching ACS 5-year estimates...")
    
    # We'll fetch data at the block group level since ACS doesn't go down to blocks
    # B01003_001E: Total population
    # B17001_001E: Total for poverty status
    # B17001_002E: Income below poverty level
    # B22007_001E: Total for SNAP
    # B22007_002E: Households receiving SNAP
    
    # Construct API URL for block groups in California
    year = "2022"  # Most recent 5-year ACS ending in 2022
    dataset = f"{year}/acs/acs5"
    
    # First, get total counts
    url = f"{CENSUS_API_BASE}/{dataset}"
    params = {
        'get': 'B01003_001E,B17001_001E,B17001_002E,B22007_001E,B22007_002E,NAME',
        'for': 'block group:*',
        'in': f'state:{state_fips} county:*',
        'key': CENSUS_API_KEY
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching ACS data: {e}")
        print("Continuing without ACS data...")
        return pd.DataFrame()
    
    # Convert to DataFrame
    if len(data) > 1:
        df = pd.DataFrame(data[1:], columns=data[0])
        
        # Create block group GEOID (state + county + tract + block group)
        df['GEOID'] = df['state'] + df['county'] + df['tract'] + df['block group']
        
        # Convert numeric columns
        numeric_cols = ['B01003_001E', 'B17001_001E', 'B17001_002E', 'B22007_001E', 'B22007_002E']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Calculate rates
        df['poverty_rate'] = df['B17001_002E'] / df['B17001_001E']
        df['snap_rate'] = df['B22007_002E'] / df['B22007_001E']
        
        # Handle division by zero
        df['poverty_rate'] = df['poverty_rate'].fillna(0)
        df['snap_rate'] = df['snap_rate'].fillna(0)
        
        # Rename columns
        df = df.rename(columns={'B01003_001E': 'population'})
        
        print(f"Fetched ACS data for {len(df)} block groups")
        return df[['GEOID', 'population', 'poverty_rate', 'snap_rate']]
    else:
        print("No ACS data returned")
        return pd.DataFrame()

def process_single_row(row_data: tuple) -> Optional[Dict[str, Any]]:
    """
    Process a single row to create GeoJSON feature.
    
    Args:
        row_data: Tuple of (index, row data dict)
        
    Returns:
        GeoJSON feature dict or None if invalid
    """
    idx, row = row_data
    
    # Skip invalid geometries
    if row['geometry'] is None or not row['geometry'].is_valid:
        return None
    
    # Create GeoJSON geometry
    try:
        geom_json = json.loads(gpd.GeoSeries([row['geometry']]).to_json())
        geometry = geom_json['features'][0]['geometry']
    except:
        return None
    
    # Create GeoJSON feature
    feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "geoid": row['GEOID20'],
            "pop": int(row['population']) if pd.notna(row['population']) else 0,
            "poverty_rate": float(row['poverty_rate']) if pd.notna(row['poverty_rate']) else 0.0,
            "snap_rate": float(row['snap_rate']) if pd.notna(row['snap_rate']) else 0.0
        }
    }
    return feature


def read_and_process_blocks(shapefile_path: str, acs_data: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Read census blocks shapefile and join with ACS data.
    
    Args:
        shapefile_path: Path to the shapefile
        acs_data: DataFrame with ACS demographic data
        
    Returns:
        List of GeoJSON features
    """
    print("Reading census blocks shapefile...")
    
    # Read shapefile
    gdf = gpd.read_file(shapefile_path)
    print(f"Loaded {len(gdf)} census blocks")
    
    # Create block group GEOID from block GEOID (first 12 characters)
    gdf['BGGEOID'] = gdf['GEOID20'].str[:12]
    
    # Join with ACS data on block group GEOID
    if not acs_data.empty:
        gdf = gdf.merge(
            acs_data,
            left_on='BGGEOID',
            right_on='GEOID',
            how='left',
            suffixes=('', '_acs')
        )
        
        # Fill missing values
        gdf['population'] = gdf['population'].fillna(0)
        gdf['poverty_rate'] = gdf['poverty_rate'].fillna(0)
        gdf['snap_rate'] = gdf['snap_rate'].fillna(0)
    else:
        # If no ACS data, set default values
        gdf['population'] = 0
        gdf['poverty_rate'] = 0
        gdf['snap_rate'] = 0
    
    # Convert to WGS84 (required for MongoDB 2dsphere index)
    gdf = gdf.to_crs('EPSG:4326')
    
    # Convert to GeoJSON features using multiprocessing
    print("Converting to GeoJSON features using multiprocessing...")
    
    # Prepare data for multiprocessing - convert to dict format
    rows_data = [(idx, row.to_dict()) for idx, row in gdf.iterrows()]
    
    # Determine number of processes
    n_processes = min(cpu_count(), 8)  # Cap at 8 to avoid overwhelming the system
    print(f"Using {n_processes} processes...")
    
    # Process blocks in parallel
    features = []
    with Pool(processes=n_processes) as pool:
        # Process with progress bar
        results = list(tqdm(
            pool.imap(process_single_row, rows_data, chunksize=1000),
            total=len(rows_data),
            desc="Processing blocks"
        ))
        
        # Filter out None results
        features = [f for f in results if f is not None]
    
    print(f"Created {len(features)} valid GeoJSON features")
    return features

def store_in_mongodb(features: List[Dict[str, Any]], db_name: str, collection_name: str = 'sample_blocks'):
    """
    Store GeoJSON features in MongoDB with 2dsphere index.
    
    Args:
        features: List of GeoJSON features
        db_name: Database name
        collection_name: Collection name
    """
    # Connect to MongoDB
    mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
    client = MongoClient(mongodb_uri)
    
    try:
        # Test connection
        client.admin.command('ping')
        print(f"Connected to MongoDB at {mongodb_uri}")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        sys.exit(1)
    
    # Get database and collection
    db = client[db_name]
    collection = db[collection_name]
    
    # Drop existing collection
    if collection_name in db.list_collection_names():
        print(f"Dropping existing collection '{collection_name}'")
        collection.drop()
    
    # Create 2dsphere index on geometry field
    print("Creating 2dsphere index...")
    collection.create_index([("geometry", GEOSPHERE)])
    
    # Prepare bulk operations
    print(f"Inserting {len(features)} features into MongoDB...")
    
    # Insert in batches to avoid memory issues
    batch_size = 1000
    total_inserted = 0
    
    for i in tqdm(range(0, len(features), batch_size), desc="Inserting batches"):
        batch = features[i:i + batch_size]
        operations = [InsertOne(doc) for doc in batch]
        
        try:
            result = collection.bulk_write(operations, ordered=False)
            total_inserted += result.inserted_count
        except BulkWriteError as e:
            print(f"Bulk write error: {e.details}")
            # Continue with partial success
            total_inserted += e.details.get('nInserted', 0)
    
    print(f"Successfully inserted {total_inserted} documents")
    
    # Print collection statistics
    stats = db.command("collStats", collection_name)
    print(f"\nCollection statistics:")
    print(f"  Total documents: {stats['count']}")
    print(f"  Total size: {stats['size'] / 1024 / 1024:.2f} MB")
    print(f"  Indexes: {[idx['name'] for idx in collection.list_indexes()]}")
    
    # Test spatial query
    print("\nTesting spatial query (finding blocks near downtown LA)...")
    downtown_la = {"type": "Point", "coordinates": [-118.2437, 34.0522]}
    nearby_blocks = collection.find({
        "geometry": {
            "$near": {
                "$geometry": downtown_la,
                "$maxDistance": 1000  # 1km
            }
        }
    }).limit(5)
    
    count = 0
    for block in nearby_blocks:
        count += 1
        print(f"  Block {block['properties']['geoid']}: pop={block['properties']['pop']}")
    
    print(f"  Found {count} blocks within 1km of downtown LA")
    
    client.close()

def main():
    """Main execution function."""
    print("California Census Blocks to MongoDB Pipeline")
    print("=" * 50)
    
    # Get database name from environment
    db_name = os.getenv('TEST_DB_NAME', 'food_insecurity_test')
    print(f"Target database: {db_name}")
    
    try:
        # Step 1: Download TIGER/Line shapefile
        shapefile_path = download_tiger_blocks(CALIFORNIA_FIPS)
        
        # Step 2: Fetch ACS data
        acs_data = fetch_acs_data_for_blocks(CALIFORNIA_FIPS)
        
        # Step 3: Read and process blocks
        features = read_and_process_blocks(shapefile_path, acs_data)
        
        # Step 4: Store in MongoDB
        store_in_mongodb(features, db_name)
        
        print("\n✓ Pipeline completed successfully!")
        
    except Exception as e:
        print(f"\n✗ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    # Check for Census API key
    if CENSUS_API_KEY == 'YOUR_API_KEY_HERE':
        print("WARNING: No Census API key found!")
        print("Please set CENSUS_API_KEY in your .env file")
        print("Get a free key at: https://api.census.gov/data/key_signup.html")
        print("\nContinuing without ACS data...")
    
    main()

