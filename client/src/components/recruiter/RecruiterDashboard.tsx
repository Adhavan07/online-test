import React, { useEffect, useState } from 'react';
import { 
  Users, CheckCircle2, AlertCircle, Clock, Search, Filter, 
  Plus, UserPlus, Eye, FileText, Copy, Check, ExternalLink, Briefcase, FileSpreadsheet, Download
} from 'lucide-react';
import { CreateJobModal } from './CreateJobModal';
import { InviteCandidateModal } from './InviteCandidateModal';
import { BulkInviteModal } from './BulkInviteModal';
import { CandidateDetailDrawer } from './CandidateDetailDrawer';
import { ResumeViewerModal } from '../common/ResumeViewerModal';
import { EmailPreviewModal } from '../common/EmailPreviewModal';

export const RecruiterDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Link copy feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

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

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/assessment/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Calculate totals
  const totalApplicants = candidates.length;
  const completedCount = candidates.filter(c => ['PASSED', 'FAILED', 'SHORTLISTED', 'HR_INTERVIEW', 'REJECTED'].includes(c.status)).length;
  const passedCount = candidates.filter(c => ['PASSED', 'SHORTLISTED', 'HR_INTERVIEW'].includes(c.status)).length;
  const hrShortlistCount = candidates.filter(c => c.status === 'HR_INTERVIEW' || c.status === 'SHORTLISTED').length;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Recruiter Technical Hiring Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Automated Candidate Screening, Proctoring Audits & HR Pipeline Management</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/api/candidates/export-csv"
            download
            className="flex items-center space-x-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-800 transition"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
            <span>Bulk Invite</span>
          </button>

          <button
            onClick={() => setIsJobModalOpen(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
          >
            <Plus className="h-4 w-4 text-blue-400" />
            <span>Create Job</span>
          </button>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-600/20"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite Candidate</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Candidates</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{totalApplicants}</div>
          <div className="text-[11px] text-slate-400">Applications received</div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Assessments Completed</span>
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{completedCount}</div>
          <div className="text-[11px] text-slate-400">Evaluated post-timer</div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Passed Technical</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{passedCount}</div>
          <div className="text-[11px] text-slate-400">Score &ge; Pass threshold</div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">HR Interview Stage</span>
            <AlertCircle className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-400">{hrShortlistCount}</div>
          <div className="text-[11px] text-slate-400">Shortlisted for HR round</div>
        </div>
      </div>

      {/* Active Jobs Grid */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Briefcase className="h-4 w-4 text-blue-400" />
          <span>Active Job Openings ({jobs.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <div
              key={job.id}
              onClick={() => setSelectedJobId(selectedJobId === job.id ? '' : job.id)}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                selectedJobId === job.id
                  ? 'bg-blue-950/30 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-sm">{job.title}</h4>
                  <p className="text-xs text-slate-400">{job.location} • {job.experienceRange}</p>
                </div>
                <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                  Pass {job.passThreshold}%
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                <span>Template: <strong className="text-slate-200">{job.assessmentTemplate?.title || 'Standard'}</strong></span>
                <span className="font-semibold text-blue-400">{job.stats.totalApps} Candidates</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Candidates Search & Filtering Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidates by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </form>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
            <Filter className="h-4 w-4 text-slate-500 mr-2 shrink-0 hidden sm:block" />
            {['ALL', 'PASSED', 'FAILED', 'INVITED', 'SHORTLISTED', 'HR_INTERVIEW', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

        </div>

        {/* Candidate Applicants Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Candidate Name</th>
                <th className="py-3.5 px-4">Applied Job</th>
                <th className="py-3.5 px-4">Technical Score</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Applied Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading candidate records...</td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No candidate applications match the selected criteria.</td>
                </tr>
              ) : (
                candidates.map((cand) => {
                  const isCopied = copiedToken === cand.token;
                  return (
                    <tr key={cand.applicationId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{cand.name}</div>
                        <div className="text-slate-400 text-[11px]">{cand.email}</div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-300">
                        {cand.jobTitle}
                      </td>

                      <td className="py-3.5 px-4">
                        {cand.scorePercentage !== null ? (
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-sm text-white">{cand.scorePercentage}%</span>
                            {cand.isPassed ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">PASS</span>
                            ) : (
                              <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-1.5 py-0.5 rounded border border-red-500/20">FAIL</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Pending Test</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          cand.status === 'HR_INTERVIEW' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          cand.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          cand.status === 'FAILED' || cand.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {cand.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {new Date(cand.appliedAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1 shrink-0">
                        <button
                          onClick={() => setInspectApplicationId(cand.applicationId)}
                          className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-semibold rounded-lg border border-blue-500/30 transition inline-flex items-center space-x-1"
                          title="Inspect Candidate Performance"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => setResumeData({
                            isOpen: true,
                            name: cand.name,
                            email: cand.email,
                            fileName: cand.resumeFileName,
                            url: cand.resumeUrl,
                          })}
                          className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg border border-slate-700 transition inline-flex items-center space-x-1"
                          title="View Resume"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-400" />
                          <span className="hidden sm:inline">Resume</span>
                        </button>

                        <button
                          onClick={() => handleCopyLink(cand.token)}
                          className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg border border-slate-700 transition inline-flex items-center space-x-1"
                          title="Copy Candidate Unique Assessment Link"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                          <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Link'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modals */}
      <CreateJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        templates={templates}
        onJobCreated={fetchData}
      />

      <InviteCandidateModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        jobs={jobs}
        onCandidateInvited={(testUrl, name, email, jobTitle) => {
          fetchData();
          setEmailPreview({
            isOpen: true,
            testUrl,
            candidateName: name,
            candidateEmail: email,
            jobTitle,
          });
        }}
      />

      {isBulkModalOpen && (
        <BulkInviteModal
          jobs={jobs}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={fetchData}
        />
      )}

      <CandidateDetailDrawer
        applicationId={inspectApplicationId}
        onClose={() => setInspectApplicationId(null)}
        onOpenResume={(name, email, fileName, url) => setResumeData({ isOpen: true, name, email, fileName, url })}
        onStatusChanged={fetchData}
      />

      <ResumeViewerModal
        isOpen={resumeData.isOpen}
        onClose={() => setResumeData(prev => ({ ...prev, isOpen: false }))}
        candidateName={resumeData.name}
        candidateEmail={resumeData.email}
        resumeFileName={resumeData.fileName}
        resumeUrl={resumeData.url}
      />

      <EmailPreviewModal
        isOpen={emailPreview.isOpen}
        onClose={() => setEmailPreview(prev => ({ ...prev, isOpen: false }))}
        candidateName={emailPreview.candidateName}
        candidateEmail={emailPreview.candidateEmail}
        jobTitle={emailPreview.jobTitle}
        testUrl={emailPreview.testUrl}
      />

    </div>
  );
};
