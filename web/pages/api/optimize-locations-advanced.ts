import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

interface AdvancedOptimizationRequest {
  domain: string;
  budget: number;
  maxLocations?: number;
  minDistanceBetweenBanks?: number;
  strategy?: 'greedy' | 'kmeans' | 'multi_objective';
  populationWeight?: number;
  povertyWeight?: number;
  snapWeight?: number;
  vehicleAccessWeight?: number;
  geographicWeight?: number;
}

interface OptimizationResponse {
  status: 'success' | 'error' | 'in_progress';
  data?: {
    locations: Array<{
      geoid: string;
      lat: number;
      lon: number;
      expected_impact: number;
      coverage_radius: number;
      efficiency_score: number;
      setup_cost: number;
      operational_cost_monthly: number;
      coverage_area?: number;
      population_served?: number;
      need_served?: number;
      accessibility_impact?: number;
    }>;
    total_people_served: number;
    total_budget_used: number;
    coverage_percentage: number;
    optimization_metrics: Record<string, any>;
    timestamp: string;
  };
  error?: string;
  jobId?: string;
}

// Store for tracking optimization jobs
const optimizationJobs = new Map<string, {
  status: 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OptimizationResponse>
) {
  if (req.method === 'POST') {
    try {
      const { 
        domain, 
        budget, 
        maxLocations = 10, 
        minDistanceBetweenBanks = 0.5,
        strategy = 'multi_objective',
        populationWeight = 0.25,
        povertyWeight = 0.25,
        snapWeight = 0.20,
        vehicleAccessWeight = 0.15,
        geographicWeight = 0.15
      } = req.body as AdvancedOptimizationRequest;

      // Validate input
      if (!domain || !budget) {
        return res.status(400).json({
          status: 'error',
          error: 'Domain and budget are required'
        });
      }

      if (budget < 500000) {
        return res.status(400).json({
          status: 'error',
          error: 'Minimum budget is $500,000'
        });
      }

      // Validate weights
      const totalWeight = populationWeight + povertyWeight + snapWeight + vehicleAccessWeight + geographicWeight;
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        return res.status(400).json({
          status: 'error',
          error: `Weights must sum to 1.0 (current sum: ${totalWeight.toFixed(2)})`
        });
      }

      // Generate job ID
      const jobId = `adv_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize job tracking
      optimizationJobs.set(jobId, { status: 'in_progress' });

      // Run Python advanced optimization script
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      // Handle both development and production paths
      const possiblePaths = [
        path.join(process.cwd(), '..', 'agents', 'location_agent', 'run_advanced_optimization.py'),
        path.join(process.cwd(), 'agents', 'location_agent', 'run_advanced_optimization.py'),
        path.resolve(__dirname, '../../../../agents/location_agent/run_advanced_optimization.py')
      ];
      
      let scriptPath = possiblePaths[0];
      const fs = require('fs');
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }
      
      console.log('Using advanced Python script path:', scriptPath);
      
      const pythonProcess = spawn(pythonPath, [
        scriptPath,
        '--domain', domain,
        '--budget', budget.toString(),
        '--max-locations', maxLocations.toString(),
        '--min-distance', minDistanceBetweenBanks.toString(),
        '--strategy', strategy,
        '--population-weight', populationWeight.toString(),
        '--poverty-weight', povertyWeight.toString(),
        '--snap-weight', snapWeight.toString(),
        '--vehicle-access-weight', vehicleAccessWeight.toString(),
        '--geographic-weight', geographicWeight.toString()
      ]);

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.error('Python error:', data.toString());
      });

      pythonProcess.on('close', (code) => {
        const job = optimizationJobs.get(jobId);
        if (!job) return;

        if (code === 0) {
          try {
            const result = JSON.parse(outputData);
            job.status = 'completed';
            job.result = result;
          } catch (parseError) {
            job.status = 'failed';
            job.error = 'Failed to parse optimization results';
            console.error('Parse error:', parseError);
            console.error('Output data:', outputData);
          }
        } else {
          job.status = 'failed';
          job.error = errorData || 'Optimization process failed';
        }
      });

      // Return job ID immediately
      return res.status(202).json({
        status: 'in_progress',
        jobId
      });

    } catch (error) {
      console.error('Advanced optimization error:', error);
      return res.status(500).json({
        status: 'error',
        error: 'Internal server error'
      });
    }
  } 
  
  else if (req.method === 'GET') {
    // Check job status
    const { jobId } = req.query;
    
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        status: 'error',
        error: 'Job ID is required'
      });
    }

    const job = optimizationJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found'
      });
    }

    if (job.status === 'in_progress') {
      return res.status(200).json({
        status: 'in_progress',
        jobId
      });
    }

    if (job.status === 'failed') {
      return res.status(200).json({
        status: 'error',
        error: job.error || 'Optimization failed'
      });
    }

    // Job completed
    return res.status(200).json({
      status: 'success',
      data: job.result
    });
  }
  
  else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 