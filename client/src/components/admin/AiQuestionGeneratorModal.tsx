import React, { useState } from 'react';
import { Sparkles, X, Check, Loader2 } from 'lucide-react';

interface AiQuestionGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: any[];
  onSuccess: () => void;
}

export const AiQuestionGeneratorModal: React.FC<AiQuestionGeneratorModalProps> = ({
  isOpen,
  onClose,
  sections,
  onSuccess,
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || '');
  const [topic, setTopic] = useState<string>('Async JavaScript & Event Loop');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [questionType, setQuestionType] = useState<'MCQ_SINGLE' | 'CODING'>('MCQ_SINGLE');
  const [count, setCount] = useState<number>(2);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId) {
      setError('Please select an assessment section');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/ai-generator/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          topic,
          difficulty,
          questionType,
          count,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(data.error || 'Failed to generate AI questions');
      }
    } catch (err: any) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-zinc-200 rounded-md max-w-lg w-full overflow-hidden shadow-lg p-6 space-y-4 text-zinc-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <div>
              <h3 className="font-bold text-zinc-900 text-sm">AI Question & Challenge Generator</h3>
              <p className="text-xs text-zinc-500">Automated MCQ & practical code challenge synthesis</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:bg-zinc-200 p-1 rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center space-x-2">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          
          <div>
            <label className="block text-zinc-700 font-semibold mb-1">Target Template Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.title} ({sec.template?.title || 'Section'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-700 font-semibold mb-1">AI Topic / Technical Domain</label>
            <input
              type="text"
              placeholder="e.g. React Custom Hooks, System Architecture, SQL Indexing"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e: any) => setDifficulty(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 font-mono"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Question Type</label>
              <select
                value={questionType}
                onChange={(e: any) => setQuestionType(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 font-mono"
              >
                <option value="MCQ_SINGLE">MCQ Single Choice</option>
                <option value="CODING">Practical Coding</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-700 font-semibold mb-1">Questions Count: <strong className="font-mono text-zinc-900">{count}</strong></label>
            <input
              type="range"
              min={1}
              max={5}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-zinc-900"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Generate Questions</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
