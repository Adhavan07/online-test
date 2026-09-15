import React, { useState, useEffect } from 'react';
import { Camera, Mic, Monitor, Globe, ShieldCheck, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';

interface SystemCheckProps {
  onSystemCheckComplete: () => void;
  jobTitle: string;
  cameraRequired?: boolean;
  microphoneRequired?: boolean;
  screenShareRequired?: boolean;
  fullscreenRequired?: boolean;
}

type DeviceStatus = 'INITIAL' | 'CHECKING' | 'READY' | 'DENIED' | 'UNAVAILABLE';
type ScreenStatus = 'INITIAL' | 'CHECKING' | 'GRANTED' | 'DENIED' | 'UNAVAILABLE';

export const SystemCheck: React.FC<SystemCheckProps> = ({
  onSystemCheckComplete,
  jobTitle,
  cameraRequired = true,
  microphoneRequired = true,
  screenShareRequired = true,
  fullscreenRequired = true,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>('INITIAL');
  const [micStatus, setMicStatus] = useState<DeviceStatus>('INITIAL');
  const [screenStatus, setScreenStatus] = useState<ScreenStatus>('INITIAL');
  const [networkStatus, setNetworkStatus] = useState<'CHECKING' | 'STABLE' | 'UNSTABLE'>('CHECKING');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Check network latency and stability on mount
  useEffect(() => {
    const startTime = Date.now();
    fetch('/api/health')
      .then(res => {
        const latency = Date.now() - startTime;
        if (res.ok && latency < 2000) {
          setNetworkStatus('STABLE');
        } else {
          setNetworkStatus('UNSTABLE');
        }
      })
      .catch(() => setNetworkStatus('UNSTABLE')); // Truthful reporting: never falsely report failed check as STABLE
  }, []);

  // Check camera and microphone hardware
  const checkMediaPermissions = async () => {
    setPermissionError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('UNAVAILABLE');
      setMicStatus('UNAVAILABLE');
      return;
    }

    setCameraStatus('CHECKING');
    setMicStatus('CHECKING');

    // Test Video
    try {
      const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
      vStream.getTracks().forEach(t => t.stop());
      setCameraStatus('READY');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('DENIED');
        setPermissionError('Camera permission was denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraStatus('UNAVAILABLE');
      } else {
        setCameraStatus('DENIED');
      }
    }

    // Test Audio
    try {
      const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      aStream.getTracks().forEach(t => t.stop());
      setMicStatus('READY');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicStatus('DENIED');
        setPermissionError('Microphone permission was denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicStatus('UNAVAILABLE');
      } else {
        setMicStatus('DENIED');
      }
    }
  };

  // Verify Screen Sharing
  const handleGrantScreenSharing = async () => {
    setPermissionError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setScreenStatus('UNAVAILABLE');
      return;
    }

    setScreenStatus('CHECKING');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        tracks.forEach(t => t.stop());
        setScreenStatus('GRANTED');
      } else {
        setScreenStatus('DENIED');
        setPermissionError('Screen sharing stream was empty or aborted.');
      }
    } catch (err: any) {
      setScreenStatus('DENIED');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Screen sharing was cancelled or denied. Screen sharing is mandatory for proctoring.');
      } else {
        setPermissionError('Screen sharing error: ' + (err.message || 'Permission denied.'));
      }
    }
  };

  // Run initial hardware check on mount
  useEffect(() => {
    checkMediaPermissions();
  }, []);

  // Strict Policy Check:
  // If a device is required, UNAVAILABLE or DENIED status blocks commencement.
  const cameraPassed = cameraRequired ? cameraStatus === 'READY' : (cameraStatus === 'READY' || cameraStatus === 'UNAVAILABLE' || cameraStatus === 'INITIAL');
  const micPassed = microphoneRequired ? micStatus === 'READY' : (micStatus === 'READY' || micStatus === 'UNAVAILABLE' || micStatus === 'INITIAL');
  const screenPassed = screenShareRequired ? screenStatus === 'GRANTED' : (screenStatus === 'GRANTED' || screenStatus === 'UNAVAILABLE' || screenStatus === 'INITIAL');

  const hasHardwareIssues = cameraStatus === 'DENIED' || micStatus === 'DENIED' || screenStatus === 'DENIED';

  const canProceed =
    agreed &&
    cameraPassed &&
    micPassed &&
    screenPassed &&
    !hasHardwareIssues &&
    networkStatus !== 'CHECKING';

  const handleCommence = async () => {
    setPermissionError(null);

    // Enforce genuine Fullscreen Entry if required
    if (fullscreenRequired) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        // Verify actual fullscreen element
        if (!document.fullscreenElement) {
          setPermissionError('Fullscreen entry could not be verified. Fullscreen mode is mandatory for this assessment.');
          return;
        }
      } catch (err: any) {
        setPermissionError('Fullscreen entry blocked: ' + (err.message || 'Browser prevented fullscreen entry. Please click to allow fullscreen.'));
        return;
      }
    }

    onSystemCheckComplete();
  };

  const renderBadge = (status: DeviceStatus | ScreenStatus | 'STABLE' | 'UNSTABLE') => {
    switch (status) {
      case 'READY':
      case 'GRANTED':
      case 'STABLE':
        return (
          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            [{status}]
          </span>
        );
      case 'CHECKING':
        return (
          <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">
            [CHECKING]
          </span>
        );
      case 'DENIED':
        return (
          <span className="text-[11px] font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
            [DENIED]
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
            [UNAVAILABLE]
          </span>
        );
      case 'UNSTABLE':
        return (
          <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            [SLOW]
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
            [PENDING]
          </span>
        );
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

      {/* Permission Error Banner */}
      {permissionError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{permissionError}</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              Click the camera/padlock icon in your browser address bar to grant permissions, then click Re-test below.
            </p>
          </div>
        </div>
      )}

      {/* System Check Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        
        {/* Camera Card */}
        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Camera className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Webcam / Camera</div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {cameraStatus === 'READY' && 'Video feed operational'}
                {cameraStatus === 'CHECKING' && 'Requesting camera stream...'}
                {cameraStatus === 'DENIED' && 'Camera access denied'}
                {cameraStatus === 'UNAVAILABLE' && 'No camera hardware found'}
                {cameraStatus === 'INITIAL' && 'Awaiting check'}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {renderBadge(cameraStatus)}
            {cameraStatus === 'DENIED' && (
              <button
                onClick={checkMediaPermissions}
                className="p-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 rounded"
                title="Retry camera check"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Microphone Card */}
        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Mic className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Microphone Input</div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {micStatus === 'READY' && 'Audio stream operational'}
                {micStatus === 'CHECKING' && 'Requesting audio input...'}
                {micStatus === 'DENIED' && 'Microphone access denied'}
                {micStatus === 'UNAVAILABLE' && 'No microphone found'}
                {micStatus === 'INITIAL' && 'Awaiting check'}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {renderBadge(micStatus)}
            {micStatus === 'DENIED' && (
              <button
                onClick={checkMediaPermissions}
                className="p-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 rounded"
                title="Retry microphone check"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Screen Sharing Card */}
        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between sm:col-span-2">
          <div className="flex items-center space-x-2.5">
            <Monitor className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Screen Sharing & Fullscreen</div>
              <div className="text-[11px] text-zinc-500">
                Mandatory for proctored evaluation environment
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {renderBadge(screenStatus)}
            {screenStatus !== 'GRANTED' && screenStatus !== 'UNAVAILABLE' && (
              <button
                onClick={handleGrantScreenSharing}
                disabled={screenStatus === 'CHECKING'}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded transition disabled:opacity-50"
              >
                {screenStatus === 'CHECKING' ? 'Verifying...' : 'Grant Access'}
              </button>
            )}
          </div>
        </div>

        {/* Network Stability Card */}
        <div className="bg-zinc-50 p-3.5 rounded border border-zinc-200 flex items-center justify-between sm:col-span-2">
          <div className="flex items-center space-x-2.5">
            <Globe className="h-4 w-4 text-zinc-500" />
            <div>
              <div className="font-semibold text-zinc-900">Network & Latency</div>
              <div className="text-[11px] text-zinc-500 font-mono">Server latency telemetry check</div>
            </div>
          </div>
          {renderBadge(networkStatus)}
        </div>

      </div>

      {/* Re-check Controls */}
      <div className="flex justify-end">
        <button
          onClick={checkMediaPermissions}
          className="text-[11px] text-zinc-600 hover:text-zinc-900 flex items-center space-x-1 underline"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Re-test Camera & Microphone Hardware</span>
        </button>
      </div>

      {/* Rules & Guidelines */}
      <div className="bg-zinc-50 p-4 rounded border border-zinc-200 space-y-2.5 text-xs">
        <h4 className="font-mono font-semibold text-zinc-700 uppercase tracking-wider text-[11px]">
          Proctoring Protocol Guidelines
        </h4>
        <ul className="text-zinc-600 space-y-1 list-disc list-inside">
          <li>Each question carries a strict <strong>60-second timer</strong> that auto-advances upon expiry.</li>
          <li>Tab switching, window unfocusing, and copy-pasting are monitored and logged in real-time.</li>
          <li>Screen sharing must remain enabled for the duration of the assessment.</li>
          <li>Ensure your environment is well-lit and free from external distractions.</li>
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
        disabled={!canProceed}
        onClick={handleCommence}
        className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 rounded transition flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
      >
        <span>Commence Technical Assessment</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

    </div>
  );
};
