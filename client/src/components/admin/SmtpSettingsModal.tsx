import React, { useState, useEffect } from 'react';
import { X, Mail, Shield, Send, CheckCircle2, AlertCircle, Info, ExternalLink, KeyRound, Server } from 'lucide-react';

interface SmtpSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SmtpSettingsModal: React.FC<SmtpSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [provider, setProvider] = useState<'gmail' | 'smtp' | 'ethereal'>('gmail');
  const [gmailUser, setGmailUser] = useState('jojoasta381@gmail.com');
  const [gmailPass, setGmailPass] = useState('');
  
  // Custom SMTP fields
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('TechScreen Pro <no-reply@techscreen.io>');
  
  // Testing fields
  const [testEmailRecipient, setTestEmailRecipient] = useState('jojoasta381@gmail.com');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; previewUrl?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/admin/smtp-config');
      const data = await res.json();
      if (data.success && data.config) {
        if (data.config.service === 'gmail') {
          setProvider('gmail');
          if (data.config.user) setGmailUser(data.config.user);
        } else if (data.config.configured) {
          setProvider('smtp');
          if (data.config.host) setSmtpHost(data.config.host);
          if (data.config.port) setSmtpPort(data.config.port);
          if (data.config.user) setSmtpUser(data.config.user);
          if (data.config.from) setSmtpFrom(data.config.from);
        }
      }
    } catch {}
  };

  if (!isOpen) return null;

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    let payload: any = {};
    if (provider === 'gmail') {
      payload = {
        service: 'gmail',
        user: gmailUser,
        pass: gmailPass,
        from: `TechScreen Pro <${gmailUser}>`,
      };
    } else if (provider === 'smtp') {
      payload = {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom,
      };
    } else {
      payload = {}; // Ethereal fallback
    }

    try {
      const res = await fetch('/api/admin/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: data.message || 'SMTP settings verified and saved successfully!',
        });
        if (onConfigSaved) onConfigSaved();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || 'Verification failed. Please verify credentials.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTesting(true);
    setStatusMessage(null);

    // Save first if there are inputs
    if (gmailPass || smtpPass) {
      await handleSaveConfig();
    }

    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: testEmailRecipient }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Test email dispatched to ${testEmailRecipient} via ${data.transport}! Check your inbox.`,
          previewUrl: data.previewUrl,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to dispatch test email. Check SMTP credentials.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs select-none">
      <div className="bg-white border border-zinc-200 rounded max-w-xl w-full overflow-hidden shadow-2xl flex flex-col text-zinc-900 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded border border-blue-200/60">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">Live Email & SMTP Configuration</h3>
              <p className="text-xs text-zinc-500 font-mono">Deliver real invitations & OTP codes to inboxes</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded hover:bg-zinc-200 text-zinc-500 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-zinc-800">

          {/* Provider Selection Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 rounded border border-zinc-200">
            <button
              type="button"
              onClick={() => setProvider('gmail')}
              className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${provider === 'gmail' ? 'bg-white text-blue-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              <span>Gmail App Pass</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider('smtp')}
              className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${provider === 'smtp' ? 'bg-white text-blue-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              <span>Custom SMTP</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider('ethereal')}
              className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${provider === 'ethereal' ? 'bg-white text-blue-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              <span>Ethereal Dev Mode</span>
            </button>
          </div>

          {/* Form Content Based on Provider */}
          {provider === 'gmail' && (
            <div className="space-y-4 bg-zinc-50 p-4 rounded border border-zinc-200">
              <div className="flex items-start space-x-2 bg-blue-50/70 text-blue-900 p-3 rounded border border-blue-200/60 text-[11px] leading-relaxed">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>How to use Gmail for instant delivery:</strong>
                  <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-blue-800">
                    <li>Open Google Account &rarr; Security &rarr; Enable <strong>2-Step Verification</strong></li>
                    <li>Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-semibold text-blue-900">Google App Passwords <ExternalLink className="h-2.5 w-2.5 inline" /></a></li>
                    <li>Create an App named <strong>"TechScreen"</strong> and copy the 16-character passcode</li>
                  </ol>
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Your Gmail Address</label>
                <input
                  type="email"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="e.g. jojoasta381@gmail.com"
                  className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">16-Character Gmail App Password</label>
                <div className="relative">
                  <KeyRound className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="password"
                    value={gmailPass}
                    onChange={(e) => setGmailPass(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full bg-white border border-zinc-300 rounded pl-9 pr-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {provider === 'smtp' && (
            <div className="space-y-3 bg-zinc-50 p-4 rounded border border-zinc-200">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-zinc-700 block mb-1">SMTP Server Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.sendgrid.net or smtp.gmail.com"
                    className="w-full bg-white border border-zinc-300 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-full bg-white border border-zinc-300 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Username / API Key</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-white border border-zinc-300 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Password / Secret</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-zinc-300 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Sender "From" Name & Address</label>
                <input
                  type="text"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder='"TechScreen Pro" <recruiting@yourcompany.com>'
                  className="w-full bg-white border border-zinc-300 rounded px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {provider === 'ethereal' && (
            <div className="bg-zinc-50 p-4 rounded border border-zinc-200 text-xs space-y-2">
              <p className="font-medium text-zinc-800">
                Ethereal Sandbox Mode:
              </p>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Generates instant live web preview URLs for every email. Great for testing without entering any credentials, though emails will not arrive in real Gmail inboxes.
              </p>
            </div>
          )}

          {/* Test Dispatch Box */}
          <div className="border border-blue-200 bg-blue-50/40 rounded p-4 space-y-2.5">
            <label className="font-bold text-zinc-900 block text-xs">
              Live Test Dispatcher
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter email to receive test message"
                className="flex-1 bg-white border border-zinc-300 rounded px-3 py-2 text-xs font-mono text-zinc-900"
              />
              <button
                type="button"
                disabled={testing || !testEmailRecipient}
                onClick={handleSendTestEmail}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded text-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Sending...' : 'Send Test Email'}</span>
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`p-3 rounded border text-xs flex items-start space-x-2 ${statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />}
              <div className="flex-1">
                <p className="font-medium">{statusMessage.text}</p>
                {statusMessage.previewUrl && (
                  <a href={statusMessage.previewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold text-[11px] block mt-1">
                    Open Ethereal Email Preview &rarr;
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">Credentials encrypted in database</span>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-xs font-medium rounded transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveConfig()}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
