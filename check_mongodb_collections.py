#!/usr/bin/env python3
"""
Check all collections in MongoDB database
"""

import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'food_insecurity')

print(f"🔍 Checking MongoDB collections")
print(f"   URI: {MONGO_URI}")
print(f"   Database: {DB_NAME}")
print("=" * 50)

try:
    client = MongoClient(MONGO_URI)
    
    # List all databases
    print("\n📚 Available databases:")
    for db_name in client.list_database_names():
        print(f"   - {db_name}")
    
    # Check our specific database
    db = client[DB_NAME]
    collections = db.list_collection_names()
    
    print(f"\n📁 Collections in '{DB_NAME}' database:")
    if collections:
        for collection in sorted(collections):
            count = db[collection].count_documents({})
            print(f"   - {collection}: {count} documents")
            
            # Show sample document structure for domain collections
            if collection.startswith('d_'):
                sample = db[collection].find_one()
                if sample:
                    print(f"     Sample fields: {list(sample.keys())}")
                    if 'properties' in sample:
                        print(f"     Properties: {list(sample['properties'].keys())[:5]}...")
    else:
        print("   ❌ No collections found!")
        
    # Also check the 'domains' collection
    print("\n🏢 Checking 'domains' collection:")
    domains_collection = db['domains']
    domain_count = domains_collection.count_documents({})
    print(f"   Found {domain_count} domain records")
    
    if domain_count > 0:
        print("   Sample domains:")
        for domain in domains_collection.find().limit(3):
            print(f"   - {domain.get('name', 'unnamed')}: collection={domain.get('collection_name', 'unknown')}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nTrying alternative database names...")
    
    # Try some common database names
    alt_db_names = ['hotspots', 'banks', 'food_banks', 'test']
    for alt_db in alt_db_names:
        try:
            db = client[alt_db]
            collections = db.list_collection_names()
            if collections:
                print(f"\n✅ Found collections in '{alt_db}' database:")
                domain_collections = [c for c in collections if c.startswith('d_')]
                if domain_collections:
                    print(f"   Domain collections: {domain_collections[:5]}")
                if 'domains' in collections:
                    print(f"   ✅ Has 'domains' collection")
        except:
            pass 