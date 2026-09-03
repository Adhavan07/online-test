import React, { useState } from 'react';
import { Play, RotateCcw, CheckCircle2, XCircle, Code2, Terminal, Sparkles } from 'lucide-react';

interface TestCase {
  description: string;
  input: string;
}

interface TestResult {
  testCaseIndex: number;
  description: string;
  passed: boolean;
  actual: string;
  expected: string;
}

interface CodeEditorWidgetProps {
  questionId: string;
  initialCode: string;
  sampleTestCases: TestCase[];
  onCodeChange: (code: string) => void;
}

export const CodeEditorWidget: React.FC<CodeEditorWidgetProps> = ({
  questionId,
  initialCode,
  sampleTestCases,
  onCodeChange,
}) => {
  const [code, setCode] = useState<string>(initialCode || '// Write your JavaScript solution below\n');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'results'>('editor');
  const [passSummary, setPassSummary] = useState<{ passCount: number; totalCases: number } | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    onCodeChange(val);
  };

  const handleReset = () => {
    setCode(initialCode || '// Write your JavaScript solution below\n');
    onCodeChange(initialCode || '');
    setTestResults(null);
    setPassSummary(null);
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/assessment/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, code })
      });
      const data = await res.json();
      if (data.success && data.evalResult) {
        setTestResults(data.evalResult.testResults);
        setPassSummary({
          passCount: data.evalResult.passCount,
          totalCases: data.evalResult.totalCases,
        });
        setActiveTab('results');
      }
    } catch (err) {
      console.error('Code execution failed', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Line counter calculation
  const lines = code.split('\n');

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200">JavaScript Environment</span>
          <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50">
            ES6 / Node.js
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'editor'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Code Editor
          </button>
          
          <button
            onClick={() => setActiveTab('results')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'results'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Execution Output
            {passSummary && (
              <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                passSummary.passCount === passSummary.totalCases
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                  : 'bg-rose-950 text-rose-400 border border-rose-800/40'
              }`}>
                {passSummary.passCount}/{passSummary.totalCases}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            title="Reset code template"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs rounded-lg shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Test Cases'}
          </button>
        </div>
      </div>

      {/* Main Container Body */}
      <div className="flex-1 flex min-h-[340px] relative">
        {activeTab === 'editor' ? (
          <div className="flex flex-1 w-full bg-slate-950 font-mono text-sm">
            {/* Line Numbers */}
            <div className="py-3 px-2 bg-slate-950 border-r border-slate-800/60 text-slate-600 select-none text-right min-w-[2.5rem] text-xs">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">{i + 1}</div>
              ))}
            </div>

            {/* Code Input */}
            <textarea
              value={code}
              onChange={handleCodeChange}
              spellCheck={false}
              className="w-full h-full py-3 px-3 bg-transparent text-emerald-300 font-mono text-xs md:text-sm leading-6 resize-none focus:outline-none focus:ring-0 select-text"
              placeholder="// Write your code here..."
            />
          </div>
        ) : (
          /* Test Results Tab View */
          <div className="flex-1 p-4 bg-slate-950 overflow-y-auto space-y-4 text-xs">
            {sampleTestCases.length > 0 && (
              <div className="mb-4">
                <h4 className="text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Sample Test Cases Provided
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sampleTestCases.map((tc, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="font-semibold text-slate-300 mb-1">{tc.description}</div>
                      <div className="font-mono text-cyan-300 bg-slate-950 px-2 py-1 rounded text-[11px]">
                        Input: {tc.input}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h4 className="text-slate-300 font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Test Case Execution Breakdown
            </h4>

            {testResults ? (
              <div className="space-y-2.5">
                {testResults.map((tr) => (
                  <div
                    key={tr.testCaseIndex}
                    className={`p-3 rounded-lg border transition ${
                      tr.passed
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                        : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-medium">
                        {tr.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>{tr.description}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tr.passed ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
                      }`}>
                        {tr.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px] mt-2">
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-slate-500 block mb-0.5">Expected Output:</span>
                        <span className="text-emerald-300">{tr.expected}</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-slate-500 block mb-0.5">Actual Output:</span>
                        <span className={tr.passed ? 'text-emerald-300' : 'text-rose-400'}>
                          {tr.actual || '(empty)'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500">
                <Play className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
                Click "Run Test Cases" above to evaluate your JavaScript solution against hidden test criteria.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
