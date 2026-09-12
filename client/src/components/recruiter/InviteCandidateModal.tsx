import React, { useState } from 'react';
import { X, UserPlus, Upload, FileText, Send } from 'lucide-react';

interface InviteCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Array<{ id: string; title: string }>;
  onCandidateInvited?: (testUrl: string, candidateName: string, candidateEmail: string, jobTitle: string) => void;
  onSuccess?: (data?: any) => void;
}

export const InviteCandidateModal: React.FC<InviteCandidateModalProps> = ({
  isOpen,
  onClose,
  jobs,
  onCandidateInvited,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobId, setJobId] = useState(jobs[0]?.id || '');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!jobId && jobs.length > 0) {
      setJobId(jobs[0].id);
    }
  }, [jobs, jobId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetJobId = jobId || jobs[0]?.id;
    if (!targetJobId) {
      alert('Please select a target job opening.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('jobId', targetJobId);
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
        const jobTitle = selectedJob?.title || 'Job Assessment';
        if (onCandidateInvited) {
          onCandidateInvited(data.testUrl, name, email, jobTitle);
        }
        if (onSuccess) {
          onSuccess({
            testUrl: data.testUrl,
            candidate: { name, email },
            jobTitle,
          });
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs select-none">
      <div className="bg-white border border-zinc-200 rounded-md max-w-lg w-full overflow-hidden shadow-lg text-zinc-900">
        
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-zinc-900 text-sm">Invite Candidate for Technical Assessment</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-200 text-zinc-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Target Job Opening</label>
            <select
              required
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
            >
              <option value="">Select Job Opening...</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Candidate Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Vikramaditya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="vikram@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Resume File (PDF / DOCX)</label>
            <div className="mt-1 flex items-center justify-center px-4 py-3 border border-dashed border-zinc-300 hover:border-zinc-400 rounded bg-zinc-50 text-center cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex items-center space-x-2 text-zinc-600 text-xs">
                {resumeFile ? (
                  <>
                    <FileText className="h-4 w-4 text-emerald-700" />
                    <span className="text-emerald-800 font-medium truncate max-w-[240px]">{resumeFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-zinc-400" />
                    <span>Upload Candidate Resume (Optional)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{loading ? 'Dispatching...' : 'Dispatch Assessment Invitation'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
