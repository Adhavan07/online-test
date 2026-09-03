import React from 'react';
import { X, FileText, Download, CheckCircle, Briefcase, GraduationCap, Award } from 'lucide-react';

interface ResumeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateEmail: string;
  resumeFileName?: string | null;
  resumeUrl?: string | null;
}

export const ResumeViewerModal: React.FC<ResumeViewerModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  candidateEmail,
  resumeFileName,
  resumeUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{candidateName} – Resume</h3>
              <p className="text-xs text-slate-400">{resumeFileName || 'arun_kumar_devops.pdf'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {resumeUrl && (
              <a
                href={resumeUrl}
                download
                className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content - Structured Professional Resume Preview */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-sm">
          
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">{candidateName}</h2>
              <p className="text-xs text-blue-400 font-medium">{candidateEmail} • DevOps & Cloud Infrastructure Specialist</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Verified Resume Upload</span>
            </div>
          </div>

          {/* Section: Executive Summary */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-400" /> Executive Summary
            </h4>
            <p className="bg-slate-800/20 p-3.5 rounded-lg border border-slate-800 text-slate-300 leading-relaxed">
              Highly passionate software engineer with hands-on expertise in Git version control, Linux systems administration, Docker containerization, and AWS deployment pipelines. Proven track record in configuring automated CI/CD workflows and managing cloud infrastructure.
            </p>
          </div>

          {/* Section: Technical Core Competencies */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-400" /> Key Technical Skills
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {['Git & GitHub Actions', 'Linux (Ubuntu/RHEL)', 'Docker & Compose', 'Kubernetes Basics', 'AWS (EC2, S3, IAM)', 'Terraform & IaC', 'CI/CD Pipelines', 'Shell Scripting', 'PostgreSQL / SQL'].map((skill, idx) => (
                <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span>{skill}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Work Experience */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-400" /> Education & Certifications
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                <div className="flex justify-between font-semibold text-white text-xs">
                  <span>B.E. Computer Science & Engineering</span>
                  <span className="text-slate-400">2020 – 2024</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">First Class with Distinction • CGPA: 8.7/10</p>
              </div>
              <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                <div className="flex justify-between font-semibold text-white text-xs">
                  <span>AWS Certified Solutions Architect – Associate</span>
                  <span className="text-emerald-400">Active</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
};
