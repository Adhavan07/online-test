import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, Mail, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Send OTP on initial mount
  useEffect(() => {
    handleSendOtp();
  }, [token]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendOtp = async () => {
    setSendingOtp(true);
    setError('');
    try {
      const res = await fetch('/api/assessment/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setCooldown(30);
        setNotice(`Verification passcode dispatched to ${candidateEmail}. Please check your Inbox and Spam folders.`);
      } else {
        setError(data.error || 'Failed to dispatch verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with authentication server.');
    } finally {
      setSendingOtp(false);
    }
  };

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
        setError(data.error || 'Invalid verification code. Please check your email and try again.');
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
        <div className="inline-flex p-2 bg-blue-50 text-blue-600 rounded mb-1">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Candidate Identity Verification</h2>
        <p className="text-xs text-zinc-600">
          Welcome <strong className="text-zinc-900">{candidateName}</strong>. Enter your verification passcode to access the assessment for <strong className="text-zinc-900">{jobTitle}</strong>.
        </p>
      </div>

      {/* Email Dispatched Alert */}
      <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Passcode Sent To:</div>
              <div className="text-zinc-900 font-semibold font-mono text-xs">{candidateEmail}</div>
            </div>
          </div>
          <button
            type="button"
            disabled={sendingOtp || cooldown > 0}
            onClick={handleSendOtp}
            className="flex items-center space-x-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:text-zinc-400 transition"
          >
            <RefreshCw className={`h-3 w-3 ${sendingOtp ? 'animate-spin' : ''}`} />
            <span>{sendingOtp ? 'Sending...' : cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Code'}</span>
          </button>
        </div>

        {notice && (
          <div className="flex items-start space-x-1.5 text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleVerify} className="space-y-4 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="font-semibold text-zinc-700">6-Digit Access Passcode</label>
            <span className="font-mono text-[11px] text-zinc-500">
              Check your inbox
            </span>
          </div>
          <div className="relative">
            <KeyRound className="h-4 w-4 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              required
              maxLength={6}
              placeholder="••••••"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white border border-zinc-200 rounded pl-9 pr-3 py-2.5 text-lg font-mono text-center font-bold tracking-widest text-zinc-900 focus:border-zinc-500 focus:outline-none transition"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium flex items-center space-x-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || otpCode.length !== 6}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 rounded transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          <span>{loading ? 'Verifying Identity...' : 'Verify & Access Assessment'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <p className="text-[11px] text-center text-zinc-500">
          Didn't receive the email? Check your spam folder or click "Resend Code" above.
        </p>
      </form>

    </div>
  );
};
