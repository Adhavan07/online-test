import React, { useEffect, useState } from 'react';
import { 
  Award, ShieldCheck, CheckCircle2, Lock, Copy, Check, 
  Printer, Share2, ExternalLink, RefreshCw, AlertCircle, BarChart3
} from 'lucide-react';

export const VerifiedSkillBadge: React.FC = () => {
  const badgeId = window.location.pathname.split('/verify/')[1] || '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const res = await fetch(`/api/badges/verify/${badgeId}`);
        const json = await res.json();
        if (json.success) {
          setData(json.badge);
        } else {
          setError(json.error || 'Verified credential not found');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching credential verification');
      } finally {
        setLoading(false);
      }
    };
    fetchBadge();
  }, [badgeId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
          <p className="font-semibold text-sm">Verifying Credential Signature...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-300">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Invalid or Unverified Credential</h2>
          <p className="text-xs text-slate-400">{error || 'The requested skill badge record could not be verified on the TechScreen registry.'}</p>
          <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">Return to Homepage</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      
      {/* Container Card */}
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
        
        {/* Top Metallic Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]" />
          
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center justify-center p-3.5 bg-slate-950/60 rounded-2xl border border-white/10 text-emerald-400 shadow-xl mb-1">
              <ShieldCheck className="h-10 w-10" />
            </div>
            
            <span className="block text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
              OFFICIAL VERIFIED CANDIDATE CREDENTIAL
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {data.candidateName}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Verified Technical Mastery for <strong className="text-white">{data.jobTitle}</strong>
            </p>
          </div>
        </div>

        {/* Badge Details & Verification Metadata */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Technical Score</span>
              <span className="text-2xl font-extrabold text-white mt-1 block">{data.overallScore}%</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Integrity Trust</span>
              <span className="text-2xl font-extrabold text-purple-400 mt-1 block">{data.trustScore}%</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 inline-block mt-2">
                VERIFIED PASS
              </span>
            </div>
          </div>

          {/* Skill Breakdown if available */}
          {data.sectionBreakdown && data.sectionBreakdown.length > 0 && (
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                <span>Verified Domain Proficiencies</span>
              </h3>

              <div className="space-y-2.5">
                {data.sectionBreakdown.map((sec: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-300">{sec.title}</span>
                      <span className="text-emerald-400 font-mono font-bold">{sec.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sec.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature Verification Stamp */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono text-slate-400">
            <div className="flex justify-between items-center">
              <span>Credential ID:</span>
              <strong className="text-white">{data.badgeId}</strong>
            </div>
            <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
              <span>Security Signature:</span>
              <strong className="text-slate-300 text-[10px]">{data.verificationSignature}</strong>
            </div>
            <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
              <span>Issued On:</span>
              <strong className="text-slate-300">{new Date(data.issuedAt).toLocaleDateString()}</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-5 py-3 rounded-xl border border-slate-700 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Credential Certificate</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-blue-600/20"
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{isCopied ? 'Verification Link Copied' : 'Share Verification Link'}</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
