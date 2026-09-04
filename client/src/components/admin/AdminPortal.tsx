import React, { useEffect, useState } from 'react';
import { 
  Building2, Users, FileText, Database, ShieldCheck, Mail, Plus, CheckCircle, ChevronDown, ChevronRight, Sparkles, Network
} from 'lucide-react';
import { AiQuestionGeneratorModal } from './AiQuestionGeneratorModal';
import { EnterpriseWebhooksModal } from '../recruiter/EnterpriseWebhooksModal';

export const AdminPortal: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'METRICS' | 'QUESTION_BANK' | 'AUDIT_LOGS' | 'EMAIL_LOGS'>('METRICS');

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
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin System Console</h1>
          <p className="text-xs text-slate-400 mt-1">Manage Companies, Question Banks, Global Settings & System Logs</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-purple-600/20"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Question Generator</span>
          </button>

          <button
            onClick={() => setIsWebhooksModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            <Network className="h-4 w-4 text-blue-400" />
            <span>ATS Webhooks</span>
          </button>

          {/* Sub Navigation */}
          <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            {[
              { id: 'METRICS', label: 'Platform Metrics', icon: Database },
              { id: 'QUESTION_BANK', label: 'Question Bank', icon: FileText },
              { id: 'AUDIT_LOGS', label: 'Audit Logs', icon: ShieldCheck },
              { id: 'EMAIL_LOGS', label: 'Email Logs', icon: Mail },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* METRICS TAB */}
      {activeTab === 'METRICS' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Companies</span>
              <Building2 className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">{stats.totalCompanies}</div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">{stats.totalUsers}</div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Assessment Templates</span>
              <FileText className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">{stats.totalTemplates}</div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Platform Pass Rate</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">{stats.passRate}%</div>
          </div>
        </div>
      )}

      {/* QUESTION BANK TAB */}
      {activeTab === 'QUESTION_BANK' && (
        <div className="space-y-6">
          
          {/* Add Question Card */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Plus className="h-4 w-4 text-blue-400" />
              <span>Add Question (MCQ or Practical Coding Challenge)</span>
            </h3>

            <form onSubmit={handleAddQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Section</label>
                  <select
                    required
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Section...</option>
                    {templates.flatMap(t => t.sections.map((s: any) => (
                      <option key={s.id} value={s.id}>{t.title} &rarr; {s.title}</option>
                    )))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Question Type</label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="MCQ_SINGLE">MCQ Single Choice</option>
                    <option value="MCQ_MULTI">MCQ Multiple Choice</option>
                    <option value="CODING">Practical Coding Challenge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Difficulty Level</label>
                  <select
                    value={newQuestion.difficulty}
                    onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Question Prompt</label>
                <input
                  type="text"
                  required
                  placeholder={newQuestion.type === 'CODING' ? 'e.g. Write a function solution(a, b) that returns sum...' : 'e.g. Which command is used to...'}
                  value={newQuestion.prompt}
                  onChange={(e) => setNewQuestion({ ...newQuestion, prompt: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* MCQ Options vs CODING Code Template */}
              {newQuestion.type === 'CODING' ? (
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Starter JavaScript Code Template</label>
                    <textarea
                      rows={4}
                      placeholder="function solution(a, b) {&#10;  // Write your code here&#10;}"
                      value={newQuestion.explanation} // Using explanation field for template state
                      onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-emerald-300 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
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
                        placeholder={`Option ${idx + 1} ${idx === newQuestion.correctIndex ? '(Correct Answer)' : ''}`}
                        value={(newQuestion as any)[optKey]}
                        onChange={(e) => setNewQuestion({ ...newQuestion, [optKey]: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-lg shadow-blue-600/20"
                >
                  Save Question to Bank
                </button>
              </div>
            </form>
          </div>

          {/* Templates Display */}
          <div className="space-y-4">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-base">{tmpl.title}</h4>
                  <span className="text-xs bg-blue-500/10 text-blue-400 font-semibold px-2.5 py-1 rounded border border-blue-500/20">
                    {tmpl.roleCategory}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {tmpl.sections.map((sec: any) => (
                    <div key={sec.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="font-bold text-slate-200 flex justify-between">
                        <span>{sec.title}</span>
                        <span className="text-slate-400">{sec.questions.length} Questions</span>
                      </div>
                      <div className="space-y-1.5 text-slate-400">
                        {sec.questions.map((q: any) => (
                          <div key={q.id} className="pl-3 border-l-2 border-slate-800 text-slate-300">
                            • {q.prompt}
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
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">System Audit Trail</h3>
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-blue-400 mr-2">[{log.action}]</span>
                  <span className="text-slate-300">{log.details}</span>
                </div>
                <span className="text-slate-500 font-mono">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMAIL LOGS TAB */}
      {activeTab === 'EMAIL_LOGS' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Sent Email Dispatch Logs</h3>
          <div className="space-y-2">
            {emailLogs.map(log => (
              <div key={log.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-emerald-400">To: {log.recipientEmail}</span>
                  <span className="text-slate-500 font-mono">{new Date(log.sentAt).toLocaleString()}</span>
                </div>
                <div className="text-slate-300 font-semibold">{log.subject}</div>
                <div className="text-slate-400 whitespace-pre-line text-[11px] font-mono bg-slate-900 p-2 rounded border border-slate-800/80">
                  {log.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Question Generator Modal */}
      <AiQuestionGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        sections={templates.flatMap(t => t.sections.map((s: any) => ({ ...s, template: t })))}
        onSuccess={fetchData}
      />

      {/* Enterprise ATS Webhooks Modal */}
      <EnterpriseWebhooksModal
        isOpen={isWebhooksModalOpen}
        onClose={() => setIsWebhooksModalOpen(false)}
      />

    </div>
  );
};
