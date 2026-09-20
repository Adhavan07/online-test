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
  executionTimeMs?: number;
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
  const [language, setLanguage] = useState<'javascript' | 'python' | 'typescript'>('javascript');
  const [code, setCode] = useState<string>(initialCode || '// Write your JavaScript solution below\n');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'results'>('editor');
  const [passSummary, setPassSummary] = useState<{ passCount: number; totalCases: number } | null>(null);

  const handleLanguageChange = (newLang: 'javascript' | 'python' | 'typescript') => {
    setLanguage(newLang);
    if (!code || code.trim().length === 0 || code.includes('// Write your') || code.includes('# Write your')) {
      let defaultTemplate = '// Write your JavaScript solution below\nfunction solution(input) {\n  return input;\n}\n';
      if (newLang === 'python') {
        defaultTemplate = '# Write your Python 3 solution below\ndef solution(input):\n    return input\n';
      } else if (newLang === 'typescript') {
        defaultTemplate = '// Write your TypeScript solution below\nfunction solution(input: any): any {\n  return input;\n}\n';
      }
      setCode(defaultTemplate);
      onCodeChange(defaultTemplate);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    onCodeChange(val);
  };

  const handleReset = () => {
    let resetVal = initialCode || '// Write your JavaScript solution below\n';
    if (language === 'python') {
      resetVal = '# Write your Python 3 solution below\ndef solution(input):\n    return input\n';
    }
    setCode(resetVal);
    onCodeChange(resetVal);
    setTestResults(null);
    setPassSummary(null);
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/assessment/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, code, language })
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
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded overflow-hidden shadow-xs">
      
      {/* Editor Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-zinc-50 border-b border-zinc-200 gap-2 select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-zinc-600" />
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded p-0.5">
            <button
              onClick={() => handleLanguageChange('javascript')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition ${
                language === 'javascript' ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              JavaScript
            </button>
            <button
              onClick={() => handleLanguageChange('python')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition ${
                language === 'python' ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Python 3
            </button>
          </div>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Isolated Sandbox
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition ${
              activeTab === 'editor'
                ? 'bg-white text-zinc-900 font-semibold border border-zinc-200 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Code Editor
          </button>
          
          <button
            onClick={() => setActiveTab('results')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'results'
                ? 'bg-white text-zinc-900 font-semibold border border-zinc-200 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Execution Output</span>
            {passSummary && (
              <span className={`ml-1 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold border ${
                passSummary.passCount === passSummary.totalCases
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
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
            className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded transition disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
            <span>{isRunning ? 'Running...' : 'Run Tests'}</span>
          </button>
        </div>
      </div>

      {/* Main Container Body */}
      <div className="flex-1 flex min-h-[340px] relative">
        {activeTab === 'editor' ? (
          <div className="flex flex-1 w-full bg-[#18181B] font-mono text-xs md:text-sm">
            {/* Line Numbers */}
            <div className="py-3 px-2 bg-[#18181B] border-r border-zinc-800 text-zinc-500 select-none text-right min-w-[2.5rem] text-xs font-mono">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">{i + 1}</div>
              ))}
            </div>

            {/* Code Input */}
            <textarea
              value={code}
              onChange={handleCodeChange}
              spellCheck={false}
              className="w-full h-full py-3 px-3 bg-transparent text-zinc-100 font-mono text-xs md:text-sm leading-6 resize-none focus:outline-none focus:ring-0 select-text"
              placeholder="// Write your code solution here..."
            />
          </div>
        ) : (
          /* Test Results Tab View */
          <div className="flex-1 p-4 bg-zinc-50 overflow-y-auto space-y-4 text-xs select-none">
            {sampleTestCases.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-zinc-600 font-semibold font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                  Sample Test Criteria
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sampleTestCases.map((tc, idx) => (
                    <div key={idx} className="p-2.5 bg-white border border-zinc-200 rounded">
                      <div className="font-semibold text-zinc-900 mb-1">{tc.description}</div>
                      <div className="font-mono text-zinc-700 bg-zinc-50 px-2 py-1 rounded text-[11px] border border-zinc-200/80">
                        Input: {tc.input}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h4 className="text-zinc-700 font-semibold font-mono text-[11px] uppercase tracking-wider flex items-center gap-2 pt-2 border-t border-zinc-200">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              Test Execution Breakdown
            </h4>

            {testResults ? (
              <div className="space-y-2">
                {testResults.map((tr) => (
                  <div
                    key={tr.testCaseIndex}
                    className={`p-3 rounded border transition ${
                      tr.passed
                        ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/40 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-medium">
                        {tr.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-semibold">{tr.description}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {tr.executionTimeMs !== undefined && (
                          <span className="text-[10px] font-mono text-zinc-400">
                            {tr.executionTimeMs}ms
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase border ${
                          tr.passed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {tr.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px] mt-2">
                      <div className="bg-white p-2 rounded border border-zinc-200">
                        <span className="text-zinc-400 block text-[10px] uppercase mb-0.5">Expected Output:</span>
                        <span className="text-zinc-900 font-bold">{tr.expected}</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-zinc-200">
                        <span className="text-zinc-400 block text-[10px] uppercase mb-0.5">Actual Output:</span>
                        <span className={tr.passed ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {tr.actual || '(empty)'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-500 font-mono text-xs">
                <Play className="w-6 h-6 mx-auto mb-2 text-zinc-400" />
                Click "Run Tests" to evaluate your solution against test cases.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

