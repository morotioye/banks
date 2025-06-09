#!/usr/bin/env python3
"""
Orchestrator script to run all food insecurity analysis steps sequentially.
"""

import os
import sys
import subprocess
from datetime import datetime
from typing import List, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Define the steps in order
STEPS = [
    {
        'name': 'Create Empty Cells',
        'script': '01_create_empty_cells.py',
        'description': 'Create grid of empty cells with centroid coordinates'
    },
    # Future steps will be added here:
    # {
    #     'name': 'Populate Cell Population',
    #     'script': '02_populate_population.py',
    #     'description': 'Add population data to cells from census data'
    # },
    # {
    #     'name': 'Calculate Poverty/SNAP Rates',
    #     'script': '03_calculate_poverty_snap.py',
    #     'description': 'Calculate poverty and SNAP eligibility rates per cell'
    # },
    # {
    #     'name': 'Find Nearest Supermarkets',
    #     'script': '04_find_supermarkets.py',
    #     'description': 'Calculate distance to nearest supermarket for each cell'
    # },
    # {
    #     'name': 'Calculate Vehicle Access',
    #     'script': '05_vehicle_access.py',
    #     'description': 'Determine vehicle access rates per cell'
    # },
    # {
    #     'name': 'Calculate Food Insecurity Scores',
    #     'script': '06_calculate_scores.py',
    #     'description': 'Calculate final food insecurity scores and need metrics'
    # }
]

def run_step(step_name: str, script_path: str) -> Tuple[bool, str]:
    """
    Run a single step script.
    
    Args:
        step_name: Name of the step
        script_path: Path to the script
        
    Returns:
        Tuple of (success, output)
    """
    print(f"\n{'='*60}")
    print(f"Running: {step_name}")
    print(f"Script: {script_path}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    try:
        # Run the script
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Print output
        if result.stdout:
            print(result.stdout)
        
        if result.stderr:
            print("Warnings/Errors:", file=sys.stderr)
            print(result.stderr, file=sys.stderr)
        
        return True, result.stdout
        
    except subprocess.CalledProcessError as e:
        print(f"\n✗ Step failed with exit code {e.returncode}")
        if e.stdout:
            print("Output:")
            print(e.stdout)
        if e.stderr:
            print("Error:")
            print(e.stderr)
        return False, str(e)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        return False, str(e)

def main():
    """Main orchestrator function."""
    print("Food Insecurity Analysis Orchestrator")
    print("=====================================")
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Database: {os.getenv('TEST_DB_NAME', 'food_insecurity_test')}")
    
    # Change to scripts directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    step_scripts_dir = os.path.join(script_dir, 'step_scripts')
    os.chdir(step_scripts_dir)
    
    # Track results
    results = []
    all_success = True
    
    # Run each step
    for i, step in enumerate(STEPS, 1):
        print(f"\n[Step {i}/{len(STEPS)}] {step['name']}")
        print(f"Description: {step['description']}")
        
        success, output = run_step(step['name'], step['script'])
        results.append({
            'step': step['name'],
            'success': success,
            'output': output
        })
        
        if not success:
            all_success = False
            print(f"\n✗ Stopping orchestration due to failure in step: {step['name']}")
            break
    
    # Print summary
    print(f"\n{'='*60}")
    print("ORCHESTRATION SUMMARY")
    print(f"{'='*60}")
    print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\nSteps completed: {len([r for r in results if r['success']])}/{len(STEPS)}")
    
    for result in results:
        status = "✓" if result['success'] else "✗"
        print(f"{status} {result['step']}")
    
    if all_success:
        print("\n✓ All steps completed successfully!")
    else:
        print("\n✗ Orchestration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
