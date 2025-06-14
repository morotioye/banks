#!/usr/bin/env python3
"""
Test script to verify agent setup and MongoDB connection
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("🔍 Testing Food Bank Optimization Agent Setup")
print("=" * 50)

# Test 1: Python version
print(f"✅ Python version: {sys.version}")

# Test 2: Required packages
print("\n📦 Checking required packages:")
required_packages = ['pymongo', 'numpy', 'geopy', 'dotenv']
for package in required_packages:
    try:
        __import__(package)
        print(f"  ✅ {package} installed")
    except ImportError:
        print(f"  ❌ {package} NOT installed")

# Test 3: MongoDB connection
print("\n🗄️  Testing MongoDB connection:")
MONGO_URI = os.getenv('MONGO_DB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'food_insecurity')

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Force connection
    client.server_info()
    print(f"  ✅ Connected to MongoDB at {MONGO_URI}")
    
    # Check database
    db = client[DB_NAME]
    collections = db.list_collection_names()
    print(f"  ✅ Database '{DB_NAME}' accessible")
    
    # List domains
    domain_collections = [c for c in collections if c.startswith('d_')]
    if domain_collections:
        print(f"  ✅ Found {len(domain_collections)} domain collections:")
        for domain in domain_collections[:5]:  # Show first 5
            collection = db[domain]
            count = collection.count_documents({})
            print(f"     - {domain}: {count} blocks")
    else:
        print("  ⚠️  No domain collections found")
        
except Exception as e:
    print(f"  ❌ MongoDB connection failed: {e}")
    print("     Make sure MongoDB is running")

# Test 4: Agent import
print("\n🤖 Testing agent import:")
try:
    sys.path.insert(0, 'agents/location_agent')
    from index import LocationOptimizationAgent, OptimizationRequest
    print("  ✅ Agent modules imported successfully")
    
    # Try to create agent instance
    agent = LocationOptimizationAgent()
    print("  ✅ Agent instance created")
    
except Exception as e:
    print(f"  ❌ Agent import failed: {e}")

print("\n" + "=" * 50)
print("Setup test complete!") 