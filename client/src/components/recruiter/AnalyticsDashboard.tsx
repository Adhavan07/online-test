import React, { useEffect, useState } from 'react';
import { 
  BarChart3, TrendingUp, CheckCircle2, AlertTriangle, 
  Clock, ShieldAlert, Award, RefreshCw, Layers
} from 'lucide-react';

interface AnalyticsData {
  metrics: {
    totalApplications: number;
    invitedCount: number;
    completedCount: number;
    passedCount: number;
    hrStageCount: number;
    passRate: number;
    avgDurationMinutes: number;
    proctoring: {
      totalTabSwitches: number;
      totalFullscreenExits: number;
      avgIntegrityScore: number;
    };
    skillAverages: { skill: string; percentage: number }[];
  };
}

interface AnalyticsDashboardProps {
  jobs?: any[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ jobs = [] }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/funnel');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to load analytics');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to analytics endpoint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-white rounded border border-zinc-200 p-8 select-none">
        <div className="text-center space-y-2">
          <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-500">Aggregating hiring funnel & proctoring analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-6 text-center text-red-800 text-xs font-medium select-none">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600" />
        <p>{error || 'Unable to display analytics'}</p>
        <button 
          onClick={fetchAnalytics}
          className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const { metrics } = data;
  const completionRate = metrics.totalApplications > 0 
    ? Math.round((metrics.completedCount / metrics.totalApplications) * 100) 
    : 0;

  const funnelStages = [
    { label: 'Applications Received', count: metrics.totalApplications, pct: 100 },
    { label: 'Invited / Dispatched', count: metrics.invitedCount, pct: metrics.totalApplications ? Math.round((metrics.invitedCount / metrics.totalApplications) * 100) : 0 },
    { label: 'Completed Test', count: metrics.completedCount, pct: metrics.totalApplications ? Math.round((metrics.completedCount / metrics.totalApplications) * 100) : 0 },
    { label: 'Passed Cutoff', count: metrics.passedCount, pct: metrics.completedCount ? Math.round((metrics.passedCount / metrics.completedCount) * 100) : 0 },
    { label: 'Shortlisted / HR Stage', count: metrics.hrStageCount, pct: metrics.passedCount ? Math.round((metrics.hrStageCount / metrics.passedCount) * 100) : 0 },
  ];

  return (
    <div className="space-y-6 select-none">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-0.5">
            Insights &bull; Executive Analytics
          </div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            Hiring Funnel & Skill Analytics
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Real-time candidate conversion efficiency, skill distribution & integrity ratings.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium px-3 py-1.5 rounded border border-zinc-200 transition"
        >
          <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded border border-zinc-200 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
        <div className="px-3 py-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Completion Rate</div>
          <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{completionRate}%</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{metrics.completedCount} of {metrics.totalApplications} completed</div>
        </div>

        <div className="px-3 py-1 pt-3 lg:pt-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Pass Rate</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{metrics.passRate}%</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{metrics.passedCount} candidates qualified</div>
        </div>

        <div className="px-3 py-1 pt-3 lg:pt-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Avg Test Duration</div>
          <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{metrics.avgDurationMinutes} min</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Completion speed</div>
        </div>

        <div className="px-3 py-1 pt-3 lg:pt-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Avg Integrity Rating</div>
          <div className="text-2xl font-bold text-blue-700 mt-1 font-mono">{metrics.proctoring.avgIntegrityScore}%</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Anti-cheat trust rating</div>
        </div>
      </div>

      {/* Funnel & Proctoring Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Conversion Funnel */}
        <div className="lg:col-span-2 bg-white p-5 rounded border border-zinc-200 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
            <h3 className="font-bold text-zinc-900 text-sm">Hiring Conversion Funnel</h3>
            <span className="text-xs font-mono text-zinc-500">Stage Conversion</span>
          </div>

          <div className="space-y-3 pt-1">
            {funnelStages.map((stage, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-zinc-800">{stage.label}</span>
                  <span className="font-mono text-zinc-600">
                    <strong className="text-zinc-900">{stage.count}</strong> ({stage.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-zinc-100 rounded overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.max(stage.pct, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Proctoring Summary */}
        <div className="bg-white p-5 rounded border border-zinc-200 space-y-4 flex flex-col justify-between">
          <div>
            <div className="pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-sm">Proctoring Security Summary</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Anti-cheat flags across active assessment sessions.</p>
            </div>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-600">Tab Switches Intercepted:</span>
                <span className="font-mono font-bold text-zinc-900">{metrics.proctoring.totalTabSwitches}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100 pt-2.5">
                <span className="text-zinc-600">Fullscreen Exits Intercepted:</span>
                <span className="font-mono font-bold text-zinc-900">{metrics.proctoring.totalFullscreenExits}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100 pt-2.5">
                <span className="text-zinc-600">Avg Integrity Trust Rating:</span>
                <span className="font-mono font-bold text-blue-700">{metrics.proctoring.avgIntegrityScore}%</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded border border-zinc-200 text-[11px] text-zinc-600 leading-relaxed font-mono">
            Candidate submissions with integrity trust score &lt; 75% are automatically flagged for manual recruiter review.
          </div>
        </div>

      </div>

      {/* Skill Breakdown */}
      <div className="bg-white p-5 rounded border border-zinc-200 space-y-4">
        <h3 className="font-bold text-zinc-900 text-sm pb-2 border-b border-zinc-100">
          Aggregate Candidate Skill Mastery
        </h3>

        {metrics.skillAverages.length === 0 ? (
          <p className="text-xs text-zinc-500 font-mono py-4 text-center">No skill breakdown data recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {metrics.skillAverages.map((sk, idx) => (
              <div key={idx} className="p-3 bg-zinc-50 rounded border border-zinc-200 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-900">{sk.skill}</span>
                  <span className="font-mono text-blue-700">{sk.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 rounded overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${sk.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
