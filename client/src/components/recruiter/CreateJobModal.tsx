import React, { useState } from 'react';
import { X, Briefcase, Plus } from 'lucide-react';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Array<{ id: string; title: string }>;
  onJobCreated: () => void;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onClose,
  templates,
  onJobCreated,
}) => {
  const [title, setTitle] = useState('');
  const [experienceRange, setExperienceRange] = useState('0–2 years');
  const [location, setLocation] = useState('Chennai / Remote');
  const [skills, setSkills] = useState('Git, Linux, Docker, AWS, CI/CD');
  const [description, setDescription] = useState('');
  const [passThreshold, setPassThreshold] = useState(70);
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const skillsRequired = skills.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          experienceRange,
          location,
          skillsRequired,
          description,
          passThreshold,
          assessmentTemplateId: templateId || undefined,
        })
      });

      const data = await res.json();
      if (data.success) {
        onJobCreated();
        onClose();
      } else {
        alert('Error creating job: ' + data.error);
      }
    } catch (err: any) {
      alert('Error creating job: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl">
        
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Create New Job Opening</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Job Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Cloud DevOps Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Experience Required</label>
              <input
                type="text"
                placeholder="e.g. 0–2 years"
                value={experienceRange}
                onChange={(e) => setExperienceRange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Location</label>
              <input
                type="text"
                placeholder="e.g. Chennai / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Required Skills (Comma separated)</label>
            <input
              type="text"
              placeholder="Git, Linux, Docker, AWS, Kubernetes"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assessment Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Pass Threshold (%)</label>
              <input
                type="number"
                min="50"
                max="100"
                value={passThreshold}
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Job Description</label>
            <textarea
              rows={3}
              placeholder="Brief description of expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{loading ? 'Creating...' : 'Create Job Opening'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
