import React, { useEffect, useState } from 'react';
import { Network, X, Send } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-zinc-200 rounded-md max-w-xl w-full overflow-hidden shadow-lg space-y-4 p-6 relative text-zinc-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center space-x-2">
            <Network className="h-4 w-4 text-blue-600" />
            <div>
              <h3 className="font-bold text-zinc-900 text-sm">Enterprise ATS & HRIS Webhooks</h3>
              <p className="text-xs text-zinc-500">Configure event streams for Workday, Greenhouse & Lever</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:bg-zinc-200 p-1 rounded transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Existing Webhooks List */}
        <div className="space-y-2 text-xs">
          <h4 className="font-mono font-semibold text-zinc-500 uppercase text-[10px]">Active Webhook Endpoints</h4>
          {loading ? (
            <p className="text-zinc-500 font-mono">Loading configured endpoints...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-zinc-500 bg-zinc-50 p-2.5 rounded border border-zinc-200">No active webhooks configured yet.</p>
          ) : (
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {webhooks.map((wh) => (
                <div key={wh.id} className="bg-zinc-50 p-2.5 rounded border border-zinc-200 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-zinc-900">{wh.name}</h5>
                    <p className="font-mono text-[11px] text-zinc-500 truncate max-w-[280px]">{wh.endpointUrl}</p>
                  </div>
                  <button
                    onClick={() => handleTestDispatch(wh.id)}
                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-medium rounded transition flex items-center space-x-1"
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
        <form onSubmit={handleCreate} className="space-y-3 pt-2 border-t border-zinc-200 text-xs">
          <h4 className="font-mono font-semibold text-zinc-500 uppercase text-[10px]">Register New Endpoint</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Integration Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-2.5 py-1.5 text-zinc-900 focus:border-zinc-400"
                required
              />
            </div>
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Secret Key</label>
              <input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-2.5 py-1.5 font-mono text-zinc-800 focus:border-zinc-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-700 font-semibold mb-1">Webhook Endpoint URL</label>
            <input
              type="url"
              placeholder="https://api.workday.com/webhooks/techscreen"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-2.5 py-1.5 text-zinc-900 focus:border-zinc-400"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => handleTestDispatch()}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded"
            >
              Test Payload
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded transition disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Save Webhook'}
            </button>
          </div>
        </form>

        {/* Test Result Log */}
        {testResult && (
          <div className="bg-zinc-50 p-2.5 rounded border border-zinc-200 text-xs space-y-1">
            <div className="flex justify-between items-center text-emerald-800 font-bold font-mono">
              <span>{testResult.message || 'Dispatch Result'}</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">HTTP 200 OK</span>
            </div>
            {testResult.deliveredPayload && (
              <pre className="text-[10px] font-mono text-zinc-800 bg-zinc-900 text-emerald-400 p-2 rounded max-h-[80px] overflow-auto">
                {JSON.stringify(testResult.deliveredPayload, null, 2)}
              </pre>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
