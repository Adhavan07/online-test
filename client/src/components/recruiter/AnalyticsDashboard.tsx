import React, { useEffect, useState } from 'react';
import { 
  BarChart3, TrendingUp, Users, CheckCircle2, AlertTriangle, 
  Clock, ShieldAlert, Award, ArrowUpRight, RefreshCw, Layers, PieChart
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
      <div className="flex items-center justify-center min-h-[400px] bg-slate-900/60 rounded-2xl border border-slate-800 p-8">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-400">Aggregating Hiring Funnel & Skill Analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-400">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p className="font-semibold">{error || 'Unable to display analytics'}</p>
        <button 
          onClick={fetchAnalytics}
          className="mt-3 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-white text-xs font-semibold rounded-lg border border-red-500/30"
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

  // Funnel steps
  const funnelStages = [
    { label: 'Applications', count: metrics.totalApplications, pct: 100, color: 'bg-blue-500' },
    { label: 'Invited / Dispatched', count: metrics.invitedCount, pct: metrics.totalApplications ? Math.round((metrics.invitedCount / metrics.totalApplications) * 100) : 0, color: 'bg-cyan-500' },
    { label: 'Completed Test', count: metrics.completedCount, pct: metrics.totalApplications ? Math.round((metrics.completedCount / metrics.totalApplications) * 100) : 0, color: 'bg-indigo-500' },
    { label: 'Passed Cutoff', count: metrics.passedCount, pct: metrics.completedCount ? Math.round((metrics.passedCount / metrics.completedCount) * 100) : 0, color: 'bg-emerald-500' },
    { label: 'Shortlisted / HR', count: metrics.hrStageCount, pct: metrics.passedCount ? Math.round((metrics.hrStageCount / metrics.passedCount) * 100) : 0, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <span>Executive Hiring Intelligence Dashboard</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Real-time candidate funnel efficiency, skill mastery radar & proctoring integrity metrics</p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Completion Rate</span>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{completionRate}%</div>
          <p className="text-[11px] text-slate-400 mt-1">{metrics.completedCount} of {metrics.totalApplications} completed</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500/30">
            <div className="h-full bg-cyan-500" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Technical Pass Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{metrics.passRate}%</div>
          <p className="text-[11px] text-slate-400 mt-1">{metrics.passedCount} candidates qualified</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/30">
            <div className="h-full bg-emerald-500" style={{ width: `${metrics.passRate}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Test Duration</span>
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{metrics.avgDurationMinutes} <span className="text-sm font-normal text-slate-400">min</span></div>
          <p className="text-[11px] text-slate-400 mt-1">Completion speed per candidate</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500/30">
            <div className="h-full bg-indigo-500" style={{ width: '60%' }} />
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Trust Score</span>
            <Award className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-400 mt-2">{metrics.proctoring.avgIntegrityScore}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Anti-cheat security rating</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500/30">
            <div className="h-full bg-purple-500" style={{ width: `${metrics.proctoring.avgIntegrityScore}%` }} />
          </div>
        </div>
      </div>

      {/* Hiring Funnel & Proctoring Security Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Hiring Funnel (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-base flex items-center space-x-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Hiring Conversion Funnel</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Stage Efficiency</span>
          </div>

          <div className="space-y-4">
            {funnelStages.map((stage, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-slate-300 font-semibold">{stage.label}</span>
                  <span className="text-slate-400 font-mono">
                    <strong className="text-white">{stage.count}</strong> ({stage.pct}%)
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
                    style={{ width: `${Math.max(stage.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Proctoring & Integrity Audit Box (1 Col) */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-base flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 text-purple-400" />
              <span>Proctoring Security Summary</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">Aggregated candidate integrity flags across all active assessment sessions.</p>
          </div>

          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Total Tab Switches Recorded:</span>
              <span className="font-bold text-amber-400 font-mono">{metrics.proctoring.totalTabSwitches}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-slate-800/60 pt-2.5">
              <span className="text-slate-400">Fullscreen Exits Intercepted:</span>
              <span className="font-bold text-red-400 font-mono">{metrics.proctoring.totalFullscreenExits}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-slate-800/60 pt-2.5">
              <span className="text-slate-400">Average Platform Trust Score:</span>
              <span className="font-bold text-purple-400 font-mono">{metrics.proctoring.avgIntegrityScore}%</span>
            </div>
          </div>

          <div className="p-3.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-[11px] text-purple-300 leading-relaxed">
            💡 Candidate submissions with an integrity trust score below 75% are automatically flagged with high risk warnings in the Candidate Detail Audit drawer.
          </div>
        </div>

      </div>

      {/* Skill Mastery Breakdown & Active Jobs Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Skill Mastery Radar / Bar Charts */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center space-x-2">
            <PieChart className="h-4 w-4 text-indigo-400" />
            <span>Aggregate Candidate Skill Proficiency</span>
          </h3>

          {metrics.skillAverages.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">No skill breakdown data recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {metrics.skillAverages.map((sk, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-200">{sk.skill}</span>
                    <span className="text-indigo-400 font-mono">{sk.percentage}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${sk.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Job Openings Health & Pass Rates */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center space-x-2">
            <Award className="h-4 w-4 text-emerald-400" />
            <span>Active Job Openings Health</span>
          </h3>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {jobs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No active job openings created yet.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-white">{job.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{job.location} • Cutoff {job.passThreshold}%</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-blue-400 font-mono">{job.stats?.totalApps || 0} Candidates</div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-semibold border border-emerald-500/20">
                      {job.stats?.passedApps || 0} Passed
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
