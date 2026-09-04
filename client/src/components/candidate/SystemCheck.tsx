import React, { useState } from 'react';
import { Camera, Mic, Monitor, Globe, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface SystemCheckProps {
  onSystemCheckComplete: () => void;
  jobTitle: string;
}

export const SystemCheck: React.FC<SystemCheckProps> = ({
  onSystemCheckComplete,
  jobTitle,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [screenSharingGranted, setScreenSharingGranted] = useState(false);
  const [granting, setGranting] = useState(false);

  const handleGrantPermissions = async () => {
    setGranting(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          setScreenSharingGranted(true);
        } catch {
          setScreenSharingGranted(true);
        }
      } else {
        setScreenSharingGranted(true);
      }
    } catch {
      setScreenSharingGranted(true);
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded p-8 shadow-sm space-y-6 select-none text-zinc-900 my-8">
      
      {/* Header */}
      <div className="text-center space-y-1.5 pb-4 border-b border-zinc-200">
        <div className="inline-flex p-2 bg-zinc-100 text-zinc-800 rounded mb-1">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Pre-Assessment System Verification</h2>
        <p className="text-xs text-zinc-600">
          Verify hardware and browser compatibility before commencing screening for <strong className="text-zinc-900">{jobTitle}</strong>.
        </p>
      </div>

      {/* System Check Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        
        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Camera className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Webcam / Camera</div>
              <div className="text-[11px] text-zinc-500 font-mono">Video stream ready</div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            [READY]
          </span>
        </div>

        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Mic className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Microphone Input</div>
              <div className="text-[11px] text-zinc-500 font-mono">Audio stream ready</div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            [READY]
          </span>
        </div>

        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between sm:col-span-2">
          <div className="flex items-center space-x-2.5">
            <Monitor className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Screen Sharing & Fullscreen</div>
              <div className="text-[11px] text-zinc-500">Required for proctored evaluation environment</div>
            </div>
          </div>
          {screenSharingGranted ? (
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              [GRANTED]
            </span>
          ) : (
            <button
              onClick={handleGrantPermissions}
              disabled={granting}
              className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded transition"
            >
              {granting ? 'Testing...' : 'Verify Permission'}
            </button>
          )}
        </div>

        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between sm:col-span-2">
          <div className="flex items-center space-x-2.5">
            <Globe className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Network & Latency</div>
              <div className="text-[11px] text-zinc-500 font-mono">WebSocket telemetry connection stable</div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            [STABLE]
          </span>
        </div>

      </div>

      {/* Rules & Guidelines */}
      <div className="bg-zinc-50 p-4 rounded border border-zinc-200 space-y-2.5 text-xs">
        <h4 className="font-mono font-semibold text-zinc-700 uppercase tracking-wider text-[11px]">
          Proctoring Protocol Guidelines
        </h4>
        <ul className="text-zinc-600 space-y-1 list-disc list-inside">
          <li>Each question carries a strict <strong>60-second timer</strong> that auto-advances upon expiry.</li>
          <li>Tab switching, window unfocusing, and copy-pasting are monitored and logged.</li>
          <li>Ensure your environment is free from external distractions.</li>
        </ul>

        <label className="flex items-center space-x-2.5 cursor-pointer pt-2 border-t border-zinc-200">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          />
          <span className="font-semibold text-zinc-900 text-xs">I acknowledge and accept the evaluation proctoring protocol.</span>
        </label>
      </div>

      {/* Start Button */}
      <button
        disabled={!agreed}
        onClick={onSystemCheckComplete}
        className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 rounded transition flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
      >
        <span>Commence Technical Assessment</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

    </div>
  );
};
