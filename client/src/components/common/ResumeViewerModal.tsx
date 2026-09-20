import React from 'react';
import { X, FileText, Download, CheckCircle, Briefcase, GraduationCap, Award } from 'lucide-react';

interface ResumeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateEmail: string;
  resumeFileName?: string | null;
  fileName?: string | null;
  resumeUrl?: string | null;
}

export const ResumeViewerModal: React.FC<ResumeViewerModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  candidateEmail,
  resumeFileName,
  fileName,
  resumeUrl,
}) => {
  if (!isOpen) return null;
  const activeFileName = resumeFileName || fileName || 'Candidate_Resume.pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs select-none">
      <div className="bg-white border border-zinc-200 rounded max-w-3xl w-full overflow-hidden shadow-lg flex flex-col max-h-[90vh] text-zinc-900">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded border border-blue-200/60">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">{candidateName} – Resume Record</h3>
              <p className="text-xs text-zinc-500 font-mono">{resumeFileName || 'arun_kumar_devops.pdf'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {resumeUrl && (
              <a
                href={resumeUrl}
                download
                className="flex items-center space-x-1.5 text-xs bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded border border-zinc-200 transition font-medium"
              >
                <Download className="h-3.5 w-3.5 text-zinc-500" />
                <span>Download</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-200 text-zinc-500 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Content - Structured Professional Resume Preview */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-zinc-800">
          
          <div className="p-4 bg-zinc-50 rounded border border-zinc-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900">{candidateName}</h2>
              <p className="text-xs text-zinc-600 font-mono mt-0.5">{candidateEmail} &bull; DevOps & Cloud Infrastructure</p>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-medium font-mono">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Verified Resume Record</span>
            </div>
          </div>

          {/* Section: Executive Summary */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 font-mono">
              <Briefcase className="h-3.5 w-3.5 text-zinc-400" /> Executive Summary
            </h4>
            <p className="bg-zinc-50/70 p-3.5 rounded border border-zinc-200 text-zinc-700 leading-relaxed">
              Highly passionate software engineer with hands-on expertise in Git version control, Linux systems administration, Docker containerization, and AWS deployment pipelines. Proven track record in configuring automated CI/CD workflows and managing cloud infrastructure.
            </p>
          </div>

          {/* Section: Technical Core Competencies */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 font-mono">
              <Award className="h-3.5 w-3.5 text-zinc-400" /> Key Technical Skills
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['Git & GitHub Actions', 'Linux (Ubuntu/RHEL)', 'Docker & Compose', 'Kubernetes Basics', 'AWS (EC2, S3, IAM)', 'Terraform & IaC', 'CI/CD Pipelines', 'Shell Scripting', 'PostgreSQL / SQL'].map((skill, idx) => (
                <div key={idx} className="bg-white border border-zinc-200 rounded px-2.5 py-1.5 text-xs text-zinc-800 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span className="font-mono text-[11px]">{skill}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Work Experience */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 font-mono">
              <GraduationCap className="h-3.5 w-3.5 text-zinc-400" /> Education & Certifications
            </h4>
            <div className="space-y-2">
              <div className="p-3 bg-white rounded border border-zinc-200">
                <div className="flex justify-between font-semibold text-zinc-900 text-xs">
                  <span>B.E. Computer Science & Engineering</span>
                  <span className="text-zinc-500 font-mono">2020 – 2024</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">First Class with Distinction &bull; CGPA: 8.7/10</p>
              </div>
              <div className="p-3 bg-white rounded border border-zinc-200 flex justify-between items-center">
                <span className="font-semibold text-zinc-900 text-xs">AWS Certified Solutions Architect – Associate</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono text-[10px] font-bold">Active</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded transition"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
};

