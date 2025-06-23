import React, { useState, useEffect } from 'react';
import { MapPin, DollarSign, Users, TrendingUp, Loader2, Play } from 'lucide-react';

interface OptimizationLocation {
  geoid: string;
  lat: number;
  lon: number;
  expected_impact: number;
  coverage_radius: number;
  efficiency_score: number;
  setup_cost: number;
  operational_cost_monthly: number;
}

interface OptimizationResult {
  status: 'success' | 'error' | 'in_progress';
  data?: {
    locations: OptimizationLocation[];
    total_people_served: number;
    total_budget_used: number;
    coverage_percentage: number;
    optimization_metrics: Record<string, any>;
    timestamp: string;
    warehouses?: OptimizationLocation[];
  };
  error?: string;
  jobId?: string;
}

interface OptimizationPanelProps {
  domain: string;
  initialBudget?: number;
  onOptimizationComplete?: (result: OptimizationResult) => void;
  onBack?: () => void;
}

export default function OptimizationPanel({ domain, initialBudget, onOptimizationComplete, onBack }: OptimizationPanelProps) {
  const [budget, setBudget] = useState<string>(initialBudget ? initialBudget.toString() : '500000');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Auto-start optimization if initial budget is provided
  useEffect(() => {
    if (initialBudget && initialBudget >= 1000000) {
      handleOptimize();
    }
  }, []); // Only run on mount

  // Poll for job status
  useEffect(() => {
    if (!jobId || !isOptimizing) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/optimize-locations?jobId=${jobId}`);
        const data: OptimizationResult = await response.json();

        if (data.status === 'success') {
          setResult(data);
          setIsOptimizing(false);
          setJobId(null);
          if (onOptimizationComplete) {
            onOptimizationComplete(data);
          }
        } else if (data.status === 'error') {
          setError(data.error || 'Optimization failed');
          setIsOptimizing(false);
          setJobId(null);
        } else {
          // Still in progress - update progress bar
          setProgress((prev) => Math.min(prev + 10, 90));
        }
      } catch (err) {
        console.error('Error polling job status:', err);
        setError('Failed to check optimization status');
        setIsOptimizing(false);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, isOptimizing, onOptimizationComplete]);

  const handleOptimize = async () => {
    const budgetNum = parseFloat(budget);
    
    if (isNaN(budgetNum) || budgetNum < 1000000) {
      setError('Please enter a valid budget (minimum $1,000,000)');
      return;
    }

    setIsOptimizing(true);
    setError(null);
    setResult(null);
    setProgress(10);

    try {
      const response = await fetch('/api/optimize-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          budget: budgetNum,
        }),
      });

      const data: OptimizationResult = await response.json();

      if (data.status === 'in_progress' && data.jobId) {
        setJobId(data.jobId);
        setProgress(20);
      } else if (data.status === 'error') {
        setError(data.error || 'Optimization failed');
        setIsOptimizing(false);
      }
    } catch (err) {
      console.error('Error starting optimization:', err);
      setError('Failed to start optimization');
      setIsOptimizing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Food Bank Location Optimization</h2>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to Map
          </button>
        )}
      </div>
      
      {/* Budget Display and Start */}
      <div className="mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Optimization Budget</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(parseFloat(budget))}
              </p>
            </div>
            {!isOptimizing && !result && (
              <button
                onClick={handleOptimize}
                className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Optimization
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Progress Bar */}
      {isOptimizing && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Analyzing data and optimizing locations...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Section */}
      {result?.data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Warehouses Card */}
            <div className="bg-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Warehouses</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {result.data.warehouses ? result.data.warehouses.length : 0}
                  </p>
                </div>
                {/* Simple warehouse SVG icon */}
                <span className="inline-block w-8 h-8">
                  <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="20" width="36" height="18" rx="3" fill="#1E40AF" stroke="#1E3A8A" strokeWidth="2"/>
                    <rect x="14" y="28" width="8" height="10" rx="1.5" fill="#3B82F6"/>
                    <rect x="26" y="28" width="8" height="10" rx="1.5" fill="#3B82F6"/>
                    <polygon points="24,6 4,20 44,20" fill="#60A5FA" stroke="#1E3A8A" strokeWidth="2"/>
                    <rect x="20" y="34" width="8" height="4" rx="1" fill="#1E40AF"/>
                  </svg>
                </span>
              </div>
            </div>
            {/* Locations Card */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Locations</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {result.data.locations.length}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">People Served</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatNumber(result.data.total_people_served)}
                  </p>
                </div>
                <Users className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Budget Used</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(result.data.total_budget_used)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Coverage</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {result.data.coverage_percentage.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-400" />
              </div>
            </div>
          </div>

          {/* Locations Table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Optimized Food Bank Locations</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coordinates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expected Impact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Efficiency Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Setup Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.data.locations.map((location, index) => (
                    <tr key={location.geoid} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {location.geoid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatNumber(location.expected_impact)} people
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${location.efficiency_score * 100}%` }}
                            />
                          </div>
                          <span>{(location.efficiency_score * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(location.setup_cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(location.operational_cost_monthly)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optimization Metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Optimization Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Efficiency Score:</span>
                <span className="ml-2 font-medium">
                  {(result.data.optimization_metrics.efficiency_score * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">Iterations:</span>
                <span className="ml-2 font-medium">
                  {result.data.optimization_metrics.iterations}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Processing Time:</span>
                <span className="ml-2 font-medium">
                  {result.data.optimization_metrics.convergence_time?.toFixed(2)}s
                </span>
              </div>
              <div>
                <span className="text-gray-600">Validation Adjustments:</span>
                <span className="ml-2 font-medium">
                  {result.data.optimization_metrics.validation_adjustments}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 