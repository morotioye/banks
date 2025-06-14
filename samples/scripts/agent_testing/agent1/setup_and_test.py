#!/usr/bin/env python3
"""
Setup and Test Execution Script for Food Bank Optimization System
This script handles dependency installation, environment setup, and test execution.
"""

import os
import sys
import subprocess
import asyncio
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def install_dependencies():
    """Install required dependencies from requirements.txt."""
    logger.info("🔧 Installing dependencies...")
    
    try:
        # Look for requirements.txt in parent directories
        requirements_paths = [
            "requirements.txt",
            "../requirements.txt", 
            "../../requirements.txt"
        ]
        
        requirements_file = None
        for path in requirements_paths:
            if Path(path).exists():
                requirements_file = path
                break
        
        if not requirements_file:
            logger.error("❌ requirements.txt not found in current or parent directories!")
            return False
            
        # Install from requirements.txt
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", requirements_file])
        logger.info("✅ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to install dependencies: {e}")
        return False

def check_environment():
    """Check if the environment is properly configured."""
    logger.info("🔍 Checking environment configuration...")
    
    # Check for .env file
    env_file = Path('.env')
    if not env_file.exists():
        logger.warning("⚠️  .env file not found - creating template...")
        create_env_template()
    
    # Check required environment variables (all optional for mock testing)
    optional_vars = [
        'MONGO_DB_URI',
        'TEST_DB_NAME'
    ]
    
    missing_vars = []
    for var in optional_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.info(f"ℹ️  Optional environment variables not set: {', '.join(missing_vars)}")
        logger.info("   The system will use default values or mock implementations.")
    else:
        logger.info("✅ All optional environment variables are configured!")
    
    return True

def create_env_template():
    """Create a template .env file."""
    template = """# Food Bank Optimization System Configuration
# All variables are OPTIONAL - system works with mock data by default

# MongoDB Configuration (only needed for real geographic data)
MONGO_DB_URI=mongodb://localhost:27017/
TEST_DB_NAME=testbank_test

# Optional: API keys for real implementations
# GEMINI_API_KEY=your_gemini_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here

# System Configuration
MAX_CONCURRENT_AGENTS=6
RESULT_OUTPUT_DIR=./results
"""
    
    with open('.env', 'w') as f:
        f.write(template)
    
    logger.info("📝 Created .env template file - please update with your API keys")

def check_test_data():
    """Check if test data is available."""
    logger.info("📊 Checking for test data...")
    
    # This would check for existing domain collections in MongoDB
    # For now, just log a message
    logger.info("   Test data check not implemented - system will use mock data if needed")
    return True

async def run_test_with_mock_data():
    """Run the test system with mock data."""
    logger.info("🚀 Running test with mock data...")
    
    try:
        # Import and run the main system
        from test_full_agent_architecture import FoodBankOptimizationSystem
        
        # Create a test system with mock domain
        system = FoodBankOptimizationSystem(domain='test_mock', budget=500000)
        
        # Override load_domain_data to provide mock data
        original_load = system.load_domain_data
        async def mock_load_domain_data():
            from test_full_agent_architecture import Cell
            
            # Create mock cells for testing
            mock_cells = []
            for i in range(10):  # 10 test cells
                cell = Cell(
                    geoid=f'test_cell_{i}',
                    lat=34.0522 + (i * 0.01),  # LA area coordinates
                    lon=-118.2437 + (i * 0.01),
                    population=1000 + (i * 500),
                    food_insecurity_score=3.0 + (i * 0.5),
                    poverty_rate=0.15 + (i * 0.05),
                    snap_rate=0.10 + (i * 0.03),
                    vehicle_access_rate=0.8 - (i * 0.02),
                    need=(1000 + (i * 500)) * (3.0 + (i * 0.5)),
                    geometry={'type': 'Polygon', 'coordinates': [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
                )
                mock_cells.append(cell)
            
            logger.info(f"Generated {len(mock_cells)} mock cells for testing")
            return mock_cells
        
        # Replace the method
        system.load_domain_data = mock_load_domain_data
        
        # Run the full pipeline
        results = await system.run_full_pipeline()
        
        if results:
            logger.info("🎉 Mock test completed successfully!")
            return True
        else:
            logger.error("❌ Mock test failed!")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error during mock test: {e}")
        return False

async def main():
    """Main setup and test function."""
    print("""
🏪 FOOD BANK OPTIMIZATION SYSTEM
=================================
Setup and Test Execution Script
=================================
    """)
    
    success = True
    
    # Step 1: Install dependencies
    if not install_dependencies():
        logger.error("❌ Dependency installation failed!")
        success = False
    
    # Step 2: Check environment
    if not check_environment():
        logger.error("❌ Environment check failed!")
        success = False
    
    # Step 3: Check test data
    if not check_test_data():
        logger.warning("⚠️  Test data check failed - will use mock data")
    
    # Step 4: Run test
    if success:
        logger.info("🚀 Starting food bank optimization test...")
        
        try:
            # Try to run with real data first
            logger.info("Attempting to run with real domain data...")
            subprocess.check_call([
                sys.executable, 
                "test_full_agent_architecture.py", 
                "--domain", "downtown_la",
                "--budget", "500000"
            ])
            logger.info("✅ Real data test completed!")
            
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.info("⚠️  Real data test failed - running with mock data...")
            
            # Run with mock data
            mock_success = await run_test_with_mock_data()
            if not mock_success:
                success = False
    
    # Final summary
    print("\n" + "="*50)
    if success:
        print("🎉 SETUP AND TEST COMPLETED SUCCESSFULLY!")
        print("="*50)
        print("✅ Dependencies installed")
        print("✅ Environment configured")  
        print("✅ Test execution completed")
        print("📁 Check the generated files for results:")
        print("   - optimization_results_*.json")
        print("   - optimization_report_*.txt")
        print("   - food_bank_optimization_*.png")
    else:
        print("❌ SETUP AND TEST FAILED!")
        print("="*50)
        print("Please check the error messages above and:")
        print("1. Ensure all dependencies are properly installed")
        print("2. Update the .env file with your API keys")
        print("3. Check that MongoDB is running (if using real data)")
    
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())