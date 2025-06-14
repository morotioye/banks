import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

interface OptimizationRequest {
  domain: string;
  budget: number;
  maxLocations?: number;
  minDistanceBetweenBanks?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { domain, budget, minDistanceBetweenBanks = 0.3 } = req.body as OptimizationRequest;
    
    // Don't set an artificial limit - let the algorithm maximize impact
    // Only use maxLocations if explicitly provided, otherwise set a high limit
    const maxLocations = req.body.maxLocations || 1000;

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

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Run Python optimization script with streaming support
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const possiblePaths = [
      path.join(process.cwd(), '..', 'agents', 'location_agent', 'run_optimization_stream.py'),
      path.join(process.cwd(), 'agents', 'location_agent', 'run_optimization_stream.py'),
      path.resolve(__dirname, '../../../../agents/location_agent/run_optimization_stream.py')
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
    ], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let lastAgentStep: any = null;
    let minStepDuration = 500; // Reduced from 2000ms to 500ms

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const message = JSON.parse(line as string);
          
          if (message.type === 'agent_step') {
            // Store the step and send it after minimum duration
            lastAgentStep = message;
            
            setTimeout(() => {
              res.write(`data: ${JSON.stringify(message)}\n\n`);
            }, minStepDuration);
          } else {
            // Send other messages immediately
            res.write(`data: ${JSON.stringify(message)}\n\n`);
          }
        } catch (e) {
          // If not JSON, it might be a log message
          console.log('Python output:', line);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python error:', data.toString());
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: data.toString() 
      })}\n\n`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: 'Optimization process failed' 
        })}\n\n`);
      }
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      pythonProcess.kill();
    });

  } catch (error) {
    console.error('Optimization error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: 'Internal server error' 
    })}\n\n`);
    res.end();
  }
} 