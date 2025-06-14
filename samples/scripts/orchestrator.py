#!/usr/bin/env python3
"""
Orchestrator script to run all food insecurity analysis steps sequentially.
Works with domain collections created by step 1.
"""

import os
import sys
import subprocess
from datetime import datetime
from typing import List, Tuple
from dotenv import load_dotenv
import argparse
import json

# Load environment variables
load_dotenv()

# Define the steps in order
STEPS = [
    {
        'name': 'Create Domain',
        'script': '01_create_domain.py',
        'description': 'Create domain collection from census blocks within radius',
        'supports_collection': False  # This step creates the collection
    },
    # Note: Score calculation is now done during initial census block collection
    # Domain creation simply copies pre-calculated blocks
    # {
    #     'name': 'Calculate Food Insecurity Scores',
    #     'script': '02_calculate_food_insecurity.py',
    #     'description': 'Calculate initial food insecurity scores based on poverty and SNAP rates',
    #     'supports_collection': True
    # },
    # Future steps will be added here:
    # {
    #     'name': 'Find Nearest Supermarkets',
    #     'script': '04_find_supermarkets.py',
    #     'description': 'Calculate distance to nearest supermarket for each block',
    #     'supports_collection': True
    # },
    # {
    #     'name': 'Update Food Insecurity Scores',
    #     'script': '05_update_scores.py',
    #     'description': 'Update scores with all factors and calculate need metrics',
    #     'supports_collection': True
    # },
    # {
    #     'name': 'Generate Analysis Report',
    #     'script': '06_generate_report.py',
    #     'description': 'Generate summary statistics and visualizations',
    #     'supports_collection': True
    # }
]

def run_step(step_name: str, script_path: str, extra_args: List[str] = None) -> Tuple[bool, str]:
    """
    Run a single step script.
    
    Args:
        step_name: Name of the step
        script_path: Path to the script
        extra_args: Additional arguments to pass to the script
        
    Returns:
        Tuple of (success, output)
    """
    print(f"\n{'='*60}")
    print(f"Running: {step_name}")
    print(f"Script: {script_path}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if extra_args:
        print(f"Arguments: {' '.join(extra_args)}")
    print(f"{'='*60}\n")
    
    try:
        # Build command
        cmd = [sys.executable, script_path]
        if extra_args:
            cmd.extend(extra_args)
        
        # Run the script
        result = subprocess.run(
            cmd,
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
        
        # Return both stdout and stderr for parsing
        return True, result.stdout + '\n' + result.stderr
        
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

def extract_collection_name(output: str) -> str:
    """Extract collection name from step 1 output."""
    # Look in both stdout and stderr since logging goes to stderr
    for line in output.split('\n'):
        if 'Collection name: ' in line:
            # Extract the collection name after the colon
            parts = line.split('Collection name: ')
            if len(parts) > 1:
                return parts[1].strip()
    return None

def main():
    """Main orchestrator function."""
    parser = argparse.ArgumentParser(description='Food Insecurity Analysis Orchestrator')
    
    # Arguments for domain creation (step 1)
    parser.add_argument('--name', type=str, default='downtown_la',
                       help='Name for the domain (will be prefixed with d_)')
    parser.add_argument('--lat', type=float, action='append',
                       help='Latitude of center point (can be specified multiple times)')
    parser.add_argument('--lon', type=float, action='append',
                       help='Longitude of center point (can be specified multiple times)')
    parser.add_argument('--radius', type=float, action='append',
                       help='Radius in miles (can be specified multiple times)')
    
    # Optional: specify existing collection to skip step 1
    parser.add_argument('--collection', type=str, default=None,
                       help='Existing domain collection name (skips step 1)')
    
    # Optional: run only specific steps
    parser.add_argument('--steps', type=str, default=None,
                       help='Comma-separated list of step numbers to run (e.g., "1,2,3")')
    
    args = parser.parse_args()
    
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
    collection_name = args.collection
    
    # Determine which steps to run
    if args.steps:
        steps_to_run = [int(s.strip()) for s in args.steps.split(',')]
    else:
        steps_to_run = list(range(1, len(STEPS) + 1))
    
    # Run each step
    for i, step in enumerate(STEPS, 1):
        if i not in steps_to_run:
            print(f"\n[Step {i}/{len(STEPS)}] {step['name']} - SKIPPED")
            continue
            
        print(f"\n[Step {i}/{len(STEPS)}] {step['name']}")
        print(f"Description: {step['description']}")
        
        # Build arguments for the step
        step_args = []
        
        if i == 1:  # Create Domain step
            if collection_name:
                print("Skipping - using existing collection")
                continue
            
            # Validate that we have matching lat/lon/radius lists
            if not args.lat or not args.lon or not args.radius:
                print("✗ Missing lat/lon/radius arguments")
                all_success = False
                break
            
            if len(args.lat) != len(args.lon) or len(args.lat) != len(args.radius):
                print("✗ Mismatched number of lat/lon/radius arguments")
                all_success = False
                break
            
            step_args = ['--name', args.name]
            
            # Add each circle
            for lat, lon, radius in zip(args.lat, args.lon, args.radius):
                step_args.extend(['--lat', str(lat), '--lon', str(lon), '--radius', str(radius)])
        else:
            # Other steps need the collection name
            if not collection_name:
                print("✗ No collection name available. Run step 1 first or provide --collection")
                all_success = False
                break
            
            if step.get('supports_collection', True):
                step_args = ['--collection', collection_name]
        
        success, output = run_step(step['name'], step['script'], step_args)
        
        # Extract collection name from step 1 output
        if i == 1 and success:
            # The output already contains both stdout and stderr
            extracted_name = extract_collection_name(output)
            if not extracted_name:
                # Try a simpler pattern match for d_* collection names
                import re
                match = re.search(r'd_[a-zA-Z0-9_]+', output)
                if match:
                    extracted_name = match.group(0)
            
            if extracted_name:
                collection_name = extracted_name
                print(f"\n✓ Created domain collection: {collection_name}")
        
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
    print(f"\nSteps completed: {len([r for r in results if r['success']])}/{len([s for s in steps_to_run])}")
    
    for result in results:
        status = "✓" if result['success'] else "✗"
        print(f"{status} {result['step']}")
    
    if collection_name:
        print(f"\nDomain collection: {collection_name}")
    
    if all_success:
        print("\n✓ All steps completed successfully!")
    else:
        print("\n✗ Orchestration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
