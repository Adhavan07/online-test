import React, { useState } from 'react';
import { X, Upload, Users, Send, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  experienceRange: string;
}

interface BulkInviteModalProps {
  jobs: Job[];
  onClose: () => void;
  onSuccess: () => void;
}

interface CandidateRow {
  name: string;
  email: string;
  phone?: string;
}

export const BulkInviteModal: React.FC<BulkInviteModalProps> = ({ jobs, onClose, onSuccess }) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
  const [csvText, setCsvText] = useState<string>(
    'Ananya Roy, ananya.roy@example.com, +91 99887 66554\nVikram Singh, vikram.singh@example.com, +91 98765 11223\nMeera Nair, meera.nair@example.com, +91 91122 33445'
  );
  const [parsedCandidates, setParsedCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Parse CSV text dynamically into candidate rows
  const parseCsv = (text: string): CandidateRow[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows: CandidateRow[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith('name,email')) continue; // Skip header row
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        rows.push({
          name: parts[0],
          email: parts[1],
          phone: parts[2] || undefined,
        });
      }
    }
    return rows;
  };

  const handleParse = () => {
    const rows = parseCsv(csvText);
    setParsedCandidates(rows);
    if (rows.length === 0) {
      setErrorMsg('No valid candidates parsed. Format: Name, Email, Phone');
    } else {
      setErrorMsg(null);
    }
  };

  const handleSendBulkInvites = async () => {
    const candidatesToInvite = parsedCandidates.length > 0 ? parsedCandidates : parseCsv(csvText);
    if (!selectedJobId) {
      setErrorMsg('Please select a target job opening.');
      return;
    }
    if (candidatesToInvite.length === 0) {
      setErrorMsg('Please enter or parse at least one candidate.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/candidates/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobId, candidates: candidatesToInvite })
      });
      const data = await res.json();
      if (data.success) {
        setResultMsg(data.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setErrorMsg(data.error || 'Failed to dispatch bulk invitations.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error dispatching invites.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-950 border border-blue-800/60 rounded-xl text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bulk Candidate CSV Dispatcher</h3>
              <p className="text-xs text-slate-400">Batch upload & invite multiple candidates to technical assessment</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Job Selection Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Job Opening</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-blue-500"
          >
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} ({job.experienceRange})
              </option>
            ))}
          </select>
        </div>

        {/* CSV Text Input Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">CSV Candidate List (Name, Email, Phone)</label>
            <button
              onClick={handleParse}
              className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1"
            >
              <Users className="w-3 h-3" /> Preview Parsed Roster
            </button>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Name, Email, Phone&#10;John Doe, john@example.com, +91 999000111"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Live Parsed Preview Roster */}
        {parsedCandidates.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5">
            <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">
              Parsed Candidates ({parsedCandidates.length})
            </div>
            {parsedCandidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-900 last:border-0">
                <span className="font-semibold text-slate-200">{c.name}</span>
                <span className="text-slate-400 font-mono">{c.email}</span>
                <span className="text-slate-500">{c.phone || 'N/A'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Alert Messages */}
        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {resultMsg && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{resultMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSendBulkInvites}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Dispatching Invites...' : 'Send Bulk Assessment Invites'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
