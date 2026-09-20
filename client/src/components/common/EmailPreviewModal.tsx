import React, { useState, useEffect } from 'react';
import { X, Mail, Copy, Check, ExternalLink, Send, CheckCircle2, AlertCircle, Settings } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  testUrl: string;
  onOpenSmtpSettings?: () => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  candidateEmail,
  jobTitle,
  testUrl,
  onOpenSmtpSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; previewUrl?: string } | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; transportType: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/smtp-config')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.config) {
            setSmtpStatus(data.config);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(testUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResendRealEmail = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: candidateEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult({
          success: true,
          message: `Email dispatched successfully to ${candidateEmail} via ${data.transport || 'SMTP'}!`,
          previewUrl: data.previewUrl,
        });
      } else {
        setSendResult({
          success: false,
          message: data.error || 'Failed to transmit email.',
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs select-none">
      <div className="bg-white border border-zinc-200 rounded max-w-2xl w-full overflow-hidden shadow-xl flex flex-col text-zinc-900">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded border border-blue-200/60">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">Assessment Invitation Dispatch</h3>
              <p className="text-xs text-zinc-500 font-mono">Target Recipient: {candidateEmail}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded hover:bg-zinc-200 text-zinc-500 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-zinc-800">
          
          {/* SMTP Delivery Status Badge */}
          <div className="flex items-center justify-between bg-zinc-50 px-3.5 py-2.5 rounded border border-zinc-200">
            <div className="flex items-center space-x-2">
              <div className={`h-2.5 w-2.5 rounded-full ${smtpStatus?.configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-medium text-xs">
                {smtpStatus?.configured
                  ? `Live Delivery Active (${smtpStatus.transportType})`
                  : 'Ethereal / Dev Mail Transport Active'}
              </span>
            </div>
            {onOpenSmtpSettings && (
              <button
                type="button"
                onClick={onOpenSmtpSettings}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium text-[11px]"
              >
                <Settings className="h-3 w-3" />
                <span>Configure Gmail / SMTP</span>
              </button>
            )}
          </div>

          {/* Email Preview Card */}
          <div className="bg-zinc-50 rounded border border-zinc-200 p-5 space-y-3">
            <div className="text-xs border-b border-zinc-200 pb-2.5 space-y-1.5 font-mono">
              <div className="flex">
                <span className="text-zinc-400 w-20 uppercase text-[10px] tracking-wider pt-0.5">Subject:</span> 
                <span className="text-zinc-900 font-semibold font-sans">Technical Assessment Invitation &bull; {jobTitle}</span>
              </div>
              <div className="flex">
                <span className="text-zinc-400 w-20 uppercase text-[10px] tracking-wider pt-0.5">To:</span> 
                <span className="text-blue-700 font-mono text-xs">{candidateName} &lt;{candidateEmail}&gt;</span>
              </div>
            </div>

            <div className="text-xs space-y-3 text-zinc-700 leading-relaxed font-sans pt-1">
              <p>Hello <strong className="text-zinc-900">{candidateName}</strong>,</p>
              <p>Thank you for your interest in the <strong className="text-zinc-900">{jobTitle}</strong> position. You have been selected for our automated first-round technical evaluation.</p>
              
              <div className="p-3 bg-white rounded border border-zinc-200 space-y-1 text-[11px] font-mono">
                <p>&bull; <span className="text-zinc-500">Position:</span> <strong className="text-zinc-900">{jobTitle}</strong></p>
                <p>&bull; <span className="text-zinc-500">Format:</span> 60-Second Rapid Assessment per Question</p>
                <p>&bull; <span className="text-zinc-500">Requirements:</span> Camera, Microphone & Screen Share Permission</p>
              </div>

              <p>Click the secure link below to verify identity and start your assessment:</p>

              {/* Assessment Link Box */}
              <div className="p-2.5 bg-white border border-zinc-200 rounded flex items-center justify-between gap-3">
                <span className="text-zinc-900 text-xs font-mono truncate">{testUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center space-x-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-3 py-1.5 rounded shrink-0 transition cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Resend Alert */}
          {sendResult && (
            <div className={`p-3 rounded border text-xs flex items-start space-x-2 ${sendResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {sendResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />}
              <div>
                <p className="font-medium">{sendResult.message}</p>
                {sendResult.previewUrl && (
                  <a href={sendResult.previewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-[11px] block mt-1">
                    Click here to open Ethereal Web Preview &rarr;
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a
              href={testUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <span>Open Candidate Test Link</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={handleResendRealEmail}
              disabled={sending}
              className="flex items-center space-x-1.5 text-xs text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 hover:border-zinc-400 px-2.5 py-1 rounded transition disabled:opacity-50"
            >
              <Send className={`h-3 w-3 ${sending ? 'animate-spin' : ''}`} />
              <span>{sending ? 'Transmitting...' : 'Send Live Email via SMTP'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
