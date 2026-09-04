import React, { useEffect, useState } from 'react';
import { 
  Users, CheckCircle2, AlertCircle, Clock, Search, Filter, 
  Plus, UserPlus, FileText, Download, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { CreateJobModal } from './CreateJobModal';
import { InviteCandidateModal } from './InviteCandidateModal';
import { BulkInviteModal } from './BulkInviteModal';
import { CandidateDetailDrawer } from './CandidateDetailDrawer';
import { ResumeViewerModal } from '../common/ResumeViewerModal';
import { EmailPreviewModal } from '../common/EmailPreviewModal';

interface RecruiterDashboardProps {
  searchQuery?: string;
  initialFilter?: string;
  onNavigateView?: (view: string) => void;
}

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({
  searchQuery: externalSearchQuery = '',
  initialFilter = 'ALL',
  onNavigateView,
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>(externalSearchQuery);

  // Modals state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [inspectApplicationId, setInspectApplicationId] = useState<string | null>(null);

  // Resume Modal
  const [resumeData, setResumeData] = useState<{
    isOpen: boolean;
    name: string;
    email: string;
    fileName?: string | null;
    url?: string | null;
  }>({ isOpen: false, name: '', email: '' });

  // Email Preview Modal
  const [emailPreview, setEmailPreview] = useState<{
    isOpen: boolean;
    testUrl: string;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
  }>({ isOpen: false, testUrl: '', candidateName: '', candidateEmail: '', jobTitle: '' });

  useEffect(() => {
    setSearchQuery(externalSearchQuery);
  }, [externalSearchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, templatesRes, candRes] = await Promise.all([
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/templates').then(r => r.json()),
        fetch(`/api/candidates?jobId=${selectedJobId}&status=${statusFilter}&search=${searchQuery}`).then(r => r.json()),
      ]);

      if (jobsRes.success) setJobs(jobsRes.jobs);
      if (templatesRes.success) setTemplates(templatesRes.templates);
      if (candRes.success) setCandidates(candRes.candidates);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedJobId, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Metrics
  const totalApplicants = candidates.length;
  const invitedCount = candidates.filter(c => ['INVITED', 'STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'SHORTLISTED', 'HR_INTERVIEW'].includes(c.status)).length;
  const completedCount = candidates.filter(c => ['PASSED', 'FAILED', 'SHORTLISTED', 'HR_INTERVIEW', 'REJECTED'].includes(c.status)).length;
  const passedCount = candidates.filter(c => ['PASSED', 'SHORTLISTED', 'HR_INTERVIEW'].includes(c.status)).length;
  const hrCount = candidates.filter(c => c.status === 'HR_INTERVIEW' || c.status === 'SHORTLISTED').length;

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 select-none">
      
      {/* Editorial Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
            Hiring Overview &bull; {currentDateStr}
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Good evening, Recruiter
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            Automated first-round candidate screening and proctoring integrity pipeline.
          </p>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/api/candidates/export-csv"
            download
            className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold px-3 py-1.5 rounded border border-zinc-200 transition"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold px-3 py-1.5 rounded border border-zinc-200 transition"
          >
            <span>Bulk Invite</span>
          </button>

          <button
            onClick={() => setIsJobModalOpen(true)}
            className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold px-3 py-1.5 rounded border border-zinc-200 transition"
          >
            <Plus className="h-3.5 w-3.5 text-zinc-500" />
            <span>Create Job</span>
          </button>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded transition shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite Candidate</span>
          </button>
        </div>
      </div>

      {/* Metrics Breakdown (Typography-driven strip, no giant floating cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded border border-zinc-200 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
        <div className="px-3 py-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Total Applicants</div>
          <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{totalApplicants}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Active candidates</div>
        </div>

        <div className="px-3 py-1 pt-3 lg:pt-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Assessments Tested</div>
          <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{completedCount}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Evaluated post-timer</div>
        </div>

        <div className="px-3 py-1 pt-3 lg:pt-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Passed Technical</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{passedCount}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Score &ge; Pass threshold</div>
        </div>

        <div className="px-3 py-1 pt-3 lg:pt-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">HR Interview Pipeline</div>
          <div className="text-2xl font-bold text-blue-700 mt-1 font-mono">{hrCount}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Shortlisted for HR stage</div>
        </div>
      </div>

      {/* Hiring Pipeline Flow Strip */}
      <div className="bg-white p-4 rounded border border-zinc-200 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-zinc-500 font-semibold uppercase tracking-wider">
          <span>HIRING PIPELINE STAGES</span>
          {selectedJobId && (
            <button
              onClick={() => setSelectedJobId('')}
              className="text-[11px] text-blue-600 hover:underline capitalize"
            >
              Clear Job Filter
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <div className="flex-1 min-w-[120px] bg-zinc-50 p-2.5 rounded border border-zinc-200 flex justify-between items-center">
            <span className="font-semibold text-zinc-700">Applied</span>
            <span className="font-mono text-zinc-900 font-bold">{totalApplicants}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 hidden sm:block" />

          <div className="flex-1 min-w-[120px] bg-zinc-50 p-2.5 rounded border border-zinc-200 flex justify-between items-center">
            <span className="font-semibold text-zinc-700">Invited</span>
            <span className="font-mono text-zinc-900 font-bold">{invitedCount}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 hidden sm:block" />

          <div className="flex-1 min-w-[120px] bg-zinc-50 p-2.5 rounded border border-zinc-200 flex justify-between items-center">
            <span className="font-semibold text-zinc-700">Tested</span>
            <span className="font-mono text-zinc-900 font-bold">{completedCount}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 hidden sm:block" />

          <div className="flex-1 min-w-[120px] bg-emerald-50/50 p-2.5 rounded border border-emerald-200 flex justify-between items-center text-emerald-900">
            <span className="font-semibold">Passed</span>
            <span className="font-mono font-bold text-emerald-700">{passedCount}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 hidden sm:block" />

          <div className="flex-1 min-w-[120px] bg-blue-50/50 p-2.5 rounded border border-blue-200 flex justify-between items-center text-blue-900">
            <span className="font-semibold">HR Interview</span>
            <span className="font-mono font-bold text-blue-700">{hrCount}</span>
          </div>
        </div>
      </div>

      {/* Active Job Selector Strip */}
      {jobs.length > 0 && (
        <div className="bg-white p-3 rounded border border-zinc-200 space-y-2">
          <div className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider px-1">
            Active Openings ({jobs.length})
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedJobId('')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition shrink-0 ${
                selectedJobId === ''
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              All Openings
            </button>
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(selectedJobId === job.id ? '' : job.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition shrink-0 flex items-center space-x-2 ${
                  selectedJobId === job.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-zinc-100 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                <span>{job.title}</span>
                <span className="font-mono text-[10px] opacity-80">({job.stats?.totalApps || 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Candidate Data Table Container */}
      <div className="bg-white rounded border border-zinc-200 overflow-hidden">
        
        {/* Table Filter & Search Controls */}
        <div className="p-3 border-b border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter candidate name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-400"
            />
          </form>

          {/* Status Stage Filter */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="h-3.5 w-3.5 text-zinc-400 mr-1 shrink-0 hidden md:block" />
            {[
              { id: 'ALL', label: 'All Stages' },
              { id: 'PASSED', label: 'Passed' },
              { id: 'HR_INTERVIEW', label: 'HR Interview' },
              { id: 'FAILED', label: 'Failed' },
              { id: 'INVITED', label: 'Invited' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-zinc-900 text-white font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* Primary Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-800">
            <thead className="bg-zinc-50 font-mono text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Candidate</th>
                <th className="py-2.5 px-4 font-semibold">Role</th>
                <th className="py-2.5 px-4 font-semibold">Technical Score</th>
                <th className="py-2.5 px-4 font-semibold">Integrity Risk</th>
                <th className="py-2.5 px-4 font-semibold">Stage</th>
                <th className="py-2.5 px-4 font-semibold">Applied</th>
                <th className="py-2.5 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 font-mono text-xs">
                    Loading candidate applications...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                    No candidates found matching current filter.
                  </td>
                </tr>
              ) : (
                candidates.map((application) => {
                  const candidate = application.candidate || {};
                  const job = application.job || {};
                  const latestAttempt = application.attempts?.[0];
                  const result = latestAttempt?.result;

                  // Technical score formatting
                  const scoreText = result ? `${result.percentage}%` : application.status === 'INVITED' ? 'Pending' : 'N/A';
                  
                  // Proctoring risk formatting
                  const riskLevel = result?.proctoringRiskLevel || (latestAttempt?.proctorLogs?.length > 3 ? 'HIGH' : latestAttempt?.proctorLogs?.length > 0 ? 'MEDIUM' : 'LOW');
                  
                  return (
                    <tr
                      key={application.id}
                      onClick={() => setInspectApplicationId(application.id)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition"
                    >
                      {/* Candidate Name & Email */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">{candidate.name || 'Anonymous Candidate'}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">{candidate.email}</div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-800">{job.title || 'DevOps Engineer'}</div>
                        <div className="text-[10px] text-zinc-400">{job.location || 'Remote'}</div>
                      </td>

                      {/* Technical Score */}
                      <td className="py-3 px-4 font-mono font-medium">
                        {result ? (
                          <span className={result.percentage >= (job.passThreshold || 70) ? 'text-emerald-700 font-bold' : 'text-red-600'}>
                            {result.percentage}% ({result.score}/{result.totalPossible})
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">--</span>
                        )}
                      </td>

                      {/* Integrity Risk Indicator */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            riskLevel === 'HIGH' ? 'bg-red-500' :
                            riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <span className="font-mono text-[11px] font-medium text-zinc-700">
                            {riskLevel}
                          </span>
                        </div>
                      </td>

                      {/* Stage Tag */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${
                          application.status === 'PASSED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          application.status === 'HR_INTERVIEW' || application.status === 'SHORTLISTED' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          application.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                          application.status === 'REJECTED' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' :
                          'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}>
                          {application.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Applied Date */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                        {new Date(application.appliedAt).toLocaleDateString()}
                      </td>

                      {/* Right Arrow Action */}
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="h-4 w-4 text-zinc-400 inline-block" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-500 flex justify-between items-center font-mono">
          <span>Showing {candidates.length} candidate applications</span>
          <span>Click any row to open candidate record</span>
        </div>

      </div>

      {/* Modals & Drawers */}
      <CreateJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        onSuccess={fetchData}
      />

      <InviteCandidateModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        jobs={jobs}
        onSuccess={(inviteData) => {
          fetchData();
          if (inviteData && inviteData.candidate) {
            setEmailPreview({
              isOpen: true,
              testUrl: inviteData.testUrl,
              candidateName: inviteData.candidate.name,
              candidateEmail: inviteData.candidate.email,
              jobTitle: inviteData.jobTitle,
            });
          }
        }}
      />

      <BulkInviteModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        jobs={jobs}
        onSuccess={fetchData}
      />

      <CandidateDetailDrawer
        applicationId={inspectApplicationId}
        onClose={() => setInspectApplicationId(null)}
        onUpdate={fetchData}
        onOpenResume={(name, email, fileName, url) => {
          setResumeData({ isOpen: true, name, email, fileName, url });
        }}
      />

      <ResumeViewerModal
        isOpen={resumeData.isOpen}
        onClose={() => setResumeData({ ...resumeData, isOpen: false })}
        candidateName={resumeData.name}
        candidateEmail={resumeData.email}
        fileName={resumeData.fileName}
        resumeUrl={resumeData.url}
      />

      <EmailPreviewModal
        isOpen={emailPreview.isOpen}
        onClose={() => setEmailPreview({ ...emailPreview, isOpen: false })}
        testUrl={emailPreview.testUrl}
        candidateName={emailPreview.candidateName}
        candidateEmail={emailPreview.candidateEmail}
        jobTitle={emailPreview.jobTitle}
      />

    </div>
  );
};
