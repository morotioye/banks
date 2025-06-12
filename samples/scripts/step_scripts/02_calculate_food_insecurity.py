#!/usr/bin/env python3
"""
Step 2: Calculate food insecurity scores for blocks in a domain collection.
Uses existing poverty and SNAP rates to calculate initial scores.
"""

import os
import sys
import logging
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
import argparse
from datetime import datetime
import numpy as np

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the calculation functions from models
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'models'))

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

# Food insecurity weights (normalized to sum to 1)
POVERTY_SNAP_WEIGHT = 0.5
DISTANCE_WEIGHT = 0.33
VEHICLE_ACCESS_WEIGHT = 0.17

def calculate_food_insecurity_score(poverty_snap_rate, distance_to_supermarket=0, vehicle_access_rate=1):
    """
    Calculate food insecurity score on a 0-10 scale.
    Now uses real vehicle access data when available.
    """
    # Normalize inputs to 0-1 scale
    poverty_snap_normalized = min(poverty_snap_rate, 1.0)
    
    # Distance factor (still placeholder for future implementation)
    distance_normalized = 0  # Will be updated in later steps
    
    # Vehicle access factor (now uses real data)
    vehicle_access_normalized = min(max(vehicle_access_rate, 0.0), 1.0)  # Ensure 0-1 range
    
    # Calculate weighted score
    score = (
        POVERTY_SNAP_WEIGHT * poverty_snap_normalized +
        DISTANCE_WEIGHT * distance_normalized +
        VEHICLE_ACCESS_WEIGHT * (1 - vehicle_access_normalized)  # Higher score = less vehicle access
    )
    
    # Scale to 0-10
    return score * 10

def calculate_need(population, food_insecurity_score):
    """Calculate need metric (population × score)."""
    return population * food_insecurity_score

def process_domain_collection(collection_name):
    """
    Process blocks in a domain collection to calculate food insecurity scores.
    
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
    
    # Get all blocks
    total_blocks = collection.count_documents({})
    logging.info(f"Total blocks to process: {total_blocks:,}")
    
    # Process in batches
    batch_size = 1000
    updates = []
    
    blocks_processed = 0
    total_population = 0
    scores = []
    
    cursor = collection.find({})
    
    for block in cursor:
        # Extract data
        properties = block.get('properties', {})
        pop = properties.get('pop', 0)
        poverty_rate = properties.get('poverty_rate', 0)
        snap_rate = properties.get('snap_rate', 0)
        vehicle_access_rate = properties.get('vehicle_access_rate', 1.0)  # Default to 1.0 (full access) if missing
        
        # Calculate combined poverty/SNAP rate (average)
        poverty_snap_rate = (poverty_rate + snap_rate) / 2
        
        # Calculate food insecurity score (now includes vehicle access)
        food_insecurity_score = calculate_food_insecurity_score(
            poverty_snap_rate, 
            distance_to_supermarket=0,  # Still placeholder
            vehicle_access_rate=vehicle_access_rate
        )
        
        # Calculate need
        need = calculate_need(pop, food_insecurity_score)
        
        # Create update
        update = UpdateOne(
            {'_id': block['_id']},
            {
                '$set': {
                    'properties.poverty_snap_rate': poverty_snap_rate,
                    'properties.food_insecurity_score': food_insecurity_score,
                    'properties.need': need,
                    'properties.score_updated_at': datetime.utcnow(),
                    'properties.score_factors': {
                        'poverty_rate': poverty_rate,
                        'snap_rate': snap_rate,
                        'poverty_snap_rate': poverty_snap_rate,
                        'distance_to_supermarket': 0,  # Placeholder
                        'vehicle_access_rate': vehicle_access_rate  # Now uses real data
                    }
                }
            }
        )
        updates.append(update)
        
        # Track statistics
        blocks_processed += 1
        total_population += pop
        if pop > 0:
            scores.append(food_insecurity_score)
        
        # Execute batch updates
        if len(updates) >= batch_size:
            collection.bulk_write(updates)
            logging.info(f"  Processed {blocks_processed:,} blocks...")
            updates = []
    
    # Execute remaining updates
    if updates:
        collection.bulk_write(updates)
    
    # Calculate statistics
    scores_array = np.array(scores)
    
    stats = {
        'blocks_processed': blocks_processed,
        'total_population': total_population,
        'blocks_with_scores': len(scores),
        'avg_food_insecurity_score': float(scores_array.mean()) if len(scores) > 0 else 0,
        'median_food_insecurity_score': float(np.median(scores_array)) if len(scores) > 0 else 0,
        'max_food_insecurity_score': float(scores_array.max()) if len(scores) > 0 else 0,
        'min_food_insecurity_score': float(scores_array.min()) if len(scores) > 0 else 0,
        'high_insecurity_blocks': int((scores_array > 7).sum()) if len(scores) > 0 else 0,
        'medium_insecurity_blocks': int(((scores_array >= 3) & (scores_array <= 7)).sum()) if len(scores) > 0 else 0,
        'low_insecurity_blocks': int((scores_array < 3).sum()) if len(scores) > 0 else 0
    }
    
    # Update domain metadata
    metadata_collection = db['domain_metadata']
    metadata_collection.update_one(
        {'collection_name': collection_name},
        {
            '$set': {
                'food_insecurity_stats': stats,
                'last_score_update': datetime.utcnow()
            }
        }
    )
    
    # Create indexes for the new fields
    logging.info("Creating indexes...")
    collection.create_index("properties.food_insecurity_score")
    collection.create_index("properties.need")
    
    logging.info("=" * 60)
    logging.info("FOOD INSECURITY CALCULATION COMPLETE")
    logging.info("=" * 60)
    logging.info(f"Blocks processed: {blocks_processed:,}")
    logging.info(f"Total population: {total_population:,}")
    logging.info(f"Average food insecurity score: {stats['avg_food_insecurity_score']:.2f}")
    logging.info(f"Score distribution:")
    logging.info(f"  High insecurity (>7): {stats['high_insecurity_blocks']:,} blocks")
    logging.info(f"  Medium insecurity (3-7): {stats['medium_insecurity_blocks']:,} blocks")
    logging.info(f"  Low insecurity (<3): {stats['low_insecurity_blocks']:,} blocks")
    
    return True

def main():
    """Main function with argument parsing."""
    parser = argparse.ArgumentParser(description='Calculate food insecurity scores for domain blocks')
    parser.add_argument('--collection', type=str, required=True,
                       help='Domain collection name')
    
    args = parser.parse_args()
    
    # Process the collection
    success = process_domain_collection(args.collection)
    
    if success:
        print(f"\n✓ Food insecurity scores calculated successfully!")
    else:
        print(f"\n✗ Failed to calculate food insecurity scores")
        sys.exit(1)

if __name__ == "__main__":
    main() 