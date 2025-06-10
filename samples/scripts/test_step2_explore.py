#!/usr/bin/env python3
"""
Exploratory analysis to understand spatial relationships between census blocks and grid cells.
Tests creating cells in a 2-mile radius and analyzing overlaps with census blocks.
"""

import os
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pymongo import MongoClient
from dotenv import load_dotenv
import json
from collections import defaultdict

# Load environment variables
load_dotenv()

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('TEST_DB_NAME', 'food_insecurity_test')

# Constants
CELL_SIZE_M2 = 150000  # 150,000 m² per cell
METERS_PER_DEGREE_LAT = 111320  # Approximate at 34°N (LA)
METERS_PER_DEGREE_LON = 96486   # Approximate at 34°N (LA)

def create_grid_cells(center_lat, center_lon, radius_miles=2):
    """Create a grid of cells within a radius of a center point."""
    # Convert radius to meters
    radius_m = radius_miles * 1609.34
    
    # Calculate cell dimensions in degrees
    # For square cells of 150,000 m²
    cell_side_m = np.sqrt(CELL_SIZE_M2)
    cell_height_deg = cell_side_m / METERS_PER_DEGREE_LAT
    cell_width_deg = cell_side_m / METERS_PER_DEGREE_LON
    
    # Calculate grid bounds
    lat_range = radius_m / METERS_PER_DEGREE_LAT
    lon_range = radius_m / METERS_PER_DEGREE_LON
    
    min_lat = center_lat - lat_range
    max_lat = center_lat + lat_range
    min_lon = center_lon - lon_range
    max_lon = center_lon + lon_range
    
    # Create grid
    cells = []
    lat = min_lat
    cell_id = 0
    
    while lat < max_lat:
        lon = min_lon
        while lon < max_lon:
            # Create cell polygon
            cell = box(lon, lat, lon + cell_width_deg, lat + cell_height_deg)
            
            # Calculate centroid
            centroid = cell.centroid
            
            # Check if centroid is within radius
            distance = Point(center_lon, center_lat).distance(centroid) * METERS_PER_DEGREE_LAT
            
            if distance <= radius_m:
                cells.append({
                    'cell_id': cell_id,
                    'geometry': cell,
                    'centroid_lat': centroid.y,
                    'centroid_lon': centroid.x,
                    'area_m2': CELL_SIZE_M2
                })
                cell_id += 1
            
            lon += cell_width_deg
        lat += cell_height_deg
    
    return gpd.GeoDataFrame(cells)

def fetch_blocks_in_area(center_lat, center_lon, radius_miles=2.5):
    """Fetch census blocks from MongoDB within an area."""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db['census_blocks']
    
    # Create a circle query (slightly larger than cell radius to ensure coverage)
    blocks = list(collection.find({
        "geometry": {
            "$nearSphere": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [center_lon, center_lat]
                },
                "$maxDistance": radius_miles * 1609.34  # Convert to meters
            }
        }
    }))
    
    print(f"Found {len(blocks)} blocks within {radius_miles} miles")
    
    # Convert to GeoDataFrame
    if blocks:
        features = []
        for block in blocks:
            feature = {
                'geoid': block['properties']['geoid'],
                'pop': block['properties']['pop'],
                'poverty_rate': block['properties']['poverty_rate'],
                'snap_rate': block['properties']['snap_rate'],
                'geometry': Polygon(block['geometry']['coordinates'][0])
            }
            features.append(feature)
        
        return gpd.GeoDataFrame(features)
    else:
        return gpd.GeoDataFrame()

def analyze_overlaps(cells_gdf, blocks_gdf):
    """Analyze spatial overlaps between cells and blocks."""
    print("\nAnalyzing spatial overlaps...")
    
    overlap_stats = {
        'cells_with_no_blocks': 0,
        'cells_with_one_block': 0,
        'cells_with_multiple_blocks': 0,
        'blocks_spanning_multiple_cells': 0,
        'overlap_details': []
    }
    
    # For each cell, find overlapping blocks
    for idx, cell in cells_gdf.iterrows():
        cell_geom = cell.geometry
        
        # Find blocks that intersect this cell
        overlapping_blocks = blocks_gdf[blocks_gdf.intersects(cell_geom)]
        
        if len(overlapping_blocks) == 0:
            overlap_stats['cells_with_no_blocks'] += 1
        elif len(overlapping_blocks) == 1:
            overlap_stats['cells_with_one_block'] += 1
        else:
            overlap_stats['cells_with_multiple_blocks'] += 1
        
        # Calculate overlap percentages
        for _, block in overlapping_blocks.iterrows():
            intersection = cell_geom.intersection(block.geometry)
            cell_overlap_pct = (intersection.area / cell_geom.area) * 100
            block_overlap_pct = (intersection.area / block.geometry.area) * 100
            
            overlap_stats['overlap_details'].append({
                'cell_id': cell['cell_id'],
                'block_geoid': block['geoid'],
                'block_pop': block['pop'],
                'cell_overlap_pct': cell_overlap_pct,
                'block_overlap_pct': block_overlap_pct,
                'block_poverty_rate': block['poverty_rate'],
                'block_snap_rate': block['snap_rate']
            })
    
    # Check blocks spanning multiple cells
    for _, block in blocks_gdf.iterrows():
        overlapping_cells = cells_gdf[cells_gdf.intersects(block.geometry)]
        if len(overlapping_cells) > 1:
            overlap_stats['blocks_spanning_multiple_cells'] += 1
    
    return overlap_stats

def calculate_sample_assignments(cells_gdf, blocks_gdf, overlap_stats):
    """Calculate cell values using different assignment methods."""
    print("\nCalculating sample assignments...")
    
    # Convert overlap details to DataFrame for easier analysis
    overlaps_df = pd.DataFrame(overlap_stats['overlap_details'])
    
    # Method 1: Centroid-based assignment
    centroid_assignments = []
    for idx, cell in cells_gdf.iterrows():
        centroid = cell.geometry.centroid
        containing_block = blocks_gdf[blocks_gdf.contains(centroid)]
        
        if len(containing_block) > 0:
            block = containing_block.iloc[0]
            centroid_assignments.append({
                'cell_id': cell['cell_id'],
                'method': 'centroid',
                'poverty_rate': block['poverty_rate'],
                'snap_rate': block['snap_rate'],
                'population': block['pop']  # This is wrong - should be distributed
            })
    
    # Method 2: Area-weighted average
    area_weighted_assignments = []
    for cell_id in cells_gdf['cell_id'].unique():
        cell_overlaps = overlaps_df[overlaps_df['cell_id'] == cell_id]
        
        if len(cell_overlaps) > 0:
            # Weight by overlap percentage
            total_overlap = cell_overlaps['cell_overlap_pct'].sum()
            weighted_poverty = (cell_overlaps['block_poverty_rate'] * 
                              cell_overlaps['cell_overlap_pct']).sum() / total_overlap
            weighted_snap = (cell_overlaps['block_snap_rate'] * 
                           cell_overlaps['cell_overlap_pct']).sum() / total_overlap
            
            area_weighted_assignments.append({
                'cell_id': cell_id,
                'method': 'area_weighted',
                'poverty_rate': weighted_poverty,
                'snap_rate': weighted_snap
            })
    
    # Method 3: Population-weighted average
    pop_weighted_assignments = []
    for cell_id in cells_gdf['cell_id'].unique():
        cell_overlaps = overlaps_df[overlaps_df['cell_id'] == cell_id]
        
        if len(cell_overlaps) > 0:
            # Calculate population in each overlap
            cell_overlaps['pop_in_overlap'] = (cell_overlaps['block_pop'] * 
                                              cell_overlaps['block_overlap_pct'] / 100)
            total_pop = cell_overlaps['pop_in_overlap'].sum()
            
            if total_pop > 0:
                weighted_poverty = (cell_overlaps['block_poverty_rate'] * 
                                  cell_overlaps['pop_in_overlap']).sum() / total_pop
                weighted_snap = (cell_overlaps['block_snap_rate'] * 
                               cell_overlaps['pop_in_overlap']).sum() / total_pop
                
                pop_weighted_assignments.append({
                    'cell_id': cell_id,
                    'method': 'population_weighted',
                    'poverty_rate': weighted_poverty,
                    'snap_rate': weighted_snap,
                    'population': int(total_pop)
                })
    
    return centroid_assignments, area_weighted_assignments, pop_weighted_assignments

def visualize_analysis(cells_gdf, blocks_gdf, center_lat, center_lon):
    """Create visualization of cells and blocks."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
    
    # Plot 1: Spatial layout
    ax1.set_title('Grid Cells vs Census Blocks', fontsize=14, fontweight='bold')
    
    # Plot blocks with population density
    if len(blocks_gdf) > 0:
        blocks_gdf['pop_density'] = blocks_gdf['pop'] / (blocks_gdf.geometry.area * 
                                                         METERS_PER_DEGREE_LAT * 
                                                         METERS_PER_DEGREE_LON)
        blocks_gdf.plot(ax=ax1, column='pop_density', cmap='YlOrRd', 
                       alpha=0.6, edgecolor='black', linewidth=0.5)
    
    # Plot cells
    cells_gdf.boundary.plot(ax=ax1, color='blue', linewidth=2, alpha=0.8)
    
    # Plot center point
    ax1.scatter(center_lon, center_lat, c='green', s=100, marker='*', 
               edgecolor='black', linewidth=2, label='Center Point', zorder=5)
    
    # Add labels for a few cells
    for idx, cell in cells_gdf.head(5).iterrows():
        centroid = cell.geometry.centroid
        ax1.annotate(f"Cell {cell['cell_id']}", 
                    xy=(centroid.x, centroid.y),
                    xytext=(5, 5), textcoords='offset points',
                    fontsize=8, color='blue', fontweight='bold')
    
    ax1.set_xlabel('Longitude')
    ax1.set_ylabel('Latitude')
    ax1.legend()
    
    # Plot 2: Overlap complexity
    ax2.set_title('Cell-Block Overlap Complexity', fontsize=14, fontweight='bold')
    
    # Color cells by number of overlapping blocks
    overlap_counts = defaultdict(int)
    for idx, cell in cells_gdf.iterrows():
        overlaps = blocks_gdf[blocks_gdf.intersects(cell.geometry)]
        overlap_counts[cell['cell_id']] = len(overlaps)
    
    cells_gdf['overlap_count'] = cells_gdf['cell_id'].map(overlap_counts)
    cells_gdf.plot(ax=ax2, column='overlap_count', cmap='RdYlBu_r', 
                  legend=True, edgecolor='black', linewidth=1)
    
    ax2.set_xlabel('Longitude')
    ax2.set_ylabel('Latitude')
    
    plt.tight_layout()
    plt.savefig('cell_block_analysis.png', dpi=150, bbox_inches='tight')
    print("\nVisualization saved as 'cell_block_analysis.png'")
    
    return fig

def main():
    """Run the exploratory analysis."""
    # Test location: Downtown LA
    center_lat = 34.0522
    center_lon = -118.2437
    
    print(f"Exploratory Analysis: Census Blocks to Grid Cells")
    print(f"Center: ({center_lat}, {center_lon}) - Downtown LA")
    print("=" * 60)
    
    # Step 1: Create grid cells
    print("\n1. Creating grid cells...")
    cells_gdf = create_grid_cells(center_lat, center_lon, radius_miles=2)
    print(f"   Created {len(cells_gdf)} cells")
    print(f"   Cell size: {CELL_SIZE_M2:,} m² ({np.sqrt(CELL_SIZE_M2):.0f}m × {np.sqrt(CELL_SIZE_M2):.0f}m)")
    
    # Step 2: Fetch census blocks
    print("\n2. Fetching census blocks from MongoDB...")
    blocks_gdf = fetch_blocks_in_area(center_lat, center_lon, radius_miles=2.5)
    
    if len(blocks_gdf) == 0:
        print("   No blocks found! Check MongoDB connection and data.")
        return
    
    print(f"   Total population in blocks: {blocks_gdf['pop'].sum():,}")
    print(f"   Average block population: {blocks_gdf['pop'].mean():.0f}")
    print(f"   Blocks with poverty data: {(blocks_gdf['poverty_rate'] > 0).sum()}")
    print(f"   Blocks with SNAP data: {(blocks_gdf['snap_rate'] > 0).sum()}")
    
    # Step 3: Analyze overlaps
    print("\n3. Analyzing spatial relationships...")
    overlap_stats = analyze_overlaps(cells_gdf, blocks_gdf)
    
    print(f"\nOverlap Summary:")
    print(f"   Cells with no blocks: {overlap_stats['cells_with_no_blocks']}")
    print(f"   Cells with one block: {overlap_stats['cells_with_one_block']}")
    print(f"   Cells with multiple blocks: {overlap_stats['cells_with_multiple_blocks']}")
    print(f"   Blocks spanning multiple cells: {overlap_stats['blocks_spanning_multiple_cells']}")
    
    # Step 4: Compare assignment methods
    print("\n4. Comparing assignment methods...")
    centroid, area_weighted, pop_weighted = calculate_sample_assignments(
        cells_gdf, blocks_gdf, overlap_stats
    )
    
    if pop_weighted:
        sample_cell = pop_weighted[0]['cell_id']
        print(f"\nExample for Cell {sample_cell}:")
        
        # Find assignments for this cell in each method
        for assignments, method in [(centroid, 'Centroid'), 
                                   (area_weighted, 'Area-weighted'),
                                   (pop_weighted, 'Population-weighted')]:
            assignment = next((a for a in assignments if a['cell_id'] == sample_cell), None)
            if assignment:
                print(f"   {method}: poverty={assignment['poverty_rate']:.3f}, "
                      f"snap={assignment['snap_rate']:.3f}")
    
    # Step 5: Visualize
    print("\n5. Creating visualization...")
    visualize_analysis(cells_gdf, blocks_gdf, center_lat, center_lon)
    
    # Summary insights
    print("\n" + "=" * 60)
    print("INSIGHTS:")
    print("=" * 60)
    
    complexity_pct = (overlap_stats['cells_with_multiple_blocks'] / len(cells_gdf)) * 100
    print(f"1. Spatial Complexity: {complexity_pct:.1f}% of cells overlap multiple blocks")
    
    if overlap_stats['cells_with_no_blocks'] > 0:
        print(f"2. Data Gaps: {overlap_stats['cells_with_no_blocks']} cells have no block data")
        print("   (Could be water, parks, or industrial areas)")
    
    print(f"3. Block Fragmentation: {overlap_stats['blocks_spanning_multiple_cells']} blocks")
    print("   span multiple cells, requiring population distribution")
    
    print("\n4. Assignment Method Impact:")
    print("   - Centroid: Fast but ignores partial overlaps")
    print("   - Area-weighted: Better for rates but assumes uniform distribution")
    print("   - Population-weighted: Most accurate for demographic data")

if __name__ == "__main__":
    main() 