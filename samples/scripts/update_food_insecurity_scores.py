#!/usr/bin/env python3
"""
Script to update food insecurity scores for all blocks using improved weighting.
Prioritizes poverty and SNAP rates with smaller contributions from vehicle access and population.
"""

import os
import sys
import logging
import math
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime

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

def calculate_improved_food_insecurity_score(poverty_rate, snap_rate, vehicle_access_rate, population):
    """
    Calculate improved food insecurity score with proper weighting.
    
    New Formula:
    - 80% Economic Hardship (poverty + SNAP, with amplification for high values)
    - 15% Transportation Barriers (vehicle access)
    - 5% Population Density Factor
    
    Args:
        poverty_rate: 0-1 (e.g., 0.274 for 27.4%)
        snap_rate: 0-1 (e.g., 0.176 for 17.6%) 
        vehicle_access_rate: 0-1 (e.g., 0.842 for 84.2%)
        population: raw count (e.g., 2112)
    
    Returns:
        float: Score from 0-10
    """
    
    # Economic Hardship Component (80% of score)
    # Use the higher of poverty or SNAP rate as base, then add 30% of the other
    primary_hardship = max(poverty_rate, snap_rate)
    secondary_hardship = min(poverty_rate, snap_rate)
    
    # Combined economic hardship with amplification for high values
    economic_hardship = primary_hardship + (0.3 * secondary_hardship)
    
    # Apply amplification curve for high hardship areas
    # This makes high poverty/SNAP areas score much higher
    if economic_hardship > 0.4:  # 40%+ hardship gets amplified
        amplification = 1 + ((economic_hardship - 0.4) * 1.5)  # Up to 90% boost
        economic_hardship = min(economic_hardship * amplification, 1.0)
    
    economic_score = economic_hardship
    
    # Transportation Barrier Component (15% of score)
    # Convert vehicle access to barrier (lack of access)
    vehicle_barrier = 1 - vehicle_access_rate if vehicle_access_rate > 0 else 0.3
    transportation_score = vehicle_barrier
    
    # Population Density Factor (5% of score)
    # Higher population can indicate more competition for resources
    # Use log scale to prevent huge populations from dominating
    if population > 0:
        # Normalize population: 0 at pop=0, 0.5 at pop=2000, 1.0 at pop=5000+
        population_factor = min(math.log(population + 1) / math.log(5001), 1.0)
    else:
        population_factor = 0
    
    # Weighted combination
    final_score = (
        0.80 * economic_score +      # 80% economic factors (poverty + SNAP)
        0.15 * transportation_score + # 15% transportation barriers
        0.05 * population_factor     # 5% population density
    ) * 10  # Scale to 0-10
    
    # Ensure score is within bounds
    final_score = max(0, min(10, final_score))
    
    return final_score

def update_scores_for_collection(collection_name):
    """Update scores for all blocks in a collection."""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[collection_name]
    
    logging.info(f"Updating scores for collection: {collection_name}")
    
    total_blocks = collection.count_documents({})
    logging.info(f"Total blocks to process: {total_blocks:,}")
    
    if total_blocks == 0:
        logging.info("No blocks found in collection")
        return
    
    updates = []
    blocks_processed = 0
    blocks_updated = 0
    batch_size = 1000
    
    # Track score changes for analysis
    score_changes = []
    
    cursor = collection.find({})
    
    for block in cursor:
        # Get block data
        properties = block.get('properties', {})
        poverty_rate = properties.get('poverty_rate', 0)
        snap_rate = properties.get('snap_rate', 0)
        vehicle_access_rate = properties.get('vehicle_access_rate', 0)
        pop = properties.get('pop', 0)
        old_score = properties.get('food_insecurity_score', 0)
        
        # Calculate new score
        new_score = calculate_improved_food_insecurity_score(
            poverty_rate, snap_rate, vehicle_access_rate, pop
        )
        
        # Calculate need (population × score)
        need = pop * new_score if pop > 0 else 0
        
        # Track the change
        score_changes.append({
            'old_score': old_score,
            'new_score': new_score,
            'poverty_rate': poverty_rate,
            'snap_rate': snap_rate,
            'vehicle_access_rate': vehicle_access_rate,
            'population': pop
        })
        
        # Create update
        update = UpdateOne(
            {'_id': block['_id']},
            {
                '$set': {
                    'properties.food_insecurity_score': new_score,
                    'properties.need': need,
                    'properties.score_updated_at': datetime.utcnow().isoformat(),
                    'properties.score_calculation_version': 'v2_improved_weighting',
                    'properties.score_factors': {
                        'poverty_rate': poverty_rate,
                        'snap_rate': snap_rate,
                        'vehicle_access_rate': vehicle_access_rate,
                        'population': pop,
                        'economic_hardship': max(poverty_rate, snap_rate) + (0.3 * min(poverty_rate, snap_rate)),
                        'transportation_barrier': 1 - vehicle_access_rate if vehicle_access_rate > 0 else 0.3,
                        'population_factor': min(math.log(pop + 1) / math.log(5001), 1.0) if pop > 0 else 0
                    }
                }
            }
        )
        updates.append(update)
        blocks_updated += 1
        blocks_processed += 1
        
        # Execute batch updates
        if len(updates) >= batch_size:
            collection.bulk_write(updates)
            logging.info(f"  Processed {blocks_processed:,} blocks...")
            updates = []
    
    # Execute remaining updates
    if updates:
        collection.bulk_write(updates)
    
    # Analyze score changes
    if score_changes:
        old_scores = [c['old_score'] for c in score_changes]
        new_scores = [c['new_score'] for c in score_changes]
        
        avg_old = sum(old_scores) / len(old_scores)
        avg_new = sum(new_scores) / len(new_scores)
        max_old = max(old_scores)
        max_new = max(new_scores)
        
        # Find examples of high poverty/SNAP areas
        high_poverty_examples = [c for c in score_changes if c['poverty_rate'] > 0.25 or c['snap_rate'] > 0.20]
        
        logging.info("=" * 50)
        logging.info(f"SCORE UPDATE COMPLETE FOR {collection_name}")
        logging.info("=" * 50)
        logging.info(f"Blocks processed: {blocks_processed:,}")
        logging.info(f"Score Changes:")
        logging.info(f"  Average: {avg_old:.2f} → {avg_new:.2f}")
        logging.info(f"  Maximum: {max_old:.2f} → {max_new:.2f}")
        
        if high_poverty_examples:
            logging.info("=" * 20 + " HIGH POVERTY EXAMPLES " + "=" * 20)
            for i, example in enumerate(high_poverty_examples[:5]):  # Show first 5 examples
                logging.info(f"Example {i+1}:")
                logging.info(f"  Poverty: {example['poverty_rate']*100:.1f}%, SNAP: {example['snap_rate']*100:.1f}%")
                logging.info(f"  Vehicle Access: {example['vehicle_access_rate']*100:.1f}%, Population: {example['population']:,}")
                logging.info(f"  Score: {example['old_score']:.1f} → {example['new_score']:.1f}")
        
        logging.info("=" * 50)
    
    return {
        'blocks_processed': blocks_processed,
        'blocks_updated': blocks_updated
    }

def main():
    """Main function to update scores for all collections."""
    start_time = datetime.now()
    
    logging.info("=" * 60)
    logging.info("UPDATING FOOD INSECURITY SCORES - IMPROVED WEIGHTING")
    logging.info("=" * 60)
    logging.info("New Formula:")
    logging.info("- 80% Economic Hardship (poverty + SNAP with amplification)")
    logging.info("- 15% Transportation Barriers (vehicle access)")
    logging.info("- 5% Population Density Factor")
    logging.info("=" * 60)
    
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        
        # Get all collections to update
        collections_to_update = []
        
        # Add census_blocks if it exists
        if 'census_blocks' in db.list_collection_names():
            collections_to_update.append('census_blocks')
        
        # Add domain collections
        domain_collections = [name for name in db.list_collection_names() if name.startswith('d_')]
        collections_to_update.extend(domain_collections)
        
        if not collections_to_update:
            logging.error("No collections found to update!")
            return
        
        logging.info(f"Found {len(collections_to_update)} collections to update:")
        for collection_name in collections_to_update:
            count = db[collection_name].count_documents({})
            logging.info(f"  {collection_name}: {count:,} blocks")
        
        # Update each collection
        total_blocks_updated = 0
        for collection_name in collections_to_update:
            stats = update_scores_for_collection(collection_name)
            total_blocks_updated += stats['blocks_updated']
        
        elapsed_time = datetime.now() - start_time
        
        logging.info("=" * 60)
        logging.info("SCORE UPDATE SUMMARY")
        logging.info("=" * 60)
        logging.info(f"Collections updated: {len(collections_to_update)}")
        logging.info(f"Total blocks updated: {total_blocks_updated:,}")
        logging.info(f"Update time: {elapsed_time}")
        logging.info("\n✓ All scores updated with improved weighting!")
        logging.info("✓ High poverty/SNAP areas should now have much higher scores")
        logging.info("✓ Economic factors now dominate the scoring (80%)")
        logging.info("✓ Transportation and population are minor factors (15% + 5%)")
        
    except Exception as e:
        logging.error(f"Score update failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    main() 