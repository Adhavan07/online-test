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
    <div className="max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-2xl ring-1 ring-blue-500/20 mb-2">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">Candidate Email Verification</h2>
        <p className="text-xs text-slate-400">
          Welcome <strong className="text-white">{candidateName}</strong>! Please verify your email to access your technical assessment for <strong className="text-blue-400">{jobTitle}</strong> at {companyName}.
        </p>
      </div>

      {/* Verification Card */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center space-x-3 text-xs">
        <div className="p-2 bg-slate-900 rounded-xl text-blue-400">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <div className="text-slate-400 font-medium">Verification code sent to:</div>
          <div className="text-white font-bold">{candidateEmail}</div>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>6-Digit Verification Code</span>
            <span className="text-blue-400 text-[11px]">Demo Code: 123456</span>
          </label>
          <div className="relative">
            <KeyRound className="h-5 w-5 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              required
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-lg font-mono text-center font-bold tracking-widest text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-400 text-center font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/25 disabled:opacity-50"
        >
          <span>{loading ? 'Verifying...' : 'Verify Email & Continue'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

    </div>
  );
};
