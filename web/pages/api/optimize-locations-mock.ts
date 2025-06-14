import { NextApiRequest, NextApiResponse } from 'next';

// Mock optimization for testing
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { domain, budget } = req.body;
    
    // Simulate processing delay
    setTimeout(() => {
      // Return mock optimization result
      const mockResult = {
        status: 'success',
        data: {
          locations: [
            {
              geoid: 'mock_001',
              lat: 34.0522,
              lon: -118.2437,
              expected_impact: 1500,
              coverage_radius: 1.5,
              efficiency_score: 0.92,
              setup_cost: 75000,
              operational_cost_monthly: 8000
            },
            {
              geoid: 'mock_002',
              lat: 34.0622,
              lon: -118.2537,
              expected_impact: 1200,
              coverage_radius: 1.5,
              efficiency_score: 0.88,
              setup_cost: 65000,
              operational_cost_monthly: 7000
            },
            {
              geoid: 'mock_003',
              lat: 34.0422,
              lon: -118.2337,
              expected_impact: 1000,
              coverage_radius: 1.5,
              efficiency_score: 0.85,
              setup_cost: 60000,
              operational_cost_monthly: 6500
            }
          ],
          total_people_served: 3700,
          total_budget_used: 200000,
          coverage_percentage: 65.5,
          optimization_metrics: {
            efficiency_score: 0.88,
            iterations: 150,
            convergence_time: 2.3,
            validation_adjustments: 1
          },
          timestamp: new Date().toISOString()
        }
      };
      
      // This would normally be handled by the job tracking system
      console.log('Mock optimization result:', mockResult);
    }, 3000);
    
    // Return job ID immediately
    return res.status(202).json({
      status: 'in_progress',
      jobId: 'mock_job_' + Date.now()
    });
  }
  
  else if (req.method === 'GET') {
    const { jobId } = req.query;
    
    // For mock, always return success after a delay
    return res.status(200).json({
      status: 'success',
      data: {
        locations: [
          {
            geoid: 'mock_001',
            lat: 34.0522,
            lon: -118.2437,
            expected_impact: 1500,
            coverage_radius: 1.5,
            efficiency_score: 0.92,
            setup_cost: 75000,
            operational_cost_monthly: 8000
          },
          {
            geoid: 'mock_002',
            lat: 34.0622,
            lon: -118.2537,
            expected_impact: 1200,
            coverage_radius: 1.5,
            efficiency_score: 0.88,
            setup_cost: 65000,
            operational_cost_monthly: 7000
          },
          {
            geoid: 'mock_003',
            lat: 34.0422,
            lon: -118.2337,
            expected_impact: 1000,
            coverage_radius: 1.5,
            efficiency_score: 0.85,
            setup_cost: 60000,
            operational_cost_monthly: 6500
          }
        ],
        total_people_served: 3700,
        total_budget_used: 200000,
        coverage_percentage: 65.5,
        optimization_metrics: {
          efficiency_score: 0.88,
          iterations: 150,
          convergence_time: 2.3,
          validation_adjustments: 1
        },
        timestamp: new Date().toISOString()
      }
    });
  }
  
  else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 