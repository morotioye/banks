import React, { useState, useEffect, useRef } from 'react';
import { MapPin, DollarSign, Users, TrendingUp, Loader2, Play, Bot, Brain, Warehouse } from 'lucide-react';

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

interface WarehouseLocation {
  geoid: string;
  lat: number;
  lon: number;
  capacity: number;
  distribution_radius: number;
  efficiency_score: number;
  setup_cost: number;
  operational_cost_monthly: number;
  food_banks_served: string[];
}

interface AgentMessage {
  type: 'text' | 'function_call' | 'function_result' | 'error';
  content: string;
  timestamp: Date;
  details?: any;
}

interface OptimizationResult {
  status: 'success' | 'error';
  locations: OptimizationLocation[];
  warehouses: WarehouseLocation[];
  total_people_served: number;
  total_budget_used: number;
  coverage_percentage: number;
  optimization_metrics: Record<string, any>;
  timestamp: string;
}

interface OptimizationPanelADKProps {
  domain: string;
  initialBudget?: number;
  onOptimizationComplete?: (result: OptimizationResult) => void;
  onBack?: () => void;
}

export default function OptimizationPanelADK({ 
  domain, 
  initialBudget, 
  onOptimizationComplete, 
  onBack 
}: OptimizationPanelADKProps) {
  const [budget, setBudget] = useState<string>(initialBudget ? initialBudget.toString() : '1000000');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  // Auto-start optimization if initial budget is provided
  useEffect(() => {
    if (initialBudget && initialBudget >= 1000000) {
      handleOptimize();
    }
  }, []); // Only run on mount

  const handleOptimize = async () => {
    const budgetNum = parseFloat(budget);
    
    if (isNaN(budgetNum) || budgetNum < 100000) {
      setError('Please enter a valid budget (minimum $100,000)');
      return;
    }

    console.log('🚀 Starting optimization with:', { domain, budget: budgetNum });

    setIsOptimizing(true);
    setError(null);
    setResult(null);
    setAgentMessages([]);
    setCurrentPhase('Initializing optimization...');

    try {
      // Close any existing event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Create EventSource for streaming
      const url = `/api/optimize-locations-stream?domain=${encodeURIComponent(domain)}&budget=${budgetNum}`;
      console.log('📡 Creating EventSource:', url);
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ EventSource connected');
      };

      eventSource.onmessage = (event) => {
        console.log('📨 Received message:', event.data);
        
        try {
          const data = JSON.parse(event.data);
          console.log('📊 Parsed data:', data);
          
          if (data.type === 'agent_message') {
            const message: AgentMessage = {
              type: 'text',
              content: data.message,
              timestamp: new Date(),
            };
            setAgentMessages(prev => [...prev, message]);
          } else if (data.type === 'function_call') {
            const message: AgentMessage = {
              type: 'function_call',
              content: `Calling function: ${data.function_name}`,
              timestamp: new Date(),
              details: data.args,
            };
            setAgentMessages(prev => [...prev, message]);
            setCurrentPhase(`Executing: ${data.function_name}`);
          } else if (data.type === 'function_result') {
            const message: AgentMessage = {
              type: 'function_result',
              content: `Function ${data.function_name} completed`,
              timestamp: new Date(),
              details: data.result,
            };
            setAgentMessages(prev => [...prev, message]);
          } else if (data.type === 'phase') {
            setCurrentPhase(data.phase);
          } else if (data.type === 'result') {
            console.log('🎯 Received final result:', data.result);
            setResult(data.result);
            setIsOptimizing(false);
            eventSource.close();
            if (onOptimizationComplete) {
              onOptimizationComplete(data.result);
            }
          } else if (data.type === 'error') {
            console.error('❌ Received error:', data.error);
            setError(data.error);
            setIsOptimizing(false);
            eventSource.close();
          }
        } catch (err) {
          console.error('❌ Error parsing SSE data:', err);
          console.error('Raw data was:', event.data);
        }
      };

      eventSource.onerror = (err) => {
        console.error('❌ SSE error:', err);
        
        // Check if the connection was closed normally
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('📡 EventSource closed');
        } else {
          console.error('📡 EventSource error, readyState:', eventSource.readyState);
          setError('Connection lost. Please try again.');
          setIsOptimizing(false);
        }
      };

    } catch (err) {
      console.error('❌ Error starting optimization:', err);
      setError('Failed to start optimization');
      setIsOptimizing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('🧹 Cleaning up EventSource');
        eventSourceRef.current.close();
      }
    };
  }, []);

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

  const getMessageIcon = (type: AgentMessage['type']) => {
    switch (type) {
      case 'function_call':
        return <Brain className="w-4 h-4 text-blue-500" />;
      case 'function_result':
        return <Bot className="w-4 h-4 text-green-500" />;
      case 'error':
        return <Bot className="w-4 h-4 text-red-500" />;
      default:
        return <Bot className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">AI-Powered Food Bank Optimization</h2>
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
      <div className="mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Optimization Budget</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(parseFloat(budget))}
              </p>
              <p className="text-xs text-gray-500 mt-1">Domain: {domain}</p>
            </div>
            {!isOptimizing && !result && (
              <button
                onClick={handleOptimize}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md font-medium hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg"
              >
                <Play className="w-5 h-5" />
                Start AI Optimization
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Agent Output Section */}
      {(isOptimizing || agentMessages.length > 0) && !result && (
        <div className="mb-6 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-500" />
              AI Agent Working
            </h3>
            {currentPhase && (
              <span className="text-sm text-gray-600 italic">{currentPhase}</span>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 flex-1 overflow-y-auto">
            <div className="space-y-3">
              {agentMessages.map((message, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getMessageIcon(message.type)}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${
                      message.type === 'error' ? 'text-red-600' : 
                      message.type === 'function_call' ? 'text-blue-600 font-medium' :
                      message.type === 'function_result' ? 'text-green-600' :
                      'text-gray-700'
                    }`}>
                      {message.content}
                    </p>
                    {message.details && message.type === 'function_call' && (
                      <div className="mt-1 text-xs text-gray-500">
                        Parameters: {JSON.stringify(message.details, null, 2).substring(0, 100)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isOptimizing && (
                <div className="flex gap-3">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin mt-1" />
                  <p className="text-sm text-gray-600 italic">Processing...</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Food Banks</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {result.locations.length}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Warehouses</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {result.warehouses?.length || 0}
                  </p>
                </div>
                <Warehouse className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">People Served</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatNumber(result.total_people_served)}
                  </p>
                </div>
                <Users className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Budget Used</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {formatCurrency(result.total_budget_used)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Coverage</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {result.coverage_percentage.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
          </div>

          {/* Optimization Metrics */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              AI Optimization Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white rounded p-3">
                <span className="text-gray-600 block">Efficiency Score</span>
                <span className="text-xl font-bold text-green-600">
                  {((result.optimization_metrics?.efficiency_score || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="bg-white rounded p-3">
                <span className="text-gray-600 block">Warehouse Efficiency</span>
                <span className="text-xl font-bold text-purple-600">
                  {((result.optimization_metrics?.warehouse_efficiency || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="bg-white rounded p-3">
                <span className="text-gray-600 block">Processing Time</span>
                <span className="text-xl font-bold text-blue-600">
                  {result.optimization_metrics?.convergence_time?.toFixed(1) || '0'}s
                </span>
              </div>
              <div className="bg-white rounded p-3">
                <span className="text-gray-600 block">Iterations</span>
                <span className="text-xl font-bold text-amber-600">
                  {result.optimization_metrics?.iterations || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Locations Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Food Banks Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                Optimized Food Bank Locations
              </h3>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Impact
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Efficiency
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.locations.slice(0, 10).map((location, index) => (
                      <tr key={location.geoid} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {location.geoid.substring(0, 10)}...
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {formatNumber(location.expected_impact)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${location.efficiency_score * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {formatCurrency(location.setup_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Warehouses Table */}
            {result.warehouses && result.warehouses.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-purple-500" />
                  Optimized Warehouse Locations
                </h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          ID
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Capacity
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Coverage
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.warehouses.map((warehouse, index) => (
                        <tr key={warehouse.geoid} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {warehouse.geoid}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {formatNumber(warehouse.capacity)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {warehouse.distribution_radius} mi
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {formatCurrency(warehouse.setup_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Agent Messages Summary */}
          {agentMessages.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2 text-blue-800">AI Agent Summary</h3>
              <p className="text-xs text-blue-700">
                Completed {agentMessages.filter(m => m.type === 'function_call').length} function calls
                in {((result.optimization_metrics?.convergence_time || 0)).toFixed(1)} seconds
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 