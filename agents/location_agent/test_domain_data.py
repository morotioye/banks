#!/usr/bin/env python3
"""
Test script to check domain data format
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'food_insecurity')

def test_domain(domain_name):
    """Test a specific domain's data format"""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    collection_name = f"d_{domain_name}"
    if collection_name not in db.list_collection_names():
        print(f"❌ Domain collection '{collection_name}' not found")
        return
    
    collection = db[collection_name]
    
    # Get sample documents
    sample_docs = list(collection.find().limit(3))
    
    print(f"\n📊 Domain: {domain_name}")
    print(f"   Collection: {collection_name}")
    print(f"   Total blocks: {collection.count_documents({})}")
    
    if sample_docs:
        print("\n   Sample block structure:")
        doc = sample_docs[0]
        
        # Check required fields
        required_fields = ['geometry', 'properties']
        for field in required_fields:
            if field in doc:
                print(f"   ✅ Has '{field}' field")
            else:
                print(f"   ❌ Missing '{field}' field")
        
        # Check properties
        if 'properties' in doc:
            props = doc['properties']
            print("\n   Properties fields:")
            important_fields = [
                'geoid', 'pop', 'food_insecurity_score', 
                'poverty_rate', 'snap_rate', 'vehicle_access_rate', 'need'
            ]
            for field in important_fields:
                if field in props:
                    value = props[field]
                    print(f"   ✅ {field}: {value} (type: {type(value).__name__})")
                else:
                    print(f"   ⚠️  {field}: NOT FOUND")
        
        # Check geometry
        if 'geometry' in doc:
            geom = doc['geometry']
            if 'type' in geom and 'coordinates' in geom:
                print(f"\n   ✅ Geometry type: {geom['type']}")
                if geom['coordinates'] and len(geom['coordinates']) > 0:
                    coords = geom['coordinates'][0]
                    if coords and len(coords) > 0:
                        print(f"   ✅ Sample coordinate: {coords[0]}")
            else:
                print("   ❌ Invalid geometry structure")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', help='Domain to test')
    args = parser.parse_args()
    
    if args.domain:
        test_domain(args.domain)
    else:
        # Test all domains
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        domain_collections = [c for c in db.list_collection_names() if c.startswith('d_')]
        
        print(f"Found {len(domain_collections)} domains to test")
        for collection in domain_collections[:3]:  # Test first 3
            domain = collection.replace('d_', '')
            test_domain(domain) 