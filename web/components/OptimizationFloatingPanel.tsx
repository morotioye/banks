import React, { useState } from 'react';
import { MapPin, DollarSign, Users, TrendingUp, X, ChevronLeft, ChevronRight, Bot, CheckCircle, Clock, AlertCircle } from 'lucide-react';

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
}

interface AgentStep {
  agent: string;
  step: string;
  status: 'starting' | 'in_progress' | 'completed' | 'error';
  message: string;
  input?: any;
  output?: any;
  timestamp: Date;
}

interface OptimizationFloatingPanelProps {
  result: OptimizationResult | null;
  isOptimizing: boolean;
  onClose: () => void;
  budget: number;
  agentSteps?: AgentStep[];
}

export default function OptimizationFloatingPanel({ 
  result, 
  isOptimizing, 
  onClose,
  budget,
  agentSteps = []
}: OptimizationFloatingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAgentDetails, setShowAgentDetails] = useState<number | null>(null);

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
            height: '100%',
            gap: '16px'
          }}>
            {/* Agent Progress Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={18} style={{ color: '#3b82f6' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: 0
                }}>
                  AI Agents Working
                </h3>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '2px 0 0 0'
                }}>
                  Optimizing food bank locations...
                </p>
              </div>
            </div>

            {/* Agent Steps */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {agentSteps.map((step, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setShowAgentDetails(showAgentDetails === index ? null : index)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    {/* Status Icon */}
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 
                        step.status === 'completed' ? '#d1fae5' :
                        step.status === 'error' ? '#fee2e2' :
                        step.status === 'in_progress' ? '#dbeafe' :
                        '#f3f4f6'
                    }}>
                      {step.status === 'completed' ? (
                        <CheckCircle size={14} style={{ color: '#059669' }} />
                      ) : step.status === 'error' ? (
                        <AlertCircle size={14} style={{ color: '#dc2626' }} />
                      ) : step.status === 'in_progress' ? (
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          border: '2px solid #3b82f6',
                          borderTopColor: 'transparent',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : (
                        <Clock size={14} style={{ color: '#6b7280' }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '2px'
                      }}>
                        {step.agent}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        lineHeight: '1.4'
                      }}>
                        {step.message}
                      </div>

                      {/* Expandable Details */}
                      {showAgentDetails === index && (
                        <div style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          {step.input && (
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '4px'
                              }}>
                                Input:
                              </div>
                              <pre style={{
                                fontSize: '11px',
                                color: '#6b7280',
                                backgroundColor: '#f3f4f6',
                                padding: '8px',
                                borderRadius: '4px',
                                overflow: 'auto',
                                margin: 0,
                                fontFamily: 'monospace'
                              }}>
                                {JSON.stringify(step.input, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.output && (
                            <div>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '4px'
                              }}>
                                Output:
                              </div>
                              <pre style={{
                                fontSize: '11px',
                                color: '#6b7280',
                                backgroundColor: '#f3f4f6',
                                padding: '8px',
                                borderRadius: '4px',
                                overflow: 'auto',
                                margin: 0,
                                fontFamily: 'monospace'
                              }}>
                                {JSON.stringify(step.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator if no steps yet */}
              {agentSteps.length === 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '200px',
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
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>Initializing agents...</p>
                </div>
              )}
            </div>
          </div>
        ) : result?.data ? (
          <>
            {/* Warehouses Overview */}
            <div style={{
              backgroundColor: '#e0e7ff',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <p style={{ fontSize: '14px', color: '#1e40af', margin: '0 0 4px 0' }}>
                  Warehouses
                </p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#1e3a8a', margin: 0 }}>
                  {result.data.warehouses ? result.data.warehouses.length : 0}
                </p>
              </div>
              <span style={{ display: 'inline-block', width: 40, height: 40 }}>
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="20" width="36" height="18" rx="3" fill="#1E40AF" stroke="#1E3A8A" strokeWidth="2"/>
                  <rect x="14" y="28" width="8" height="10" rx="1.5" fill="#3B82F6"/>
                  <rect x="26" y="28" width="8" height="10" rx="1.5" fill="#3B82F6"/>
                  <polygon points="24,6 4,20 44,20" fill="#60A5FA" stroke="#1E3A8A" strokeWidth="2"/>
                  <rect x="20" y="34" width="8" height="4" rx="1" fill="#1E40AF"/>
                </svg>
              </span>
            </div>

            {/* Budget Overview */}
            <div style={{
              backgroundColor: '#ecf8ff',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <p style={{ fontSize: '14px', color: '#0369a1', margin: '0 0 4px 0' }}>
                Budget Utilization
              </p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#0284c7', margin: 0 }}>
                {formatCurrency(result.data.total_budget_used)} / {formatCurrency(budget)}
              </p>
              <p style={{ fontSize: '12px', color: '#0369a1', margin: '8px 0 0 0' }}>
                {((result.data.total_budget_used / budget) * 100).toFixed(1)}% utilized
              </p>
            </div>

            {/* Key Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {/* Food Banks Count */}
              <div style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#16a34a', margin: '0 0 4px 0' }}>
                    Food Banks
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#15803d', margin: 0 }}>
                    {result.data.locations.length}
                  </p>
                </div>
                <MapPin size={24} style={{ color: '#16a34a', opacity: 0.5 }} />
              </div>

              {/* People Served */}
              <div style={{
                backgroundColor: '#fef3c7',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <p style={{ fontSize: '12px', color: '#d97706', margin: '0 0 4px 0' }}>
                  Monthly Reach
                </p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#b45309', margin: 0 }}>
                  {formatNumber(result.data.total_people_served)}
                </p>
                <p style={{ fontSize: '11px', color: '#d97706', margin: '4px 0 0 0' }}>
                  people served per month
                </p>
              </div>

              {/* Coverage */}
              <div style={{
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Area Coverage</span>
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
                <p style={{ fontSize: '11px', color: '#6b7280', margin: '8px 0 0 0' }}>
                  of high-need areas covered
                </p>
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