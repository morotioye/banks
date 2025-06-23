import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, budget, maxLocations = 1000, useApp = false } = req.body;

  if (!domain || !budget) {
    return res.status(400).json({ error: 'Domain and budget are required' });
  }

  try {
    // Path to the ADK Python script
    const scriptPath = path.join(process.cwd(), '..', 'agents', 'location_agent', 'run_adk_optimization.py');
    
    // Arguments for the Python script
    const args = [
      scriptPath,
      '--domain', domain,
      '--budget', budget.toString(),
      '--max-locations', maxLocations.toString()
    ];

    if (useApp) {
      args.push('--use-app');
    }

    // Spawn Python process
    const pythonProcess = spawn('python3', args);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process exited with code:', code);
        console.error('Error output:', errorData);
        return res.status(500).json({ 
          error: 'Optimization failed',
          details: errorData,
          code: code 
        });
      }

      try {
        const result = JSON.parse(outputData);
        
        // Transform the result to match the expected format
        if (result.status === 'success') {
          // If using AdkApp, parse the messages to extract results
          if (useApp && result.messages) {
            // Extract optimization results from agent messages
            const optimizationResult = {
              status: 'success',
              locations: [],
              warehouses: [],
              total_people_served: 0,
              total_budget_used: 0,
              coverage_percentage: 0,
              optimization_metrics: {
                messages: result.messages
              },
              timestamp: new Date().toISOString()
            };
            
            // Try to extract structured data from results if available
            if (result.results) {
              if (result.results.locations) {
                optimizationResult.locations = result.results.locations;
              }
              if (result.results.warehouses) {
                optimizationResult.warehouses = result.results.warehouses;
              }
              if (result.results.total_impact) {
                optimizationResult.total_people_served = result.results.total_impact;
              }
              if (result.results.budget_used) {
                optimizationResult.total_budget_used = result.results.budget_used;
              }
            }
            
            return res.status(200).json(optimizationResult);
          } else {
            // Direct agent call result
            return res.status(200).json(result);
          }
        } else {
          return res.status(500).json(result);
        }
      } catch (parseError) {
        console.error('Failed to parse Python output:', outputData);
        return res.status(500).json({ 
          error: 'Failed to parse optimization results',
          details: outputData 
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      return res.status(500).json({ 
        error: 'Failed to start optimization process',
        details: error.message 
      });
    });

  } catch (error) {
    console.error('Optimization error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 