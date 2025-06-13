import React, { useState } from 'react';
import { MapPin, DollarSign, Users, TrendingUp, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  };
  error?: string;
}

interface OptimizationFloatingPanelProps {
  result: OptimizationResult | null;
  isOptimizing: boolean;
  onClose: () => void;
  budget: number;
}

export default function OptimizationFloatingPanel({ 
  result, 
  isOptimizing, 
  onClose,
  budget 
}: OptimizationFloatingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
    <div
      style={{
        position: 'fixed',
        right: isCollapsed ? '-380px' : '24px',
        top: '24px',
        bottom: '24px',
        width: '420px',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'right 0.3s ease',
        zIndex: 1000,
        fontFamily: '"Funnel Display", system-ui, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #e8eaed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#2c3e50',
          margin: 0
        }}>
          Optimization Results
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Collapse/Expand Tab */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: 'absolute',
          left: '-40px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '40px',
          height: '80px',
          backgroundColor: 'white',
          border: 'none',
          borderRadius: '8px 0 0 8px',
          boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'white';
        }}
      >
        {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px'
      }}>
        {isOptimizing ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '3px solid #e5e7eb',
              borderTopColor: '#74b9ff',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>Optimizing locations...</p>
          </div>
        ) : result?.data ? (
          <>
            {/* Budget Overview */}
            <div style={{
              backgroundColor: '#ecf8ff',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <p style={{ fontSize: '14px', color: '#0369a1', margin: '0 0 4px 0' }}>
                Optimization Budget
              </p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#0284c7', margin: 0 }}>
                {formatCurrency(budget)}
              </p>
              <p style={{ fontSize: '12px', color: '#0369a1', margin: '8px 0 0 0' }}>
                {formatCurrency(result.data.total_budget_used)} utilized ({((result.data.total_budget_used / budget) * 100).toFixed(1)}%)
              </p>
            </div>

            {/* Summary Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <MapPin size={20} style={{ color: '#16a34a', marginBottom: '8px' }} />
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#15803d', margin: 0 }}>
                  {result.data.locations.length}
                </p>
                <p style={{ fontSize: '12px', color: '#16a34a', margin: '4px 0 0 0' }}>
                  Food Banks
                </p>
              </div>

              <div style={{
                backgroundColor: '#fef3c7',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <Users size={20} style={{ color: '#d97706', marginBottom: '8px' }} />
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#b45309', margin: 0 }}>
                  {formatNumber(result.data.total_people_served)}
                </p>
                <p style={{ fontSize: '12px', color: '#d97706', margin: '4px 0 0 0' }}>
                  People Served
                </p>
              </div>
            </div>

            {/* Coverage Metric */}
            <div style={{
              backgroundColor: '#f3f4f6',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Coverage</span>
                <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                  {result.data.coverage_percentage.toFixed(1)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${result.data.coverage_percentage}%`,
                  height: '100%',
                  backgroundColor: '#74b9ff',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>

            {/* Locations List */}
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                margin: '0 0 12px 0'
              }}>
                Optimized Locations
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.data.locations.map((location, index) => (
                  <div
                    key={location.geoid}
                    style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                          Location {index + 1}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                          {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: '#059669', margin: '0 0 2px 0' }}>
                          {formatNumber(location.expected_impact)}
                        </p>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                          people/month
                        </p>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb'
                    }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        Setup: {formatCurrency(location.setup_cost)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        Monthly: {formatCurrency(location.operational_cost_monthly)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimization Metrics */}
            <div style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#6b7280',
                margin: '0 0 12px 0'
              }}>
                Performance Metrics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Efficiency Score</span>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                    {(result.data.optimization_metrics.efficiency_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Processing Time</span>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                    {result.data.optimization_metrics.convergence_time?.toFixed(2)}s
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : result?.error ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <X size={24} style={{ color: '#dc2626' }} />
            </div>
            <p style={{ color: '#dc2626', fontSize: '16px' }}>{result.error}</p>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 