import React, { useEffect, useState } from 'react';
import { Network, X, Check, Loader2, Send, ShieldCheck, RefreshCw } from 'lucide-react';

interface EnterpriseWebhooksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnterpriseWebhooksModal: React.FC<EnterpriseWebhooksModalProps> = ({ isOpen, onClose }) => {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [name, setName] = useState('Workday HRIS Integration');
  const [secretKey, setSecretKey] = useState(`whsec_${Math.random().toString(36).substring(2, 12)}`);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      if (data.success) {
        setWebhooks(data.webhooks);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchWebhooks();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpointUrl) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          endpointUrl,
          secretKey,
          events: ['candidate.completed', 'assessment.passed', 'interview.scheduled'],
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchWebhooks();
        setEndpointUrl('');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestDispatch = async (webhookId?: string) => {
    setTestResult(null);
    try {
      const res = await fetch('/api/webhooks/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl space-y-5 p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Enterprise ATS & HRIS Webhooks</h3>
              <p className="text-xs text-slate-400">Configure event streams for Workday, Greenhouse & Lever</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Existing Webhooks List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Webhook Endpoints</h4>
          {loading ? (
            <p className="text-xs text-slate-400 italic">Loading configured endpoints...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-slate-950 p-3 rounded-xl border border-slate-800">No active webhooks configured yet.</p>
          ) : (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {webhooks.map((wh) => (
                <div key={wh.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white">{wh.name}</h5>
                    <p className="text-[11px] font-mono text-slate-400 truncate max-w-[280px]">{wh.endpointUrl}</p>
                  </div>
                  <button
                    onClick={() => handleTestDispatch(wh.id)}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold rounded-lg border border-blue-500/30 transition flex items-center space-x-1"
                  >
                    <Send className="h-3 w-3" />
                    <span>Test Dispatch</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Webhook Form */}
        <form onSubmit={handleCreate} className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Register New Endpoint</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1">Integration Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1">Secret Key</label>
              <input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1">Webhook Endpoint URL</label>
            <input
              type="url"
              placeholder="https://api.workday.com/webhooks/techscreen"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => handleTestDispatch()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
            >
              Test Mock Payload
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Save Webhook'}
            </button>
          </div>
        </form>

        {/* Test Result Log */}
        {testResult && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-emerald-400 font-bold">
              <span>{testResult.message || 'Dispatch Result'}</span>
              <span className="font-mono text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">HTTP 200 OK</span>
            </div>
            {testResult.deliveredPayload && (
              <pre className="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded max-h-[90px] overflow-auto">
                {JSON.stringify(testResult.deliveredPayload, null, 2)}
              </pre>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
