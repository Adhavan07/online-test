import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, Mail } from 'lucide-react';

interface OtpVerificationProps {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  onVerifySuccess: () => void;
  token: string;
}

export const OtpVerification: React.FC<OtpVerificationProps> = ({
  candidateName,
  candidateEmail,
  jobTitle,
  companyName,
  onVerifySuccess,
  token,
}) => {
  const [otpCode, setOtpCode] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/assessment/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otpCode }),
      });

      const data = await res.json();
      if (data.success) {
        onVerifySuccess();
      } else {
        setError(data.error || 'Verification failed. Please enter valid 6-digit code.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded p-8 shadow-sm space-y-6 select-none text-zinc-900 my-10">
      
      {/* Header */}
      <div className="text-center space-y-1.5 pb-4 border-b border-zinc-200">
        <div className="inline-flex p-2 bg-zinc-100 text-zinc-800 rounded mb-1">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Candidate Identity Verification</h2>
        <p className="text-xs text-zinc-600">
          Welcome <strong className="text-zinc-900">{candidateName}</strong>. Please enter your verification passkey to begin assessment for <strong className="text-zinc-900">{jobTitle}</strong>.
        </p>
      </div>

      {/* Verification Details */}
      <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center space-x-2.5 text-xs">
        <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
        <div>
          <div className="text-zinc-500 font-mono text-[11px]">Invitation sent to:</div>
          <div className="text-zinc-900 font-semibold font-mono">{candidateEmail}</div>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-semibold text-zinc-700">6-Digit Access Code</label>
            <span className="font-mono text-[11px] text-zinc-500">Demo Code: 123456</span>
          </div>
          <div className="relative">
            <KeyRound className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              required
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded pl-9 pr-3 py-2 text-base font-mono text-center font-bold tracking-widest text-zinc-900 focus:border-zinc-400"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 rounded transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <span>{loading ? 'Verifying...' : 'Verify & Access Assessment'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>

    </div>
  );
};
