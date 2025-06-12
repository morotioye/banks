#!/usr/bin/env python3
"""
Update food insecurity scores with improved algorithm - NO VEHICLE ACCESS COMPONENT
Focus purely on economic hardship indicators (poverty + SNAP rates)
"""

import os
import sys
import logging
import math
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv()

# Configuration
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('TEST_DB_NAME', 'food_insecurity_test')

def calculate_new_food_insecurity_score(poverty_rate, snap_rate, population):
    """
    Calculate improved food insecurity score focusing ONLY on economic hardship.
    
    New Formula:
    - 90% Economic Hardship (poverty + SNAP with amplification)
    - 10% Population Density Factor
    
    Args:
        poverty_rate: Poverty rate (0-1)
        snap_rate: SNAP rate (0-1) 
        population: Total population
        
    Returns:
        float: Score from 0-10
    """
    
    # Economic hardship calculation
    primary_hardship = max(poverty_rate, snap_rate)
    secondary_hardship = min(poverty_rate, snap_rate)
    
    # Base economic hardship: primary + 30% of secondary
    economic_hardship = primary_hardship + (0.3 * secondary_hardship)
    
    # Amplification for very high economic hardship areas
    if economic_hardship > 0.4:  # 40%+ combined hardship
        # Up to 50% boost for extreme hardship
        amplification = 1 + ((economic_hardship - 0.4) * 1.5)
        economic_hardship = min(economic_hardship * amplification, 1.0)
    
    # Population density factor (minor influence)
    population_factor = min(math.log(population + 1) / math.log(5001), 1.0) if population > 0 else 0
    
    # Final score calculation (focused on economic hardship)
    final_score = (
        0.90 * economic_hardship +      # 90% economic hardship
        0.10 * population_factor        # 10% population density
    ) * 10
    
    return max(0, min(10, final_score))

def update_collection_scores(collection_name):
    """Update food insecurity scores for a specific collection."""
    
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[collection_name]
    
    logging.info(f"Updating scores for collection: {collection_name}")
    
    # Get all blocks with required data
    blocks = list(collection.find({
        "properties.poverty_rate": {"$gte": 0},
        "properties.snap_rate": {"$gte": 0}
    }))
    
    if not blocks:
        logging.warning(f"No blocks with poverty/SNAP data found in {collection_name}")
        return
    
    logging.info(f"Total blocks to process: {len(blocks):,}")
    
    # Track score changes for reporting
    old_scores = []
    new_scores = []
    examples = []
    
    count = 0
    for block in blocks:
        count += 1
        
        props = block['properties']
        poverty_rate = props.get('poverty_rate', 0)
        snap_rate = props.get('snap_rate', 0)
        population = props.get('pop', 0)
        old_score = props.get('food_insecurity_score', 0)
        
        # Calculate new score (NO VEHICLE ACCESS)
        new_score = calculate_new_food_insecurity_score(poverty_rate, snap_rate, population)
        
        # Track for statistics
        old_scores.append(old_score)
        new_scores.append(new_score)
        
        # Collect examples of high-poverty areas
        if len(examples) < 5 and (poverty_rate > 0.25 or snap_rate > 0.25):
            examples.append({
                'poverty_rate': poverty_rate,
                'snap_rate': snap_rate,
                'population': population,
                'old_score': old_score,
                'new_score': new_score
            })
        
        # Update the block
        collection.update_one(
            {"_id": block["_id"]},
            {"$set": {"properties.food_insecurity_score": new_score}}
        )
        
        if count % 1000 == 0:
            logging.info(f"  Processed {count:,} blocks...")
    
    # Report statistics
    logging.info("=" * 50)
    logging.info(f"SCORE UPDATE COMPLETE FOR {collection_name}")
    logging.info("=" * 50)
    logging.info(f"Blocks processed: {len(blocks):,}")
    logging.info(f"Score Changes:")
    logging.info(f"  Average: {sum(old_scores)/len(old_scores):.2f} → {sum(new_scores)/len(new_scores):.2f}")
    logging.info(f"  Maximum: {max(old_scores):.2f} → {max(new_scores):.2f}")
    
    # Show examples of high-poverty areas
    logging.info("=" * 20 + " HIGH POVERTY EXAMPLES " + "=" * 20)
    for i, example in enumerate(examples, 1):
        logging.info(f"Example {i}:")
        logging.info(f"  Poverty: {example['poverty_rate']*100:.1f}%, SNAP: {example['snap_rate']*100:.1f}%")
        logging.info(f"  Population: {example['population']:,}")
        logging.info(f"  Score: {example['old_score']:.1f} → {example['new_score']:.1f}")
    
    logging.info("=" * 50)

def main():
    """Main function to update all collections."""
    
    logging.info("=" * 60)
    logging.info("UPDATING FOOD INSECURITY SCORES - ECONOMIC HARDSHIP ONLY")
    logging.info("=" * 60)
    logging.info("New Formula:")
    logging.info("- 90% Economic Hardship (poverty + SNAP with amplification)")
    logging.info("- 10% Population Density Factor")
    logging.info("- Vehicle access REMOVED from scoring (kept for visualization)")
    logging.info("=" * 60)
    
    start_time = datetime.now()
    
    # Connect to database
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Update only census_blocks collection
    collection_name = "census_blocks"
    
    # Check if collection exists and has data
    if collection_name not in db.list_collection_names():
        logging.error(f"Collection '{collection_name}' not found!")
        return
        
    count = db[collection_name].count_documents({"properties.poverty_rate": {"$gte": 0}})
    if count == 0:
        logging.error(f"No census blocks with poverty data found in '{collection_name}'!")
        return
    
    # Show what we found
    logging.info(f"Updating collection: {collection_name}")
    logging.info(f"  Blocks with data: {count:,}")
    total_blocks = count
    
    # Update the collection
    update_collection_scores(collection_name)
    
    end_time = datetime.now()
    
    # Final summary
    logging.info("=" * 60)
    logging.info("SCORE UPDATE SUMMARY")
    logging.info("=" * 60)
    logging.info(f"Collection updated: {collection_name}")
    logging.info(f"Total blocks updated: {total_blocks:,}")
    logging.info(f"Update time: {end_time - start_time}")
    logging.info("")
    logging.info("✓ Census blocks scores updated with economic hardship focus!")
    logging.info("✓ Vehicle access removed from scoring calculation")
    logging.info("✓ Vehicle access still available for frontend visualization")
    logging.info("✓ Scoring now purely reflects economic need")

if __name__ == "__main__":
    main() 