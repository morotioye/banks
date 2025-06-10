#!/usr/bin/env python3
"""Check the sizes of census blocks compared to our cells."""

import geopandas as gpd
from pymongo import MongoClient
from shapely.geometry import Polygon
import numpy as np
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to MongoDB
client = MongoClient(os.getenv('MONGO_DB_URI'))
db = client[os.getenv('TEST_DB_NAME')]

# Get sample blocks from downtown LA area
center_lat = 34.0522
center_lon = -118.2437

blocks = list(db['census_blocks'].find({
    "geometry": {
        "$nearSphere": {
            "$geometry": {
                "type": "Point",
                "coordinates": [center_lon, center_lat]
            },
            "$maxDistance": 5000  # 5km radius
        }
    }
}).limit(500))

print(f"Analyzing {len(blocks)} census blocks near downtown LA...")

# Calculate areas
areas = []
populations = []
for block in blocks:
    geom = Polygon(block['geometry']['coordinates'][0])
    # Convert to projected coordinates for area calculation
    # Using approximate conversion at LA latitude
    area_deg = geom.area
    area_m2 = area_deg * 111320 * 96486  # deg² to m² at 34°N
    areas.append(area_m2)
    populations.append(block['properties']['pop'])

areas = np.array(areas)
populations = np.array(populations)

print(f'\nCensus Block Group Statistics:')
print(f'  Count: {len(areas)}')
print(f'  Min area: {areas.min():,.0f} m² ({areas.min()/1000000:.3f} km²)')
print(f'  Max area: {areas.max():,.0f} m² ({areas.max()/1000000:.3f} km²)')
print(f'  Mean area: {areas.mean():,.0f} m² ({areas.mean()/1000000:.3f} km²)')
print(f'  Median area: {np.median(areas):,.0f} m² ({np.median(areas)/1000000:.3f} km²)')
print(f'  Std dev: {areas.std():,.0f} m²')

print(f'\nOur Grid Cell Size: 150,000 m² (0.150 km²)')
print(f'  Cell is {150000/np.median(areas):.1f}x larger than median block')
print(f'  Cell is {150000/areas.min():.1f}x larger than smallest block')
print(f'  Cell is {150000/areas.max():.1f}x smaller than largest block')

# Distribution
print(f'\nBlock Size Distribution:')
print(f'  < 50,000 m²: {(areas < 50000).sum()} blocks ({(areas < 50000).sum()/len(areas)*100:.1f}%)')
print(f'  50,000-150,000 m²: {((areas >= 50000) & (areas < 150000)).sum()} blocks ({((areas >= 50000) & (areas < 150000)).sum()/len(areas)*100:.1f}%)')
print(f'  150,000-500,000 m²: {((areas >= 150000) & (areas < 500000)).sum()} blocks ({((areas >= 150000) & (areas < 500000)).sum()/len(areas)*100:.1f}%)')
print(f'  > 500,000 m²: {(areas >= 500000).sum()} blocks ({(areas >= 500000).sum()/len(areas)*100:.1f}%)')

# Population density
densities = populations / (areas / 1000000)  # people per km²
print(f'\nPopulation Density:')
print(f'  Mean: {densities[populations > 0].mean():,.0f} people/km²')
print(f'  Blocks with 0 population: {(populations == 0).sum()} ({(populations == 0).sum()/len(populations)*100:.1f}%)') 