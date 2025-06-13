#!/usr/bin/env python3
"""
Check testbank database contents
"""

import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')

print("🔍 Checking testbank database")
print("=" * 50)

try:
    client = MongoClient(MONGO_URI)
    db = client['testbank']  # Use testbank database
    
    collections = db.list_collection_names()
    
    print(f"\n📁 Collections in 'testbank' database ({len(collections)} total):")
    
    # Separate domain collections from others
    domain_collections = [c for c in collections if c.startswith('d_')]
    other_collections = [c for c in collections if not c.startswith('d_')]
    
    print(f"\n🏢 System collections:")
    for collection in sorted(other_collections):
        count = db[collection].count_documents({})
        print(f"   - {collection}: {count} documents")
    
    print(f"\n🗺️  Domain collections ({len(domain_collections)} total):")
    for collection in sorted(domain_collections)[:10]:  # Show first 10
        count = db[collection].count_documents({})
        domain_name = collection.replace('d_', '')
        print(f"   - {domain_name}: {count} blocks")
    
    if len(domain_collections) > 10:
        print(f"   ... and {len(domain_collections) - 10} more domains")
    
    # Check domains collection
    print("\n📋 Domains registry:")
    domains_collection = db['domains']
    for domain in domains_collection.find().limit(5):
        print(f"   - {domain.get('name', 'unnamed')} -> {domain.get('collection_name', 'unknown')}")
    
    # Check a sample domain structure
    if domain_collections:
        sample_collection = domain_collections[0]
        print(f"\n🔬 Sample data from '{sample_collection}':")
        sample_doc = db[sample_collection].find_one()
        if sample_doc and 'properties' in sample_doc:
            props = sample_doc['properties']
            print("   Properties available:")
            for key in ['geoid', 'pop', 'food_insecurity_score', 'poverty_rate', 'snap_rate', 'vehicle_access_rate']:
                if key in props:
                    print(f"   ✅ {key}: {props[key]}")
                else:
                    print(f"   ❌ {key}: NOT FOUND")
    
except Exception as e:
    print(f"❌ Error: {e}") 