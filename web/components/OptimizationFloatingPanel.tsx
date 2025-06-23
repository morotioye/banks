import React from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

// Dynamic import of the ADK panel to avoid SSR issues
const OptimizationPanelADK = dynamic(() => import('./OptimizationPanelADK'), { ssr: false });

interface OptimizationResult {
  status: 'success' | 'error';
  locations: any[];
  warehouses?: any[];
  total_people_served: number;
  total_budget_used: number;
  coverage_percentage: number;
  optimization_metrics: Record<string, any>;
  timestamp: string;
}

interface OptimizationFloatingPanelProps {
  domain: string;
  budget: number;
  isVisible: boolean;
  onClose: () => void;
  onOptimizationComplete?: (result: OptimizationResult) => void;
}

export default function OptimizationFloatingPanel({
  domain,
  budget,
  isVisible,
  onClose,
  onOptimizationComplete
}: OptimizationFloatingPanelProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] bg-white shadow-2xl transform transition-transform">
        <div className="h-full flex flex-col">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* ADK Optimization Panel */}
          <div className="flex-1 overflow-hidden">
            <OptimizationPanelADK
              domain={domain}
              initialBudget={budget}
              onOptimizationComplete={(result) => {
                if (onOptimizationComplete) {
                  onOptimizationComplete(result);
                }
                // Don't auto-close to allow user to view results
              }}
              onBack={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 