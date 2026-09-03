import React, { useState } from 'react';
import { X, Mail, Copy, Check, ExternalLink } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  testUrl: string;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  candidateEmail,
  jobTitle,
  testUrl,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(testUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Sent Assessment Invitation Email</h3>
              <p className="text-xs text-slate-400">Recipient: {candidateEmail}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-slate-300 text-sm">
          
          {/* Email Preview Card */}
          <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 space-y-3">
            <div className="text-xs border-b border-slate-800/80 pb-2 space-y-1">
              <div className="flex"><span className="text-slate-500 w-16">Subject:</span> <span className="text-white font-medium">Technical Assessment Invitation – {jobTitle}</span></div>
              <div className="flex"><span className="text-slate-500 w-16">To:</span> <span className="text-blue-400 font-medium">{candidateName} &lt;{candidateEmail}&gt;</span></div>
            </div>

            <div className="text-xs space-y-2 text-slate-300 leading-relaxed font-sans pt-1">
              <p>Hello <strong className="text-white">{candidateName}</strong>,</p>
              <p>Thank you for applying for the <strong>{jobTitle}</strong> position. You have been shortlisted for our automated first-round technical assessment.</p>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                <p>• <strong>Role:</strong> {jobTitle}</p>
                <p>• <strong>Format:</strong> 60 Seconds per Technical MCQ Question</p>
                <p>• <strong>System Check:</strong> Camera, Microphone & Screen Share Consent</p>
              </div>
              <p>Click the link below to verify your email and begin your assessment:</p>

              {/* Assessment Link Box */}
              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl flex items-center justify-between gap-2">
                <span className="text-blue-300 text-xs font-mono truncate">{testUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center space-x-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1.5 rounded-lg shrink-0 transition"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <a
            href={testUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            <span>Open Link in New Tab</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
