import React, { useState, useEffect } from 'react';
import { MailCheck, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

export const UnsubscribeView: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (!tokenParam) {
      setError('Missing unsubscribe token. Please use the complete link provided in your email.');
      setLoading(false);
      return;
    }

    setToken(tokenParam);

    // Verify token validity without exposing plain email in URL
    fetch(`/api/legal/unsubscribe?token=${encodeURIComponent(tokenParam)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMaskedEmail(data.maskedEmail);
        } else {
          setError(data.error || 'This unsubscribe link is invalid or has already been used.');
        }
      })
      .catch(err => {
        setError('Network error verifying unsubscribe link: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConfirmUnsubscribe = async () => {
    setUnsubscribing(true);
    setError(null);

    try {
      const res = await fetch('/api/legal/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to process unsubscribe request.');
      }
    } catch (err: any) {
      setError('Error communicating with compliance service: ' + err.message);
    } finally {
      setUnsubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4 font-sans text-zinc-900 select-none">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-lg shadow-sm p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 pb-4 border-b border-zinc-100">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-zinc-100 rounded-full text-zinc-800 mb-1">
            <MailCheck className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">
            Email Communication Preferences
          </h1>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Manage your subscription preferences under the Digital Personal Data Protection framework.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-8 text-center text-xs font-mono text-zinc-500 animate-pulse">
            Verifying secure unsubscribe token...
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <p className="text-[11px] text-zinc-500 text-center">
              Single-use tokens expire after 30 days. If you continue to receive unwanted emails, you can submit a grievance via our Grievance Redressal mechanism.
            </p>
          </div>
        )}

        {/* Action State: Token Verified */}
        {!loading && !error && !success && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded space-y-1">
              <span className="text-[10px] uppercase font-mono text-zinc-400 font-semibold block">
                Target Recipient Address:
              </span>
              <span className="font-mono font-bold text-zinc-800 text-sm">
                {maskedEmail || 'Protected Email'}
              </span>
            </div>

            <p className="text-zinc-600 leading-relaxed text-[11px]">
              Clicking below will suppress this address from non-transactional marketing and campaign communications. Essential transactional notifications (such as active screening invitations and score notices) will continue to be delivered.
            </p>

            <button
              onClick={handleConfirmUnsubscribe}
              disabled={unsubscribing}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 rounded text-xs transition cursor-pointer disabled:opacity-50"
            >
              {unsubscribing ? 'Processing Unsubscribe...' : 'Confirm Unsubscribe'}
            </button>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-emerald-950 text-xs">Preferences Updated Successfully</h3>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Your email ({maskedEmail}) has been placed on the suppression list. You will not receive further marketing or campaign messages from this fiduciary.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-1 text-[10px] text-zinc-400 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Single-use compliance token invalidated</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-100 text-center">
          <a
            href="/"
            className="text-[11px] text-zinc-500 hover:text-zinc-800 underline font-medium"
          >
            Return to TechScreen Home
          </a>
        </div>

      </div>
    </div>
  );
};
