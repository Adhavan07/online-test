import React, { useState } from 'react';
import { X, UserPlus, Upload, FileText, Send } from 'lucide-react';

interface InviteCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Array<{ id: string; title: string }>;
  onCandidateInvited: (testUrl: string, candidateName: string, candidateEmail: string, jobTitle: string) => void;
}

export const InviteCandidateModal: React.FC<InviteCandidateModalProps> = ({
  isOpen,
  onClose,
  jobs,
  onCandidateInvited,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobId, setJobId] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) {
      alert('Please select a target job opening.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('jobId', jobId);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await fetch('/api/candidates/apply', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const selectedJob = jobs.find(j => j.id === jobId);
        onCandidateInvited(data.testUrl, name, email, selectedJob?.title || 'Job Assessment');
        onClose();
      } else {
        alert('Error inviting candidate: ' + data.error);
      }
    } catch (err: any) {
      alert('Error inviting candidate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <UserPlus className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Invite Candidate for Technical Assessment</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Job Opening</label>
            <select
              required
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Job Opening...</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Candidate Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Vikramaditya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="vikram@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Resume File (PDF / DOCX)</label>
            <div className="mt-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950 text-center cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                {resumeFile ? (
                  <>
                    <FileText className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300 font-medium truncate max-w-[240px]">{resumeFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-slate-500" />
                    <span>Upload Candidate Resume (Optional)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{loading ? 'Sending Link...' : 'Generate & Send Invitation'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
