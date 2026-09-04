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
    <div className="max-w-xl mx-auto bg-white border border-zinc-200 rounded p-8 shadow-sm space-y-6 text-center select-none text-zinc-900 my-8">
      
      {/* Icon Badge */}
      <div className="inline-flex p-3 rounded-full mb-1" style={{
        backgroundColor: isPassed ? '#ecfdf5' : '#fef2f2',
        color: isPassed ? '#047857' : '#b91c1c',
      }}>
        {isPassed ? <CheckCircle className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Assessment Completed & Submitted</h2>
        <p className="text-xs text-zinc-600">
          Thank you <strong className="text-zinc-900">{candidateName}</strong> for completing technical evaluation for <strong className="text-zinc-900">{jobTitle}</strong>.
        </p>
      </div>

      {/* Score Summary Box */}
      <div className="bg-zinc-50 p-6 rounded border border-zinc-200 space-y-3">
        <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Overall Evaluation Score</div>
        
        <div className="text-4xl font-bold text-zinc-900 font-mono">
          {percentage}%
        </div>

        <div className="inline-block px-3 py-1 rounded text-xs font-mono font-bold" style={{
          backgroundColor: isPassed ? '#d1fae5' : '#fee2e2',
          color: isPassed ? '#065f46' : '#991b1b',
        }}>
          {isPassed ? 'QUALIFIED / PASSED CUTOFF' : 'DID NOT MEET PASS THRESHOLD'}
        </div>

        {/* Section Score Breakdown */}
        <div className="pt-3 border-t border-zinc-200 space-y-1.5 text-left text-xs">
          <h4 className="font-semibold text-zinc-700 flex items-center space-x-1.5 mb-2">
            <Award className="h-4 w-4 text-amber-500" />
            <span>Section Breakdown</span>
          </h4>

          {Object.entries(sectionScores).map(([secName, secData]: [string, any]) => {
            const secPct = Math.round((secData.score / (secData.max || 1)) * 100);
            return (
              <div key={secName} className="flex justify-between items-center bg-white px-3 py-2 rounded border border-zinc-200 font-mono">
                <span className="font-medium text-zinc-900">{secName}</span>
                <span className="text-zinc-600 font-bold">{secData.score}/{secData.max} ({secPct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 text-xs text-zinc-600 leading-relaxed text-left flex items-start space-x-2.5">
        <ShieldCheck className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
        <p>
          Your evaluation score, code submission telemetry, and anti-cheat proctoring logs have been recorded in the company dashboard. The recruitment team will review your application profile.
        </p>
      </div>

    </div>
  );
};
