import React, { useState } from 'react';
import { X, Users, Send, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

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

  const parseCsv = (text: string): CandidateRow[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows: CandidateRow[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith('name,email')) continue;
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
        }, 1500);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs select-none">
      <div className="bg-white border border-zinc-200 rounded-md max-w-2xl w-full p-6 shadow-lg space-y-4 text-zinc-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Bulk Candidate CSV Dispatcher</h3>
              <p className="text-xs text-zinc-500">Batch upload & invite multiple candidates to technical assessment</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 text-zinc-500 hover:bg-zinc-200 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Job Selection */}
        <div className="text-xs">
          <label className="block font-semibold text-zinc-700 mb-1">Target Job Opening</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 font-medium text-zinc-900 focus:border-zinc-400"
          >
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} ({job.experienceRange})
              </option>
            ))}
          </select>
        </div>

        {/* CSV Text Input Area */}
        <div className="text-xs">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-zinc-700">CSV Candidate List (Name, Email, Phone)</label>
            <button
              onClick={handleParse}
              className="font-bold text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
            >
              <Users className="w-3 h-3" /> Preview Parsed Roster
            </button>
          </div>

          <textarea
            rows={4}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Name, Email, Phone&#10;John Doe, john@example.com, +91 999000111"
            className="w-full bg-white border border-zinc-200 rounded p-2.5 font-mono text-zinc-900 focus:border-zinc-400 resize-none text-xs"
          />
        </div>

        {/* Live Parsed Preview Roster */}
        {parsedCandidates.length > 0 && (
          <div className="bg-zinc-50 border border-zinc-200 rounded p-3 max-h-32 overflow-y-auto space-y-1 text-xs">
            <div className="text-[10px] font-mono font-bold uppercase text-zinc-500 mb-1">
              Parsed Candidates ({parsedCandidates.length})
            </div>
            {parsedCandidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-0.5 border-b border-zinc-200 last:border-0">
                <span className="font-semibold text-zinc-900">{c.name}</span>
                <span className="text-zinc-500 font-mono text-[11px]">{c.email}</span>
                <span className="text-zinc-400 text-[11px]">{c.phone || 'N/A'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Alert Messages */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {resultMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{resultMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-200 text-xs">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100 rounded transition"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSendBulkInvites}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Dispatching...' : 'Dispatch Bulk Invites'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
