import React, { useState, useEffect } from 'react';
import { X, Briefcase, Plus } from 'lucide-react';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates?: Array<{ id: string; title: string }>;
  onJobCreated?: () => void;
  onSuccess?: () => void;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onClose,
  templates: externalTemplates,
  onJobCreated,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [experienceRange, setExperienceRange] = useState('0–2 years');
  const [location, setLocation] = useState('Chennai / Remote');
  const [skills, setSkills] = useState('Git, Linux, Docker, AWS, CI/CD');
  const [description, setDescription] = useState('');
  const [passThreshold, setPassThreshold] = useState(70);
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<any[]>(externalTemplates || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!externalTemplates && isOpen) {
      fetch('/api/templates')
        .then(r => r.json())
        .then(data => {
          if (data.success) setTemplates(data.templates);
        })
        .catch(console.error);
    }
  }, [isOpen, externalTemplates]);

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
        if (onJobCreated) onJobCreated();
        if (onSuccess) onSuccess();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs select-none">
      <div className="bg-white border border-zinc-200 rounded-md max-w-xl w-full overflow-hidden shadow-lg text-zinc-900">
        
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-2">
            <Briefcase className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-zinc-900 text-sm">Create New Job Opening</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-200 text-zinc-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Job Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Cloud DevOps Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Experience Required</label>
              <input
                type="text"
                placeholder="e.g. 0–2 years"
                value={experienceRange}
                onChange={(e) => setExperienceRange(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Location</label>
              <input
                type="text"
                placeholder="e.g. Chennai / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Required Skills (Comma separated)</label>
            <input
              type="text"
              placeholder="Git, Linux, Docker, AWS, Kubernetes"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Assessment Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400"
              >
                <option value="">Standard Technical Assessment</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Pass Threshold (%)</label>
              <input
                type="number"
                min="50"
                max="100"
                value={passThreshold}
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Job Description</label>
            <textarea
              rows={3}
              placeholder="Brief description of role expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-zinc-900 focus:border-zinc-400 resize-none"
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
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{loading ? 'Creating...' : 'Create Job Position'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
