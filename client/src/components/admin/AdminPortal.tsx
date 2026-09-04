import React, { useEffect, useState } from 'react';
import { 
  Building2, Users, FileText, Database, ShieldCheck, Mail, Plus, CheckCircle, Sparkles, Network
} from 'lucide-react';
import { AiQuestionGeneratorModal } from './AiQuestionGeneratorModal';
import { EnterpriseWebhooksModal } from '../recruiter/EnterpriseWebhooksModal';

interface AdminPortalProps {
  initialTab?: 'METRICS' | 'QUESTION_BANK' | 'AUDIT_LOGS' | 'EMAIL_LOGS';
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ initialTab = 'METRICS' }) => {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'METRICS' | 'QUESTION_BANK' | 'AUDIT_LOGS' | 'EMAIL_LOGS'>(initialTab);

  // Modals state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isWebhooksModalOpen, setIsWebhooksModalOpen] = useState(false);

  // Add Question Modal state
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [newQuestion, setNewQuestion] = useState({
    prompt: '',
    type: 'MCQ_SINGLE',
    difficulty: 'MEDIUM',
    explanation: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correctIndex: 0,
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, auditRes, emailRes, tmplRes] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/audit-logs').then(r => r.json()),
        fetch('/api/admin/email-logs').then(r => r.json()),
        fetch('/api/templates').then(r => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (auditRes.success) setAuditLogs(auditRes.logs);
      if (emailRes.success) setEmailLogs(emailRes.logs);
      if (tmplRes.success) setTemplates(tmplRes.templates);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId) return alert('Select section first');

    try {
      const options = [
        { text: newQuestion.option1, isCorrect: newQuestion.correctIndex === 0 },
        { text: newQuestion.option2, isCorrect: newQuestion.correctIndex === 1 },
        { text: newQuestion.option3, isCorrect: newQuestion.correctIndex === 2 },
        { text: newQuestion.option4, isCorrect: newQuestion.correctIndex === 3 },
      ].filter(o => o.text.trim());

      const res = await fetch('/api/templates/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          prompt: newQuestion.prompt,
          type: newQuestion.type,
          difficulty: newQuestion.difficulty,
          explanation: newQuestion.explanation,
          options,
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Question added to Question Bank!');
        setNewQuestion({
          prompt: '',
          type: 'MCQ_SINGLE',
          difficulty: 'MEDIUM',
          explanation: '',
          option1: '',
          option2: '',
          option3: '',
          option4: '',
          correctIndex: 0,
        });
        fetchData();
      }
    } catch (err: any) {
      alert('Error adding question: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 select-none">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-0.5">
            System &bull; Admin Console
          </div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            System Administration & Question Bank
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Manage assessment templates, AI prompt generators, ATS integrations, and audit logs.
          </p>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded transition"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>AI Question Generator</span>
          </button>

          <button
            onClick={() => setIsWebhooksModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded border border-zinc-200 transition"
          >
            <Network className="h-3.5 w-3.5 text-blue-600" />
            <span>ATS Webhooks</span>
          </button>

          {/* Sub Navigation */}
          <div className="flex items-center space-x-1 bg-zinc-100 p-1 rounded border border-zinc-200">
            {[
              { id: 'METRICS', label: 'Metrics', icon: Database },
              { id: 'QUESTION_BANK', label: 'Question Bank', icon: FileText },
              { id: 'AUDIT_LOGS', label: 'Audit Logs', icon: ShieldCheck },
              { id: 'EMAIL_LOGS', label: 'Email Logs', icon: Mail },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-white text-zinc-900 font-semibold border border-zinc-200/80 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* METRICS TAB */}
      {activeTab === 'METRICS' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded border border-zinc-200 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
          <div className="px-3 py-1">
            <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Registered Companies</div>
            <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{stats.totalCompanies}</div>
          </div>

          <div className="px-3 py-1 pt-3 lg:pt-1">
            <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Total Platform Users</div>
            <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{stats.totalUsers}</div>
          </div>

          <div className="px-3 py-1 pt-3 lg:pt-1">
            <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Assessment Templates</div>
            <div className="text-2xl font-bold text-zinc-900 mt-1 font-mono">{stats.totalTemplates}</div>
          </div>

          <div className="px-3 py-1 pt-3 lg:pt-1">
            <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Platform Pass Rate</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{stats.passRate}%</div>
          </div>
        </div>
      )}

      {/* QUESTION BANK TAB */}
      {activeTab === 'QUESTION_BANK' && (
        <div className="space-y-6">
          
          {/* Add Question Card */}
          <div className="bg-white p-5 rounded border border-zinc-200 space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 font-mono uppercase tracking-wider">
              + Manual Question & Coding Challenge Creation
            </h3>

            <form onSubmit={handleAddQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Target Section</label>
                  <select
                    required
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
                  >
                    <option value="">Select Section...</option>
                    {templates.flatMap(t => t.sections.map((s: any) => (
                      <option key={s.id} value={s.id}>{t.title} &rarr; {s.title}</option>
                    )))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Question Type</label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
                  >
                    <option value="MCQ_SINGLE">MCQ Single Choice</option>
                    <option value="MCQ_MULTI">MCQ Multiple Choice</option>
                    <option value="CODING">Practical Coding Challenge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Difficulty Level</label>
                  <select
                    value={newQuestion.difficulty}
                    onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 font-mono"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Question Prompt</label>
                <input
                  type="text"
                  required
                  placeholder={newQuestion.type === 'CODING' ? 'e.g. Write a function solution(a, b) that returns sum...' : 'e.g. Which command is used to...'}
                  value={newQuestion.prompt}
                  onChange={(e) => setNewQuestion({ ...newQuestion, prompt: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
                />
              </div>

              {newQuestion.type === 'CODING' ? (
                <div className="space-y-2 bg-zinc-50 p-3 rounded border border-zinc-200">
                  <label className="block text-zinc-700 font-semibold">Starter Code Template</label>
                  <textarea
                    rows={4}
                    placeholder="function solution(a, b) {&#10;  // Write your solution code here&#10;}"
                    value={newQuestion.explanation}
                    onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 font-mono text-emerald-400 text-xs focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {['option1', 'option2', 'option3', 'option4'].map((optKey, idx) => (
                    <div key={optKey} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="correctIdx"
                        checked={newQuestion.correctIndex === idx}
                        onChange={() => setNewQuestion({ ...newQuestion, correctIndex: idx })}
                      />
                      <input
                        type="text"
                        required
                        placeholder={`Option ${idx + 1}`}
                        value={(newQuestion as any)[optKey]}
                        onChange={(e) => setNewQuestion({ ...newQuestion, [optKey]: e.target.value })}
                        className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded transition"
                >
                  Save Question to Template
                </button>
              </div>
            </form>
          </div>

          {/* Templates Display */}
          <div className="space-y-4">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="bg-white p-5 rounded border border-zinc-200 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                  <h4 className="font-bold text-zinc-900 text-sm">{tmpl.title}</h4>
                  <span className="text-[11px] font-mono bg-zinc-100 text-zinc-700 font-semibold px-2 py-0.5 rounded border border-zinc-200">
                    {tmpl.roleCategory}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {tmpl.sections.map((sec: any) => (
                    <div key={sec.id} className="bg-zinc-50 p-3.5 rounded border border-zinc-200 space-y-2">
                      <div className="font-semibold text-zinc-800 flex justify-between font-mono">
                        <span>{sec.title}</span>
                        <span className="text-zinc-500">{sec.questions.length} Questions</span>
                      </div>
                      <div className="space-y-1 text-zinc-600">
                        {sec.questions.map((q: any) => (
                          <div key={q.id} className="pl-2 border-l-2 border-zinc-300">
                            &bull; {q.prompt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="bg-white rounded border border-zinc-200 p-5 space-y-3">
          <h3 className="font-bold text-zinc-900 text-sm font-mono uppercase tracking-wider">System Audit Trail</h3>
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 bg-zinc-50 rounded border border-zinc-200 text-xs flex justify-between items-center">
                <div>
                  <span className="font-mono font-bold text-blue-700 mr-2">[{log.action}]</span>
                  <span className="text-zinc-700">{log.details}</span>
                </div>
                <span className="text-zinc-400 font-mono text-[11px]">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMAIL LOGS TAB */}
      {activeTab === 'EMAIL_LOGS' && (
        <div className="bg-white rounded border border-zinc-200 p-5 space-y-3">
          <h3 className="font-bold text-zinc-900 text-sm font-mono uppercase tracking-wider">Sent Email Dispatch Logs</h3>
          <div className="space-y-2">
            {emailLogs.map(log => (
              <div key={log.id} className="p-3.5 bg-zinc-50 rounded border border-zinc-200 text-xs space-y-1">
                <div className="flex justify-between font-mono font-bold">
                  <span className="text-emerald-800">To: {log.recipientEmail}</span>
                  <span className="text-zinc-400 text-[11px]">{new Date(log.sentAt).toLocaleString()}</span>
                </div>
                <div className="text-zinc-900 font-semibold">{log.subject}</div>
                <div className="text-zinc-600 whitespace-pre-line text-[11px] font-mono bg-white p-2.5 rounded border border-zinc-200">
                  {log.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <AiQuestionGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        sections={templates.flatMap(t => t.sections.map((s: any) => ({ ...s, template: t })))}
        onSuccess={fetchData}
      />

      <EnterpriseWebhooksModal
        isOpen={isWebhooksModalOpen}
        onClose={() => setIsWebhooksModalOpen(false)}
      />

    </div>
  );
};
