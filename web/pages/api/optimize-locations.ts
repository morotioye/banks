import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

interface OptimizationRequest {
  domain: string;
  budget: number;
  maxLocations?: number;
  minDistanceBetweenBanks?: number;
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
      const { domain, budget, maxLocations = 10, minDistanceBetweenBanks = 0.5 } = req.body as OptimizationRequest;

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

      // Generate job ID
      const jobId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize job tracking
      optimizationJobs.set(jobId, { status: 'in_progress' });

      // Run Python optimization script
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      // Handle both development and production paths
      const possiblePaths = [
        path.join(process.cwd(), '..', 'agents', 'location_agent', 'run_optimization.py'),
        path.join(process.cwd(), 'agents', 'location_agent', 'run_optimization.py'),
        path.resolve(__dirname, '../../../../agents/location_agent/run_optimization.py')
      ];
      
      let scriptPath = possiblePaths[0];
      const fs = require('fs');
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }
      
      console.log('Using Python script path:', scriptPath);
      
      const pythonProcess = spawn(pythonPath, [
        scriptPath,
        '--domain', domain,
        '--budget', budget.toString(),
        '--max-locations', maxLocations.toString(),
        '--min-distance', minDistanceBetweenBanks.toString()
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
      console.error('Optimization error:', error);
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