import React from 'react';
import { CheckCircle, XCircle, Award, ShieldCheck } from 'lucide-react';

interface ResultViewProps {
  result: any;
  jobTitle: string;
  candidateName: string;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  jobTitle,
  candidateName,
}) => {
  const isPassed = result?.isPassed;
  const percentage = result?.percentage || 0;
  const sectionScores = result?.sectionScores || {};

  return (
    <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
      
      {/* Icon Badge */}
      <div className="inline-flex p-4 rounded-3xl ring-1 mb-2 shadow-2xl" style={{
        backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        color: isPassed ? '#10b981' : '#ef4444',
      }}>
        {isPassed ? <CheckCircle className="h-12 w-12" /> : <XCircle className="h-12 w-12" />}
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold text-white">Assessment Submitted!</h2>
        <p className="text-xs text-slate-400">
          Thank you <strong className="text-white">{candidateName}</strong> for completing your technical screening for <strong className="text-blue-400">{jobTitle}</strong>.
        </p>
      </div>

      {/* Score Summary Box */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Technical Score</div>
        
        <div className="text-5xl font-extrabold text-white">
          {percentage}%
        </div>

        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{
          backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: isPassed ? '#34d399' : '#f87171',
        }}>
          {isPassed ? 'QUALIFIED / PASSED' : 'DID NOT MEET PASS THRESHOLD'}
        </div>

        {/* Section Score Breakdown */}
        <div className="pt-4 border-t border-slate-800 space-y-2 text-left text-xs">
          <h4 className="font-semibold text-slate-300 flex items-center space-x-1.5 mb-2">
            <Award className="h-4 w-4 text-amber-400" />
            <span>Section Breakdown</span>
          </h4>

          {Object.entries(sectionScores).map(([secName, secData]: [string, any]) => {
            const secPct = Math.round((secData.score / (secData.max || 1)) * 100);
            return (
              <div key={secName} className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
                <span className="font-medium text-slate-200">{secName}</span>
                <span className="font-mono text-slate-400 font-bold">{secData.score}/{secData.max} ({secPct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed text-left flex items-start space-x-3">
        <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <p>
          Your evaluation results and proctoring logs have been automatically submitted to the hiring team. The recruiter will review your profile and update your application status.
        </p>
      </div>

    </div>
  );
};
